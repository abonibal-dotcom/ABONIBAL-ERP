import type { AuthStateService } from "../../auth/AuthStateService";
import type { Invoice, InvoiceLine } from "../Invoice";
import type {
    InvoiceReturn,
    InvoiceReturnInput,
    InvoiceReturnLine,
    InvoiceReturnLineInput
} from "../InvoiceReturn";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoiceReturnRepository } from "../repositories/InvoiceReturnRepository";
import { InvoiceReturnValidator } from "../validators/InvoiceReturnValidator";

export class InvoiceReturnService {

    private readonly repository: InvoiceReturnRepository;
    private readonly validator: InvoiceReturnValidator;
    private readonly invoiceRepository: InvoiceRepository;
    private readonly authStateService: AuthStateService;

    public constructor(
        repository: InvoiceReturnRepository,
        validator: InvoiceReturnValidator,
        invoiceRepository: InvoiceRepository,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.invoiceRepository = invoiceRepository;
        this.authStateService = authStateService;

    }

    public getAll(): InvoiceReturn[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository.allForAccount(accountContext.accountId);

    }

    public getById(invoiceReturnId: string): InvoiceReturn | undefined {

        const accountContext = this.currentAccountContext();
        const normalizedInvoiceReturnId = invoiceReturnId.trim();

        if (!accountContext || !normalizedInvoiceReturnId) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceReturnId
        );

    }

    public getByInvoiceId(invoiceId: string): InvoiceReturn[] {

        const accountContext = this.currentAccountContext();
        const normalizedInvoiceId = invoiceId.trim();

        if (!accountContext || !normalizedInvoiceId) {
            return [];
        }

        return this.repository.allForInvoice(
            accountContext.accountId,
            normalizedInvoiceId
        );

    }

    public createReturnRecord(input: InvoiceReturnInput): InvoiceReturnResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceReturnResult("Authenticated account is required.");
        }

        const validation = this.validateReturnRequest(input);

        if (!validation.success || !validation.invoice) {
            return failedInvoiceReturnResult(validation.errors);
        }

        const createdAt = new Date().toISOString();
        const existingReturns = this.repository.allForAccount(
            accountContext.accountId
        );
        const lines = buildReturnLines(validation.invoice, input.lines);
        const invoiceReturn: InvoiceReturn = {
            id: crypto.randomUUID(),
            accountId: accountContext.accountId,
            returnNumber: generateReturnNumber(existingReturns, createdAt),
            invoiceId: validation.invoice.id,
            invoiceNumberSnapshot: validation.invoice.invoiceNumber,
            status: "recorded",
            reason: input.reason.trim(),
            notes: normalizeOptionalString(input.notes),
            lines,
            total: lines.reduce(
                (total, line) =>
                    total + line.returnQuantity * line.unitPriceSnapshot,
                0
            ),
            createdAt,
            createdBy: accountContext.userId,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(invoiceReturn);

        if (errors.length > 0) {
            return failedInvoiceReturnResult(errors);
        }

        this.repository.appendForAccount(
            accountContext.accountId,
            invoiceReturn
        );

        return {
            success: true,
            errors: [],
            invoiceReturn
        };

    }

    public validateReturnRequest(
        input: InvoiceReturnInput
    ): InvoiceReturnValidationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceReturnValidation(
                "Authenticated account is required."
            );
        }

        if (!input || typeof input !== "object") {
            return failedInvoiceReturnValidation(
                "Invoice return request is required."
            );
        }

        const normalizedInvoiceId = normalizeRequiredString(input.invoiceId);

        if (!normalizedInvoiceId) {
            return failedInvoiceReturnValidation("Invoice id is required.");
        }

        const invoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceId
        );

        if (!invoice) {
            return failedInvoiceReturnValidation("Invoice not found.");
        }

        if (invoice.status !== "issued") {
            return failedInvoiceReturnValidation(
                "Only issued invoices can be returned."
            );
        }

        if (!normalizeRequiredString(input.reason)) {
            return failedInvoiceReturnValidation("Return reason is required.");
        }

        if (!Array.isArray(input.lines) || input.lines.length === 0) {
            return failedInvoiceReturnValidation(
                "Invoice return must include at least one line."
            );
        }

        const errors: string[] = [];
        const seenInvoiceLineIds = new Set<string>();

        for (const lineInput of input.lines) {
            if (!lineInput || typeof lineInput !== "object") {
                errors.push("Invoice return line request is required.");
                continue;
            }

            const normalizedInvoiceLineId = normalizeRequiredString(
                lineInput.invoiceLineId
            );

            if (seenInvoiceLineIds.has(normalizedInvoiceLineId)) {
                errors.push("Duplicate invoice return line is not allowed.");
                continue;
            }

            seenInvoiceLineIds.add(normalizedInvoiceLineId);
            errors.push(...this.validateReturnLineRequest(invoice, lineInput));
        }

        if (errors.length > 0) {
            return failedInvoiceReturnValidation(errors);
        }

        return {
            success: true,
            errors: [],
            invoice
        };

    }

    public getReturnedQuantity(
        invoiceId: string,
        invoiceLineId: string
    ): number {

        const accountContext = this.currentAccountContext();
        const normalizedInvoiceId = invoiceId.trim();
        const normalizedInvoiceLineId = invoiceLineId.trim();

        if (!accountContext || !normalizedInvoiceId || !normalizedInvoiceLineId) {
            return 0;
        }

        return this.repository
            .allForInvoice(accountContext.accountId, normalizedInvoiceId)
            .flatMap(invoiceReturn => invoiceReturn.lines)
            .filter(line => line.invoiceLineId === normalizedInvoiceLineId)
            .reduce((total, line) => total + line.returnQuantity, 0);

    }

    public getRemainingReturnableQuantity(
        invoiceId: string,
        invoiceLineId: string
    ): number {

        const accountContext = this.currentAccountContext();
        const normalizedInvoiceId = invoiceId.trim();
        const normalizedInvoiceLineId = invoiceLineId.trim();

        if (!accountContext || !normalizedInvoiceId || !normalizedInvoiceLineId) {
            return 0;
        }

        const invoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceId
        );
        const line = invoice?.lines.find(
            currentLine => currentLine.id === normalizedInvoiceLineId
        );

        if (!line) {
            return 0;
        }

        return Math.max(
            0,
            line.quantity - this.getReturnedQuantity(
                normalizedInvoiceId,
                normalizedInvoiceLineId
            )
        );

    }

    private validateReturnLineRequest(
        invoice: Invoice,
        lineInput: InvoiceReturnLineInput
    ): string[] {

        const errors: string[] = [];
        const normalizedInvoiceLineId = normalizeRequiredString(
            lineInput.invoiceLineId
        );
        const invoiceLine = invoice.lines.find(
            line => line.id === normalizedInvoiceLineId
        );

        if (!normalizedInvoiceLineId) {
            errors.push("Invoice line id is required.");
            return errors;
        }

        if (!invoiceLine) {
            errors.push("Invoice line not found.");
            return errors;
        }

        if (!invoiceLine.stockMovementId?.trim()) {
            errors.push("Invoice line original stock movement is required.");
        }

        if (!Number.isFinite(lineInput.returnQuantity) || lineInput.returnQuantity <= 0) {
            errors.push("Return quantity must be positive.");
            return errors;
        }

        const remainingQuantity = this.getRemainingReturnableQuantity(
            invoice.id,
            invoiceLine.id
        );

        if (lineInput.returnQuantity > remainingQuantity) {
            errors.push("Return quantity exceeds remaining returnable quantity.");
        }

        return errors;

    }

    private currentAccountContext(): InvoiceReturnAccountContext | null {

        const state = this.authStateService.getState();

        if (state.status !== "authenticated") {
            return null;
        }

        const accountId = state.session.account.id.trim();
        const userId = state.session.user.id.trim();

        if (!accountId || !userId) {
            return null;
        }

        return {
            accountId,
            userId
        };

    }

}

export interface InvoiceReturnResult {

    success: boolean;
    errors: string[];
    invoiceReturn: InvoiceReturn | null;

}

export interface InvoiceReturnValidationResult {

    success: boolean;
    errors: string[];
    invoice: Invoice | null;

}

interface InvoiceReturnAccountContext {

    accountId: string;
    userId: string;

}

function buildReturnLines(
    invoice: Invoice,
    lines: InvoiceReturnLineInput[]
): InvoiceReturnLine[] {

    return lines.map(lineInput => {

        const invoiceLine = invoice.lines.find(
            line => line.id === lineInput.invoiceLineId.trim()
        );

        if (!invoiceLine) {
            throw new Error("Invoice return line source invoice line is missing.");
        }

        return buildReturnLine(invoiceLine, lineInput.returnQuantity);

    });

}

function buildReturnLine(
    invoiceLine: InvoiceLine,
    returnQuantity: number
): InvoiceReturnLine {

    return {
        id: crypto.randomUUID(),
        invoiceLineId: invoiceLine.id,
        productId: invoiceLine.productId,
        productNameSnapshot: invoiceLine.productNameSnapshot,
        quantity: invoiceLine.quantity,
        unitPriceSnapshot: invoiceLine.unitPrice,
        lineTotalSnapshot: invoiceLine.lineTotal,
        returnQuantity,
        originalSaleDeductionMovementId:
            invoiceLine.stockMovementId?.trim() ?? null,
        returnStockMovementId: null
    };

}

function generateReturnNumber(
    existingReturns: InvoiceReturn[],
    timestamp: string
): string {

    const datePart = timestamp.slice(0, 10).replaceAll("-", "");
    const prefix = `RET-${datePart}-`;
    const existingNumbers = new Set(
        existingReturns.map(invoiceReturn => invoiceReturn.returnNumber)
    );
    let sequence = existingReturns
        .map(invoiceReturn => invoiceReturn.returnNumber)
        .filter(returnNumber => returnNumber.startsWith(prefix))
        .map(returnNumber => Number(returnNumber.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((max, current) => Math.max(max, current), 0) + 1;
    let returnNumber = formatReturnNumber(prefix, sequence);

    while (existingNumbers.has(returnNumber)) {
        sequence += 1;
        returnNumber = formatReturnNumber(prefix, sequence);
    }

    return returnNumber;

}

function formatReturnNumber(prefix: string, sequence: number): string {

    return `${prefix}${String(sequence).padStart(4, "0")}`;

}

function normalizeOptionalString(value: string | undefined): string | undefined {

    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : undefined;

}

function normalizeRequiredString(value: unknown): string {

    return typeof value === "string" ? value.trim() : "";

}

function failedInvoiceReturnResult(
    errors: string | string[]
): InvoiceReturnResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        invoiceReturn: null
    };

}

function failedInvoiceReturnValidation(
    errors: string | string[]
): InvoiceReturnValidationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        invoice: null
    };

}
