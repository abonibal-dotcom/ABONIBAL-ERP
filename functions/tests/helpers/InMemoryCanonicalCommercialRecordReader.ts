import type { CanonicalCommercialRecordReader } from "../../src/allocation/CanonicalCommercialRecordReader.js";
import type {
    CanonicalInvoice,
    CanonicalInvoiceReturn
} from "../../src/allocation/ReturnAllocationTypes.js";

export class InMemoryCanonicalCommercialRecordReader
implements CanonicalCommercialRecordReader {
    readonly invoices = new Map<string, CanonicalInvoice>();
    readonly returns = new Map<string, CanonicalInvoiceReturn>();
    invoiceReads = 0;
    returnReads = 0;

    async findInvoice(
        accountId: string,
        invoiceId: string
    ): Promise<CanonicalInvoice | null> {
        this.invoiceReads += 1;
        return cloneOrNull(this.invoices.get(`${accountId}/${invoiceId}`));
    }

    async findInvoiceReturn(
        accountId: string,
        returnId: string
    ): Promise<CanonicalInvoiceReturn | null> {
        this.returnReads += 1;
        return cloneOrNull(this.returns.get(`${accountId}/${returnId}`));
    }

    putInvoice(invoice: CanonicalInvoice): void {
        this.invoices.set(`${invoice.accountId}/${invoice.id}`, clone(invoice));
    }

    putReturn(invoiceReturn: CanonicalInvoiceReturn): void {
        this.returns.set(
            `${invoiceReturn.accountId}/${invoiceReturn.id}`,
            clone(invoiceReturn)
        );
    }
}

function cloneOrNull<T>(value: T | undefined): T | null {
    return value === undefined ? null : clone(value);
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
