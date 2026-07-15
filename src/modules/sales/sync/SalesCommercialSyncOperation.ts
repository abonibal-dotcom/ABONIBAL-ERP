import type { SyncOperation, SyncOperationInput } from "../../sync/SyncOperation";
import {
    canonicalChecksum,
    sha256Hex,
    toJsonObject,
    type JsonObject
} from "../../sync/master-data/CanonicalJson";
import type { Invoice } from "../Invoice";
import type { InvoiceReturn } from "../InvoiceReturn";

export type InvoiceLifecycleTransition = "issue" | "cancel";
export type InvoiceReturnLifecycleTransition = "execute";

interface CommercialLifecyclePayload {
    commandId: string;
    transition: string;
    expected: JsonObject;
    intended: JsonObject;
}

export interface InvoiceLifecycleTransitionPayload {
    commandId: string;
    transition: InvoiceLifecycleTransition;
    expected: Invoice;
    intended: Invoice;
}

export interface InvoiceReturnLifecycleTransitionPayload {
    commandId: string;
    transition: InvoiceReturnLifecycleTransition;
    expected: InvoiceReturn;
    intended: InvoiceReturn;
}

export function buildInvoiceLifecycleTransitionOperation(
    expected: Invoice,
    intended: Invoice,
    commandId: string,
    transition: InvoiceLifecycleTransition,
    createdAt: string
): SyncOperationInput {
    return buildCommercialLifecycleOperation(
        "invoices",
        expected,
        intended,
        commandId,
        transition,
        createdAt
    );
}

export function buildInvoiceReturnLifecycleTransitionOperation(
    expected: InvoiceReturn,
    intended: InvoiceReturn,
    commandId: string,
    createdAt: string
): SyncOperationInput {
    return buildCommercialLifecycleOperation(
        "invoiceReturns",
        expected,
        intended,
        commandId,
        "execute",
        createdAt
    );
}

export function readInvoiceLifecycleTransitionOperation(
    operation: SyncOperation
): InvoiceLifecycleTransitionPayload {
    const payload = readCommercialLifecyclePayload(operation, "invoices");

    if (payload.transition !== "issue" && payload.transition !== "cancel") {
        throw new Error("Invoice lifecycle transition is unsupported.");
    }

    const expected = payload.expected as unknown as Invoice;
    const intended = payload.intended as unknown as Invoice;
    const rebuilt = buildInvoiceLifecycleTransitionOperation(
        expected,
        intended,
        payload.commandId,
        payload.transition,
        operation.createdAt
    );

    assertOperationIdentity(operation, rebuilt);

    return {
        commandId: payload.commandId,
        transition: payload.transition,
        expected,
        intended
    };
}

export function readInvoiceReturnLifecycleTransitionOperation(
    operation: SyncOperation
): InvoiceReturnLifecycleTransitionPayload {
    const payload = readCommercialLifecyclePayload(operation, "invoiceReturns");

    if (payload.transition !== "execute") {
        throw new Error("Invoice return lifecycle transition is unsupported.");
    }

    const expected = payload.expected as unknown as InvoiceReturn;
    const intended = payload.intended as unknown as InvoiceReturn;
    const rebuilt = buildInvoiceReturnLifecycleTransitionOperation(
        expected,
        intended,
        payload.commandId,
        operation.createdAt
    );

    assertOperationIdentity(operation, rebuilt);

    return {
        commandId: payload.commandId,
        transition: "execute",
        expected,
        intended
    };
}

function buildCommercialLifecycleOperation(
    module: "invoices" | "invoiceReturns",
    expected: Invoice | InvoiceReturn,
    intended: Invoice | InvoiceReturn,
    commandId: string,
    transition: InvoiceLifecycleTransition | InvoiceReturnLifecycleTransition,
    createdAt: string
): SyncOperationInput {
    const normalizedCommandId = requireKeySafeText(commandId, "commandId");
    const normalizedCreatedAt = requireText(createdAt, "createdAt");
    const expectedRecord = toCommercialJsonObject(expected);
    const intendedRecord = toCommercialJsonObject(intended);
    const accountId = requireText(expected.accountId, "accountId");
    const recordId = requireKeySafeText(expected.id, "recordId");

    if (
        intended.accountId !== accountId
        || intended.id !== recordId
        || expected.id !== intended.id
    ) {
        throw new Error("Commercial lifecycle identity is immutable.");
    }

    const safePayload: CommercialLifecyclePayload = {
        commandId: normalizedCommandId,
        transition,
        expected: expectedRecord,
        intended: intendedRecord
    };
    const writeSetChecksum = canonicalChecksum(toJsonObject(safePayload));

    return {
        operationId: `${module}-${sha256Hex(
            `${normalizedCommandId}:${writeSetChecksum}`
        ).slice(0, 32)}`,
        accountId,
        module,
        recordId,
        operationType: "update",
        expectedRevision: revisionOf(expected),
        idempotencyKey: normalizedCommandId,
        writeSetChecksum,
        safePayload,
        createdAt: normalizedCreatedAt
    };
}

function readCommercialLifecyclePayload(
    operation: SyncOperation,
    module: "invoices" | "invoiceReturns"
): CommercialLifecyclePayload {
    if (
        operation.module !== module
        || operation.operationType !== "update"
        || !operation.safePayload
        || typeof operation.safePayload !== "object"
    ) {
        throw new Error("Commercial lifecycle operation is invalid.");
    }

    const candidate = operation.safePayload as Partial<CommercialLifecyclePayload>;
    const commandId = requireKeySafeText(candidate.commandId ?? "", "commandId");
    const transition = requireText(candidate.transition ?? "", "transition");
    const expected = toJsonObject(candidate.expected);
    const intended = toJsonObject(candidate.intended);

    if (
        expected.accountId !== operation.accountId
        || expected.id !== operation.recordId
        || intended.accountId !== operation.accountId
        || intended.id !== operation.recordId
        || commandId !== operation.idempotencyKey
    ) {
        throw new Error("Commercial lifecycle payload identity conflicts.");
    }

    return { commandId, transition, expected, intended };
}

function assertOperationIdentity(
    operation: SyncOperation,
    rebuilt: SyncOperationInput
): void {
    if (
        rebuilt.operationId !== operation.operationId
        || rebuilt.accountId !== operation.accountId
        || rebuilt.module !== operation.module
        || rebuilt.recordId !== operation.recordId
        || rebuilt.idempotencyKey !== operation.idempotencyKey
        || rebuilt.expectedRevision !== operation.expectedRevision
        || rebuilt.writeSetChecksum !== operation.writeSetChecksum
    ) {
        throw new Error("Commercial lifecycle operation identity conflicts.");
    }
}

function revisionOf(record: Invoice | InvoiceReturn): number {
    return typeof record.revision === "number"
        && Number.isInteger(record.revision)
        && record.revision >= 0
        ? record.revision
        : 0;
}

function toCommercialJsonObject(value: unknown): JsonObject {
    return toJsonObject(JSON.parse(JSON.stringify(value)) as unknown);
}

function requireKeySafeText(value: string, field: string): string {
    const normalized = requireText(value, field);

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Commercial lifecycle ${field} is not key-safe.`);
    }

    return normalized;
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Commercial lifecycle ${field} is required.`);
    }

    return normalized;
}
