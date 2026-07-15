import type { SyncOperation } from "../../sync/SyncOperation";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../../sync/services/LocalMutationApplier";
import type { StockMovementRepository } from "../repositories/StockMovementRepository";
import type { StockMovementValidator } from "../validators/StockMovementValidator";
import { readOpeningStockMovementAppendPayload } from "./StockMovementSyncOperation";

export class StockMovementLocalMutationApplier
implements LocalMutationApplier {
    public readonly module = "stockMovements" as const;

    private readonly repository: StockMovementRepository;
    private readonly validator: StockMovementValidator;

    public constructor(
        repository: StockMovementRepository,
        validator: StockMovementValidator
    ) {
        this.repository = repository;
        this.validator = validator;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const intended = readOpeningStockMovementAppendPayload(operation);
        const current = this.repository.findForAccount(
            operation.accountId,
            operation.recordId
        );

        if (!current) {
            return { state: "not_applied" };
        }

        return jsonValuesMatch(
            toJsonObject(current),
            toJsonObject(intended)
        )
            ? { state: "already_applied" }
            : {
                state: "conflict",
                summarySafe: "Opening stock movement identity has divergent local data."
            };
    }

    public apply(operation: SyncOperation): void {
        const intended = readOpeningStockMovementAppendPayload(operation);
        const errors = this.validator.validate(intended);

        if (errors.length > 0) {
            throw new Error("Opening stock movement payload failed validation.");
        }

        this.repository.appendForAccount(operation.accountId, intended);
    }
}
