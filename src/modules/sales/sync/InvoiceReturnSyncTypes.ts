import type { SyncOperation } from "../../sync/SyncOperation";
import {
    canonicalChecksum,
    toJsonObject,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import type { InvoiceReturn } from "../InvoiceReturn";
import {
    readInvoiceReturnCloudMutation,
    type InvoiceReturnCloudMutation,
    type InvoiceReturnCloudMutationKind
} from "./InvoiceReturnSyncOperation";

export interface InvoiceReturnCloudRecordMeta {
    schemaVersion: 1;
    revision: number;
    serverUpdatedAt: number;
    lastOperationId: string;
    idempotencyKey: string;
    writeSetChecksum: string;
    recordChecksum: string;
    tombstone: false;
    operationKind: InvoiceReturnCloudMutationKind;
    lifecycleStatus: "recorded" | "executed";
}

export interface InvoiceReturnCloudEnvelope {
    data: JsonObject;
    meta: InvoiceReturnCloudRecordMeta;
}

export interface InvoiceReturnCloudReceipt {
    operationId: string;
    idempotencyKey: string;
    state: "acknowledged";
    module: "invoiceReturns";
    recordId: string;
    resultRevision: number;
    checksum: string;
    serverAppliedAt: number;
}

export function invoiceReturnAccountPath(accountId: string): string {
    return `accounts/${normalizePathPart(accountId, "accountId")}`;
}

export function invoiceReturnModulePath(accountId: string): string {
    return `${invoiceReturnAccountPath(accountId)}/invoiceReturns`;
}

export function invoiceReturnRecordPath(
    accountId: string,
    invoiceReturnId: string
): string {
    return `${invoiceReturnModulePath(accountId)}/${normalizePathPart(
        invoiceReturnId,
        "invoiceReturnId"
    )}`;
}

export function invoiceReturnCloudReceiptPath(
    accountId: string,
    operationId: string
): string {
    return `${invoiceReturnAccountPath(accountId)}/_sync/operations/${normalizePathPart(
        operationId,
        "operationId"
    )}`;
}

export function createInvoiceReturnCloudEnvelope(
    operation: SyncOperation,
    serverUpdatedAt = 0
): InvoiceReturnCloudEnvelope {
    const mutation = readInvoiceReturnCloudMutation(operation);
    const data = invoiceReturnToJson(mutation.intended);

    return {
        data,
        meta: {
            schemaVersion: 1,
            revision: revisionOf(mutation.intended),
            serverUpdatedAt,
            lastOperationId: operation.operationId,
            idempotencyKey: operation.idempotencyKey,
            writeSetChecksum: requireText(
                operation.writeSetChecksum ?? "",
                "writeSetChecksum"
            ),
            recordChecksum: canonicalChecksum(data),
            tombstone: false,
            operationKind: mutation.kind,
            lifecycleStatus: mutation.intended.status
        }
    };
}

export function normalizeInvoiceReturnCloudEnvelope(
    value: unknown,
    accountId?: string,
    invoiceReturnId?: string
): InvoiceReturnCloudEnvelope {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("InvoiceReturn cloud envelope is invalid.");
    }

    const candidate = value as {
        data?: unknown;
        meta?: Partial<InvoiceReturnCloudRecordMeta>;
    };

    if (!isJsonObject(candidate.data) || !candidate.meta) {
        throw new Error("InvoiceReturn cloud envelope fields are invalid.");
    }

    const data = candidate.data;
    const meta = candidate.meta;

    if (
        meta.schemaVersion !== 1
        || !isRevision(meta.revision)
        || !isNonNegativeNumber(meta.serverUpdatedAt)
        || !isText(meta.lastOperationId)
        || !isText(meta.idempotencyKey)
        || !isText(meta.writeSetChecksum)
        || !isText(meta.recordChecksum)
        || canonicalChecksum(data) !== meta.recordChecksum
        || meta.tombstone !== false
        || !isInvoiceReturnMutationKind(meta.operationKind)
        || !isInvoiceReturnStatus(meta.lifecycleStatus)
        || data.revision !== meta.revision
        || data.status !== meta.lifecycleStatus
        || !isText(data.id)
        || !isText(data.accountId)
    ) {
        throw new Error("InvoiceReturn cloud envelope metadata is invalid.");
    }

    if (
        (accountId !== undefined && data.accountId !== accountId.trim())
        || (
            invoiceReturnId !== undefined
            && data.id !== invoiceReturnId.trim()
        )
    ) {
        throw new Error("InvoiceReturn cloud envelope identity does not match its path.");
    }

    if (
        (meta.operationKind === "create_recorded"
            || meta.operationKind === "update_recorded")
        && meta.lifecycleStatus !== "recorded"
    ) {
        throw new Error("InvoiceReturn recorded envelope lifecycle is invalid.");
    }

    if (
        meta.operationKind === "execute_invoice_return"
        && meta.lifecycleStatus !== "executed"
    ) {
        throw new Error("InvoiceReturn executed envelope lifecycle is invalid.");
    }

    return {
        data,
        meta: {
            schemaVersion: 1,
            revision: meta.revision,
            serverUpdatedAt: meta.serverUpdatedAt,
            lastOperationId: meta.lastOperationId.trim(),
            idempotencyKey: meta.idempotencyKey.trim(),
            writeSetChecksum: meta.writeSetChecksum.trim(),
            recordChecksum: meta.recordChecksum.trim(),
            tombstone: false,
            operationKind: meta.operationKind,
            lifecycleStatus: meta.lifecycleStatus
        }
    };
}

export function normalizeInvoiceReturnCloudReceipt(
    value: unknown
): InvoiceReturnCloudReceipt | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const receipt = value as Partial<InvoiceReturnCloudReceipt>;

    if (
        !isText(receipt.operationId)
        || !isText(receipt.idempotencyKey)
        || receipt.state !== "acknowledged"
        || receipt.module !== "invoiceReturns"
        || !isText(receipt.recordId)
        || !isRevision(receipt.resultRevision)
        || !isText(receipt.checksum)
        || !isNonNegativeNumber(receipt.serverAppliedAt)
    ) {
        return null;
    }

    return receipt as InvoiceReturnCloudReceipt;
}

export function invoiceReturnMutationExpectedChecksum(
    mutation: InvoiceReturnCloudMutation
): string | null {
    return mutation.expected
        ? canonicalChecksum(invoiceReturnToJson(mutation.expected))
        : null;
}

export function invoiceReturnFromCloudData(data: JsonObject): InvoiceReturn {
    return JSON.parse(JSON.stringify(data)) as InvoiceReturn;
}

function invoiceReturnToJson(invoiceReturn: InvoiceReturn): JsonObject {
    return toJsonObject(JSON.parse(JSON.stringify(invoiceReturn)) as unknown);
}

function revisionOf(invoiceReturn: InvoiceReturn): number {
    return typeof invoiceReturn.revision === "number"
        && Number.isInteger(invoiceReturn.revision)
        && invoiceReturn.revision >= 0
        ? invoiceReturn.revision
        : 0;
}

function normalizePathPart(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`InvoiceReturn ${field} is not RTDB key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`InvoiceReturn ${field} is required.`);
    }

    return normalized;
}

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isRevision(value: unknown): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0;
}

function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isJsonObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isInvoiceReturnStatus(
    value: unknown
): value is InvoiceReturn["status"] {
    return value === "recorded" || value === "executed";
}

function isInvoiceReturnMutationKind(
    value: unknown
): value is InvoiceReturnCloudMutationKind {
    return value === "create_recorded"
        || value === "update_recorded"
        || value === "execute_invoice_return";
}
