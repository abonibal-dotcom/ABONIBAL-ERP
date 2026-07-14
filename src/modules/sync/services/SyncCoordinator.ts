import type {
    SyncAuthStateSource,
    SyncExecutionConflict,
    SyncOperationTransport
} from "../SyncContracts";
import { SyncTransportError } from "../SyncContracts";
import type { SyncConnectivity } from "../SyncStatus";
import type { SyncOperation } from "../SyncOperation";
import type { PersistentOutboxRepository } from "../repositories/PersistentOutboxRepository";
import type { SyncConflictRepository } from "../repositories/SyncConflictRepository";
import type { SyncReceiptRepository } from "../repositories/SyncReceiptRepository";
import type { ListenerCoordinator } from "./ListenerCoordinator";
import type { LocalMutationReconciler } from "./LocalMutationReconciler";
import type { RetryPolicy } from "./RetryPolicy";
import type { SyncModeService } from "./SyncModeService";
import type { SyncStatusService } from "./SyncStatusService";

export type SyncClock = () => string;

export class SyncCoordinator {
    private readonly modeService: SyncModeService;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly receiptRepository: SyncReceiptRepository;
    private readonly conflictRepository: SyncConflictRepository;
    private readonly retryPolicy: RetryPolicy;
    private readonly listenerCoordinator: ListenerCoordinator;
    private readonly statusService: SyncStatusService;
    private readonly transport: SyncOperationTransport;
    private readonly authStateSource: SyncAuthStateSource;
    private readonly clock: SyncClock;
    private readonly unsubscribeAuth: () => void;
    private readonly unsubscribeMode: () => void;

    private localMutationReconciler: LocalMutationReconciler | null = null;

    private currentAccountId: string | null = null;
    private paused = false;
    private disposed = false;

    public constructor(
        modeService: SyncModeService,
        outboxRepository: PersistentOutboxRepository,
        receiptRepository: SyncReceiptRepository,
        conflictRepository: SyncConflictRepository,
        retryPolicy: RetryPolicy,
        listenerCoordinator: ListenerCoordinator,
        statusService: SyncStatusService,
        transport: SyncOperationTransport,
        authStateSource: SyncAuthStateSource,
        clock: SyncClock = () => new Date().toISOString()
    ) {
        this.modeService = modeService;
        this.outboxRepository = outboxRepository;
        this.receiptRepository = receiptRepository;
        this.conflictRepository = conflictRepository;
        this.retryPolicy = retryPolicy;
        this.listenerCoordinator = listenerCoordinator;
        this.statusService = statusService;
        this.transport = transport;
        this.authStateSource = authStateSource;
        this.clock = clock;

        this.statusService.update({
            mode: this.modeService.getMode(),
            state: "disabled"
        });
        this.unsubscribeAuth = this.authStateSource.subscribe(state => {
            this.handleAuthStateChange(state);
        });
        this.unsubscribeMode = this.modeService.subscribe(mode => {
            this.handleModeChange(mode);
        });
    }

    public start(): void {
        this.ensureNotDisposed();

        const accountId = this.resolveExplicitAccountId();

        if (this.currentAccountId && this.currentAccountId !== accountId) {
            this.listenerCoordinator.unsubscribeAll();
        }

        this.currentAccountId = accountId;
        this.paused = false;
        this.recoverAcknowledgedEntries(accountId);
        this.outboxRepository.recoverInterruptedSyncingEntries(
            accountId,
            this.clock()
        );
        this.localMutationReconciler?.start(accountId);
        this.localMutationReconciler?.reconcilePending(accountId);
        this.refreshCounts();
        this.updateReadyState();
    }

    public configureLocalMutationReconciler(
        reconciler: LocalMutationReconciler
    ): void {
        this.ensureNotDisposed();

        if (this.localMutationReconciler) {
            throw new Error("Local mutation reconciler is already configured.");
        }

        this.localMutationReconciler = reconciler;
    }

    public stop(): void {
        this.listenerCoordinator.unsubscribeAll();
        this.localMutationReconciler?.stop();
        this.currentAccountId = null;
        this.paused = false;
        this.statusService.update({
            state: "stopped",
            accountResolved: false,
            pendingCount: 0,
            conflictCount: 0,
            failedCount: 0,
            pendingLocalApplyCount: 0,
            localApplyConflictCount: 0,
            localApplyFailedCount: 0
        });
    }

    public pause(messageSafe?: string): void {
        this.paused = true;
        this.listenerCoordinator.unsubscribeAll();
        this.statusService.update({
            state: "paused",
            ...(messageSafe ? { lastErrorSafe: messageSafe } : {})
        });
    }

    public resume(): void {
        this.ensureNotDisposed();

        if (!this.currentAccountId) {
            this.start();
            return;
        }

        this.paused = false;
        this.updateReadyState();
    }

    public setConnectivity(connectivity: SyncConnectivity): void {
        this.statusService.update({ connectivity });

        if (connectivity === "offline") {
            this.listenerCoordinator.unsubscribeAll();
            this.statusService.update({ state: "offline" });
            return;
        }

        if (connectivity === "online" && this.currentAccountId) {
            this.updateReadyState();
        }
    }

    public async processNext(): Promise<boolean> {
        this.ensureNotDisposed();

        if (!this.canProcess()) {
            return false;
        }

        const accountId = this.currentAccountId as string;
        const now = this.clock();
        const operation = this.outboxRepository.getPending(accountId, now)[0];

        if (!operation) {
            this.refreshCounts();
            this.updateReadyState();
            return false;
        }

        const syncingOperation = this.outboxRepository.markSyncing(
            accountId,
            operation.operationId,
            now
        );

        this.statusService.update({ state: "syncing" });

        const existingReceipt = this.receiptRepository.findByOperationId(
            accountId,
            syncingOperation.operationId
        );

        if (existingReceipt) {
            this.finalizeAcknowledgement(
                accountId,
                syncingOperation.operationId,
                existingReceipt.acknowledgedAt
            );
            return true;
        }

        try {
            const result = await this.transport.execute(syncingOperation);
            const completedAt = this.clock();

            if (result.kind === "conflict") {
                this.recordConflict(accountId, syncingOperation, result, completedAt);
                return true;
            }

            this.receiptRepository.save({
                operationId: syncingOperation.operationId,
                accountId,
                module: syncingOperation.module,
                recordId: syncingOperation.recordId,
                idempotencyKey: syncingOperation.idempotencyKey,
                result: result.result,
                acknowledgedAt: completedAt,
                ...(result.cloudRevision !== undefined
                    ? { cloudRevision: result.cloudRevision }
                    : {}),
                ...(result.cloudChecksum
                    ? { cloudChecksum: result.cloudChecksum }
                    : {})
            });

            if (!this.receiptRepository.findByOperationId(
                accountId,
                syncingOperation.operationId
            )) {
                throw new Error("Sync receipt was not persisted before outbox removal.");
            }

            this.finalizeAcknowledgement(
                accountId,
                syncingOperation.operationId,
                completedAt
            );

            return true;
        } catch (error) {
            const persistedReceipt = this.receiptRepository.findByOperationId(
                accountId,
                syncingOperation.operationId
            );

            if (persistedReceipt) {
                try {
                    this.finalizeAcknowledgement(
                        accountId,
                        syncingOperation.operationId,
                        persistedReceipt.acknowledgedAt
                    );
                } catch {
                    this.refreshCounts();
                    this.statusService.update({
                        state: "error",
                        lastErrorSafe: "Acknowledged sync cleanup requires restart recovery."
                    });
                }

                return true;
            }

            this.handleFailure(accountId, syncingOperation, error);
            return true;
        }
    }

    public async processPending(maxOperations = 100): Promise<number> {
        if (!Number.isInteger(maxOperations) || maxOperations < 1) {
            throw new Error("Sync maxOperations must be a positive integer.");
        }

        let processed = 0;

        while (processed < maxOperations && await this.processNext()) {
            processed += 1;

            if (this.paused) {
                break;
            }
        }

        return processed;
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.stop();
        this.unsubscribeAuth();
        this.unsubscribeMode();
        this.disposed = true;
    }

    private canProcess(): boolean {
        if (
            !this.currentAccountId
            || this.paused
            || this.modeService.getMode() === "disabled"
        ) {
            if (this.modeService.getMode() === "disabled") {
                this.statusService.update({ state: "disabled" });
            }

            return false;
        }

        if (this.statusService.getStatus().connectivity === "offline") {
            this.statusService.update({ state: "offline" });
            return false;
        }

        return true;
    }

    private handleFailure(
        accountId: string,
        operation: SyncOperation,
        error: unknown
    ): void {
        const descriptor = normalizeSyncFailure(error);
        const now = this.clock();
        const decision = this.retryPolicy.decide(operation, descriptor.code, now);

        if (decision.classification === "conflict") {
            this.recordConflict(
                accountId,
                operation,
                {
                    kind: "conflict",
                    summarySafe: descriptor.messageSafe
                },
                now
            );
            return;
        }

        if (decision.classification === "blocked") {
            this.outboxRepository.markFailed(
                accountId,
                operation.operationId,
                descriptor.code,
                descriptor.messageSafe
            );
            this.refreshCounts();
            this.pause(descriptor.messageSafe);
            return;
        }

        if (decision.shouldRetry && decision.nextAttemptAt) {
            this.outboxRepository.scheduleRetry(
                accountId,
                operation.operationId,
                decision.nextAttemptAt,
                descriptor.code,
                descriptor.messageSafe
            );
            this.refreshCounts();
            this.statusService.update({
                state: "idle",
                lastErrorSafe: descriptor.messageSafe
            });
            return;
        }

        this.outboxRepository.markFailed(
            accountId,
            operation.operationId,
            descriptor.code,
            descriptor.messageSafe
        );
        this.refreshCounts();
        this.statusService.update({
            state: "error",
            lastErrorSafe: descriptor.messageSafe
        });
    }

    private recordConflict(
        accountId: string,
        operation: SyncOperation,
        conflict: SyncExecutionConflict,
        detectedAt: string
    ): void {
        this.outboxRepository.markConflict(
            accountId,
            operation.operationId,
            "revision_conflict",
            conflict.summarySafe
        );
        this.conflictRepository.save({
            conflictId: `${operation.operationId}:conflict`,
            accountId,
            operationId: operation.operationId,
            module: operation.module,
            recordId: operation.recordId,
            ...(operation.expectedRevision !== undefined
                ? { expectedRevision: operation.expectedRevision }
                : {}),
            ...(conflict.actualRevision !== undefined
                ? { actualRevision: conflict.actualRevision }
                : {}),
            detectedAt,
            summarySafe: conflict.summarySafe,
            status: "unresolved"
        });
        this.refreshCounts();
        this.statusService.update({
            state: "conflict",
            lastErrorSafe: conflict.summarySafe
        });
    }

    private recoverAcknowledgedEntries(accountId: string): void {
        const acknowledgedOperations = this.outboxRepository
            .allForAccount(accountId)
            .filter(operation => operation.status === "acknowledged");

        for (const operation of acknowledgedOperations) {
            if (this.receiptRepository.findByOperationId(
                accountId,
                operation.operationId
            )) {
                this.outboxRepository.removeAcknowledged(
                    accountId,
                    operation.operationId
                );
            }
        }
    }

    private finalizeAcknowledgement(
        accountId: string,
        operationId: string,
        acknowledgedAt: string
    ): void {
        const current = this.outboxRepository.findByOperationId(
            accountId,
            operationId
        );

        if (current?.status === "syncing") {
            this.outboxRepository.markAcknowledged(accountId, operationId);
        }

        const acknowledged = this.outboxRepository.findByOperationId(
            accountId,
            operationId
        );

        if (acknowledged?.status === "acknowledged") {
            this.outboxRepository.removeAcknowledged(accountId, operationId);
        } else if (acknowledged) {
            throw new Error("Receipt exists for an operation in an invalid state.");
        }

        this.refreshCounts();
        this.statusService.update({
            state: "idle",
            lastSuccessfulSyncAt: acknowledgedAt,
            lastErrorSafe: undefined
        });
    }

    private handleAuthStateChange(state: ReturnType<SyncAuthStateSource["getState"]>): void {
        if (state.status !== "authenticated") {
            if (this.currentAccountId) {
                this.stop();
            }
            return;
        }

        const resolvedAccountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();

        if (
            this.currentAccountId
            && (
                !resolvedAccountId
                || resolvedAccountId !== userAccountId
                || this.currentAccountId !== resolvedAccountId
            )
        ) {
            this.stop();
        }
    }

    private handleModeChange(mode: "disabled" | "migration" | "active"): void {
        this.statusService.update({ mode });

        if (mode === "disabled") {
            this.listenerCoordinator.unsubscribeAll();
            this.statusService.update({ state: "disabled" });
            return;
        }

        if (this.currentAccountId && !this.paused) {
            this.updateReadyState();
        }
    }

    private resolveExplicitAccountId(): string {
        const state = this.authStateSource.getState();

        if (state.status !== "authenticated") {
            throw new Error("Sync requires an authenticated account session.");
        }

        const accountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();

        if (!accountId || accountId !== userAccountId) {
            throw new Error("Sync requires one explicit, matching logical accountId.");
        }

        return accountId;
    }

    private refreshCounts(): void {
        if (!this.currentAccountId) {
            return;
        }

        const accountId = this.currentAccountId;

        this.statusService.update({
            pendingCount: this.outboxRepository.countByStatus(accountId, "pending"),
            conflictCount: this.outboxRepository.countByStatus(accountId, "conflict"),
            failedCount: this.outboxRepository.countByStatus(accountId, "failed"),
            pendingLocalApplyCount: this.outboxRepository.countByLocalApplyState(
                accountId,
                "pending"
            ),
            localApplyConflictCount: this.outboxRepository.countByLocalApplyState(
                accountId,
                "conflict"
            ),
            localApplyFailedCount: this.outboxRepository.countByLocalApplyState(
                accountId,
                "failed"
            ),
            accountResolved: true
        });
    }

    private updateReadyState(): void {
        const status = this.statusService.getStatus();

        if (this.modeService.getMode() === "disabled") {
            this.statusService.update({ state: "disabled" });
            return;
        }

        if (this.paused) {
            this.statusService.update({ state: "paused" });
            return;
        }

        if (status.connectivity === "offline") {
            this.statusService.update({ state: "offline" });
            return;
        }

        if (status.localApplyConflictCount > 0) {
            this.statusService.update({ state: "conflict" });
            return;
        }

        if (status.localApplyFailedCount > 0) {
            this.statusService.update({ state: "error" });
            return;
        }

        this.statusService.update({ state: "idle" });
    }

    private ensureNotDisposed(): void {
        if (this.disposed) {
            throw new Error("SyncCoordinator has been disposed.");
        }
    }
}

interface NormalizedFailure {
    code: string;
    messageSafe: string;
}

function normalizeSyncFailure(error: unknown): NormalizedFailure {
    if (error instanceof SyncTransportError) {
        return {
            code: error.code,
            messageSafe: error.message
        };
    }

    if (error && typeof error === "object") {
        const code = (error as { code?: unknown }).code;

        if (typeof code === "string" && code.trim()) {
            return {
                code: code.trim(),
                messageSafe: "Sync transport operation failed."
            };
        }
    }

    return {
        code: "sync_unknown_error",
        messageSafe: "Sync operation failed."
    };
}
