import type { AuthStateService } from "../../auth/AuthStateService";
import type { InventoryService } from "../../inventory/services/InventoryService";
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

        const cancelledAt = new Date().toISOString();
        const cancelledInvoice: Invoice = {
            ...currentInvoice,
            status: "cancelled",
            accountId: accountContext.accountId,
            cancelledAt,
            cancelledBy: accountContext.userId,
            cancelReason: normalizeOptionalString(reason),
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
            stockMovementId: null
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

function failedInvoiceResult(errors: string | string[]): InvoiceResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        invoice: null
    };

}
