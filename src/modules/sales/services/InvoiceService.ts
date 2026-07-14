import type { AuthStateService } from "../../auth/AuthStateService";
import type { InventoryService } from "../../inventory/services/InventoryService";
import type { StockMovement } from "../../inventory/StockMovement";
import type {
    Invoice,
    InvoiceDraftInput,
    InvoiceDraftLineInput,
    InvoiceDraftUpdateInput,
    InvoiceLine
} from "../Invoice";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoiceValidator } from "../validators/InvoiceValidator";

export class InvoiceService {

    private readonly repository: InvoiceRepository;
    private readonly validator: InvoiceValidator;
    private readonly authStateService: AuthStateService;
    private readonly inventoryService: InventoryService;

    public constructor(
        repository: InvoiceRepository,
        validator: InvoiceValidator,
        authStateService: AuthStateService,
        inventoryService: InventoryService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;
        this.inventoryService = inventoryService;

    }

    public getAll(): Invoice[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository.allForAccount(accountContext.accountId);

    }

    public getById(invoiceId: string): Invoice | undefined {

        const accountContext = this.currentAccountContext();
        const normalizedInvoiceId = invoiceId.trim();

        if (!accountContext || !normalizedInvoiceId) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceId
        );

    }

    public createDraft(input: InvoiceDraftInput): InvoiceResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceResult("Authenticated account is required.");
        }

        const createdAt = new Date().toISOString();
        const existingInvoices = this.repository.allForAccount(
            accountContext.accountId
        );
        const invoice: Invoice = {
            id: crypto.randomUUID(),
            accountId: accountContext.accountId,
            invoiceNumber: generateInvoiceNumber(existingInvoices, createdAt),
            status: "draft",
            customerId: normalizeOptionalString(input.customerId),
            customerSnapshot: input.customerSnapshot ?? null,
            lines: buildInvoiceLines(input.lines),
            subtotal: 0,
            discount: normalizeAmount(input.discount),
            tax: normalizeAmount(input.tax),
            total: 0,
            notes: normalizeOptionalString(input.notes),
            createdAt,
            createdBy: accountContext.userId,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };

        applyTotals(invoice);

        const errors = this.validator.validate(invoice);

        if (errors.length > 0) {
            return failedInvoiceResult(errors);
        }

        this.repository.appendForAccount(accountContext.accountId, invoice);

        return {
            success: true,
            errors: [],
            invoice
        };

    }

    public updateDraft(
        invoiceId: string,
        input: InvoiceDraftUpdateInput
    ): InvoiceResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceResult("Authenticated account is required.");
        }

        const currentInvoice = this.repository.findForAccount(
            accountContext.accountId,
            invoiceId.trim()
        );

        if (!currentInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        if (currentInvoice.status !== "draft") {
            return failedInvoiceResult("Only draft invoices can be updated.");
        }

        const updatedAt = new Date().toISOString();
        const updatedInvoice: Invoice = {
            ...currentInvoice,
            customerId: input.customerId === undefined
                ? currentInvoice.customerId
                : normalizeOptionalString(input.customerId),
            customerSnapshot: input.customerSnapshot === undefined
                ? currentInvoice.customerSnapshot
                : input.customerSnapshot,
            lines: input.lines === undefined
                ? currentInvoice.lines
                : buildInvoiceLines(input.lines),
            discount: input.discount === undefined
                ? currentInvoice.discount
                : normalizeAmount(input.discount),
            tax: input.tax === undefined
                ? currentInvoice.tax
                : normalizeAmount(input.tax),
            notes: input.notes === undefined
                ? currentInvoice.notes
                : normalizeOptionalString(input.notes),
            accountId: accountContext.accountId,
            updatedAt,
            updatedBy: accountContext.userId
        };

        applyTotals(updatedInvoice);

        const errors = this.validator.validate(updatedInvoice);

        if (errors.length > 0) {
            return failedInvoiceResult(errors);
        }

        const savedInvoice = this.repository.updateForAccount(
            accountContext.accountId,
            currentInvoice.id,
            updatedInvoice
        );

        if (!savedInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        return {
            success: true,
            errors: [],
            invoice: savedInvoice
        };

    }

    public deleteDraft(invoiceId: string): InvoiceDeleteResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceDeleteResult(
                "Authenticated account is required."
            );
        }

        const currentInvoice = this.repository.findForAccount(
            accountContext.accountId,
            invoiceId.trim()
        );

        if (!currentInvoice) {
            return failedInvoiceDeleteResult("Invoice not found.");
        }

        if (currentInvoice.status !== "draft") {
            return failedInvoiceDeleteResult(
                "Only draft invoices can be deleted."
            );
        }

        const deleted = this.repository.removeForAccount(
            accountContext.accountId,
            currentInvoice.id
        );

        return deleted
            ? { success: true, errors: [] }
            : failedInvoiceDeleteResult("Invoice not found.");

    }

    public markIssued(invoiceId: string): InvoiceResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceResult("Authenticated account is required.");
        }

        const currentInvoice = this.repository.findForAccount(
            accountContext.accountId,
            invoiceId.trim()
        );

        if (!currentInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        if (currentInvoice.status !== "draft") {
            return failedInvoiceResult("Only draft invoices can be issued.");
        }

        if (currentInvoice.lines.some(line => line.stockMovementId)) {
            return failedInvoiceResult(
                "Draft invoice already has stock movement references."
            );
        }

        const availability = this.inventoryService.checkAvailabilityBatch(
            currentInvoice.lines.map(line => ({
                productId: line.productId,
                requestedQuantity: line.quantity
            }))
        );

        if (!availability.canFulfill) {
            return failedInvoiceResult(
                availability.results.flatMap(result => result.errors.length > 0
                    ? result.errors
                    : [
                        `Insufficient stock for product ${result.productId}.`
                    ])
            );
        }

        const issuedAt = new Date().toISOString();
        const stockMovementIds = new Map<string, string>();

        for (const line of currentInvoice.lines) {
            const movementResult = this.inventoryService.addMovement({
                productId: line.productId,
                type: "sale_deduction",
                quantityDelta: -line.quantity,
                reason: `Invoice ${currentInvoice.invoiceNumber}`,
                referenceType: "invoice",
                referenceId: currentInvoice.id,
                metadata: {
                    invoiceId: currentInvoice.id,
                    invoiceLineId: line.id,
                    invoiceNumber: currentInvoice.invoiceNumber
                }
            });

            if (!movementResult.success || !movementResult.movement) {
                return failedInvoiceResult(movementResult.errors);
            }

            stockMovementIds.set(line.id, movementResult.movement.id);
        }

        const issuedInvoice: Invoice = {
            ...currentInvoice,
            status: "issued",
            accountId: accountContext.accountId,
            lines: currentInvoice.lines.map(line => ({
                ...line,
                stockMovementId: stockMovementIds.get(line.id) ?? null
            })),
            issuedAt,
            issuedBy: accountContext.userId,
            updatedAt: issuedAt,
            updatedBy: accountContext.userId
        };

        const errors = this.validator.validate(issuedInvoice);

        if (errors.length > 0) {
            return failedInvoiceResult(errors);
        }

        const savedInvoice = this.repository.updateForAccount(
            accountContext.accountId,
            currentInvoice.id,
            issuedInvoice
        );

        if (!savedInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        return {
            success: true,
            errors: [],
            invoice: savedInvoice
        };

    }

    public markCancelled(
        invoiceId: string,
        reason = ""
    ): InvoiceResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedInvoiceResult("Authenticated account is required.");
        }

        const currentInvoice = this.repository.findForAccount(
            accountContext.accountId,
            invoiceId.trim()
        );

        if (!currentInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        if (currentInvoice.status === "cancelled") {
            return failedInvoiceResult("Invoice is already cancelled.");
        }

        if (currentInvoice.status !== "issued") {
            return failedInvoiceResult("Only issued invoices can be cancelled.");
        }

        const normalizedReason =
            normalizeOptionalString(reason) || "Invoice cancellation";
        const reversalPlan = this.buildCancellationReversalPlan(
            currentInvoice,
            normalizedReason,
            accountContext
        );

        if (!reversalPlan.success) {
            return failedInvoiceResult(reversalPlan.errors);
        }

        const reversalStockMovementIds =
            new Map(reversalPlan.existingReversalMovementIds);

        for (const item of reversalPlan.items) {
            const movementResult = this.inventoryService.addMovement({
                productId: item.line.productId,
                type: "sale_return",
                quantityDelta: item.line.quantity,
                reason: `Invoice ${currentInvoice.invoiceNumber} cancellation: ${normalizedReason}`,
                referenceType: "invoice_return",
                referenceId: currentInvoice.id,
                metadata: {
                    reversesMovementId: item.originalMovement.id,
                    originalStockMovementId: item.originalMovement.id,
                    originalMovementType: "sale_deduction",
                    reversalOfInvoiceId: currentInvoice.id,
                    reversalOfInvoiceLineId: item.line.id,
                    invoiceNumber: currentInvoice.invoiceNumber,
                    cancellationReason: normalizedReason
                }
            });

            if (!movementResult.success || !movementResult.movement) {
                return failedInvoiceResult(movementResult.errors);
            }

            reversalStockMovementIds.set(
                item.line.id,
                movementResult.movement.id
            );
        }

        const cancelledAt = new Date().toISOString();
        const cancelledInvoice: Invoice = {
            ...currentInvoice,
            status: "cancelled",
            accountId: accountContext.accountId,
            lines: currentInvoice.lines.map(line => ({
                ...line,
                reversalStockMovementId:
                    reversalStockMovementIds.get(line.id)
                    ?? line.reversalStockMovementId
                    ?? null
            })),
            cancelledAt,
            cancelledBy: accountContext.userId,
            cancelReason: normalizedReason,
            updatedAt: cancelledAt,
            updatedBy: accountContext.userId
        };

        const errors = this.validator.validate(cancelledInvoice);

        if (errors.length > 0) {
            return failedInvoiceResult(errors);
        }

        const savedInvoice = this.repository.updateForAccount(
            accountContext.accountId,
            currentInvoice.id,
            cancelledInvoice
        );

        if (!savedInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        return {
            success: true,
            errors: [],
            invoice: savedInvoice
        };

    }

    private buildCancellationReversalPlan(
        invoice: Invoice,
        reason: string,
        accountContext: InvoiceAccountContext
    ): CancellationReversalPlan {

        if (!reason.trim()) {
            return failedCancellationReversalPlan(
                "Cancellation reason is required."
            );
        }

        const movements = this.inventoryService.getAll();
        const items: CancellationReversalPlanItem[] = [];
        const existingReversalMovementIds = new Map<string, string>();

        for (const line of invoice.lines) {
            const originalStockMovementId =
                line.stockMovementId?.trim() ?? "";

            if (!originalStockMovementId) {
                return failedCancellationReversalPlan(
                    "Invoice line is missing stock movement reference."
                );
            }

            const originalMovement = movements.find(
                movement => movement.id === originalStockMovementId
            );

            if (!originalMovement) {
                return failedCancellationReversalPlan(
                    "Original sale deduction movement was not found."
                );
            }

            const movementErrors = validateOriginalSaleDeduction(
                originalMovement,
                invoice,
                line,
                accountContext
            );

            if (movementErrors.length > 0) {
                return failedCancellationReversalPlan(movementErrors);
            }

            const existingReversal = findExistingReversalMovement(
                movements,
                invoice,
                line,
                originalMovement.id
            );

            if (existingReversal) {
                existingReversalMovementIds.set(line.id, existingReversal.id);
                continue;
            }

            items.push({
                line,
                originalMovement
            });
        }

        return {
            success: true,
            errors: [],
            items,
            existingReversalMovementIds
        };

    }

    private currentAccountContext(): InvoiceAccountContext | null {

        const state = this.authStateService.getState();

        if (state.status !== "authenticated") {
            return null;
        }

        const accountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();
        const userId = state.session.user.id.trim();

        if (!accountId || accountId !== userAccountId || !userId) {
            return null;
        }

        return {
            accountId,
            userId
        };

    }

}

export interface InvoiceResult {

    success: boolean;
    errors: string[];
    invoice: Invoice | null;

}

export interface InvoiceDeleteResult {

    success: boolean;
    errors: string[];

}

interface InvoiceAccountContext {

    accountId: string;
    userId: string;

}

function buildInvoiceLines(lines: InvoiceDraftLineInput[]): InvoiceLine[] {

    return lines.map(line => {

        const quantity = line.quantity;
        const unitPrice = line.unitPrice;
        const discount = normalizeAmount(line.discount);
        const tax = normalizeAmount(line.tax);
        const lineSubtotal = quantity * unitPrice;

        return {
            id: crypto.randomUUID(),
            productId: line.productId.trim(),
            productNameSnapshot: line.productNameSnapshot.trim(),
            skuSnapshot: normalizeOptionalString(line.skuSnapshot),
            barcodeSnapshot: normalizeOptionalString(line.barcodeSnapshot),
            unitSnapshot: normalizeOptionalString(line.unitSnapshot),
            quantity,
            unitPrice,
            discount,
            tax,
            lineSubtotal,
            lineTotal: lineSubtotal - discount + tax,
            stockMovementId: null,
            reversalStockMovementId: null
        };

    });

}

function applyTotals(invoice: Invoice): void {

    invoice.subtotal = invoice.lines.reduce(
        (total, line) => total + line.lineSubtotal,
        0
    );
    const lineDiscount = invoice.lines.reduce(
        (total, line) => total + line.discount,
        0
    );
    const lineTax = invoice.lines.reduce(
        (total, line) => total + line.tax,
        0
    );

    invoice.discount = lineDiscount + normalizeAmount(invoice.discount);
    invoice.tax = lineTax + normalizeAmount(invoice.tax);
    invoice.total = invoice.subtotal - invoice.discount + invoice.tax;

}

function generateInvoiceNumber(
    existingInvoices: Invoice[],
    timestamp: string
): string {

    const datePart = timestamp.slice(0, 10).replaceAll("-", "");
    const prefix = `INV-${datePart}-`;
    const existingNumbers = new Set(
        existingInvoices.map(invoice => invoice.invoiceNumber)
    );
    let sequence = existingInvoices
        .map(invoice => invoice.invoiceNumber)
        .filter(invoiceNumber => invoiceNumber.startsWith(prefix))
        .map(invoiceNumber => Number(invoiceNumber.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((max, current) => Math.max(max, current), 0) + 1;
    let invoiceNumber = formatInvoiceNumber(prefix, sequence);

    while (existingNumbers.has(invoiceNumber)) {
        sequence += 1;
        invoiceNumber = formatInvoiceNumber(prefix, sequence);
    }

    return invoiceNumber;

}

function formatInvoiceNumber(prefix: string, sequence: number): string {

    return `${prefix}${String(sequence).padStart(4, "0")}`;

}

function normalizeOptionalString(value: string | undefined): string | undefined {

    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : undefined;

}

function normalizeAmount(value: number | undefined): number {

    return typeof value === "number" && Number.isFinite(value)
        ? value
        : 0;

}

interface CancellationReversalPlan {

    success: boolean;
    errors: string[];
    items: CancellationReversalPlanItem[];
    existingReversalMovementIds: Map<string, string>;

}

interface CancellationReversalPlanItem {

    line: InvoiceLine;
    originalMovement: StockMovement;

}

function failedCancellationReversalPlan(
    errors: string | string[]
): CancellationReversalPlan {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        items: [],
        existingReversalMovementIds: new Map()
    };

}

function validateOriginalSaleDeduction(
    movement: StockMovement,
    invoice: Invoice,
    line: InvoiceLine,
    accountContext: InvoiceAccountContext
): string[] {

    const errors: string[] = [];

    if (movement.type !== "sale_deduction") {
        errors.push("Original stock movement must be a sale deduction.");
    }

    if (movement.voidedAt) {
        errors.push("Original sale deduction movement must not be voided.");
    }

    if (movement.accountId !== accountContext.accountId) {
        errors.push("Original stock movement account does not match invoice.");
    }

    if (movement.accountId !== invoice.accountId) {
        errors.push("Original stock movement invoice account is invalid.");
    }

    if (movement.productId !== line.productId) {
        errors.push("Original stock movement Product does not match invoice line.");
    }

    if (movement.referenceType !== "invoice") {
        errors.push("Original stock movement reference type is invalid.");
    }

    if (movement.referenceId !== invoice.id) {
        errors.push("Original stock movement does not reference the invoice.");
    }

    if (!Number.isFinite(movement.quantityDelta) || movement.quantityDelta >= 0) {
        errors.push("Original sale deduction quantity must be negative.");
    }

    return errors;

}

function findExistingReversalMovement(
    movements: StockMovement[],
    invoice: Invoice,
    line: InvoiceLine,
    originalStockMovementId: string
): StockMovement | undefined {

    return movements.find(movement => {
        const metadata = movement.metadata ?? {};

        return movement.type === "sale_return"
            && movement.referenceType === "invoice_return"
            && movement.referenceId === invoice.id
            && movement.accountId === invoice.accountId
            && movement.productId === line.productId
            && (
                metadata.reversesMovementId === originalStockMovementId
                || metadata.originalStockMovementId === originalStockMovementId
            );
    });

}

function failedInvoiceResult(errors: string | string[]): InvoiceResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        invoice: null
    };

}

function failedInvoiceDeleteResult(
    errors: string | string[]
): InvoiceDeleteResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors]
    };

}
