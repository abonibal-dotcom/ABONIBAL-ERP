import type { SyncAuthStateSource } from "../../sync/SyncContracts";
import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import type { SyncConflictRepository } from "../../sync/repositories/SyncConflictRepository";
import type { SyncReceiptRepository } from "../../sync/repositories/SyncReceiptRepository";
import type { ListenerCoordinator } from "../../sync/services/ListenerCoordinator";
import type { SyncEchoPolicy } from "../../sync/services/SyncEchoPolicy";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { InvoiceReturnLocalMutationApplier } from "./InvoiceReturnLocalMutationApplier";
import {
    invoiceReturnModulePath,
    invoiceReturnRecordPath,
    normalizeInvoiceReturnCloudEnvelope
} from "./InvoiceReturnSyncTypes";

export interface InvoiceReturnRealtimeReader {
    read<T>(path: string): Promise<T | null>;
    subscribe<T>(
        path: string,
        callback: (value: T | null) => void,
        onError?: (error: Error) => void
    ): () => void;
}

export interface InvoiceReturnPullResult {
    success: boolean;
    outcome: "applied" | "duplicate" | "ignored_older" | "conflict" | "missing";
    errors: string[];
}

export class InvoiceReturnSyncAdapter {
    private readonly reader: InvoiceReturnRealtimeReader;
    private readonly modeService: SyncModeService;
    private readonly authStateSource: SyncAuthStateSource;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly conflictRepository: SyncConflictRepository;
    private readonly receiptRepository: SyncReceiptRepository;
    private readonly listenerCoordinator: ListenerCoordinator;
    private readonly echoPolicy: SyncEchoPolicy;
    private readonly localApplier: InvoiceReturnLocalMutationApplier;

    public constructor(
        reader: InvoiceReturnRealtimeReader,
        modeService: SyncModeService,
        authStateSource: SyncAuthStateSource,
        outboxRepository: PersistentOutboxRepository,
        conflictRepository: SyncConflictRepository,
        receiptRepository: SyncReceiptRepository,
        listenerCoordinator: ListenerCoordinator,
        echoPolicy: SyncEchoPolicy,
        localApplier: InvoiceReturnLocalMutationApplier
    ) {
        this.reader = reader;
        this.modeService = modeService;
        this.authStateSource = authStateSource;
        this.outboxRepository = outboxRepository;
        this.conflictRepository = conflictRepository;
        this.receiptRepository = receiptRepository;
        this.listenerCoordinator = listenerCoordinator;
        this.echoPolicy = echoPolicy;
        this.localApplier = localApplier;
    }

    public async pullRecord(
        accountId: string,
        invoiceReturnId: string
    ): Promise<InvoiceReturnPullResult> {
        this.assertActiveAccount(accountId);
        const value = await this.reader.read<unknown>(
            invoiceReturnRecordPath(accountId, invoiceReturnId)
        );

        if (value === null) {
            return { success: true, outcome: "missing", errors: [] };
        }

        return this.applyPulledEnvelope(accountId, invoiceReturnId, value);
    }

    public startSubscription(accountId: string): void {
        this.assertActiveAccount(accountId);
        const key = `invoiceReturns:${accountId}`;
        const unsubscribe = this.reader.subscribe<Record<string, unknown>>(
            invoiceReturnModulePath(accountId),
            records => {
                if (!records || typeof records !== "object" || Array.isArray(records)) {
                    return;
                }

                for (const [invoiceReturnId, envelope] of Object.entries(records)) {
                    this.applyPulledEnvelope(
                        accountId,
                        invoiceReturnId,
                        envelope
                    );
                }
            }
        );

        this.listenerCoordinator.register(key, unsubscribe);
    }

    public applyPulledEnvelope(
        accountId: string,
        invoiceReturnId: string,
        value: unknown
    ): InvoiceReturnPullResult {
        this.assertActiveAccount(accountId);

        let envelope;

        try {
            envelope = normalizeInvoiceReturnCloudEnvelope(
                value,
                accountId,
                invoiceReturnId
            );
        } catch {
            return this.recordConflict(
                accountId,
                invoiceReturnId,
                undefined,
                "Remote InvoiceReturn envelope is invalid."
            );
        }

        if (this.outboxRepository.hasOpenOperationForRecord(
            accountId,
            "invoiceReturns",
            invoiceReturnId
        )) {
            return this.recordConflict(
                accountId,
                invoiceReturnId,
                envelope.meta.revision,
                "Remote InvoiceReturn pull is blocked by an unresolved local operation."
            );
        }

        const receipt = this.receiptRepository.findByOperationId(
            accountId,
            envelope.meta.lastOperationId
        );
        const shouldApply = this.echoPolicy.shouldApplyRemoteRecord(
            {
                operationId: envelope.meta.lastOperationId,
                revision: envelope.meta.revision
            },
            receipt
        );
        const result = this.localApplier.applyAuthoritativeEnvelope(
            accountId,
            invoiceReturnId,
            envelope
        );

        if (result.outcome === "conflict") {
            return this.recordConflict(
                accountId,
                invoiceReturnId,
                result.remoteRevision,
                result.summarySafe
                    ?? "Remote InvoiceReturn conflicts with local cache."
            );
        }

        return {
            success: true,
            outcome: shouldApply ? result.outcome : "duplicate",
            errors: []
        };
    }

    private recordConflict(
        accountId: string,
        invoiceReturnId: string,
        actualRevision: number | undefined,
        summarySafe: string
    ): InvoiceReturnPullResult {
        const identity = `invoiceReturns:${invoiceReturnId}:${actualRevision ?? "unknown"}`;

        this.conflictRepository.save({
            conflictId: `conflict-pull-${identity}`,
            accountId,
            operationId: `pull-${identity}`,
            module: "invoiceReturns",
            recordId: invoiceReturnId,
            ...(actualRevision !== undefined ? { actualRevision } : {}),
            detectedAt: new Date().toISOString(),
            summarySafe,
            status: "unresolved"
        });

        return {
            success: false,
            outcome: "conflict",
            errors: [summarySafe]
        };
    }

    private assertActiveAccount(accountId: string): void {
        const normalizedAccountId = accountId.trim();
        const state = this.authStateSource.getState();

        if (this.modeService.getMode() !== "active") {
            throw new Error("InvoiceReturn pull requires explicitly active sync mode.");
        }

        if (
            state.status !== "authenticated"
            || !normalizedAccountId
            || state.session.account.id.trim() !== normalizedAccountId
            || state.session.user.accountId.trim() !== normalizedAccountId
        ) {
            throw new Error(
                "InvoiceReturn pull requires one explicit matching accountId."
            );
        }
    }
}
