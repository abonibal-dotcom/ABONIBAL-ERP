import type { SyncAuthStateSource } from "../../sync/SyncContracts";
import { createPendingSyncOperation } from "../../sync/SyncOperation";
import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import type { SyncConflictRepository } from "../../sync/repositories/SyncConflictRepository";
import type { ListenerCoordinator } from "../../sync/services/ListenerCoordinator";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { StockMovement } from "../StockMovement";
import type { StockMovementLocalMutationApplier } from "./StockMovementLocalMutationApplier";
import { buildStockMovementAppendOperation } from "./StockMovementSyncOperation";
import {
    normalizeStockMovementCloudEnvelope,
    stockMovementModulePath,
    stockMovementRecordPath
} from "./StockMovementSyncTypes";

export interface StockMovementRealtimeReader {
    read<T>(path: string): Promise<T | null>;
    subscribe<T>(
        path: string,
        callback: (value: T | null) => void,
        onError?: (error: Error) => void
    ): () => void;
}

export interface StockMovementPullResult {
    success: boolean;
    outcome: "applied" | "duplicate" | "conflict" | "missing";
    errors: string[];
}

export class StockMovementSyncAdapter {
    private readonly reader: StockMovementRealtimeReader;
    private readonly modeService: SyncModeService;
    private readonly authStateSource: SyncAuthStateSource;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly conflictRepository: SyncConflictRepository;
    private readonly listenerCoordinator: ListenerCoordinator;
    private readonly localApplier: StockMovementLocalMutationApplier;

    public constructor(
        reader: StockMovementRealtimeReader,
        modeService: SyncModeService,
        authStateSource: SyncAuthStateSource,
        outboxRepository: PersistentOutboxRepository,
        conflictRepository: SyncConflictRepository,
        listenerCoordinator: ListenerCoordinator,
        localApplier: StockMovementLocalMutationApplier
    ) {
        this.reader = reader;
        this.modeService = modeService;
        this.authStateSource = authStateSource;
        this.outboxRepository = outboxRepository;
        this.conflictRepository = conflictRepository;
        this.listenerCoordinator = listenerCoordinator;
        this.localApplier = localApplier;
    }

    public async pullRecord(
        accountId: string,
        movementId: string
    ): Promise<StockMovementPullResult> {
        this.assertActiveAccount(accountId);

        const value = await this.reader.read<unknown>(
            stockMovementRecordPath(accountId, movementId)
        );

        if (value === null) {
            return { success: true, outcome: "missing", errors: [] };
        }

        return this.applyPulledEnvelope(accountId, movementId, value);
    }

    public startSubscription(accountId: string): void {
        this.assertActiveAccount(accountId);

        const key = `stock-movements:${accountId}`;
        const unsubscribe = this.reader.subscribe<Record<string, unknown>>(
            stockMovementModulePath(accountId),
            records => {
                if (!records || typeof records !== "object" || Array.isArray(records)) {
                    return;
                }

                for (const [movementId, envelope] of Object.entries(records)) {
                    this.applyPulledEnvelope(accountId, movementId, envelope);
                }
            }
        );

        this.listenerCoordinator.register(key, unsubscribe);
    }

    public applyPulledEnvelope(
        accountId: string,
        movementId: string,
        value: unknown
    ): StockMovementPullResult {
        this.assertActiveAccount(accountId);

        try {
            const envelope = normalizeStockMovementCloudEnvelope(
                value,
                accountId,
                movementId
            );
            const movement = envelope.data as unknown as StockMovement;
            const operation = createPendingSyncOperation(
                buildStockMovementAppendOperation(
                    movement,
                    movement.createdAt
                )
            );
            const inspection = this.localApplier.inspect(operation);

            if (inspection.state === "already_applied") {
                return { success: true, outcome: "duplicate", errors: [] };
            }

            if (inspection.state === "conflict") {
                return this.recordConflict(
                    accountId,
                    movementId,
                    inspection.summarySafe
                        ?? "Remote StockMovement conflicts with local cache."
                );
            }

            if (this.outboxRepository.hasOpenOperationForRecord(
                accountId,
                "stockMovements",
                movementId
            )) {
                return this.recordConflict(
                    accountId,
                    movementId,
                    "Remote StockMovement is blocked by an unresolved local append."
                );
            }

            this.localApplier.apply(operation);

            return this.localApplier.inspect(operation).state === "already_applied"
                ? { success: true, outcome: "applied", errors: [] }
                : this.recordConflict(
                    accountId,
                    movementId,
                    "Remote StockMovement cache apply could not be verified."
                );
        } catch {
            return this.recordConflict(
                accountId,
                movementId,
                "Remote StockMovement envelope is invalid."
            );
        }
    }

    private recordConflict(
        accountId: string,
        movementId: string,
        summarySafe: string
    ): StockMovementPullResult {
        const operationId = `pull-stockMovements-${movementId}`;

        this.conflictRepository.save({
            conflictId: `conflict-stockMovements-${movementId}`,
            accountId,
            operationId,
            module: "stockMovements",
            recordId: movementId,
            actualRevision: 1,
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
            throw new Error("StockMovement pull requires explicitly active sync mode.");
        }

        if (
            state.status !== "authenticated"
            || !normalizedAccountId
            || state.session.account.id.trim() !== normalizedAccountId
            || state.session.user.accountId.trim() !== normalizedAccountId
        ) {
            throw new Error("StockMovement pull requires one explicit matching accountId.");
        }
    }
}
