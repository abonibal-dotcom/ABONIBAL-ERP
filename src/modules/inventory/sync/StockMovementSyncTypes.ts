import {
    canonicalChecksum,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import type { SyncOperation } from "../../sync/SyncOperation";
import type { StockMovement } from "../StockMovement";
import {
    buildStockMovementAppendOperation,
    readStockMovementAppendPayload
} from "./StockMovementSyncOperation";

export interface StockMovementCloudRecordMeta {
    schemaVersion: 1;
    revision: 1;
    immutable: true;
    serverUpdatedAt: number;
    lastOperationId: string;
    idempotencyKey: string;
    writeSetChecksum: string;
}

export interface StockMovementCloudEnvelope {
    data: JsonObject;
    meta: StockMovementCloudRecordMeta;
}

export interface StockMovementCloudReceipt {
    operationId: string;
    idempotencyKey: string;
    state: "acknowledged";
    module: "stockMovements";
    recordId: string;
    resultRevision: 1;
    checksum: string;
    serverAppliedAt: number;
}

export function stockMovementAccountPath(accountId: string): string {
    return `accounts/${normalizePathPart(accountId, "accountId")}`;
}

export function stockMovementModulePath(accountId: string): string {
    return `${stockMovementAccountPath(accountId)}/stockMovements`;
}

export function stockMovementRecordPath(
    accountId: string,
    movementId: string
): string {
    return `${stockMovementModulePath(accountId)}/${normalizePathPart(
        movementId,
        "movementId"
    )}`;
}

export function stockMovementCloudReceiptPath(
    accountId: string,
    operationId: string
): string {
    return `${stockMovementAccountPath(accountId)}/_sync/operations/${normalizePathPart(
        operationId,
        "operationId"
    )}`;
}

export function createStockMovementCloudEnvelope(
    operation: SyncOperation
): StockMovementCloudEnvelope {
    readStockMovementAppendPayload(operation);
    const data = operation.safePayload as { intended: JsonObject };

    return {
        data: data.intended,
        meta: {
            schemaVersion: 1,
            revision: 1,
            immutable: true,
            serverUpdatedAt: 0,
            lastOperationId: operation.operationId,
            idempotencyKey: operation.idempotencyKey,
            writeSetChecksum: operation.writeSetChecksum
                ?? canonicalChecksum(data.intended)
        }
    } satisfies StockMovementCloudEnvelope;
}

export function normalizeStockMovementCloudEnvelope(
    value: unknown,
    accountId?: string,
    movementId?: string
): StockMovementCloudEnvelope {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Stock movement cloud envelope is invalid.");
    }

    const candidate = value as {
        data?: unknown;
        meta?: Partial<StockMovementCloudRecordMeta>;
    };

    if (!isJsonObject(candidate.data) || !candidate.meta) {
        throw new Error("Stock movement cloud envelope fields are invalid.");
    }

    const meta = candidate.meta;

    if (
        meta.schemaVersion !== 1
        || meta.revision !== 1
        || meta.immutable !== true
        || !isNonNegativeNumber(meta.serverUpdatedAt)
        || !isNonEmptyText(meta.lastOperationId)
        || !isNonEmptyText(meta.idempotencyKey)
        || !isNonEmptyText(meta.writeSetChecksum)
        || canonicalChecksum(candidate.data) !== meta.writeSetChecksum
    ) {
        throw new Error("Stock movement cloud metadata is invalid.");
    }

    const movement = candidate.data as unknown as StockMovement;
    const expected = buildStockMovementAppendOperation(
        movement,
        movement.createdAt
    );

    if (
        (accountId !== undefined && movement.accountId !== accountId.trim())
        || (movementId !== undefined && movement.id !== movementId.trim())
        || expected.operationId !== meta.lastOperationId
        || expected.idempotencyKey !== meta.idempotencyKey
        || expected.writeSetChecksum !== meta.writeSetChecksum
    ) {
        throw new Error("Stock movement cloud identity is invalid.");
    }

    return {
        data: candidate.data,
        meta: {
            schemaVersion: 1,
            revision: 1,
            immutable: true,
            serverUpdatedAt: meta.serverUpdatedAt,
            lastOperationId: meta.lastOperationId.trim(),
            idempotencyKey: meta.idempotencyKey.trim(),
            writeSetChecksum: meta.writeSetChecksum.trim()
        }
    };
}

export function normalizeStockMovementCloudReceipt(
    value: unknown
): StockMovementCloudReceipt | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const receipt = value as Partial<StockMovementCloudReceipt>;

    if (
        !isNonEmptyText(receipt.operationId)
        || !isNonEmptyText(receipt.idempotencyKey)
        || receipt.state !== "acknowledged"
        || receipt.module !== "stockMovements"
        || !isNonEmptyText(receipt.recordId)
        || receipt.resultRevision !== 1
        || !isNonEmptyText(receipt.checksum)
        || !isNonNegativeNumber(receipt.serverAppliedAt)
    ) {
        return null;
    }

    return receipt as StockMovementCloudReceipt;
}

function normalizePathPart(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Stock movement ${field} is not RTDB key-safe.`);
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

function isNonEmptyText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isJsonObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
