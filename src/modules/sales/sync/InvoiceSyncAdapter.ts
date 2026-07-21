import type { SyncAuthStateSource } from "../../sync/SyncContracts";
import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import type { SyncConflictRepository } from "../../sync/repositories/SyncConflictRepository";
import type { SyncReceiptRepository } from "../../sync/repositories/SyncReceiptRepository";
import type { ListenerCoordinator } from "../../sync/services/ListenerCoordinator";
import type { SyncEchoPolicy } from "../../sync/services/SyncEchoPolicy";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { InvoiceLocalMutationApplier } from "./InvoiceLocalMutationApplier";
import {
    invoiceModulePath,
    invoiceRecordPath,
    normalizeInvoiceCloudEnvelope
} from "./InvoiceSyncTypes";

export interface InvoiceRealtimeReader {
    read<T>(path: string): Promise<T | null>;
    subscribe<T>(
        path: string,
        callback: (value: T | null) => void,
        onError?: (error: Error) => void
    ): () => void;
}

export interface InvoicePullResult {
    success: boolean;
    outcome: "applied" | "duplicate" | "ignored_older" | "conflict" | "missing";
    errors: string[];
}

export class InvoiceSyncAdapter {
    private readonly reader: InvoiceRealtimeReader;
    private readonly modeService: SyncModeService;
    private readonly authStateSource: SyncAuthStateSource;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly conflictRepository: SyncConflictRepository;
    private readonly receiptRepository: SyncReceiptRepository;
    private readonly listenerCoordinator: ListenerCoordinator;
    private readonly echoPolicy: SyncEchoPolicy;
    private readonly localApplier: InvoiceLocalMutationApplier;

    public constructor(
        reader: InvoiceRealtimeReader,
        modeService: SyncModeService,
        authStateSource: SyncAuthStateSource,
        outboxRepository: PersistentOutboxRepository,
        conflictRepository: SyncConflictRepository,
        receiptRepository: SyncReceiptRepository,
        listenerCoordinator: ListenerCoordinator,
        echoPolicy: SyncEchoPolicy,
        localApplier: InvoiceLocalMutationApplier
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
        invoiceId: string
    ): Promise<InvoicePullResult> {
        this.assertActiveAccount(accountId);
        const value = await this.reader.read<unknown>(
            invoiceRecordPath(accountId, invoiceId)
        );

        if (value === null) {
            return { success: true, outcome: "missing", errors: [] };
        }

        return this.applyPulledEnvelope(accountId, invoiceId, value);
    }

    public startSubscription(accountId: string): void {
        this.assertActiveAccount(accountId);
        const key = `invoices:${accountId}`;
        const unsubscribe = this.reader.subscribe<Record<string, unknown>>(
            invoiceModulePath(accountId),
            records => {
                if (!records || typeof records !== "object" || Array.isArray(records)) {
                    return;
                }

                for (const [invoiceId, envelope] of Object.entries(records)) {
                    this.applyPulledEnvelope(accountId, invoiceId, envelope);
                }
            }
        );

        this.listenerCoordinator.register(key, unsubscribe);
    }

    public applyPulledEnvelope(
        accountId: string,
        invoiceId: string,
        value: unknown
    ): InvoicePullResult {
        this.assertActiveAccount(accountId);

        let envelope;

        try {
            envelope = normalizeInvoiceCloudEnvelope(
                value,
                accountId,
                invoiceId
            );
        } catch {
            return this.recordConflict(
                accountId,
                invoiceId,
                undefined,
                "Remote Invoice envelope is invalid."
            );
        }

        if (this.outboxRepository.hasOpenOperationForRecord(
            accountId,
            "invoices",
            invoiceId
        )) {
            return this.recordConflict(
                accountId,
                invoiceId,
                envelope.meta.revision,
                envelope.meta.tombstone
                    ? "Remote Invoice tombstone conflicts with an unresolved local operation."
                    : "Remote Invoice pull is blocked by an unresolved local operation."
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
            invoiceId,
            envelope
        );

        if (result.outcome === "conflict") {
            return this.recordConflict(
                accountId,
                invoiceId,
                result.remoteRevision,
                result.summarySafe ?? "Remote Invoice conflicts with local cache."
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
        invoiceId: string,
        actualRevision: number | undefined,
        summarySafe: string
    ): InvoicePullResult {
        const identity = `invoices:${invoiceId}:${actualRevision ?? "unknown"}`;

        this.conflictRepository.save({
            conflictId: `conflict-pull-${identity}`,
            accountId,
            operationId: `pull-${identity}`,
            module: "invoices",
            recordId: invoiceId,
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
            throw new Error("Invoice pull requires explicitly active sync mode.");
        }

        if (
            state.status !== "authenticated"
            || !normalizedAccountId
            || state.session.account.id.trim() !== normalizedAccountId
            || state.session.user.accountId.trim() !== normalizedAccountId
        ) {
            throw new Error("Invoice pull requires one explicit matching accountId.");
        }
    }
}
