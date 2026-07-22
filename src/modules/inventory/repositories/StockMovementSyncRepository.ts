import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import { createPendingSyncOperation } from "../../sync/SyncOperation";
import type { DurableMutationCapture } from "../../sync/services/DurableMutationCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { StockMovement } from "../StockMovement";
import {
    type StockMovementRepository,
    type StockMovementRepositoryPort
} from "./StockMovementRepository";
import type { StockMovementLocalMutationApplier } from "../sync/StockMovementLocalMutationApplier";
import { buildStockMovementAppendOperation } from "../sync/StockMovementSyncOperation";

export class StockMovementSyncMutationError extends Error {
    public readonly messageSafe: string;

    public constructor(messageSafe: string) {
        super(messageSafe);
        this.name = "StockMovementSyncMutationError";
        this.messageSafe = messageSafe;
    }
}

export type StockMovementSyncClock = () => string;

export class StockMovementSyncRepository implements StockMovementRepositoryPort {
    private readonly cacheRepository: StockMovementRepository;
    private readonly modeService: SyncModeService;
    private readonly capture: DurableMutationCapture;
    private readonly localApplier: StockMovementLocalMutationApplier;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly clock: StockMovementSyncClock;

    public constructor(
        cacheRepository: StockMovementRepository,
        modeService: SyncModeService,
        capture: DurableMutationCapture,
        localApplier: StockMovementLocalMutationApplier,
        outboxRepository: PersistentOutboxRepository,
        clock: StockMovementSyncClock = () => new Date().toISOString()
    ) {
        this.cacheRepository = cacheRepository;
        this.modeService = modeService;
        this.capture = capture;
        this.localApplier = localApplier;
        this.outboxRepository = outboxRepository;
        this.clock = clock;
    }

    public allForAccount(accountId: string): StockMovement[] {
        return this.cacheRepository.allForAccount(accountId);
    }

    public appendForAccount(
        accountId: string,
        movement: StockMovement
    ): StockMovement {
        if (movement.accountId !== accountId) {
            throw new StockMovementSyncMutationError(
                "Stock movement account mismatch."
            );
        }

        if (this.modeService.getMode() !== "active") {
            return this.cacheRepository.appendForAccount(accountId, movement);
        }

        const operation = buildStockMovementAppendOperation(
            movement,
            this.clock()
        );
        const pending = this.outboxRepository.findByOperationId(
            accountId,
            operation.operationId
        );
        const inspection = this.localApplier.inspect(
            createPendingSyncOperation(operation)
        );

        if (inspection.state === "conflict") {
            throw new StockMovementSyncMutationError(
                inspection.summarySafe
                    ?? "Stock movement identity conflicts with local cache."
            );
        }

        // A pre-existing cache record with no durable operation is historical or
        // remotely pulled data. Active mode must not silently backfill it.
        if (inspection.state === "already_applied" && !pending) {
            return this.cacheRepository.findForAccount(accountId, movement.id)!;
        }

        const result = this.capture.capture({
            accountId,
            operation,
            localApplier: this.localApplier
        });

        if (!result.success) {
            throw new StockMovementSyncMutationError(
                result.errors[0] ?? "Stock movement mutation capture failed."
            );
        }

        const stored = this.cacheRepository.findForAccount(
            accountId,
            movement.id
        );

        if (!stored) {
            throw new StockMovementSyncMutationError(
                "Captured stock movement is missing from local cache."
            );
        }

        return stored;
    }

    public findForAccount(
        accountId: string,
        movementId: string
    ): StockMovement | undefined {
        return this.cacheRepository.findForAccount(accountId, movementId);
    }

    public allForProduct(
        accountId: string,
        productId: string
    ): StockMovement[] {
        return this.cacheRepository.allForProduct(accountId, productId);
    }

    public reversalsForAccount(
        accountId: string,
        originalMovementId: string
    ): StockMovement[] {
        return this.cacheRepository.reversalsForAccount(
            accountId,
            originalMovementId
        );
    }
}
