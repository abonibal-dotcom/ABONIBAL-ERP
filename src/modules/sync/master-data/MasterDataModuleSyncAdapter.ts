import type { SyncAuthStateSource } from "../SyncContracts";
import type { PersistentOutboxRepository } from "../repositories/PersistentOutboxRepository";
import type { SyncConflictRepository } from "../repositories/SyncConflictRepository";
import type { SyncReceiptRepository } from "../repositories/SyncReceiptRepository";
import type { ListenerCoordinator } from "../services/ListenerCoordinator";
import type { SyncEchoPolicy } from "../services/SyncEchoPolicy";
import type { SyncModeService } from "../services/SyncModeService";
import type { MasterDataLocalMutationApplier } from "./MasterDataLocalMutationApplier";
import {
    masterDataModulePath,
    masterDataRecordPath,
    normalizeMasterDataEnvelope,
    type MasterDataCloudEnvelope,
    type MasterDataRecordCodec
} from "./MasterDataSyncTypes";

export interface MasterDataRealtimeReader {
    read<T>(path: string): Promise<T | null>;
    subscribe<T>(
        path: string,
        callback: (value: T | null) => void,
        onError?: (error: Error) => void
    ): () => void;
}

export interface MasterDataPullResult {
    success: boolean;
    outcome: "applied" | "duplicate" | "ignored_older" | "conflict" | "missing";
    errors: string[];
}

export class MasterDataModuleSyncAdapter<T extends object> {
    private readonly reader: MasterDataRealtimeReader;
    private readonly modeService: SyncModeService;
    private readonly authStateSource: SyncAuthStateSource;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly conflictRepository: SyncConflictRepository;
    private readonly receiptRepository: SyncReceiptRepository;
    private readonly listenerCoordinator: ListenerCoordinator;
    private readonly echoPolicy: SyncEchoPolicy;
    private readonly localApplier: MasterDataLocalMutationApplier<T>;
    private readonly codec: MasterDataRecordCodec<T>;

    public constructor(
        reader: MasterDataRealtimeReader,
        modeService: SyncModeService,
        authStateSource: SyncAuthStateSource,
        outboxRepository: PersistentOutboxRepository,
        conflictRepository: SyncConflictRepository,
        receiptRepository: SyncReceiptRepository,
        listenerCoordinator: ListenerCoordinator,
        echoPolicy: SyncEchoPolicy,
        localApplier: MasterDataLocalMutationApplier<T>,
        codec: MasterDataRecordCodec<T>
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
        this.codec = codec;
    }

    public async pullRecord(
        accountId: string,
        recordId: string
    ): Promise<MasterDataPullResult> {
        this.assertActiveAccount(accountId);

        const value = await this.reader.read<unknown>(
            masterDataRecordPath(accountId, this.codec.module, recordId)
        );

        if (value === null) {
            return { success: true, outcome: "missing", errors: [] };
        }

        return this.applyPulledEnvelope(accountId, recordId, value);
    }

    public startSubscription(accountId: string): void {
        this.assertActiveAccount(accountId);

        const key = `master-data:${accountId}:${this.codec.module}`;
        const unsubscribe = this.reader.subscribe<Record<string, unknown>>(
            masterDataModulePath(accountId, this.codec.module),
            records => {
                if (!records || typeof records !== "object" || Array.isArray(records)) {
                    return;
                }

                for (const [recordId, envelope] of Object.entries(records)) {
                    this.applyPulledEnvelope(accountId, recordId, envelope);
                }
            }
        );

        this.listenerCoordinator.register(key, unsubscribe);
    }

    public applyPulledEnvelope(
        accountId: string,
        recordId: string,
        value: unknown
    ): MasterDataPullResult {
        this.assertActiveAccount(accountId);

        let envelope: MasterDataCloudEnvelope;

        try {
            envelope = normalizeMasterDataEnvelope(value);
        } catch {
            return this.recordConflict(
                accountId,
                recordId,
                undefined,
                "Remote master-data envelope is invalid."
            );
        }

        if (this.outboxRepository.hasOpenOperationForRecord(
            accountId,
            this.codec.module,
            recordId
        )) {
            return this.recordConflict(
                accountId,
                recordId,
                envelope.meta.revision,
                "Remote pull is blocked by an unresolved local operation."
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

        if (!shouldApply) {
            const duplicate = this.localApplier.applyAuthoritativeEnvelope(
                accountId,
                recordId,
                envelope
            );

            return duplicate.outcome === "conflict"
                ? this.recordConflict(
                    accountId,
                    recordId,
                    envelope.meta.revision,
                    duplicate.summarySafe ?? "Remote echo conflicts with local cache."
                )
                : { success: true, outcome: "duplicate", errors: [] };
        }

        const result = this.localApplier.applyAuthoritativeEnvelope(
            accountId,
            recordId,
            envelope
        );

        if (result.outcome === "conflict") {
            return this.recordConflict(
                accountId,
                recordId,
                result.remoteRevision,
                result.summarySafe ?? "Remote master-data state conflicts with local cache."
            );
        }

        return {
            success: true,
            outcome: result.outcome,
            errors: []
        };
    }

    private recordConflict(
        accountId: string,
        recordId: string,
        actualRevision: number | undefined,
        summarySafe: string
    ): MasterDataPullResult {
        const identity = `${this.codec.module}:${recordId}:${actualRevision ?? "unknown"}`;
        const operationId = `pull-${identity}`;

        this.conflictRepository.save({
            conflictId: `conflict-${identity}`,
            accountId,
            operationId,
            module: this.codec.module,
            recordId,
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
            throw new Error("Master-data pull requires explicitly active sync mode.");
        }

        if (
            state.status !== "authenticated"
            || !normalizedAccountId
            || state.session.account.id.trim() !== normalizedAccountId
            || state.session.user.accountId.trim() !== normalizedAccountId
        ) {
            throw new Error("Master-data pull requires one explicit matching accountId.");
        }
    }
}
