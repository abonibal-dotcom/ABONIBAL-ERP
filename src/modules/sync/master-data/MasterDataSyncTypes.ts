import type { SyncModule, SyncOperation } from "../SyncOperation";
import {
    canonicalChecksum,
    type JsonObject,
    type JsonValue
} from "./CanonicalJson";

export const masterDataSyncModules = [
    "products",
    "customers",
    "suppliers"
] as const;

export type MasterDataSyncModule = typeof masterDataSyncModules[number];

export interface MasterDataCloudRecordMeta {
    schemaVersion: 1;
    revision: number;
    serverUpdatedAt: number;
    lastOperationId: string;
    tombstone: boolean;
    writeSetChecksum: string;
}

export interface MasterDataCloudEnvelope {
    data: JsonObject;
    meta: MasterDataCloudRecordMeta;
}

export interface MasterDataMutationPayload {
    envelope: MasterDataCloudEnvelope;
}

export interface MasterDataCloudReceipt {
    operationId: string;
    idempotencyKey: string;
    state: "acknowledged";
    module: MasterDataSyncModule;
    recordId: string;
    resultRevision: number;
    checksum: string;
    serverAppliedAt: number;
}

export interface MasterDataRecordCodec<T> {
    readonly module: MasterDataSyncModule;
    toCloudRecord(record: T): JsonObject;
    fromCloudRecord(data: JsonObject): T;
    validateRecord(record: T, accountId: string, recordId: string): void;
    isTombstone(record: T): boolean;
}

export interface MasterDataCacheRepository<T> {
    findForAccount(accountId: string, recordId: string): T | undefined;
    addToAccount(accountId: string, record: T): void;
    updateForAccount(accountId: string, recordId: string, data: Partial<T>): void;
}

export function isMasterDataSyncModule(
    value: SyncModule
): value is MasterDataSyncModule {
    return masterDataSyncModules.some(module => module === value);
}

export function masterDataAccountPath(accountId: string): string {
    return `accounts/${normalizePathPart(accountId, "accountId")}`;
}

export function masterDataModulePath(
    accountId: string,
    module: MasterDataSyncModule
): string {
    return `${masterDataAccountPath(accountId)}/${module}`;
}

export function masterDataRecordPath(
    accountId: string,
    module: MasterDataSyncModule,
    recordId: string
): string {
    return `${masterDataModulePath(accountId, module)}/${normalizePathPart(recordId, "recordId")}`;
}

export function masterDataCloudReceiptPath(
    accountId: string,
    operationId: string
): string {
    return `${masterDataAccountPath(accountId)}/_sync/operations/${normalizePathPart(operationId, "operationId")}`;
}

export function createMasterDataEnvelope(
    data: JsonObject,
    revision: number,
    operationId: string,
    tombstone: boolean
): MasterDataCloudEnvelope {
    validatePositiveRevision(revision);

    const checksum = checksumMasterDataRecord(data, revision, tombstone);

    return {
        data,
        meta: {
            schemaVersion: 1,
            revision,
            serverUpdatedAt: 0,
            lastOperationId: requireText(operationId, "operationId"),
            tombstone,
            writeSetChecksum: checksum
        }
    };
}

export function checksumMasterDataRecord(
    data: JsonObject,
    revision: number,
    tombstone: boolean
): string {
    validatePositiveRevision(revision);

    return canonicalChecksum({
        data,
        revision,
        tombstone
    });
}

export function readMasterDataMutationPayload(
    operation: SyncOperation
): MasterDataMutationPayload {
    if (!isMasterDataSyncModule(operation.module)) {
        throw new Error("Sync operation is not a supported master-data module.");
    }

    if (!operation.safePayload || typeof operation.safePayload !== "object") {
        throw new Error("Master-data operation payload is missing.");
    }

    const payload = operation.safePayload as Partial<MasterDataMutationPayload>;
    const envelope = normalizeMasterDataEnvelope(payload.envelope);

    if (
        envelope.data.id !== operation.recordId
        || envelope.data.accountId !== operation.accountId
        || envelope.meta.lastOperationId !== operation.operationId
        || envelope.meta.writeSetChecksum !== operation.writeSetChecksum
    ) {
        throw new Error("Master-data operation identity does not match its payload.");
    }

    const expectedRevision = operation.operationType === "create"
        ? 1
        : (operation.expectedRevision ?? -1) + 1;

    if (
        !["create", "update"].includes(operation.operationType)
        || envelope.meta.revision !== expectedRevision
    ) {
        throw new Error("Master-data operation revision transition is invalid.");
    }

    return { envelope };
}

export function normalizeMasterDataEnvelope(
    value: unknown
): MasterDataCloudEnvelope {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Master-data cloud envelope is invalid.");
    }

    const candidate = value as {
        data?: unknown;
        meta?: Partial<MasterDataCloudRecordMeta>;
    };

    if (!isJsonObject(candidate.data) || !candidate.meta) {
        throw new Error("Master-data cloud envelope fields are invalid.");
    }

    const meta = candidate.meta;

    if (
        meta.schemaVersion !== 1
        || !isPositiveRevision(meta.revision)
        || !isNonNegativeNumber(meta.serverUpdatedAt)
        || typeof meta.tombstone !== "boolean"
        || !isNonEmptyText(meta.lastOperationId)
        || !isNonEmptyText(meta.writeSetChecksum)
    ) {
        throw new Error("Master-data cloud metadata is invalid.");
    }

    const checksum = checksumMasterDataRecord(
        candidate.data,
        meta.revision,
        meta.tombstone
    );

    if (checksum !== meta.writeSetChecksum) {
        throw new Error("Master-data cloud checksum does not match the record.");
    }

    return {
        data: candidate.data,
        meta: {
            schemaVersion: 1,
            revision: meta.revision,
            serverUpdatedAt: meta.serverUpdatedAt,
            lastOperationId: meta.lastOperationId.trim(),
            tombstone: meta.tombstone,
            writeSetChecksum: meta.writeSetChecksum.trim()
        }
    };
}

export function normalizeMasterDataCloudReceipt(
    value: unknown
): MasterDataCloudReceipt | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const receipt = value as Partial<MasterDataCloudReceipt>;

    if (
        !isNonEmptyText(receipt.operationId)
        || !isNonEmptyText(receipt.idempotencyKey)
        || receipt.state !== "acknowledged"
        || !receipt.module
        || !masterDataSyncModules.some(module => module === receipt.module)
        || !isNonEmptyText(receipt.recordId)
        || !isPositiveRevision(receipt.resultRevision)
        || !isNonEmptyText(receipt.checksum)
        || !isNonNegativeNumber(receipt.serverAppliedAt)
    ) {
        return null;
    }

    return receipt as MasterDataCloudReceipt;
}

function normalizePathPart(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Master-data ${field} is not RTDB key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Master-data ${field} is required.`);
    }

    return normalized;
}

function validatePositiveRevision(value: number): void {
    if (!isPositiveRevision(value)) {
        throw new Error("Master-data revision must be a positive integer.");
    }
}

function isPositiveRevision(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonEmptyText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isJsonObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
    if (
        value === null
        || typeof value === "string"
        || typeof value === "boolean"
        || (typeof value === "number" && Number.isFinite(value))
    ) {
        return true;
    }

    if (Array.isArray(value)) {
        return value.every(isJsonValue);
    }

    return isJsonObject(value) && Object.values(value).every(isJsonValue);
}
