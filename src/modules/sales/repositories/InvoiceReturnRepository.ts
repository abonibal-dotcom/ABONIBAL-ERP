import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { InvoiceReturn, InvoiceReturnLine } from "../InvoiceReturn";
import { isInvoiceReturnStatus } from "../InvoiceReturnStatus";
import { invoiceReturnStorageKeyForAccount } from "../persistence/InvoiceReturnPersistenceKey";

export class InvoiceReturnRepository extends Repository<InvoiceReturn> {

    public constructor(driver: Driver) {

        super("invoiceReturns", driver);

    }

    public allForAccount(accountId: string): InvoiceReturn[] {

        const storedReturns = this.driver.read<unknown[]>(
            invoiceReturnStorageKeyForAccount(accountId)
        );

        if (!Array.isArray(storedReturns)) {
            return [];
        }

        return storedReturns.filter(isInvoiceReturn);

    }

    public appendForAccount(
        accountId: string,
        invoiceReturn: InvoiceReturn
    ): void {

        const invoiceReturns = this.allForAccount(accountId);

        invoiceReturns.push(invoiceReturn);

        this.saveForAccount(accountId, invoiceReturns);

    }

    public findForAccount(
        accountId: string,
        invoiceReturnId: string
    ): InvoiceReturn | undefined {

        return this
            .allForAccount(accountId)
            .find(invoiceReturn => invoiceReturn.id === invoiceReturnId);

    }

    public updateForAccount(
        accountId: string,
        invoiceReturnId: string,
        updatedReturn: InvoiceReturn
    ): InvoiceReturn | null {

        const invoiceReturns = this.allForAccount(accountId);
        const invoiceReturnIndex = invoiceReturns.findIndex(
            invoiceReturn => invoiceReturn.id === invoiceReturnId
        );

        if (invoiceReturnIndex === -1) {
            return null;
        }

        invoiceReturns[invoiceReturnIndex] = updatedReturn;

        this.saveForAccount(accountId, invoiceReturns);

        return updatedReturn;

    }

    public allForInvoice(
        accountId: string,
        invoiceId: string
    ): InvoiceReturn[] {

        return this
            .allForAccount(accountId)
            .filter(invoiceReturn => invoiceReturn.invoiceId === invoiceId);

    }

    private saveForAccount(
        accountId: string,
        invoiceReturns: InvoiceReturn[]
    ): void {

        this.driver.write<InvoiceReturn[]>(
            invoiceReturnStorageKeyForAccount(accountId),
            invoiceReturns
        );

    }

}

function isInvoiceReturn(value: unknown): value is InvoiceReturn {

    if (!value || typeof value !== "object") {
        return false;
    }

    const invoiceReturn = value as Partial<InvoiceReturn>;

    return isNonEmptyString(invoiceReturn.id)
        && isNonEmptyString(invoiceReturn.accountId)
        && isNonEmptyString(invoiceReturn.returnNumber)
        && isNonEmptyString(invoiceReturn.invoiceId)
        && isNonEmptyString(invoiceReturn.invoiceNumberSnapshot)
        && isInvoiceReturnStatus(invoiceReturn.status)
        && isNonEmptyString(invoiceReturn.reason)
        && Array.isArray(invoiceReturn.lines)
        && invoiceReturn.lines.every(isInvoiceReturnLine)
        && isFiniteNumber(invoiceReturn.total)
        && isNonEmptyString(invoiceReturn.createdAt)
        && isNonEmptyString(invoiceReturn.createdBy)
        && isNonEmptyString(invoiceReturn.updatedAt)
        && isNonEmptyString(invoiceReturn.updatedBy);

}

function isInvoiceReturnLine(value: unknown): value is InvoiceReturnLine {

    if (!value || typeof value !== "object") {
        return false;
    }

    const line = value as Partial<InvoiceReturnLine>;

    return isNonEmptyString(line.id)
        && isNonEmptyString(line.invoiceLineId)
        && isNonEmptyString(line.productId)
        && isNonEmptyString(line.productNameSnapshot)
        && isFiniteNumber(line.quantity)
        && isFiniteNumber(line.unitPriceSnapshot)
        && isFiniteNumber(line.lineTotalSnapshot)
        && isPositiveNumber(line.returnQuantity);

}

function isNonEmptyString(value: unknown): value is string {

    return typeof value === "string" && value.trim().length > 0;

}

function isFiniteNumber(value: unknown): value is number {

    return typeof value === "number" && Number.isFinite(value);

}

function isPositiveNumber(value: unknown): value is number {

    return isFiniteNumber(value) && value > 0;

}
