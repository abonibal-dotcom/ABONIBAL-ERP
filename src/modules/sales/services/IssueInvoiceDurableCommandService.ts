import type { AuthStateService } from "../../auth/AuthStateService";
import type { StockMovement, StockMovementInput } from "../../inventory/StockMovement";
import type { StockMovementRepository } from "../../inventory/repositories/StockMovementRepository";
import type { InventoryService } from "../../inventory/services/InventoryService";
import { buildStockMovementAppendOperation } from "../../inventory/sync/StockMovementSyncOperation";
import type { StockMovementValidator } from "../../inventory/validators/StockMovementValidator";
import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import type { DurableMutationGroupCapture } from "../../sync/services/DurableMutationGroupCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { Invoice } from "../Invoice";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import {
    buildInvoiceIssueCommandId,
    buildInvoiceSaleMovementIdentity,
    isStableSalesIdentity
} from "../SalesIdentity";
import { buildInvoiceLifecycleTransitionOperation } from "../sync/SalesCommercialSyncOperation";
import type { InvoiceValidator } from "../validators/InvoiceValidator";
import type { InvoiceService } from "./InvoiceService";
import {
    buildCommercialStockMovement,
    invoiceCommandFailed,
    invoiceCommandSucceeded,
    resolveSalesAccountContext,
    type InvoiceCommercialCommandResult,
    type SalesAccountContext
} from "./SalesCommercialCommandSupport";

export type SalesCommandClock = () => string;

export class IssueInvoiceDurableCommandService {
    private readonly localInvoiceService: InvoiceService;
    private readonly invoiceRepository: InvoiceRepository;
    private readonly invoiceValidator: InvoiceValidator;
    private readonly inventoryService: InventoryService;
    private readonly stockMovementRepository: StockMovementRepository;
    private readonly stockMovementValidator: StockMovementValidator;
    private readonly groupCapture: DurableMutationGroupCapture;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly syncModeService: SyncModeService;
    private readonly authStateService: AuthStateService;
    private readonly clock: SalesCommandClock;

    public constructor(
        localInvoiceService: InvoiceService,
        invoiceRepository: InvoiceRepository,
        invoiceValidator: InvoiceValidator,
        inventoryService: InventoryService,
        stockMovementRepository: StockMovementRepository,
        stockMovementValidator: StockMovementValidator,
        groupCapture: DurableMutationGroupCapture,
        outboxRepository: PersistentOutboxRepository,
        syncModeService: SyncModeService,
        authStateService: AuthStateService,
        clock: SalesCommandClock = () => new Date().toISOString()
    ) {
        this.localInvoiceService = localInvoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceValidator = invoiceValidator;
        this.inventoryService = inventoryService;
        this.stockMovementRepository = stockMovementRepository;
        this.stockMovementValidator = stockMovementValidator;
        this.groupCapture = groupCapture;
        this.outboxRepository = outboxRepository;
        this.syncModeService = syncModeService;
        this.authStateService = authStateService;
        this.clock = clock;
    }

    public execute(
        invoiceId: string,
        commandId?: string
    ): InvoiceCommercialCommandResult {
        if (this.syncModeService.getMode() !== "active") {
            return this.executeLocally(invoiceId, commandId);
        }

        const accountContext = resolveSalesAccountContext(this.authStateService);
        const normalizedInvoiceId = invoiceId.trim();

        if (!accountContext) {
            return invoiceCommandFailed(
                "durable_group",
                "failed",
                "Authenticated account is required."
            );
        }

        if (!normalizedInvoiceId) {
            return invoiceCommandFailed(
                "durable_group",
                "failed",
                "Invoice id is required."
            );
        }

        const expectedCommandId = buildInvoiceIssueCommandId(normalizedInvoiceId);
        const requestedCommandId = commandId?.trim() || expectedCommandId;

        if (!expectedCommandId || requestedCommandId !== expectedCommandId) {
            return invoiceCommandFailed(
                "durable_group",
                "conflict",
                "Invoice issue command identity conflicts."
            );
        }

        const existingMembers = this.outboxRepository.getGroupMembers(
            accountContext.accountId,
            expectedCommandId
        );

        if (existingMembers.length > 0) {
            return this.recoverExistingGroup(
                accountContext.accountId,
                normalizedInvoiceId,
                expectedCommandId
            );
        }

        const currentInvoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceId
        );

        if (!currentInvoice) {
            return invoiceCommandFailed(
                "durable_group",
                "failed",
                "Invoice not found."
            );
        }

        if (currentInvoice.status === "issued") {
            return this.executeLegacyRetry(normalizedInvoiceId, expectedCommandId);
        }

        if (currentInvoice.status !== "draft") {
            return invoiceCommandFailed(
                "durable_group",
                "failed",
                "Only draft invoices can be issued."
            );
        }

        const preparation = this.prepare(
            currentInvoice,
            expectedCommandId,
            accountContext
        );

        if (!preparation.success) {
            return invoiceCommandFailed(
                "durable_group",
                preparation.conflict ? "conflict" : "failed",
                preparation.errors
            );
        }

        const commercialOperation = buildInvoiceLifecycleTransitionOperation(
            currentInvoice,
            preparation.issuedInvoice,
            expectedCommandId,
            "issue",
            preparation.createdAt
        );
        const movementOperations = preparation.movements.map(movement =>
            buildStockMovementAppendOperation(movement, preparation.createdAt)
        );
        const result = this.groupCapture.capture({
            accountId: accountContext.accountId,
            group: {
                groupId: expectedCommandId,
                groupType: "invoice_issue",
                members: [
                    {
                        operation: commercialOperation,
                        groupSequence: 1,
                        requiredForLocalCompletion: true
                    },
                    ...movementOperations.map((operation, index) => ({
                        operation,
                        groupSequence: index + 2,
                        requiredForLocalCompletion: true
                    }))
                ]
            }
        });

        if (!result.success) {
            return invoiceCommandFailed(
                "durable_group",
                result.outcome === "conflict" ? "conflict" : "failed",
                result.errors,
                expectedCommandId
            );
        }

        const issuedInvoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceId
        );

        return issuedInvoice
            ? invoiceCommandSucceeded(
                "durable_group",
                result.outcome === "already_applied"
                    ? "already_applied"
                    : "applied",
                issuedInvoice,
                expectedCommandId
            )
            : invoiceCommandFailed(
                "durable_group",
                "failed",
                "Issued Invoice was not found after local group application.",
                expectedCommandId
            );
    }

    private prepare(
        invoice: Invoice,
        commandId: string,
        accountContext: SalesAccountContext
    ): IssuePreparationResult {
        if (invoice.accountId !== accountContext.accountId) {
            return failedPreparation("Invoice account mismatch.");
        }

        const lineIds = new Set<string>();

        for (const line of invoice.lines) {
            if (!isStableSalesIdentity(line.id) || lineIds.has(line.id)) {
                return failedPreparation(
                    "Invoice line stable identity is invalid or duplicated."
                );
            }

            if (line.stockMovementId || line.reversalStockMovementId) {
                return failedPreparation(
                    "Draft invoice already has stock movement references."
                );
            }

            lineIds.add(line.id);
        }

        const createdAt = this.clock();
        const movements: StockMovement[] = [];

        for (const line of invoice.lines) {
            const identity = buildInvoiceSaleMovementIdentity(invoice.id, line.id);

            if (!identity) {
                return failedPreparation(
                    "Invoice issue movement identity is invalid."
                );
            }

            if (this.stockMovementRepository.findForAccount(
                accountContext.accountId,
                identity.movementId
            )) {
                return failedPreparation(
                    "Invoice issue movement exists without its durable group.",
                    true
                );
            }

            const movement = buildCommercialStockMovement(
                accountContext,
                buildIssueMovementInput(invoice, line.id, commandId),
                identity,
                createdAt
            );
            const errors = this.stockMovementValidator.validate(movement);

            if (errors.length > 0) {
                return failedPreparation(errors);
            }

            movements.push(movement);
        }

        const availability = this.inventoryService.checkAvailabilityBatch(
            invoice.lines.map(line => ({
                productId: line.productId,
                requestedQuantity: line.quantity
            }))
        );

        if (!availability.canFulfill) {
            return failedPreparation(
                availability.results.flatMap(result => result.errors.length > 0
                    ? result.errors
                    : [`Insufficient stock for product ${result.productId}.`]
                )
            );
        }

        const movementIds = new Map(
            movements.map(movement => [
                String(movement.metadata?.invoiceLineId ?? ""),
                movement.id
            ])
        );
        const issuedInvoice: Invoice = {
            ...invoice,
            status: "issued",
            revision: revisionOf(invoice) + 1,
            issueCommandId: commandId,
            lines: invoice.lines.map(line => ({
                ...line,
                stockMovementId: movementIds.get(line.id) ?? null
            })),
            issuedAt: createdAt,
            issuedBy: accountContext.userId,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const invoiceErrors = this.invoiceValidator.validate(issuedInvoice);

        return invoiceErrors.length > 0
            ? failedPreparation(invoiceErrors)
            : {
                success: true,
                conflict: false,
                errors: [],
                createdAt,
                issuedInvoice,
                movements
            };
    }

    private recoverExistingGroup(
        accountId: string,
        invoiceId: string,
        groupId: string
    ): InvoiceCommercialCommandResult {
        const result = this.groupCapture.applyPersistedGroup(accountId, groupId);

        if (!result.success) {
            return invoiceCommandFailed(
                "durable_group",
                result.outcome === "conflict" ? "conflict" : "failed",
                result.errors,
                groupId
            );
        }

        const invoice = this.invoiceRepository.findForAccount(accountId, invoiceId);

        return invoice?.status === "issued"
            ? invoiceCommandSucceeded(
                "durable_group",
                result.outcome === "already_applied"
                    ? "already_applied"
                    : "applied",
                invoice,
                groupId
            )
            : invoiceCommandFailed(
                "durable_group",
                "failed",
                "Persisted issue group did not produce an issued Invoice.",
                groupId
            );
    }

    private executeLocally(
        invoiceId: string,
        commandId?: string
    ): InvoiceCommercialCommandResult {
        const result = this.localInvoiceService.markIssued(invoiceId, commandId);

        return result.success && result.invoice
            ? invoiceCommandSucceeded("local", "applied", result.invoice, null)
            : invoiceCommandFailed("local", "failed", result.errors);
    }

    private executeLegacyRetry(
        invoiceId: string,
        commandId: string
    ): InvoiceCommercialCommandResult {
        const result = this.localInvoiceService.markIssued(invoiceId, commandId);

        return result.success && result.invoice
            ? invoiceCommandSucceeded(
                "local",
                "already_applied",
                result.invoice,
                null
            )
            : invoiceCommandFailed("local", "conflict", result.errors);
    }
}

interface IssuePreparationResult {
    success: boolean;
    conflict: boolean;
    errors: string[];
    createdAt: string;
    issuedInvoice: Invoice;
    movements: StockMovement[];
}

function failedPreparation(
    errors: string | string[],
    conflict = false
): IssuePreparationResult {
    return {
        success: false,
        conflict,
        errors: Array.isArray(errors) ? errors : [errors],
        createdAt: "",
        issuedInvoice: null as unknown as Invoice,
        movements: []
    };
}

function buildIssueMovementInput(
    invoice: Invoice,
    invoiceLineId: string,
    commandId: string
): StockMovementInput {
    const line = invoice.lines.find(candidate => candidate.id === invoiceLineId);

    if (!line) {
        throw new Error("Invoice issue line was not found.");
    }

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

function revisionOf(invoice: Invoice): number {
    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;
}
