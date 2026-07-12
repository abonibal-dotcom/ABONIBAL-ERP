import type { AuthStateService } from "../../auth/AuthStateService";
import type {
    Purchase,
    PurchaseDraftInput,
    PurchaseDraftLineInput,
    PurchaseDraftUpdateInput,
    PurchaseLine
} from "../Purchase";
import { PurchaseRepository } from "../repositories/PurchaseRepository";
import { PurchaseValidator } from "../validators/PurchaseValidator";

export class PurchaseService {

    private readonly repository: PurchaseRepository;
    private readonly validator: PurchaseValidator;
    private readonly authStateService: AuthStateService;

    public constructor(
        repository: PurchaseRepository,
        validator: PurchaseValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public getAll(): Purchase[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository.allForAccount(accountContext.accountId);

    }

    public find(purchaseId: string): Purchase | undefined {

        const accountContext = this.currentAccountContext();
        const normalizedPurchaseId = purchaseId.trim();

        if (!accountContext || !normalizedPurchaseId) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            normalizedPurchaseId
        );

    }

    public createDraft(input: PurchaseDraftInput): PurchaseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPurchaseMutationResult("Authenticated account is required.");
        }

        const createdAt = new Date().toISOString();
        const existingPurchases = this.repository.allForAccount(
            accountContext.accountId
        );
        const lines = buildPurchaseLines(input.lines);
        const totals = calculatePurchaseTotals(
            lines,
            normalizeAmount(input.discount),
            normalizeAmount(input.tax)
        );
        const purchase: Purchase = {
            id: generatePurchaseId(),
            accountId: accountContext.accountId,
            purchaseNumber: normalizeOptionalString(input.purchaseNumber)
                ?? generatePurchaseNumber(existingPurchases, createdAt),
            status: "draft",
            supplierId: normalizeOptionalString(input.supplierId),
            supplierSnapshot: input.supplierSnapshot ?? null,
            lines,
            subtotal: totals.subtotal,
            discount: totals.discount,
            tax: totals.tax,
            total: totals.total,
            notes: normalizeOptionalString(input.notes),
            createdAt,
            createdBy: accountContext.userId,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(purchase);

        if (errors.length > 0) {
            return failedPurchaseMutationResult(errors);
        }

        this.repository.appendForAccount(accountContext.accountId, purchase);

        return {
            success: true,
            errors: [],
            purchase
        };

    }

    public updateDraft(
        purchaseId: string,
        input: PurchaseDraftUpdateInput
    ): PurchaseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPurchaseMutationResult("Authenticated account is required.");
        }

        const currentPurchase = this.repository.findForAccount(
            accountContext.accountId,
            purchaseId.trim()
        );

        if (!currentPurchase) {
            return failedPurchaseMutationResult("Purchase not found.");
        }

        if (currentPurchase.status !== "draft") {
            return failedPurchaseMutationResult("Only draft purchases can be updated.");
        }

        const updatedAt = new Date().toISOString();
        const lines = input.lines === undefined
            ? currentPurchase.lines
            : buildPurchaseLines(input.lines);
        const totals = calculateUpdatedPurchaseTotals(currentPurchase, lines, input);
        const updatedPurchase: Purchase = {
            ...currentPurchase,
            accountId: accountContext.accountId,
            purchaseNumber: input.purchaseNumber === undefined
                ? currentPurchase.purchaseNumber
                : normalizeRequiredString(input.purchaseNumber),
            supplierId: input.supplierId === undefined
                ? currentPurchase.supplierId
                : normalizeOptionalString(input.supplierId),
            supplierSnapshot: input.supplierSnapshot === undefined
                ? currentPurchase.supplierSnapshot
                : input.supplierSnapshot,
            lines,
            subtotal: totals.subtotal,
            discount: totals.discount,
            tax: totals.tax,
            total: totals.total,
            notes: input.notes === undefined
                ? currentPurchase.notes
                : normalizeOptionalString(input.notes),
            updatedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(updatedPurchase);

        if (errors.length > 0) {
            return failedPurchaseMutationResult(errors);
        }

        const savedPurchase = this.repository.updateForAccount(
            accountContext.accountId,
            currentPurchase.id,
            updatedPurchase
        );

        if (!savedPurchase) {
            return failedPurchaseMutationResult("Purchase not found.");
        }

        return {
            success: true,
            errors: [],
            purchase: savedPurchase
        };

    }

    public post(purchaseId: string): PurchaseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPurchaseMutationResult("Authenticated account is required.");
        }

        const currentPurchase = this.repository.findForAccount(
            accountContext.accountId,
            purchaseId.trim()
        );

        if (!currentPurchase) {
            return failedPurchaseMutationResult("Purchase not found.");
        }

        if (currentPurchase.status !== "draft") {
            return failedPurchaseMutationResult("Only draft purchases can be posted.");
        }

        const postedAt = new Date().toISOString();
        const postedPurchase: Purchase = {
            ...currentPurchase,
            accountId: accountContext.accountId,
            status: "posted",
            postedAt,
            postedBy: accountContext.userId,
            updatedAt: postedAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(postedPurchase);

        if (errors.length > 0) {
            return failedPurchaseMutationResult(errors);
        }

        const savedPurchase = this.repository.updateForAccount(
            accountContext.accountId,
            currentPurchase.id,
            postedPurchase
        );

        if (!savedPurchase) {
            return failedPurchaseMutationResult("Purchase not found.");
        }

        return {
            success: true,
            errors: [],
            purchase: savedPurchase
        };

    }

    public cancel(
        purchaseId: string,
        reason = ""
    ): PurchaseMutationResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedPurchaseMutationResult("Authenticated account is required.");
        }

        const currentPurchase = this.repository.findForAccount(
            accountContext.accountId,
            purchaseId.trim()
        );

        if (!currentPurchase) {
            return failedPurchaseMutationResult("Purchase not found.");
        }

        if (currentPurchase.status === "cancelled") {
            return failedPurchaseMutationResult("Purchase is already cancelled.");
        }

        const cancelledAt = new Date().toISOString();
        const cancelledPurchase: Purchase = {
            ...currentPurchase,
            accountId: accountContext.accountId,
            status: "cancelled",
            cancelledAt,
            cancelledBy: accountContext.userId,
            cancelReason: normalizeOptionalString(reason) ?? "Purchase cancelled",
            updatedAt: cancelledAt,
            updatedBy: accountContext.userId
        };
        const errors = this.validator.validate(cancelledPurchase);

        if (errors.length > 0) {
            return failedPurchaseMutationResult(errors);
        }

        const savedPurchase = this.repository.updateForAccount(
            accountContext.accountId,
            currentPurchase.id,
            cancelledPurchase
        );

        if (!savedPurchase) {
            return failedPurchaseMutationResult("Purchase not found.");
        }

        return {
            success: true,
            errors: [],
            purchase: savedPurchase
        };

    }

    private currentAccountContext(): PurchaseAccountContext | null {

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

export interface PurchaseMutationResult {

    success: boolean;
    errors: string[];
    purchase: Purchase | null;

}

interface PurchaseAccountContext {

    accountId: string;
    userId: string;

}

interface PurchaseTotals {

    subtotal: number;
    discount: number;
    tax: number;
    total: number;

}

function buildPurchaseLines(lines: PurchaseDraftLineInput[]): PurchaseLine[] {

    return lines.map(line => {

        const quantity = normalizeAmount(line.quantity);
        const unitCost = normalizeAmount(line.unitCost);
        const discount = normalizeAmount(line.discount);
        const tax = normalizeAmount(line.tax);
        const lineSubtotal = quantity * unitCost;

        return {
            id: generatePurchaseId(),
            productId: normalizeOptionalString(line.productId),
            productNameSnapshot: line.productNameSnapshot.trim(),
            skuSnapshot: normalizeOptionalString(line.skuSnapshot),
            barcodeSnapshot: normalizeOptionalString(line.barcodeSnapshot),
            unitSnapshot: normalizeOptionalString(line.unitSnapshot),
            quantity,
            unitCost,
            discount,
            tax,
            lineSubtotal,
            lineTotal: lineSubtotal - discount + tax
        };

    });

}

function calculateUpdatedPurchaseTotals(
    currentPurchase: Purchase,
    lines: PurchaseLine[],
    input: PurchaseDraftUpdateInput
): PurchaseTotals {

    if (input.discount === undefined && input.tax === undefined) {
        return calculatePurchaseTotalsFromAggregate(
            lines,
            currentPurchase.discount,
            currentPurchase.tax
        );
    }

    return calculatePurchaseTotals(
        lines,
        input.discount === undefined
            ? currentPurchase.discount
            : normalizeAmount(input.discount),
        input.tax === undefined
            ? currentPurchase.tax
            : normalizeAmount(input.tax)
    );

}

function calculatePurchaseTotals(
    lines: PurchaseLine[],
    headerDiscount: number,
    headerTax: number
): PurchaseTotals {

    const lineDiscount = lines.reduce(
        (total, line) => total + line.discount,
        0
    );
    const lineTax = lines.reduce(
        (total, line) => total + line.tax,
        0
    );

    return calculatePurchaseTotalsFromAggregate(
        lines,
        lineDiscount + headerDiscount,
        lineTax + headerTax
    );

}

function calculatePurchaseTotalsFromAggregate(
    lines: PurchaseLine[],
    discount: number,
    tax: number
): PurchaseTotals {

    const subtotal = lines.reduce(
        (total, line) => total + line.lineSubtotal,
        0
    );

    return {
        subtotal,
        discount,
        tax,
        total: subtotal - discount + tax
    };

}

function generatePurchaseNumber(
    existingPurchases: Purchase[],
    timestamp: string
): string {

    const datePart = timestamp.slice(0, 10).replaceAll("-", "");
    const prefix = `PUR-${datePart}-`;
    const existingNumbers = new Set(
        existingPurchases.map(purchase => purchase.purchaseNumber)
    );
    let sequence = existingPurchases
        .map(purchase => purchase.purchaseNumber)
        .filter(purchaseNumber => purchaseNumber.startsWith(prefix))
        .map(purchaseNumber => Number(purchaseNumber.slice(prefix.length)))
        .filter(Number.isFinite)
        .reduce((max, current) => Math.max(max, current), 0) + 1;
    let purchaseNumber = formatPurchaseNumber(prefix, sequence);

    while (existingNumbers.has(purchaseNumber)) {
        sequence += 1;
        purchaseNumber = formatPurchaseNumber(prefix, sequence);
    }

    return purchaseNumber;

}

function formatPurchaseNumber(prefix: string, sequence: number): string {

    return `${prefix}${String(sequence).padStart(4, "0")}`;

}

function generatePurchaseId(): string {

    const cryptoApi = globalThis.crypto;

    if (typeof cryptoApi?.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }

    return `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function normalizeRequiredString(value: string): string {

    return value.trim();

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

function failedPurchaseMutationResult(
    errors: string | string[]
): PurchaseMutationResult {

    return {
        success: false,
        errors: Array.isArray(errors) ? errors : [errors],
        purchase: null
    };

}
