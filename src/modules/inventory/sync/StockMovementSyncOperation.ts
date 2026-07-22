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

export function buildStockMovementAppendOperation(
    movement: StockMovement,
    createdAt: string
): SyncOperationInput {
    const intended = toJsonObject(movement);
    const writeSetChecksum = canonicalChecksum(intended);
    const idempotencyKey = stockMovementIdempotencyKey(movement);
    const operationId = `stockMovements-${sha256Hex(
        `${idempotencyKey}:${writeSetChecksum}`
    ).slice(0, 32)}`;

    return {
        operationId,
        accountId: requireText(movement.accountId, "accountId"),
        module: "stockMovements",
        recordId: requireKeySafeText(movement.id, "movementId"),
        operationType: "append",
        idempotencyKey,
        writeSetChecksum,
        safePayload: { intended } satisfies StockMovementAppendPayload,
        createdAt: requireText(createdAt, "createdAt")
    };
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

    const operation = buildStockMovementAppendOperation(movement, createdAt);

    if (operation.idempotencyKey !== identity.idempotencyKey) {
        throw new Error("Opening stock movement idempotency identity is invalid.");
    }

    return operation;
}

export function readStockMovementAppendPayload(
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
    const expected = buildStockMovementAppendOperation(
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

export const readOpeningStockMovementAppendPayload =
    readStockMovementAppendPayload;

function stockMovementIdempotencyKey(movement: StockMovement): string {
    const explicit = movement.idempotencyKey?.trim();

    if (explicit) {
        return requireKeySafeText(explicit, "idempotencyKey");
    }

    const openingIdentity = buildProductOpeningStockMovementIdentity(
        movement.productId
    );

    if (
        openingIdentity
        && movement.id === openingIdentity.movementId
        && movement.type === "opening_balance"
        && movement.referenceType === "opening_balance"
        && movement.referenceId === movement.productId
        && movement.metadata?.source === "product_create"
    ) {
        return openingIdentity.idempotencyKey;
    }

    return `stockMovement:append:${requireKeySafeText(
        movement.id,
        "movementId"
    )}`;
}

function requireKeySafeText(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Stock movement ${field} is not key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Stock movement ${field} is required.`);
    }

    return normalized;
}
