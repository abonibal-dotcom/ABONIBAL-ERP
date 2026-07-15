import type {
    SyncOperation,
    SyncOperationInput
} from "../../sync/SyncOperation";
import {
    canonicalChecksum,
    sha256Hex,
    toJsonObject,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import {
    buildProductOpeningStockMovementIdentity,
    type StockMovement
} from "../StockMovement";

export interface StockMovementAppendPayload {
    intended: JsonObject;
}

export function buildOpeningStockMovementAppendOperation(
    movement: StockMovement,
    createdAt: string
): SyncOperationInput {
    const identity = buildProductOpeningStockMovementIdentity(
        movement.productId
    );

    if (!identity || movement.id !== identity.movementId) {
        throw new Error("Opening stock movement identity is invalid.");
    }

    const intended = toJsonObject(movement);
    const writeSetChecksum = canonicalChecksum(intended);
    const operationId = `stockMovements-${sha256Hex(
        `${identity.idempotencyKey}:${writeSetChecksum}`
    ).slice(0, 32)}`;

    return {
        operationId,
        accountId: movement.accountId,
        module: "stockMovements",
        recordId: movement.id,
        operationType: "append",
        idempotencyKey: identity.idempotencyKey,
        writeSetChecksum,
        safePayload: { intended } satisfies StockMovementAppendPayload,
        createdAt
    };
}

export function readOpeningStockMovementAppendPayload(
    operation: SyncOperation
): StockMovement {
    if (
        operation.module !== "stockMovements"
        || operation.operationType !== "append"
        || !operation.safePayload
        || typeof operation.safePayload !== "object"
    ) {
        throw new Error("Stock movement append operation is invalid.");
    }

    const payload = operation.safePayload as Partial<StockMovementAppendPayload>;
    const intended = toJsonObject(payload.intended);
    const movement = intended as unknown as StockMovement;
    const expected = buildOpeningStockMovementAppendOperation(
        movement,
        operation.createdAt
    );

    if (
        movement.accountId !== operation.accountId
        || movement.id !== operation.recordId
        || expected.operationId !== operation.operationId
        || expected.idempotencyKey !== operation.idempotencyKey
        || expected.writeSetChecksum !== operation.writeSetChecksum
    ) {
        throw new Error("Stock movement append identity conflicts with its payload.");
    }

    return movement;
}
