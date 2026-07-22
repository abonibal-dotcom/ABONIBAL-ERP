import type { SyncOperation } from "../../sync/SyncOperation";
import {
    canonicalChecksum,
    toJsonObject,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import type { Invoice } from "../Invoice";
import {
    readInvoiceCloudMutation,
    type InvoiceCloudMutation,
    type InvoiceCloudMutationKind
} from "./InvoiceSyncOperation";

export interface InvoiceCloudRecordMeta {
    schemaVersion: 1;
    revision: number;
    serverUpdatedAt: number;
    lastOperationId: string;
    idempotencyKey: string;
    writeSetChecksum: string;
    recordChecksum: string;
    tombstone: boolean;
    operationKind: InvoiceCloudMutationKind;
    lifecycleStatus: "draft" | "issued" | "cancelled";
    tombstonedAt?: string;
    tombstonedBy?: string;
}

export interface InvoiceCloudEnvelope {
    data: JsonObject;
    meta: InvoiceCloudRecordMeta;
}

export interface InvoiceCloudReceipt {
    operationId: string;
    idempotencyKey: string;
    state: "acknowledged";
    module: "invoices";
    recordId: string;
    resultRevision: number;
    checksum: string;
    serverAppliedAt: number;
}

export function invoiceAccountPath(accountId: string): string {
    return `accounts/${normalizePathPart(accountId, "accountId")}`;
}

export function invoiceModulePath(accountId: string): string {
    return `${invoiceAccountPath(accountId)}/invoices`;
}

export function invoiceRecordPath(
    accountId: string,
    invoiceId: string
): string {
    return `${invoiceModulePath(accountId)}/${normalizePathPart(
        invoiceId,
        "invoiceId"
    )}`;
}

export function invoiceCloudReceiptPath(
    accountId: string,
    operationId: string
): string {
    return `${invoiceAccountPath(accountId)}/_sync/operations/${normalizePathPart(
        operationId,
        "operationId"
    )}`;
}

export function createInvoiceCloudEnvelope(
    operation: SyncOperation,
    serverUpdatedAt = 0
): InvoiceCloudEnvelope {
    const mutation = readInvoiceCloudMutation(operation);
    const data = invoiceToJson(mutation.intended);

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
            tombstone: mutation.kind === "tombstone_draft",
            operationKind: mutation.kind,
            lifecycleStatus: mutation.intended.status,
            ...(mutation.tombstonedAt
                ? { tombstonedAt: mutation.tombstonedAt }
                : {}),
            ...(mutation.tombstonedBy
                ? { tombstonedBy: mutation.tombstonedBy }
                : {})
        }
    };
}

export function normalizeInvoiceCloudEnvelope(
    value: unknown,
    accountId?: string,
    invoiceId?: string
): InvoiceCloudEnvelope {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invoice cloud envelope is invalid.");
    }

    const candidate = value as {
        data?: unknown;
        meta?: Partial<InvoiceCloudRecordMeta>;
    };

    if (!isJsonObject(candidate.data) || !candidate.meta) {
        throw new Error("Invoice cloud envelope fields are invalid.");
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
        || typeof meta.tombstone !== "boolean"
        || !isInvoiceMutationKind(meta.operationKind)
        || !isInvoiceStatus(meta.lifecycleStatus)
        || data.revision !== meta.revision
        || data.status !== meta.lifecycleStatus
        || !isText(data.id)
        || !isText(data.accountId)
    ) {
        throw new Error("Invoice cloud envelope metadata is invalid.");
    }

    if (
        (accountId !== undefined && data.accountId !== accountId.trim())
        || (invoiceId !== undefined && data.id !== invoiceId.trim())
    ) {
        throw new Error("Invoice cloud envelope identity does not match its path.");
    }

    if (
        meta.tombstone
        && (
            meta.operationKind !== "tombstone_draft"
            || meta.lifecycleStatus !== "draft"
            || !isText(meta.tombstonedAt)
            || !isText(meta.tombstonedBy)
        )
    ) {
        throw new Error("Invoice draft tombstone metadata is invalid.");
    }

    if (!meta.tombstone && meta.operationKind === "tombstone_draft") {
        throw new Error("Invoice tombstone operation requires tombstone metadata.");
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
            tombstone: meta.tombstone,
            operationKind: meta.operationKind,
            lifecycleStatus: meta.lifecycleStatus,
            ...(meta.tombstonedAt
                ? { tombstonedAt: meta.tombstonedAt.trim() }
                : {}),
            ...(meta.tombstonedBy
                ? { tombstonedBy: meta.tombstonedBy.trim() }
                : {})
        }
    };
}

export function normalizeInvoiceCloudReceipt(
    value: unknown
): InvoiceCloudReceipt | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const receipt = value as Partial<InvoiceCloudReceipt>;

    if (
        !isText(receipt.operationId)
        || !isText(receipt.idempotencyKey)
        || receipt.state !== "acknowledged"
        || receipt.module !== "invoices"
        || !isText(receipt.recordId)
        || !isRevision(receipt.resultRevision)
        || !isText(receipt.checksum)
        || !isNonNegativeNumber(receipt.serverAppliedAt)
    ) {
        return null;
    }

    return receipt as InvoiceCloudReceipt;
}

export function mutationExpectedChecksum(
    mutation: InvoiceCloudMutation
): string | null {
    return mutation.expected
        ? canonicalChecksum(invoiceToJson(mutation.expected))
        : null;
}

export function invoiceFromCloudData(data: JsonObject): Invoice {
    return JSON.parse(JSON.stringify(data)) as Invoice;
}

function invoiceToJson(invoice: Invoice): JsonObject {
    return toJsonObject(JSON.parse(JSON.stringify(invoice)) as unknown);
}

function revisionOf(invoice: Invoice): number {
    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;
}

function normalizePathPart(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Invoice ${field} is not RTDB key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Invoice ${field} is required.`);
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

function isInvoiceStatus(value: unknown): value is Invoice["status"] {
    return value === "draft" || value === "issued" || value === "cancelled";
}

function isInvoiceMutationKind(value: unknown): value is InvoiceCloudMutationKind {
    return value === "create_draft"
        || value === "update_draft"
        || value === "tombstone_draft"
        || value === "issue_invoice"
        || value === "cancel_invoice";
}
