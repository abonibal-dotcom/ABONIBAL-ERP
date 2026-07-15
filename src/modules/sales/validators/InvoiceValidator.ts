import type { Invoice, InvoiceLine } from "../Invoice";
import { isInvoiceStatus } from "../InvoiceStatus";

export class InvoiceValidator {

    public validate(invoice: Invoice): string[] {

        const errors: string[] = [];

        if (!invoice.id.trim()) {
            errors.push("Invoice id is required.");
        }

        if (!invoice.accountId.trim()) {
            errors.push("Invoice accountId is required.");
        }

        if (!invoice.invoiceNumber.trim()) {
            errors.push("Invoice number is required.");
        }

        if (!isInvoiceStatus(invoice.status)) {
            errors.push("Invoice status is invalid.");
        }

        if (
            invoice.revision !== undefined
            && (
                !Number.isInteger(invoice.revision)
                || invoice.revision < 0
            )
        ) {
            errors.push("Invoice revision is invalid.");
        }

        if (invoice.issueCommandId !== undefined && !invoice.issueCommandId.trim()) {
            errors.push("Invoice issue command id cannot be empty.");
        }

        if (
            invoice.cancellationCommandId !== undefined
            && !invoice.cancellationCommandId.trim()
        ) {
            errors.push("Invoice cancellation command id cannot be empty.");
        }

        if (!Array.isArray(invoice.lines) || invoice.lines.length === 0) {
            errors.push("Invoice must include at least one line.");
        } else {
            const lineIds = new Set<string>();

            for (const line of invoice.lines) {
                errors.push(...this.validateLine(line));

                if (lineIds.has(line.id)) {
                    errors.push("Invoice line id must be unique.");
                }

                lineIds.add(line.id);
            }
        }

        if (!isFiniteCurrency(invoice.subtotal)) {
            errors.push("Invoice subtotal must be a finite number.");
        }

        if (!isFiniteCurrency(invoice.discount)) {
            errors.push("Invoice discount must be a finite number.");
        }

        if (!isFiniteCurrency(invoice.tax)) {
            errors.push("Invoice tax must be a finite number.");
        }

        if (!isFiniteCurrency(invoice.total)) {
            errors.push("Invoice total must be a finite number.");
        }

        if (!invoice.createdAt.trim()) {
            errors.push("Invoice createdAt is required.");
        }

        if (!invoice.createdBy.trim()) {
            errors.push("Invoice createdBy is required.");
        }

        if (!invoice.updatedAt.trim()) {
            errors.push("Invoice updatedAt is required.");
        }

        if (!invoice.updatedBy.trim()) {
            errors.push("Invoice updatedBy is required.");
        }

        return errors;

    }

    private validateLine(line: InvoiceLine): string[] {

        const errors: string[] = [];

        if (!line.id.trim()) {
            errors.push("Invoice line id is required.");
        }

        if (!line.productId.trim()) {
            errors.push("Invoice line productId is required.");
        }

        if (!line.productNameSnapshot.trim()) {
            errors.push("Invoice line product snapshot is required.");
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
            errors.push("Invoice line quantity must be a positive number.");
        }

        if (!isFiniteCurrency(line.unitPrice)) {
            errors.push("Invoice line unit price must be a finite number.");
        }

        if (!isFiniteCurrency(line.discount)) {
            errors.push("Invoice line discount must be a finite number.");
        }

        if (!isFiniteCurrency(line.tax)) {
            errors.push("Invoice line tax must be a finite number.");
        }

        if (!isFiniteCurrency(line.lineSubtotal)) {
            errors.push("Invoice line subtotal must be a finite number.");
        }

        if (!isFiniteCurrency(line.lineTotal)) {
            errors.push("Invoice line total must be a finite number.");
        }

        return errors;

    }

}

function isFiniteCurrency(value: number): boolean {

    return Number.isFinite(value) && value >= 0;

}
