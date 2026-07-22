import {
    canonicalChecksum,
    normalizeJsonObject
} from "../trusted/CanonicalJson.js";
import {
    RETURN_ALLOCATION_SCHEMA_VERSION,
    type ReserveReturnAllocationRequest,
    type ReturnAllocationLineRequest
} from "./ReturnAllocationTypes.js";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,190}[A-Za-z0-9])?$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;

export type ReturnAllocationRequestWithoutChecksum = Omit<
    ReserveReturnAllocationRequest,
    "requestChecksum"
>;

export function validateReserveReturnAllocationRequest(
    value: unknown
): ReserveReturnAllocationRequest {
    const input = requireObject(value, "allocation request");
    assertExactKeys(input, [
        "schemaVersion",
        "accountId",
        "commandId",
        "commandType",
        "returnId",
        "invoiceId",
        "expectedReturnRevision",
        "expectedReturnChecksum",
        "requestChecksum",
        "lines"
    ]);

    if (input.schemaVersion !== RETURN_ALLOCATION_SCHEMA_VERSION) {
        invalid("Unsupported allocation schema version.");
    }

    const accountId = identifier(input.accountId, "accountId");
    const returnId = identifier(input.returnId, "returnId");
    const invoiceId = identifier(input.invoiceId, "invoiceId");
    const commandId = identifier(input.commandId, "commandId");
    const expectedCommandId = `invoice-return-execute-${returnId}`;

    if (commandId !== expectedCommandId) {
        invalid("commandId does not match the stable InvoiceReturn identity.");
    }
    if (input.commandType !== "invoiceReturn.execute") {
        invalid("commandType must be invoiceReturn.execute.");
    }
    if (!isRevision(input.expectedReturnRevision)) {
        invalid("expectedReturnRevision must be a non-negative integer.");
    }

    const expectedReturnChecksum = checksum(
        input.expectedReturnChecksum,
        "expectedReturnChecksum"
    );
    const requestChecksum = checksum(input.requestChecksum, "requestChecksum");

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
        invalid("At least one allocation line is required.");
    }

    const returnLineIds = new Set<string>();
    const invoiceLineIds = new Set<string>();
    const lines = input.lines.map((line, index) => {
        const normalized = validateLine(line, index);
        if (returnLineIds.has(normalized.returnLineId)) {
            invalid("Duplicate returnLineId is not allowed.");
        }
        if (invoiceLineIds.has(normalized.invoiceLineId)) {
            invalid("Duplicate invoiceLineId is not allowed.");
        }
        returnLineIds.add(normalized.returnLineId);
        invoiceLineIds.add(normalized.invoiceLineId);
        return normalized;
    }).sort((left, right) => left.returnLineId.localeCompare(right.returnLineId));

    const normalized: ReserveReturnAllocationRequest = {
        schemaVersion: RETURN_ALLOCATION_SCHEMA_VERSION,
        accountId,
        commandId,
        commandType: "invoiceReturn.execute",
        returnId,
        invoiceId,
        expectedReturnRevision: input.expectedReturnRevision,
        expectedReturnChecksum,
        requestChecksum,
        lines
    };

    if (calculateReturnAllocationRequestChecksum(normalized) !== requestChecksum) {
        invalid("requestChecksum does not match the canonical allocation request.");
    }

    return normalized;
}

export function calculateReturnAllocationRequestChecksum(
    request: ReturnAllocationRequestWithoutChecksum | ReserveReturnAllocationRequest
): string {
    const lines = [...request.lines]
        .map(line => ({
            returnLineId: line.returnLineId,
            invoiceLineId: line.invoiceLineId,
            quantity: line.quantity
        }))
        .sort((left, right) => left.returnLineId.localeCompare(right.returnLineId));

    return canonicalChecksum(normalizeJsonObject({
        schemaVersion: request.schemaVersion,
        accountId: request.accountId,
        commandId: request.commandId,
        commandType: request.commandType,
        returnId: request.returnId,
        invoiceId: request.invoiceId,
        expectedReturnRevision: request.expectedReturnRevision,
        expectedReturnChecksum: request.expectedReturnChecksum,
        lines
    }));
}

function validateLine(value: unknown, index: number): ReturnAllocationLineRequest {
    const line = requireObject(value, `lines[${index}]`);
    assertExactKeys(line, ["returnLineId", "invoiceLineId", "quantity"]);
    const quantity = line.quantity;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
        invalid(`lines[${index}].quantity must be finite and greater than zero.`);
    }

    return {
        returnLineId: identifier(line.returnLineId, `lines[${index}].returnLineId`),
        invoiceLineId: identifier(line.invoiceLineId, `lines[${index}].invoiceLineId`),
        quantity
    };
}

function identifier(value: unknown, field: string): string {
    if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
        invalid(`${field} is malformed.`);
    }
    return value;
}

function checksum(value: unknown, field: string): string {
    if (typeof value !== "string" || !CHECKSUM_PATTERN.test(value)) {
        invalid(`${field} is malformed.`);
    }
    return value;
}

function isRevision(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        invalid(`${field} must be an object.`);
    }
    return value as Record<string, unknown>;
}

function assertExactKeys(
    value: Record<string, unknown>,
    allowedKeys: readonly string[]
): void {
    const allowed = new Set(allowedKeys);
    const unexpected = Object.keys(value).find(key => !allowed.has(key));
    if (unexpected) {
        invalid(`Unknown field: ${unexpected}.`);
    }
}

function invalid(message: string): never {
    throw new Error(message);
}
