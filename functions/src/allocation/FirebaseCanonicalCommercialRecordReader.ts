import type { Database } from "firebase-admin/database";
import {
    canonicalChecksum,
    normalizeJsonObject,
    type JsonObject
} from "../trusted/CanonicalJson.js";
import {
    CanonicalRecordStateError,
    type CanonicalCommercialRecordReader
} from "./CanonicalCommercialRecordReader.js";
import type {
    CanonicalInvoice,
    CanonicalInvoiceReturn
} from "./ReturnAllocationTypes.js";

export class FirebaseCanonicalCommercialRecordReader
implements CanonicalCommercialRecordReader {
    constructor(private readonly database: Database) {}

    async findInvoice(
        accountId: string,
        invoiceId: string
    ): Promise<CanonicalInvoice | null> {
        const snapshot = await this.database.ref(
            `accounts/${accountId}/invoices/${invoiceId}`
        ).get();
        return snapshot.exists()
            ? parseInvoiceEnvelope(snapshot.val(), accountId, invoiceId)
            : null;
    }

    async findInvoiceReturn(
        accountId: string,
        returnId: string
    ): Promise<CanonicalInvoiceReturn | null> {
        const snapshot = await this.database.ref(
            `accounts/${accountId}/invoiceReturns/${returnId}`
        ).get();
        return snapshot.exists()
            ? parseInvoiceReturnEnvelope(snapshot.val(), accountId, returnId)
            : null;
    }
}

function parseInvoiceEnvelope(
    value: unknown,
    accountId: string,
    invoiceId: string
): CanonicalInvoice {
    const { data, meta } = envelope(value, "Invoice");
    const status = data.status;
    const revision = data.revision;
    if (
        data.id !== invoiceId
        || data.accountId !== accountId
        || !isInvoiceStatus(status)
        || !isRevision(revision)
        || meta.revision !== revision
        || meta.lifecycleStatus !== status
        || meta.tombstone !== false
        || !Array.isArray(data.lines)
    ) {
        malformed("Invoice canonical identity or lifecycle is invalid.");
    }

    const seen = new Set<string>();
    const lines = data.lines.map((valueLine, index) => {
        if (!isObject(valueLine)) {
            malformed(`Invoice line ${index} is malformed.`);
        }
        const id = valueLine.id;
        const quantity = valueLine.quantity;
        if (!isIdentifier(id) || !isPositiveFinite(quantity) || seen.has(id)) {
            malformed(`Invoice line ${index} identity or quantity is invalid.`);
        }
        seen.add(id);
        return { id, soldQuantity: quantity };
    });
    if (lines.length === 0) {
        malformed("Invoice must contain at least one immutable line.");
    }

    return {
        id: invoiceId,
        accountId,
        status,
        revision,
        recordChecksum: meta.recordChecksum,
        lines
    };
}

function parseInvoiceReturnEnvelope(
    value: unknown,
    accountId: string,
    returnId: string
): CanonicalInvoiceReturn {
    const { data, meta } = envelope(value, "InvoiceReturn");
    const status = data.status;
    const revision = data.revision;
    const invoiceId = data.invoiceId;
    if (
        data.id !== returnId
        || data.accountId !== accountId
        || !isIdentifier(invoiceId)
        || !isInvoiceReturnStatus(status)
        || !isRevision(revision)
        || meta.revision !== revision
        || meta.lifecycleStatus !== status
        || meta.tombstone !== false
        || !Array.isArray(data.lines)
    ) {
        malformed("InvoiceReturn canonical identity or lifecycle is invalid.");
    }

    const returnLineIds = new Set<string>();
    const invoiceLineIds = new Set<string>();
    const lines = data.lines.map((valueLine, index) => {
        if (!isObject(valueLine)) {
            malformed(`InvoiceReturn line ${index} is malformed.`);
        }
        const id = valueLine.id;
        const linkedInvoiceLineId = valueLine.invoiceLineId;
        const quantity = valueLine.returnQuantity;
        if (
            !isIdentifier(id)
            || !isIdentifier(linkedInvoiceLineId)
            || !isPositiveFinite(quantity)
            || returnLineIds.has(id)
            || invoiceLineIds.has(linkedInvoiceLineId)
        ) {
            malformed(`InvoiceReturn line ${index} identity or quantity is invalid.`);
        }
        returnLineIds.add(id);
        invoiceLineIds.add(linkedInvoiceLineId);
        return {
            id,
            invoiceLineId: linkedInvoiceLineId,
            returnQuantity: quantity
        };
    });
    if (lines.length === 0) {
        malformed("InvoiceReturn must contain at least one line.");
    }

    return {
        id: returnId,
        accountId,
        invoiceId,
        status,
        revision,
        recordChecksum: meta.recordChecksum,
        lines
    };
}

function envelope(
    value: unknown,
    label: string
): {
    data: JsonObject;
    meta: {
        revision: number;
        lifecycleStatus: unknown;
        tombstone: boolean;
        recordChecksum: string;
    };
} {
    if (!isObject(value) || !isObject(value.data) || !isObject(value.meta)) {
        malformed(`${label} cloud envelope is malformed.`);
    }
    const data = normalizeJsonObject(value.data);
    const meta = value.meta;
    if (
        meta.schemaVersion !== 1
        || !isRevision(meta.revision)
        || typeof meta.tombstone !== "boolean"
        || !isChecksum(meta.recordChecksum)
        || canonicalChecksum(data) !== meta.recordChecksum
    ) {
        malformed(`${label} cloud envelope metadata is invalid.`);
    }
    return {
        data,
        meta: {
            revision: meta.revision,
            lifecycleStatus: meta.lifecycleStatus,
            tombstone: meta.tombstone,
            recordChecksum: meta.recordChecksum
        }
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
    return typeof value === "string"
        && value.length > 0
        && !/[.#$\[\]\/]/.test(value);
}

function isChecksum(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRevision(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isInvoiceStatus(value: unknown): value is CanonicalInvoice["status"] {
    return value === "draft" || value === "issued" || value === "cancelled";
}

function isInvoiceReturnStatus(
    value: unknown
): value is CanonicalInvoiceReturn["status"] {
    return value === "recorded" || value === "executed";
}

function malformed(message: string): never {
    throw new CanonicalRecordStateError(message);
}
