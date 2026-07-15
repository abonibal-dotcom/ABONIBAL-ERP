import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { Invoice, InvoiceLine } from "../Invoice";
import { isInvoiceStatus } from "../InvoiceStatus";
import { invoiceStorageKeyForAccount } from "../persistence/InvoicePersistenceKey";

export class InvoiceRepository extends Repository<Invoice> {

    public constructor(driver: Driver) {

        super("invoices", driver);

    }

    public allForAccount(accountId: string): Invoice[] {

        const storedInvoices = this.driver.read<unknown[]>(
            invoiceStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedInvoices)) {
            return [];
        }

        return storedInvoices
            .filter(isInvoice)
            .map(normalizeStoredInvoice);

    }

    public appendForAccount(accountId: string, invoice: Invoice): void {

        const invoices = this.allForAccount(accountId);

        if (invoice.accountId !== accountId) {
            throw new Error("Invoice account mismatch.");
        }

        if (invoice.status !== "draft" || invoiceRevision(invoice) !== 0) {
            throw new Error("Only a revision zero draft invoice can be created.");
        }

        if (invoices.some(currentInvoice => currentInvoice.id === invoice.id)) {
            throw new Error("Invoice identity already exists.");
        }

        invoices.push(invoice);

        this.saveForAccount(accountId, invoices);

    }

    public findForAccount(
        accountId: string,
        invoiceId: string
    ): Invoice | undefined {

        return this
            .allForAccount(accountId)
            .find(invoice => invoice.id === invoiceId);

    }

    public updateForAccount(
        accountId: string,
        invoiceId: string,
        invoice: Invoice
    ): Invoice | null {

        const invoices = this.allForAccount(accountId);
        const invoiceIndex = invoices.findIndex(
            currentInvoice => currentInvoice.id === invoiceId
        );

        if (invoiceIndex === -1) {
            return null;
        }

        const currentInvoice = invoices[invoiceIndex];

        if (
            invoice.accountId !== accountId
            || invoice.id !== invoiceId
            || currentInvoice.accountId !== accountId
        ) {
            throw new Error("Invoice immutable identity mismatch.");
        }

        if (invoiceRevision(invoice) !== invoiceRevision(currentInvoice) + 1) {
            throw new Error("Invoice revision conflict.");
        }

        if (!isAllowedInvoiceUpdate(currentInvoice, invoice)) {
            throw new Error("Invoice lifecycle or immutable data update is not allowed.");
        }

        invoices[invoiceIndex] = invoice;

        this.saveForAccount(accountId, invoices);

        return invoice;

    }

    public removeForAccount(
        accountId: string,
        invoiceId: string
    ): boolean {

        const invoices = this.allForAccount(accountId);
        const currentInvoice = invoices.find(
            invoice => invoice.id === invoiceId
        );

        if (!currentInvoice || currentInvoice.status !== "draft") {
            return false;
        }

        const remainingInvoices = invoices.filter(
            invoice => invoice.id !== invoiceId
        );

        if (remainingInvoices.length === invoices.length) {
            return false;
        }

        this.saveForAccount(accountId, remainingInvoices);

        return true;

    }

    private saveForAccount(accountId: string, invoices: Invoice[]): void {

        this.driver.write<Invoice[]>(
            invoiceStorageKeyForAccount(accountId),
            invoices
        );

    }

}

function isInvoice(value: unknown): value is Invoice {

    if (!value || typeof value !== "object") {
        return false;
    }

    const invoice = value as Partial<Invoice>;

    return isNonEmptyString(invoice.id)
        && isNonEmptyString(invoice.accountId)
        && isNonEmptyString(invoice.invoiceNumber)
        && isInvoiceStatus(invoice.status)
        && isOptionalRevision(invoice.revision)
        && isNullableRecord(invoice.customerSnapshot)
        && Array.isArray(invoice.lines)
        && invoice.lines.every(isInvoiceLine)
        && isFiniteNumber(invoice.subtotal)
        && isFiniteNumber(invoice.discount)
        && isFiniteNumber(invoice.tax)
        && isFiniteNumber(invoice.total)
        && isNonEmptyString(invoice.createdAt)
        && isNonEmptyString(invoice.createdBy)
        && isNonEmptyString(invoice.updatedAt)
        && isNonEmptyString(invoice.updatedBy);

}

function isInvoiceLine(value: unknown): value is InvoiceLine {

    if (!value || typeof value !== "object") {
        return false;
    }

    const line = value as Partial<InvoiceLine>;

    return isOptionalLineId(line.id)
        && isNonEmptyString(line.productId)
        && isNonEmptyString(line.productNameSnapshot)
        && isFiniteNumber(line.quantity)
        && isFiniteNumber(line.unitPrice)
        && isFiniteNumber(line.discount)
        && isFiniteNumber(line.tax)
        && isFiniteNumber(line.lineSubtotal)
        && isFiniteNumber(line.lineTotal);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isFiniteNumber(value: unknown): value is number {

    return typeof value === "number" && Number.isFinite(value);

}

function isNullableRecord(value: unknown): value is Record<string, unknown> | null {

    return value === null
        || (
            typeof value === "object"
            && !Array.isArray(value)
        );

}

function normalizeStoredInvoice(invoice: Invoice): Invoice {

    return {
        ...invoice,
        lines: invoice.lines.map(line => ({
            ...line,
            id: typeof line.id === "string" ? line.id : ""
        }))
    };

}

function isAllowedInvoiceUpdate(
    currentInvoice: Invoice,
    updatedInvoice: Invoice
): boolean {

    if (!hasStableInvoiceIdentity(currentInvoice, updatedInvoice)) {
        return false;
    }

    if (
        currentInvoice.status === "draft"
        && updatedInvoice.status === "draft"
    ) {
        return hasNoIssuedOrCancelledState(updatedInvoice)
            && updatedInvoice.lines.every(line =>
                !line.stockMovementId && !line.reversalStockMovementId
            );
    }

    if (
        currentInvoice.status === "draft"
        && updatedInvoice.status === "issued"
    ) {
        return canonicalJson(invoiceCommercialSnapshot(currentInvoice))
                === canonicalJson(invoiceCommercialSnapshot(updatedInvoice))
            && isNonEmptyString(updatedInvoice.issueCommandId)
            && isNonEmptyString(updatedInvoice.issuedAt)
            && isNonEmptyString(updatedInvoice.issuedBy)
            && !updatedInvoice.cancelledAt
            && !updatedInvoice.cancelledBy
            && !updatedInvoice.cancelReason
            && !updatedInvoice.cancellationCommandId
            && updatedInvoice.lines.every(line =>
                isNonEmptyString(line.stockMovementId)
                && !line.reversalStockMovementId
            );
    }

    if (
        currentInvoice.status === "issued"
        && updatedInvoice.status === "cancelled"
    ) {
        return canonicalJson(invoiceIssuedSnapshot(currentInvoice))
                === canonicalJson(invoiceIssuedSnapshot(updatedInvoice))
            && isNonEmptyString(updatedInvoice.cancellationCommandId)
            && isNonEmptyString(updatedInvoice.cancelledAt)
            && isNonEmptyString(updatedInvoice.cancelledBy)
            && isNonEmptyString(updatedInvoice.cancelReason)
            && updatedInvoice.lines.every(line =>
                isNonEmptyString(line.reversalStockMovementId)
            );
    }

    return false;

}

function hasStableInvoiceIdentity(
    currentInvoice: Invoice,
    updatedInvoice: Invoice
): boolean {

    return currentInvoice.id === updatedInvoice.id
        && currentInvoice.accountId === updatedInvoice.accountId
        && currentInvoice.invoiceNumber === updatedInvoice.invoiceNumber
        && currentInvoice.createdAt === updatedInvoice.createdAt
        && currentInvoice.createdBy === updatedInvoice.createdBy;

}

function hasNoIssuedOrCancelledState(invoice: Invoice): boolean {

    return !invoice.issueCommandId
        && !invoice.issuedAt
        && !invoice.issuedBy
        && !invoice.cancellationCommandId
        && !invoice.cancelledAt
        && !invoice.cancelledBy
        && !invoice.cancelReason;

}

function invoiceCommercialSnapshot(invoice: Invoice): unknown {

    return {
        customerId: invoice.customerId,
        customerSnapshot: invoice.customerSnapshot,
        lines: invoice.lines.map(line => ({
            id: line.id,
            productId: line.productId,
            productNameSnapshot: line.productNameSnapshot,
            skuSnapshot: line.skuSnapshot,
            barcodeSnapshot: line.barcodeSnapshot,
            unitSnapshot: line.unitSnapshot,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            tax: line.tax,
            lineSubtotal: line.lineSubtotal,
            lineTotal: line.lineTotal
        })),
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
        notes: invoice.notes
    };

}

function invoiceIssuedSnapshot(invoice: Invoice): unknown {

    return {
        commercial: invoiceCommercialSnapshot(invoice),
        issueCommandId: invoice.issueCommandId,
        issuedAt: invoice.issuedAt,
        issuedBy: invoice.issuedBy,
        stockMovementIds: invoice.lines.map(line => line.stockMovementId)
    };

}

function invoiceRevision(invoice: Invoice): number {

    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;

}

function isOptionalRevision(value: unknown): boolean {

    return value === undefined
        || (
            typeof value === "number"
            && Number.isInteger(value)
            && value >= 0
        );

}

function isOptionalLineId(value: unknown): boolean {

    return value === undefined
        || value === null
        || typeof value === "string";

}

function canonicalJson(value: unknown): string {

    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(",")}]`;
    }

    if (value && typeof value === "object") {
        return `{${Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
            .join(",")}}`;
    }

    return JSON.stringify(value) ?? "undefined";

}
