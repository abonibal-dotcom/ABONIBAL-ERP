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

        return storedInvoices.filter(isInvoice);

    }

    public appendForAccount(accountId: string, invoice: Invoice): void {

        const invoices = this.allForAccount(accountId);

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

        invoices[invoiceIndex] = invoice;

        this.saveForAccount(accountId, invoices);

        return invoice;

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

    return isNonEmptyString(line.id)
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

