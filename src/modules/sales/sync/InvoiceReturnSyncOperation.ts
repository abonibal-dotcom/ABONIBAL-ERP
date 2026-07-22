import type { SyncOperation, SyncOperationInput } from "../../sync/SyncOperation";
import {
    canonicalChecksum,
    sha256Hex,
    toJsonObject,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import type { InvoiceReturn } from "../InvoiceReturn";
import { readInvoiceReturnLifecycleTransitionOperation } from "./SalesCommercialSyncOperation";

export type InvoiceReturnCloudMutationKind =
    | "create_recorded"
    | "update_recorded"
    | "execute_invoice_return";

interface InvoiceReturnRecordedMutationPayload {
    kind: "create_recorded" | "update_recorded";
    expected: JsonObject | null;
    intended: JsonObject;
}

export interface InvoiceReturnCloudMutation {
    kind: InvoiceReturnCloudMutationKind;
    expected: InvoiceReturn | null;
    intended: InvoiceReturn;
}

export function buildInvoiceReturnRecordedCreateOperation(
    invoiceReturn: InvoiceReturn,
    createdAt: string
): SyncOperationInput {
    return buildRecordedOperation(
        "create_recorded",
        null,
        invoiceReturn,
        createdAt
    );
}

export function buildInvoiceReturnRecordedUpdateOperation(
    expected: InvoiceReturn,
    intended: InvoiceReturn,
    createdAt: string
): SyncOperationInput {
    return buildRecordedOperation(
        "update_recorded",
        expected,
        intended,
        createdAt
    );
}

export function readInvoiceReturnCloudMutation(
    operation: SyncOperation
): InvoiceReturnCloudMutation {
    if (isRecordedMutationPayload(operation.safePayload)) {
        return readRecordedMutation(operation);
    }

    const lifecycle = readInvoiceReturnLifecycleTransitionOperation(operation);
    const expectedRevision = revisionOf(lifecycle.expected);

    if (
        operation.operationType !== "update"
        || (
            operation.cloudAction !== undefined
            && operation.cloudAction !== "execute"
        )
        || operation.expectedRevision !== expectedRevision
        || revisionOf(lifecycle.intended) !== expectedRevision + 1
        || lifecycle.expected.status !== "recorded"
        || lifecycle.intended.status !== "executed"
    ) {
        throw new Error("InvoiceReturn execution cloud mutation is invalid.");
    }

    return {
        kind: "execute_invoice_return",
        expected: lifecycle.expected,
        intended: lifecycle.intended
    };
}

function buildRecordedOperation(
    kind: InvoiceReturnRecordedMutationPayload["kind"],
    expected: InvoiceReturn | null,
    intended: InvoiceReturn,
    createdAt: string
): SyncOperationInput {
    const normalizedCreatedAt = requireText(createdAt, "createdAt");
    const accountId = requireText(intended.accountId, "accountId");
    const recordId = requireKeySafeText(intended.id, "recordId");
    const payload: InvoiceReturnRecordedMutationPayload = {
        kind,
        expected: expected ? toInvoiceReturnJson(expected) : null,
        intended: toInvoiceReturnJson(intended)
    };
    const writeSetChecksum = canonicalChecksum(toJsonObject(payload));
    const intendedRevision = revisionOf(intended);
    const idempotencyKey = `invoiceReturn:${kind}:${recordId}:r${intendedRevision}`;
    const operationId = `invoiceReturns-${sha256Hex(
        `${idempotencyKey}:${writeSetChecksum}`
    ).slice(0, 32)}`;
    const cloudAction = kind === "create_recorded"
        ? "createRecorded"
        : "updateRecorded";

    validateRecordedMutation(kind, expected, intended);

    return {
        operationId,
        accountId,
        module: "invoiceReturns",
        recordId,
        operationType: kind === "create_recorded" ? "create" : "update",
        cloudAction,
        ...(expected ? { expectedRevision: revisionOf(expected) } : {}),
        idempotencyKey,
        writeSetChecksum,
        safePayload: payload,
        createdAt: normalizedCreatedAt
    };
}

function readRecordedMutation(
    operation: SyncOperation
): InvoiceReturnCloudMutation {
    if (
        operation.module !== "invoiceReturns"
        || !isRecordedMutationPayload(operation.safePayload)
    ) {
        throw new Error("InvoiceReturn recorded cloud operation is invalid.");
    }

    const payload = operation.safePayload;
    const expected = payload.expected
        ? payload.expected as unknown as InvoiceReturn
        : null;
    const intended = payload.intended as unknown as InvoiceReturn;
    const rebuilt = buildRecordedOperation(
        payload.kind,
        expected,
        intended,
        operation.createdAt
    );

    if (
        rebuilt.operationId !== operation.operationId
        || rebuilt.accountId !== operation.accountId
        || rebuilt.recordId !== operation.recordId
        || rebuilt.operationType !== operation.operationType
        || rebuilt.cloudAction !== operation.cloudAction
        || rebuilt.expectedRevision !== operation.expectedRevision
        || rebuilt.idempotencyKey !== operation.idempotencyKey
        || rebuilt.writeSetChecksum !== operation.writeSetChecksum
    ) {
        throw new Error("InvoiceReturn recorded cloud operation identity conflicts.");
    }

    return {
        kind: payload.kind,
        expected,
        intended
    };
}

function validateRecordedMutation(
    kind: InvoiceReturnRecordedMutationPayload["kind"],
    expected: InvoiceReturn | null,
    intended: InvoiceReturn
): void {
    if (
        intended.status !== "recorded"
        || intended.executionCommandId
        || intended.lines.some(line => line.returnStockMovementId)
    ) {
        throw new Error("InvoiceReturn recorded operation requires recorded state.");
    }

    if (kind === "create_recorded") {
        if (expected || revisionOf(intended) !== 0) {
            throw new Error("InvoiceReturn recorded create requires revision zero.");
        }

        return;
    }

    if (
        !expected
        || expected.status !== "recorded"
        || expected.id !== intended.id
        || expected.accountId !== intended.accountId
        || expected.returnNumber !== intended.returnNumber
        || expected.invoiceId !== intended.invoiceId
        || expected.invoiceNumberSnapshot !== intended.invoiceNumberSnapshot
        || expected.createdAt !== intended.createdAt
        || expected.createdBy !== intended.createdBy
        || revisionOf(intended) !== revisionOf(expected) + 1
    ) {
        throw new Error("InvoiceReturn recorded update identity or revision is invalid.");
    }

    const expectedLineIds = new Map(
        expected.lines.map(line => [line.invoiceLineId, line.id])
    );

    if (intended.lines.some(line => {
        const expectedId = expectedLineIds.get(line.invoiceLineId);
        return expectedId !== undefined && expectedId !== line.id;
    })) {
        throw new Error("InvoiceReturn recorded line identity is unstable.");
    }
}

function isRecordedMutationPayload(
    value: unknown
): value is InvoiceReturnRecordedMutationPayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const payload = value as Partial<InvoiceReturnRecordedMutationPayload>;

    return (
        payload.kind === "create_recorded"
        || payload.kind === "update_recorded"
    )
        && (payload.expected === null || isJsonObject(payload.expected))
        && isJsonObject(payload.intended);
}

function revisionOf(invoiceReturn: InvoiceReturn): number {
    return typeof invoiceReturn.revision === "number"
        && Number.isInteger(invoiceReturn.revision)
        && invoiceReturn.revision >= 0
        ? invoiceReturn.revision
        : 0;
}

function toInvoiceReturnJson(value: InvoiceReturn): JsonObject {
    return toJsonObject(JSON.parse(JSON.stringify(value)) as unknown);
}

function isJsonObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireKeySafeText(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`InvoiceReturn cloud ${field} is not key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`InvoiceReturn cloud ${field} is required.`);
    }

    return normalized;
}
