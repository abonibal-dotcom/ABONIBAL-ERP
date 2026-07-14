export const syncModules = [
    "products",
    "stockMovements",
    "invoices",
    "invoiceReturns",
    "customers",
    "suppliers",
    "payments",
    "purchases",
    "expenses",
    "safes",
    "cashMovements",
    "ledgerAccounts",
    "ledgerEntries"
] as const;

export type SyncModule = typeof syncModules[number];

export const syncOperationTypes = [
    "create",
    "update",
    "append",
    "void",
    "reverse"
] as const;

export type SyncOperationType = typeof syncOperationTypes[number];

export const syncOperationStatuses = [
    "pending",
    "syncing",
    "acknowledged",
    "conflict",
    "failed"
] as const;

export type SyncOperationStatus = typeof syncOperationStatuses[number];

export interface SyncPayloadReference {
    storageKey: string;
    checksum?: string;
}

export interface SyncOperation {
    operationId: string;
    accountId: string;
    module: SyncModule;
    recordId: string;
    operationType: SyncOperationType;
    expectedRevision?: number;
    idempotencyKey: string;
    writeSetChecksum?: string;
    safePayload?: unknown;
    payloadReference?: SyncPayloadReference;
    createdAt: string;
    attemptCount: number;
    lastAttemptAt?: string;
    nextAttemptAt?: string;
    errorCode?: string;
    errorMessageSafe?: string;
    status: SyncOperationStatus;
}

export interface SyncOperationInput {
    operationId: string;
    accountId: string;
    module: SyncModule;
    recordId: string;
    operationType: SyncOperationType;
    expectedRevision?: number;
    idempotencyKey: string;
    writeSetChecksum?: string;
    safePayload?: unknown;
    payloadReference?: SyncPayloadReference;
    createdAt: string;
}

export function createPendingSyncOperation(
    input: SyncOperationInput
): SyncOperation {
    const operationId = requireText(input.operationId, "operationId");
    const accountId = requireText(input.accountId, "accountId");
    const recordId = requireText(input.recordId, "recordId");
    const idempotencyKey = requireText(input.idempotencyKey, "idempotencyKey");
    const createdAt = requireText(input.createdAt, "createdAt");

    if (!isSyncModule(input.module)) {
        throw new Error("Sync module is not supported.");
    }

    if (!isSyncOperationType(input.operationType)) {
        throw new Error("Sync operation type is not supported.");
    }

    if (
        input.expectedRevision !== undefined
        && !isRevision(input.expectedRevision)
    ) {
        throw new Error("Sync expectedRevision must be a non-negative integer.");
    }

    if (
        input.safePayload === undefined
        && input.payloadReference === undefined
    ) {
        throw new Error("Sync operation requires a safe payload or payload reference.");
    }

    const payloadReference = input.payloadReference
        ? normalizePayloadReference(input.payloadReference)
        : undefined;
    const writeSetChecksum = optionalText(input.writeSetChecksum);

    return {
        operationId,
        accountId,
        module: input.module,
        recordId,
        operationType: input.operationType,
        ...(input.expectedRevision !== undefined
            ? { expectedRevision: input.expectedRevision }
            : {}),
        idempotencyKey,
        ...(writeSetChecksum ? { writeSetChecksum } : {}),
        ...(input.safePayload !== undefined
            ? { safePayload: input.safePayload }
            : {}),
        ...(payloadReference ? { payloadReference } : {}),
        createdAt,
        attemptCount: 0,
        status: "pending"
    };
}

export function isSyncModule(value: unknown): value is SyncModule {
    return typeof value === "string"
        && syncModules.some(module => module === value);
}

export function isSyncOperationType(
    value: unknown
): value is SyncOperationType {
    return typeof value === "string"
        && syncOperationTypes.some(type => type === value);
}

export function isSyncOperationStatus(
    value: unknown
): value is SyncOperationStatus {
    return typeof value === "string"
        && syncOperationStatuses.some(status => status === value);
}

export function isStoredSyncOperation(value: unknown): value is SyncOperation {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const operation = value as Partial<SyncOperation>;

    return isNonEmptyText(operation.operationId)
        && isNonEmptyText(operation.accountId)
        && isSyncModule(operation.module)
        && isNonEmptyText(operation.recordId)
        && isSyncOperationType(operation.operationType)
        && (
            operation.expectedRevision === undefined
            || isRevision(operation.expectedRevision)
        )
        && isNonEmptyText(operation.idempotencyKey)
        && isNonEmptyText(operation.createdAt)
        && Number.isInteger(operation.attemptCount)
        && (operation.attemptCount as number) >= 0
        && isSyncOperationStatus(operation.status);
}

function normalizePayloadReference(
    reference: SyncPayloadReference
): SyncPayloadReference {
    const storageKey = requireText(reference.storageKey, "payloadReference.storageKey");
    const checksum = optionalText(reference.checksum);

    return {
        storageKey,
        ...(checksum ? { checksum } : {})
    };
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Sync ${field} is required.`);
    }

    return normalized;
}

function optionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim();

    return normalized || undefined;
}

function isNonEmptyText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isRevision(value: unknown): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0;
}
