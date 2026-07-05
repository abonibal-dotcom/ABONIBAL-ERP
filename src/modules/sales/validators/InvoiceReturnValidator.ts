import type { InvoiceReturn, InvoiceReturnLine } from "../InvoiceReturn";
import { isInvoiceReturnStatus } from "../InvoiceReturnStatus";

export class InvoiceReturnValidator {

    public validate(invoiceReturn: InvoiceReturn): string[] {

        const errors: string[] = [];

        if (!invoiceReturn.id.trim()) {
            errors.push("Invoice return id is required.");
        }

        if (!invoiceReturn.accountId.trim()) {
            errors.push("Invoice return accountId is required.");
        }

        if (!invoiceReturn.returnNumber.trim()) {
            errors.push("Invoice return number is required.");
        }

        if (!invoiceReturn.invoiceId.trim()) {
            errors.push("Invoice return invoiceId is required.");
        }

        if (!invoiceReturn.invoiceNumberSnapshot.trim()) {
            errors.push("Invoice return invoice number snapshot is required.");
        }

        if (!isInvoiceReturnStatus(invoiceReturn.status)) {
            errors.push("Invoice return status is invalid.");
        }

        if (!invoiceReturn.reason.trim()) {
            errors.push("Invoice return reason is required.");
        }

        if (!Array.isArray(invoiceReturn.lines) || invoiceReturn.lines.length === 0) {
            errors.push("Invoice return must include at least one line.");
        } else {
            for (const line of invoiceReturn.lines) {
                errors.push(...this.validateLine(line));
            }
        }

        if (!isFiniteCurrency(invoiceReturn.total)) {
            errors.push("Invoice return total must be a finite number.");
        }

        if (!invoiceReturn.createdAt.trim()) {
            errors.push("Invoice return createdAt is required.");
        }

        if (!invoiceReturn.createdBy.trim()) {
            errors.push("Invoice return createdBy is required.");
        }

        if (!invoiceReturn.updatedAt.trim()) {
            errors.push("Invoice return updatedAt is required.");
        }

        if (!invoiceReturn.updatedBy.trim()) {
            errors.push("Invoice return updatedBy is required.");
        }

        return errors;

    }

    private validateLine(line: InvoiceReturnLine): string[] {

        const errors: string[] = [];

        if (!line.id.trim()) {
            errors.push("Invoice return line id is required.");
        }

        if (!line.invoiceLineId.trim()) {
            errors.push("Invoice return line invoiceLineId is required.");
        }

        if (!line.productId.trim()) {
            errors.push("Invoice return line productId is required.");
        }

        if (!line.productNameSnapshot.trim()) {
            errors.push("Invoice return line Product snapshot is required.");
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
            errors.push("Invoice return line original quantity must be positive.");
        }

        if (!isFiniteCurrency(line.unitPriceSnapshot)) {
            errors.push("Invoice return line unit price snapshot must be a finite number.");
        }

        if (!isFiniteCurrency(line.lineTotalSnapshot)) {
            errors.push("Invoice return line total snapshot must be a finite number.");
        }

        if (!Number.isFinite(line.returnQuantity) || line.returnQuantity <= 0) {
            errors.push("Invoice return line return quantity must be positive.");
        }

        return errors;

    }

}

function isFiniteCurrency(value: number): boolean {

    return Number.isFinite(value) && value >= 0;

}
