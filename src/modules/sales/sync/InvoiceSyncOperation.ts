import type { SyncOperation, SyncOperationInput } from "../../sync/SyncOperation";
import {
    canonicalChecksum,
    sha256Hex,
    toJsonObject,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import type { Invoice } from "../Invoice";
import { readInvoiceLifecycleTransitionOperation } from "./SalesCommercialSyncOperation";

export type InvoiceCloudMutationKind =
    | "create_draft"
    | "update_draft"
    | "tombstone_draft"
    | "issue_invoice"
    | "cancel_invoice";

interface InvoiceDraftMutationPayload {
    kind: "create_draft" | "update_draft" | "tombstone_draft";
    expected: JsonObject | null;
    intended: JsonObject;
    tombstonedAt?: string;
    tombstonedBy?: string;
}

export interface InvoiceCloudMutation {
    kind: InvoiceCloudMutationKind;
    expected: Invoice | null;
    intended: Invoice;
    tombstonedAt?: string;
    tombstonedBy?: string;
}

export function buildInvoiceDraftCreateOperation(
    invoice: Invoice,
    createdAt: string
): SyncOperationInput {
    return buildDraftOperation(
        "create_draft",
        null,
        invoice,
        createdAt
    );
}

export function buildInvoiceDraftUpdateOperation(
    expected: Invoice,
    intended: Invoice,
    createdAt: string
): SyncOperationInput {
    return buildDraftOperation(
        "update_draft",
        expected,
        intended,
        createdAt
    );
}

export function buildInvoiceDraftTombstoneOperation(
    expected: Invoice,
    tombstonedAt: string,
    tombstonedBy: string
): SyncOperationInput {
    const normalizedAt = requireText(tombstonedAt, "tombstonedAt");
    const normalizedBy = requireText(tombstonedBy, "tombstonedBy");
    const intended: Invoice = {
        ...expected,
        revision: revisionOf(expected) + 1,
        updatedAt: normalizedAt,
        updatedBy: normalizedBy
    };

    return buildDraftOperation(
        "tombstone_draft",
        expected,
        intended,
        normalizedAt,
        normalizedAt,
        normalizedBy
    );
}

export function readInvoiceCloudMutation(
    operation: SyncOperation
): InvoiceCloudMutation {
    if (isDraftMutationPayload(operation.safePayload)) {
        return readDraftMutation(operation);
    }

    const lifecycle = readInvoiceLifecycleTransitionOperation(operation);
    const expectedRevision = revisionOf(lifecycle.expected);

    if (
        operation.operationType !== "update"
        || operation.expectedRevision !== expectedRevision
        || revisionOf(lifecycle.intended) !== expectedRevision + 1
    ) {
        throw new Error("Invoice lifecycle cloud revision is invalid.");
    }

    if (
        lifecycle.transition === "issue"
        && (
            lifecycle.expected.status !== "draft"
            || lifecycle.intended.status !== "issued"
        )
    ) {
        throw new Error("Invoice issue cloud transition is invalid.");
    }

    if (
        lifecycle.transition === "cancel"
        && (
            lifecycle.expected.status !== "issued"
            || lifecycle.intended.status !== "cancelled"
        )
    ) {
        throw new Error("Invoice cancellation cloud transition is invalid.");
    }

    return {
        kind: lifecycle.transition === "issue"
            ? "issue_invoice"
            : "cancel_invoice",
        expected: lifecycle.expected,
        intended: lifecycle.intended
    };
}

function buildDraftOperation(
    kind: InvoiceDraftMutationPayload["kind"],
    expected: Invoice | null,
    intended: Invoice,
    createdAt: string,
    tombstonedAt?: string,
    tombstonedBy?: string
): SyncOperationInput {
    const normalizedCreatedAt = requireText(createdAt, "createdAt");
    const accountId = requireText(intended.accountId, "accountId");
    const recordId = requireKeySafeText(intended.id, "recordId");
    const expectedRecord = expected ? toInvoiceJson(expected) : null;
    const intendedRecord = toInvoiceJson(intended);
    const payload: InvoiceDraftMutationPayload = {
        kind,
        expected: expectedRecord,
        intended: intendedRecord,
        ...(tombstonedAt ? { tombstonedAt } : {}),
        ...(tombstonedBy ? { tombstonedBy } : {})
    };
    const writeSetChecksum = canonicalChecksum(toJsonObject(payload));
    const intendedRevision = revisionOf(intended);
    const idempotencyKey = `invoice:${kind}:${recordId}:r${intendedRevision}`;
    const operationId = `invoices-${sha256Hex(
        `${idempotencyKey}:${writeSetChecksum}`
    ).slice(0, 32)}`;

    validateDraftMutation(kind, expected, intended);

    return {
        operationId,
        accountId,
        module: "invoices",
        recordId,
        operationType: kind === "create_draft" ? "create" : "update",
        ...(expected ? { expectedRevision: revisionOf(expected) } : {}),
        idempotencyKey,
        writeSetChecksum,
        safePayload: payload,
        createdAt: normalizedCreatedAt
    };
}

function readDraftMutation(operation: SyncOperation): InvoiceCloudMutation {
    if (
        operation.module !== "invoices"
        || !isDraftMutationPayload(operation.safePayload)
    ) {
        throw new Error("Invoice draft cloud operation is invalid.");
    }

    const payload = operation.safePayload;
    const expected = payload.expected
        ? payload.expected as unknown as Invoice
        : null;
    const intended = payload.intended as unknown as Invoice;
    const rebuilt = buildDraftOperation(
        payload.kind,
        expected,
        intended,
        operation.createdAt,
        payload.tombstonedAt,
        payload.tombstonedBy
    );

    if (
        rebuilt.operationId !== operation.operationId
        || rebuilt.accountId !== operation.accountId
        || rebuilt.recordId !== operation.recordId
        || rebuilt.operationType !== operation.operationType
        || rebuilt.expectedRevision !== operation.expectedRevision
        || rebuilt.idempotencyKey !== operation.idempotencyKey
        || rebuilt.writeSetChecksum !== operation.writeSetChecksum
    ) {
        throw new Error("Invoice draft cloud operation identity conflicts.");
    }

    return {
        kind: payload.kind,
        expected,
        intended,
        ...(payload.tombstonedAt
            ? { tombstonedAt: payload.tombstonedAt }
            : {}),
        ...(payload.tombstonedBy
            ? { tombstonedBy: payload.tombstonedBy }
            : {})
    };
}

function validateDraftMutation(
    kind: InvoiceDraftMutationPayload["kind"],
    expected: Invoice | null,
    intended: Invoice
): void {
    if (intended.status !== "draft") {
        throw new Error("Invoice draft operation requires draft lifecycle state.");
    }

    if (kind === "create_draft") {
        if (expected || revisionOf(intended) !== 0) {
            throw new Error("Invoice draft create requires revision zero.");
        }

        return;
    }

    if (
        !expected
        || expected.status !== "draft"
        || expected.id !== intended.id
        || expected.accountId !== intended.accountId
        || revisionOf(intended) !== revisionOf(expected) + 1
    ) {
        throw new Error("Invoice draft mutation revision or identity is invalid.");
    }

    if (
        kind === "tombstone_draft"
        && (
            expected.invoiceNumber !== intended.invoiceNumber
            || expected.createdAt !== intended.createdAt
            || expected.createdBy !== intended.createdBy
        )
    ) {
        throw new Error("Invoice draft tombstone identity is immutable.");
    }
}

function isDraftMutationPayload(
    value: unknown
): value is InvoiceDraftMutationPayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const payload = value as Partial<InvoiceDraftMutationPayload>;

    return (
        payload.kind === "create_draft"
        || payload.kind === "update_draft"
        || payload.kind === "tombstone_draft"
    )
        && (payload.expected === null || isJsonObject(payload.expected))
        && isJsonObject(payload.intended)
        && (
            payload.tombstonedAt === undefined
            || typeof payload.tombstonedAt === "string"
        )
        && (
            payload.tombstonedBy === undefined
            || typeof payload.tombstonedBy === "string"
        );
}

function revisionOf(invoice: Invoice): number {
    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;
}

function toInvoiceJson(value: Invoice): JsonObject {
    return toJsonObject(JSON.parse(JSON.stringify(value)) as unknown);
}

function isJsonObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireKeySafeText(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Invoice cloud ${field} is not key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Invoice cloud ${field} is required.`);
    }

    return normalized;
}
