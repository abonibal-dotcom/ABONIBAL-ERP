import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import type { InvoiceReturn, InvoiceReturnLine } from "../InvoiceReturn";
import { isInvoiceReturnStatus } from "../InvoiceReturnStatus";
import { invoiceReturnStorageKeyForAccount } from "../persistence/InvoiceReturnPersistenceKey";

export interface InvoiceReturnRepositoryPort {
    allForAccount(accountId: string): InvoiceReturn[];
    appendForAccount(accountId: string, invoiceReturn: InvoiceReturn): void;
    findForAccount(
        accountId: string,
        invoiceReturnId: string
    ): InvoiceReturn | undefined;
    updateForAccount(
        accountId: string,
        invoiceReturnId: string,
        updatedReturn: InvoiceReturn
    ): InvoiceReturn | null;
    allForInvoice(accountId: string, invoiceId: string): InvoiceReturn[];
}

export class InvoiceReturnRepository extends Repository<InvoiceReturn>
implements InvoiceReturnRepositoryPort {

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

        return storedReturns
            .filter(isInvoiceReturn)
            .map(normalizeStoredInvoiceReturn);

    }

    public appendForAccount(
        accountId: string,
        invoiceReturn: InvoiceReturn
    ): void {

        const invoiceReturns = this.allForAccount(accountId);

        if (invoiceReturn.accountId !== accountId) {
            throw new Error("Invoice return account mismatch.");
        }

        if (
            invoiceReturn.status !== "recorded"
            || invoiceReturnRevision(invoiceReturn) !== 0
        ) {
            throw new Error("Only a revision zero recorded return can be created.");
        }

        if (invoiceReturns.some(current => current.id === invoiceReturn.id)) {
            throw new Error("Invoice return identity already exists.");
        }

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

    public appendAuthoritativeForAccount(
        accountId: string,
        invoiceReturn: InvoiceReturn
    ): void {

        const invoiceReturns = this.allForAccount(accountId);

        if (
            invoiceReturn.accountId !== accountId
            || invoiceReturns.some(current => current.id === invoiceReturn.id)
            || !isCompleteAuthoritativeState(invoiceReturn)
        ) {
            throw new Error("Authoritative InvoiceReturn identity conflicts.");
        }

        invoiceReturns.push(invoiceReturn);
        this.saveForAccount(accountId, invoiceReturns);

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

        const currentReturn = invoiceReturns[invoiceReturnIndex];

        if (
            updatedReturn.accountId !== accountId
            || updatedReturn.id !== invoiceReturnId
            || currentReturn.accountId !== accountId
        ) {
            throw new Error("Invoice return immutable identity mismatch.");
        }

        if (
            invoiceReturnRevision(updatedReturn)
            !== invoiceReturnRevision(currentReturn) + 1
        ) {
            throw new Error("Invoice return revision conflict.");
        }

        if (!isAllowedInvoiceReturnUpdate(currentReturn, updatedReturn)) {
            throw new Error(
                "Invoice return lifecycle or immutable data update is not allowed."
            );
        }

        invoiceReturns[invoiceReturnIndex] = updatedReturn;

        this.saveForAccount(accountId, invoiceReturns);

        return updatedReturn;

    }

    public applyAuthoritativeForAccount(
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

        const currentReturn = invoiceReturns[invoiceReturnIndex];

        if (
            updatedReturn.accountId !== accountId
            || updatedReturn.id !== invoiceReturnId
            || currentReturn.accountId !== accountId
            || invoiceReturnRevision(updatedReturn)
                <= invoiceReturnRevision(currentReturn)
            || !isAllowedAuthoritativeInvoiceReturnState(
                currentReturn,
                updatedReturn
            )
        ) {
            throw new Error("Authoritative InvoiceReturn state is not safe to apply.");
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
        && isOptionalRevision(invoiceReturn.revision)
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

    return isOptionalLineId(line.id)
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

function normalizeStoredInvoiceReturn(
    invoiceReturn: InvoiceReturn
): InvoiceReturn {

    return {
        ...invoiceReturn,
        lines: invoiceReturn.lines.map(line => ({
            ...line,
            id: typeof line.id === "string" ? line.id : ""
        }))
    };

}

function isAllowedInvoiceReturnUpdate(
    currentReturn: InvoiceReturn,
    updatedReturn: InvoiceReturn
): boolean {

    if (!hasStableInvoiceReturnIdentity(currentReturn, updatedReturn)) {
        return false;
    }

    if (
        currentReturn.status === "recorded"
        && updatedReturn.status === "recorded"
    ) {
        return !updatedReturn.executionCommandId
            && updatedReturn.lines.every(line => !line.returnStockMovementId)
            && hasStableRecordedLineIdentities(currentReturn, updatedReturn);
    }

    if (
        currentReturn.status === "recorded"
        && updatedReturn.status === "executed"
    ) {
        return canonicalJson(invoiceReturnCommercialSnapshot(currentReturn))
                === canonicalJson(invoiceReturnCommercialSnapshot(updatedReturn))
            && isNonEmptyString(updatedReturn.executionCommandId)
            && updatedReturn.lines.every(line =>
                isNonEmptyString(line.returnStockMovementId)
            );
    }

    return false;

}

function isAllowedAuthoritativeInvoiceReturnState(
    currentReturn: InvoiceReturn,
    updatedReturn: InvoiceReturn
): boolean {

    if (!hasStableInvoiceReturnIdentity(currentReturn, updatedReturn)) {
        return false;
    }

    if (currentReturn.status === "recorded") {
        if (updatedReturn.status === "recorded") {
            return isCompleteRecordedState(updatedReturn)
                && hasStableRecordedLineIdentities(
                    currentReturn,
                    updatedReturn
                );
        }

        return updatedReturn.status === "executed"
            && canonicalJson(invoiceReturnCommercialSnapshot(currentReturn))
                === canonicalJson(invoiceReturnCommercialSnapshot(updatedReturn))
            && isCompleteExecutedState(updatedReturn);
    }

    return false;

}

function isCompleteAuthoritativeState(invoiceReturn: InvoiceReturn): boolean {

    return invoiceReturn.status === "recorded"
        ? isCompleteRecordedState(invoiceReturn)
        : isCompleteExecutedState(invoiceReturn);

}

function isCompleteRecordedState(invoiceReturn: InvoiceReturn): boolean {

    return !invoiceReturn.executionCommandId
        && invoiceReturn.lines.every(line => !line.returnStockMovementId);

}

function isCompleteExecutedState(invoiceReturn: InvoiceReturn): boolean {

    return invoiceReturn.status === "executed"
        && isNonEmptyString(invoiceReturn.executionCommandId)
        && invoiceReturn.lines.every(line =>
            isNonEmptyString(line.returnStockMovementId)
        );

}

function hasStableRecordedLineIdentities(
    currentReturn: InvoiceReturn,
    updatedReturn: InvoiceReturn
): boolean {

    const currentByInvoiceLine = new Map(
        currentReturn.lines.map(line => [line.invoiceLineId, line.id])
    );

    return updatedReturn.lines.every(line => {
        const currentId = currentByInvoiceLine.get(line.invoiceLineId);

        return currentId === undefined || currentId === line.id;
    });

}

function hasStableInvoiceReturnIdentity(
    currentReturn: InvoiceReturn,
    updatedReturn: InvoiceReturn
): boolean {

    return currentReturn.id === updatedReturn.id
        && currentReturn.accountId === updatedReturn.accountId
        && currentReturn.returnNumber === updatedReturn.returnNumber
        && currentReturn.invoiceId === updatedReturn.invoiceId
        && currentReturn.invoiceNumberSnapshot
            === updatedReturn.invoiceNumberSnapshot
        && currentReturn.createdAt === updatedReturn.createdAt
        && currentReturn.createdBy === updatedReturn.createdBy;

}

function invoiceReturnCommercialSnapshot(invoiceReturn: InvoiceReturn): unknown {

    return {
        reason: invoiceReturn.reason,
        notes: invoiceReturn.notes,
        lines: invoiceReturn.lines.map(line => ({
            id: line.id,
            invoiceLineId: line.invoiceLineId,
            productId: line.productId,
            productNameSnapshot: line.productNameSnapshot,
            quantity: line.quantity,
            unitPriceSnapshot: line.unitPriceSnapshot,
            lineTotalSnapshot: line.lineTotalSnapshot,
            returnQuantity: line.returnQuantity,
            originalSaleDeductionMovementId:
                line.originalSaleDeductionMovementId
        })),
        total: invoiceReturn.total
    };

}

function invoiceReturnRevision(invoiceReturn: InvoiceReturn): number {

    return typeof invoiceReturn.revision === "number"
        && Number.isInteger(invoiceReturn.revision)
        && invoiceReturn.revision >= 0
        ? invoiceReturn.revision
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
