import type { AuthStateService } from "../../auth/AuthStateService";
import type { StockMovement } from "../../inventory/StockMovement";
import type { InventoryService } from "../../inventory/services/InventoryService";
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
    private readonly inventoryService: InventoryService;

    public constructor(
        repository: InvoiceReturnRepository,
        validator: InvoiceReturnValidator,
        invoiceRepository: InvoiceRepository,
        authStateService: AuthStateService,
        inventoryService: InventoryService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.invoiceRepository = invoiceRepository;
        this.authStateService = authStateService;
        this.inventoryService = inventoryService;

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

    public executeReturn(invoiceReturnId: string): InvoiceReturnResult {

        const accountContext = this.currentAccountContext();
        const normalizedInvoiceReturnId = invoiceReturnId.trim();

        if (!accountContext) {
            return failedInvoiceReturnResult("Authenticated account is required.");
        }

        if (!normalizedInvoiceReturnId) {
            return failedInvoiceReturnResult("Invoice return id is required.");
        }

        const currentReturn = this.repository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceReturnId
        );

        if (!currentReturn) {
            return failedInvoiceReturnResult("Invoice return not found.");
        }

        if (currentReturn.accountId !== accountContext.accountId) {
            return failedInvoiceReturnResult("Invoice return account mismatch.");
        }

        if (currentReturn.status !== "recorded") {
            return failedInvoiceReturnResult(
                "Only recorded invoice returns can be executed."
            );
        }

        if (currentReturn.lines.some(isExecutedReturnLine)) {
            return failedInvoiceReturnResult(
                "Invoice return is already executed."
            );
        }

        const invoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            currentReturn.invoiceId
        );

        if (!invoice) {
            return failedInvoiceReturnResult("Invoice not found.");
        }

        if (invoice.accountId !== accountContext.accountId) {
            return failedInvoiceReturnResult("Invoice account mismatch.");
        }

        if (invoice.status !== "issued") {
            return failedInvoiceReturnResult(
                "Only issued invoices can be returned."
            );
        }

        const validation = this.validateReturnExecution(
            accountContext.accountId,
            currentReturn,
            invoice
        );

        if (validation.errors.length > 0) {
            return failedInvoiceReturnResult(validation.errors);
        }

        const createdMovementIds = new Map<string, string>();

        for (const line of validation.lines) {
            const movementResult = this.inventoryService.addMovement({
                productId: line.returnLine.productId,
                type: "sale_return",
                quantityDelta: line.returnLine.returnQuantity,
                reason: `Invoice return ${currentReturn.returnNumber}`,
                referenceType: "invoice_return",
                referenceId: currentReturn.id,
                metadata: {
                    invoiceReturnId: currentReturn.id,
                    invoiceReturnLineId: line.returnLine.id,
                    invoiceId: invoice.id,
                    invoiceLineId: line.invoiceLine.id,
                    invoiceNumber: invoice.invoiceNumber,
                    originalSaleDeductionMovementId:
                        line.originalMovement.id,
                    originalStockMovementId: line.originalMovement.id,
                    reversesMovementId: line.originalMovement.id,
                    originalMovementType: line.originalMovement.type
                }
            });

            if (!movementResult.success || !movementResult.movement) {
                return failedInvoiceReturnResult(movementResult.errors);
            }

            createdMovementIds.set(
                line.returnLine.id,
                movementResult.movement.id
            );
        }

        const updatedAt = new Date().toISOString();
        const executedReturn: InvoiceReturn = {
            ...currentReturn,
            status: "executed",
            lines: currentReturn.lines.map(line => ({
                ...line,
                returnStockMovementId:
                    createdMovementIds.get(line.id)
                    ?? line.returnStockMovementId
                    ?? null
            })),
            updatedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(executedReturn);

        if (errors.length > 0) {
            return failedInvoiceReturnResult(errors);
        }

        const savedReturn = this.repository.updateForAccount(
            accountContext.accountId,
            currentReturn.id,
            executedReturn
        );

        if (!savedReturn) {
            return failedInvoiceReturnResult("Invoice return not found.");
        }

        return {
            success: true,
            errors: [],
            invoiceReturn: savedReturn
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

    private validateReturnExecution(
        accountId: string,
        invoiceReturn: InvoiceReturn,
        invoice: Invoice
    ): InvoiceReturnExecutionValidation {

        const errors: string[] = [];
        const movements = this.inventoryService.getAll();
        const lines: InvoiceReturnExecutionLine[] = [];
        const seenInvoiceLineIds = new Set<string>();

        for (const returnLine of invoiceReturn.lines) {
            if (seenInvoiceLineIds.has(returnLine.invoiceLineId)) {
                errors.push("Duplicate invoice return line is not allowed.");
                continue;
            }

            seenInvoiceLineIds.add(returnLine.invoiceLineId);

            const invoiceLine = invoice.lines.find(
                currentLine => currentLine.id === returnLine.invoiceLineId
            );

            if (!invoiceLine) {
                errors.push("Invoice line not found.");
                continue;
            }

            if (returnLine.productId !== invoiceLine.productId) {
                errors.push("Invoice return line Product mismatch.");
            }

            if (!Number.isFinite(returnLine.returnQuantity) || returnLine.returnQuantity <= 0) {
                errors.push("Return quantity must be positive.");
                continue;
            }

            const remainingQuantity = this.getRemainingReturnableQuantityExcludingReturn(
                accountId,
                invoice.id,
                invoiceLine.id,
                invoiceReturn.id
            );

            if (returnLine.returnQuantity > remainingQuantity) {
                errors.push("Return quantity exceeds remaining returnable quantity.");
            }

            const originalMovementId = (
                returnLine.originalSaleDeductionMovementId
                ?? invoiceLine.stockMovementId
                ?? ""
            ).trim();

            if (!originalMovementId) {
                errors.push("Original sale deduction movement is required.");
                continue;
            }

            const originalMovement = movements.find(
                movement => movement.id === originalMovementId
            );

            if (!originalMovement) {
                errors.push("Original sale deduction movement not found.");
                continue;
            }

            if (
                originalMovement.accountId !== accountId
                || originalMovement.productId !== returnLine.productId
                || originalMovement.type !== "sale_deduction"
                || originalMovement.voidedAt
            ) {
                errors.push("Original sale deduction movement is invalid.");
                continue;
            }

            if (
                hasExistingReturnMovement(
                    movements,
                    invoiceReturn.id,
                    returnLine.id
                )
            ) {
                errors.push("Invoice return line is already executed.");
                continue;
            }

            lines.push({
                returnLine,
                invoiceLine,
                originalMovement
            });
        }

        return {
            errors,
            lines
        };

    }

    private getRemainingReturnableQuantityExcludingReturn(
        accountId: string,
        invoiceId: string,
        invoiceLineId: string,
        excludedInvoiceReturnId: string
    ): number {

        const invoice = this.invoiceRepository.findForAccount(
            accountId,
            invoiceId
        );
        const line = invoice?.lines.find(
            currentLine => currentLine.id === invoiceLineId
        );

        if (!line) {
            return 0;
        }

        const returnedQuantity = this.repository
            .allForInvoice(accountId, invoiceId)
            .filter(invoiceReturn => invoiceReturn.id !== excludedInvoiceReturnId)
            .flatMap(invoiceReturn => invoiceReturn.lines)
            .filter(returnLine => returnLine.invoiceLineId === invoiceLineId)
            .reduce(
                (total, returnLine) => total + returnLine.returnQuantity,
                0
            );

        return Math.max(0, line.quantity - returnedQuantity);

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

interface InvoiceReturnExecutionValidation {

    errors: string[];
    lines: InvoiceReturnExecutionLine[];

}

interface InvoiceReturnExecutionLine {

    returnLine: InvoiceReturnLine;
    invoiceLine: InvoiceLine;
    originalMovement: StockMovement;

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

function isExecutedReturnLine(line: InvoiceReturnLine): boolean {

    return typeof line.returnStockMovementId === "string"
        && line.returnStockMovementId.trim().length > 0;

}

function hasExistingReturnMovement(
    movements: StockMovement[],
    invoiceReturnId: string,
    invoiceReturnLineId: string
): boolean {

    return movements.some(movement => movement.type === "sale_return"
        && movement.referenceType === "invoice_return"
        && !movement.voidedAt
        && (
            movement.referenceId === invoiceReturnId
            || movementMetadataString(movement, "invoiceReturnId")
                === invoiceReturnId
        )
        && movementMetadataString(movement, "invoiceReturnLineId")
            === invoiceReturnLineId);

}

function movementMetadataString(
    movement: StockMovement,
    key: string
): string {

    const value = movement.metadata?.[key];

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
