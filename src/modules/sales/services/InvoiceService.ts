import type { AuthStateService } from "../../auth/AuthStateService";
import type { InventoryService } from "../../inventory/services/InventoryService";
import type {
    StockMovement,
    StockMovementCreateIdentity,
    StockMovementInput
} from "../../inventory/StockMovement";
import type {
    Invoice,
    InvoiceDraftInput,
    InvoiceDraftLineInput,
    InvoiceDraftUpdateInput,
    InvoiceLine
} from "../Invoice";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoiceValidator } from "../validators/InvoiceValidator";
import {
    buildInvoiceCancellationCommandId,
    buildInvoiceCancellationMovementIdentity,
    buildInvoiceIssueCommandId,
    buildInvoiceSaleMovementIdentity,
    isStableSalesIdentity
} from "../SalesIdentity";

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
            revision: 0,
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

        try {
            this.repository.appendForAccount(accountContext.accountId, invoice);
        } catch (error) {
            return failedInvoiceResult(safeSalesError(error));
        }

        return {
            success: true,
            errors: [],
            invoice
        };

    }

    public updateDraft(
        invoiceId: string,
        input: InvoiceDraftUpdateInput,
        expectedRevision: number
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

        if (
            !Number.isInteger(expectedRevision)
            || expectedRevision < 0
            || expectedRevision !== invoiceRevision(currentInvoice)
        ) {
            return failedInvoiceResult("Invoice revision conflict.");
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
                : buildInvoiceLines(input.lines, currentInvoice.lines),
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
            revision: expectedRevision + 1,
            updatedAt,
            updatedBy: accountContext.userId
        };

        applyTotals(updatedInvoice);

        const errors = this.validator.validate(updatedInvoice);

        if (errors.length > 0) {
            return failedInvoiceResult(errors);
        }

        let savedInvoice: Invoice | null;

        try {
            savedInvoice = this.repository.updateForAccount(
                accountContext.accountId,
                currentInvoice.id,
                updatedInvoice
            );
        } catch (error) {
            return failedInvoiceResult(safeSalesError(error));
        }

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

    public markIssued(
        invoiceId: string,
        commandId?: string
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

        const expectedCommandId = buildInvoiceIssueCommandId(
            currentInvoice.id
        );
        const requestedCommandId = commandId?.trim() || expectedCommandId;

        if (!expectedCommandId || requestedCommandId !== expectedCommandId) {
            return failedInvoiceResult("Invoice issue command identity conflicts.");
        }

        if (currentInvoice.status === "issued") {
            const retryErrors = this.validateIssuedRetry(
                currentInvoice,
                expectedCommandId
            );

            return retryErrors.length === 0
                ? {
                    success: true,
                    errors: [],
                    invoice: currentInvoice
                }
                : failedInvoiceResult(retryErrors);
        }

        if (currentInvoice.status !== "draft") {
            return failedInvoiceResult("Only draft invoices can be issued.");
        }

        const lineIdentityErrors = validateStableInvoiceLineIdentities(
            currentInvoice.lines
        );

        if (lineIdentityErrors.length > 0) {
            return failedInvoiceResult(lineIdentityErrors);
        }

        if (currentInvoice.lines.some(line =>
            line.stockMovementId || line.reversalStockMovementId
        )) {
            return failedInvoiceResult(
                "Draft invoice already has stock movement references."
            );
        }

        const issuePlan = currentInvoice.lines.map(line => {
            const identity = buildInvoiceSaleMovementIdentity(
                currentInvoice.id,
                line.id
            );

            return {
                line,
                identity,
                input: buildIssueMovementInput(
                    currentInvoice,
                    line,
                    expectedCommandId
                )
            };
        });

        if (issuePlan.some(item => !item.identity)) {
            return failedInvoiceResult(
                "Invoice issue movement identity is invalid."
            );
        }

        const existingMovementIds = new Set(
            this.inventoryService.getAll().map(movement => movement.id)
        );
        const missingItems = issuePlan.filter(item =>
            !existingMovementIds.has(item.identity!.movementId)
        );

        const availability = this.inventoryService.checkAvailabilityBatch(
            missingItems.map(item => ({
                productId: item.line.productId,
                requestedQuantity: item.line.quantity
            }))
        );

        if (missingItems.length > 0 && !availability.canFulfill) {
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

        for (const item of issuePlan) {
            const movementResult = this.inventoryService.addMovementWithIdentity(
                item.input,
                item.identity!
            );

            if (!movementResult.success || !movementResult.movement) {
                return failedInvoiceResult(movementResult.errors);
            }

            stockMovementIds.set(
                item.line.id,
                movementResult.movement.id
            );
        }

        const issuedInvoice: Invoice = {
            ...currentInvoice,
            status: "issued",
            revision: invoiceRevision(currentInvoice) + 1,
            issueCommandId: expectedCommandId,
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

        let savedInvoice: Invoice | null;

        try {
            savedInvoice = this.repository.updateForAccount(
                accountContext.accountId,
                currentInvoice.id,
                issuedInvoice
            );
        } catch (error) {
            return failedInvoiceResult(safeSalesError(error));
        }

        if (!savedInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        return {
            success: true,
            errors: [],
            invoice: savedInvoice
        };

    }

    private validateIssuedRetry(
        invoice: Invoice,
        expectedCommandId: string
    ): string[] {

        if (invoice.issueCommandId !== expectedCommandId) {
            return ["Invoice issue command identity conflicts."];
        }

        const errors = validateStableInvoiceLineIdentities(invoice.lines);
        const movements = this.inventoryService.getAll();

        for (const line of invoice.lines) {
            const identity = buildInvoiceSaleMovementIdentity(
                invoice.id,
                line.id
            );

            if (!identity || line.stockMovementId !== identity.movementId) {
                errors.push("Issued Invoice movement reference conflicts.");
                continue;
            }

            if (!movements.some(movement => movement.id === identity.movementId)) {
                errors.push("Issued Invoice movement was not found.");
                continue;
            }

            const movementResult = this.inventoryService.addMovementWithIdentity(
                buildIssueMovementInput(invoice, line, expectedCommandId),
                identity
            );

            if (!movementResult.success) {
                errors.push(...movementResult.errors);
            }
        }

        return errors;

    }

    public markCancelled(
        invoiceId: string,
        reason = "",
        commandId?: string
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

        const normalizedReason =
            normalizeOptionalString(reason) || "Invoice cancellation";
        const expectedCommandId = buildInvoiceCancellationCommandId(
            currentInvoice.id
        );
        const requestedCommandId = commandId?.trim() || expectedCommandId;

        if (!expectedCommandId || requestedCommandId !== expectedCommandId) {
            return failedInvoiceResult(
                "Invoice cancellation command identity conflicts."
            );
        }

        if (currentInvoice.status === "cancelled") {
            const retryErrors = this.validateCancellationRetry(
                currentInvoice,
                normalizedReason,
                expectedCommandId
            );

            return retryErrors.length === 0
                ? { success: true, errors: [], invoice: currentInvoice }
                : failedInvoiceResult(retryErrors);
        }

        if (currentInvoice.status !== "issued") {
            return failedInvoiceResult("Only issued invoices can be cancelled.");
        }

        const reversalPlan = this.buildCancellationReversalPlan(
            currentInvoice,
            normalizedReason,
            expectedCommandId,
            accountContext
        );

        if (!reversalPlan.success) {
            return failedInvoiceResult(reversalPlan.errors);
        }

        const reversalStockMovementIds =
            new Map(reversalPlan.existingReversalMovementIds);

        for (const item of reversalPlan.items) {
            const movementResult = this.inventoryService.addMovementWithIdentity(
                item.input,
                item.identity
            );

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
            revision: invoiceRevision(currentInvoice) + 1,
            cancellationCommandId: expectedCommandId,
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

        let savedInvoice: Invoice | null;

        try {
            savedInvoice = this.repository.updateForAccount(
                accountContext.accountId,
                currentInvoice.id,
                cancelledInvoice
            );
        } catch (error) {
            return failedInvoiceResult(safeSalesError(error));
        }

        if (!savedInvoice) {
            return failedInvoiceResult("Invoice not found.");
        }

        return {
            success: true,
            errors: [],
            invoice: savedInvoice
        };

    }

    private validateCancellationRetry(
        invoice: Invoice,
        reason: string,
        expectedCommandId: string
    ): string[] {

        if (
            invoice.cancellationCommandId !== expectedCommandId
            || invoice.cancelReason !== reason
        ) {
            return ["Invoice cancellation retry conflicts with existing data."];
        }

        const errors = validateStableInvoiceLineIdentities(invoice.lines);
        const movements = this.inventoryService.getAll();

        for (const line of invoice.lines) {
            const originalMovement = movements.find(
                movement => movement.id === line.stockMovementId
            );
            const identity = buildInvoiceCancellationMovementIdentity(
                invoice.id,
                line.id
            );

            if (!originalMovement || !identity) {
                errors.push("Invoice cancellation movement identity is invalid.");
                continue;
            }

            if (line.reversalStockMovementId !== identity.movementId) {
                errors.push("Invoice cancellation movement reference conflicts.");
                continue;
            }

            if (!movements.some(movement => movement.id === identity.movementId)) {
                errors.push("Invoice cancellation movement was not found.");
                continue;
            }

            const result = this.inventoryService.addMovementWithIdentity(
                buildCancellationMovementInput(
                    invoice,
                    line,
                    originalMovement,
                    reason,
                    expectedCommandId
                ),
                identity
            );

            if (!result.success) {
                errors.push(...result.errors);
            }
        }

        return errors;

    }

    private buildCancellationReversalPlan(
        invoice: Invoice,
        reason: string,
        commandId: string,
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

            if (!isStableSalesIdentity(line.id) || !originalStockMovementId) {
                return failedCancellationReversalPlan(
                    "Invoice line stable identity and stock movement reference are required."
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

            const identity = buildInvoiceCancellationMovementIdentity(
                invoice.id,
                line.id
            );

            if (!identity) {
                return failedCancellationReversalPlan(
                    "Invoice cancellation movement identity is invalid."
                );
            }

            const existingReversal = findExistingReversalMovement(
                movements,
                invoice,
                line,
                originalMovement.id
            );

            if (
                existingReversal
                && existingReversal.id !== identity.movementId
            ) {
                return failedCancellationReversalPlan(
                    "Invoice cancellation has a conflicting legacy reversal movement."
                );
            }

            const input = buildCancellationMovementInput(
                invoice,
                line,
                originalMovement,
                reason,
                commandId
            );

            if (existingReversal) {
                const result = this.inventoryService.addMovementWithIdentity(
                    input,
                    identity
                );

                if (!result.success || !result.movement) {
                    return failedCancellationReversalPlan(result.errors);
                }

                existingReversalMovementIds.set(
                    line.id,
                    result.movement.id
                );
                continue;
            }

            items.push({ line, originalMovement, identity, input });
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

function buildInvoiceLines(
    lines: InvoiceDraftLineInput[],
    currentLines: InvoiceLine[] = []
): InvoiceLine[] {

    const currentLineIds = new Set(
        currentLines
            .map(line => line.id.trim())
            .filter(Boolean)
    );

    return lines.map(line => {

        const quantity = line.quantity;
        const unitPrice = line.unitPrice;
        const discount = normalizeAmount(line.discount);
        const tax = normalizeAmount(line.tax);
        const lineSubtotal = quantity * unitPrice;
        const requestedLineId = line.id?.trim() ?? "";
        const lineId = currentLineIds.has(requestedLineId)
            ? requestedLineId
            : crypto.randomUUID();

        return {
            id: lineId,
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
    identity: StockMovementCreateIdentity;
    input: StockMovementInput;

}

function buildIssueMovementInput(
    invoice: Invoice,
    line: InvoiceLine,
    commandId: string
): StockMovementInput {

    return {
        productId: line.productId,
        type: "sale_deduction",
        quantityDelta: -line.quantity,
        reason: `Invoice ${invoice.invoiceNumber}`,
        referenceType: "invoice",
        referenceId: invoice.id,
        metadata: {
            commandId,
            invoiceId: invoice.id,
            invoiceLineId: line.id,
            invoiceNumber: invoice.invoiceNumber
        }
    };

}

function buildCancellationMovementInput(
    invoice: Invoice,
    line: InvoiceLine,
    originalMovement: StockMovement,
    reason: string,
    commandId: string
): StockMovementInput {

    return {
        productId: line.productId,
        type: "sale_return",
        quantityDelta: line.quantity,
        reason: `Invoice ${invoice.invoiceNumber} cancellation: ${reason}`,
        referenceType: "invoice_return",
        referenceId: invoice.id,
        metadata: {
            commandId,
            reversesMovementId: originalMovement.id,
            originalStockMovementId: originalMovement.id,
            originalMovementType: "sale_deduction",
            reversalOfInvoiceId: invoice.id,
            reversalOfInvoiceLineId: line.id,
            invoiceNumber: invoice.invoiceNumber,
            cancellationReason: reason
        }
    };

}

function validateStableInvoiceLineIdentities(lines: InvoiceLine[]): string[] {

    const errors: string[] = [];
    const lineIds = new Set<string>();

    for (const line of lines) {
        const lineId = line.id.trim();

        if (!isStableSalesIdentity(lineId)) {
            errors.push("Invoice line stable identity is invalid.");
            continue;
        }

        if (lineIds.has(lineId)) {
            errors.push("Invoice line stable identity is duplicated.");
            continue;
        }

        lineIds.add(lineId);
    }

    return errors;

}

function invoiceRevision(invoice: Invoice): number {

    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;

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

function safeSalesError(error: unknown): string {

    return error instanceof Error && error.message.trim()
        ? error.message
        : "Invoice persistence failed.";

}
