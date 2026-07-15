import type { AuthStateService } from "../../auth/AuthStateService";
import type { StockMovement, StockMovementInput } from "../../inventory/StockMovement";
import type { StockMovementRepository } from "../../inventory/repositories/StockMovementRepository";
import { buildStockMovementAppendOperation } from "../../inventory/sync/StockMovementSyncOperation";
import type { StockMovementValidator } from "../../inventory/validators/StockMovementValidator";
import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import type { DurableMutationGroupCapture } from "../../sync/services/DurableMutationGroupCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { Invoice } from "../Invoice";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import {
    buildInvoiceCancellationCommandId,
    buildInvoiceCancellationMovementIdentity,
    isStableSalesIdentity
} from "../SalesIdentity";
import {
    buildInvoiceLifecycleTransitionOperation,
    readInvoiceLifecycleTransitionOperation
} from "../sync/SalesCommercialSyncOperation";
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
import type { SalesCommandClock } from "./IssueInvoiceDurableCommandService";

export class CancelInvoiceDurableCommandService {
    private readonly localInvoiceService: InvoiceService;
    private readonly invoiceRepository: InvoiceRepository;
    private readonly invoiceValidator: InvoiceValidator;
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
        reason = "",
        commandId?: string
    ): InvoiceCommercialCommandResult {
        if (this.syncModeService.getMode() !== "active") {
            return this.executeLocally(invoiceId, reason, commandId);
        }

        const accountContext = resolveSalesAccountContext(this.authStateService);
        const normalizedInvoiceId = invoiceId.trim();
        const normalizedReason = reason.trim() || "Invoice cancellation";

        if (!accountContext) {
            return invoiceCommandFailed(
                "durable_group",
                "failed",
                "Authenticated account is required."
            );
        }

        const expectedCommandId = buildInvoiceCancellationCommandId(
            normalizedInvoiceId
        );
        const requestedCommandId = commandId?.trim() || expectedCommandId;

        if (!expectedCommandId || requestedCommandId !== expectedCommandId) {
            return invoiceCommandFailed(
                "durable_group",
                "conflict",
                "Invoice cancellation command identity conflicts."
            );
        }

        const existingMembers = this.outboxRepository.getGroupMembers(
            accountContext.accountId,
            expectedCommandId
        );

        if (existingMembers.length > 0) {
            const commercialMember = existingMembers.find(member =>
                member.group?.groupSequence === 1
                && member.module === "invoices"
            );

            try {
                const payload = commercialMember
                    ? readInvoiceLifecycleTransitionOperation(commercialMember)
                    : null;

                if (
                    !payload
                    || payload.transition !== "cancel"
                    || payload.intended.cancelReason !== normalizedReason
                ) {
                    return invoiceCommandFailed(
                        "durable_group",
                        "conflict",
                        "Invoice cancellation retry conflicts with durable intent.",
                        expectedCommandId
                    );
                }
            } catch {
                return invoiceCommandFailed(
                    "durable_group",
                    "conflict",
                    "Invoice cancellation durable intent is invalid.",
                    expectedCommandId
                );
            }

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

        if (currentInvoice.status === "cancelled") {
            return this.executeLegacyRetry(
                normalizedInvoiceId,
                normalizedReason,
                expectedCommandId
            );
        }

        if (currentInvoice.status !== "issued") {
            return invoiceCommandFailed(
                "durable_group",
                "failed",
                "Only issued invoices can be cancelled."
            );
        }

        const preparation = this.prepare(
            currentInvoice,
            normalizedReason,
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
            preparation.cancelledInvoice,
            expectedCommandId,
            "cancel",
            preparation.createdAt
        );
        const movementOperations = preparation.movements.map(movement =>
            buildStockMovementAppendOperation(movement, preparation.createdAt)
        );
        const result = this.groupCapture.capture({
            accountId: accountContext.accountId,
            group: {
                groupId: expectedCommandId,
                groupType: "invoice_cancellation",
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

        const cancelledInvoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            normalizedInvoiceId
        );

        return cancelledInvoice
            ? invoiceCommandSucceeded(
                "durable_group",
                result.outcome === "already_applied"
                    ? "already_applied"
                    : "applied",
                cancelledInvoice,
                expectedCommandId
            )
            : invoiceCommandFailed(
                "durable_group",
                "failed",
                "Cancelled Invoice was not found after local group application.",
                expectedCommandId
            );
    }

    private prepare(
        invoice: Invoice,
        reason: string,
        commandId: string,
        accountContext: SalesAccountContext
    ): CancellationPreparationResult {
        if (!reason) {
            return failedPreparation("Cancellation reason is required.");
        }

        const createdAt = this.clock();
        const movements: StockMovement[] = [];

        for (const line of invoice.lines) {
            const originalMovementId = line.stockMovementId?.trim() ?? "";
            const originalMovement = this.stockMovementRepository.findForAccount(
                accountContext.accountId,
                originalMovementId
            );

            if (!isStableSalesIdentity(line.id) || !originalMovementId) {
                return failedPreparation(
                    "Invoice line identity and sale movement reference are required."
                );
            }

            if (!isOriginalSaleMovement(originalMovement, invoice, line.id)) {
                return failedPreparation(
                    "Original sale deduction movement is invalid."
                );
            }

            const identity = buildInvoiceCancellationMovementIdentity(
                invoice.id,
                line.id
            );

            if (!identity) {
                return failedPreparation(
                    "Invoice cancellation movement identity is invalid."
                );
            }

            if (
                line.reversalStockMovementId
                || this.stockMovementRepository.findForAccount(
                    accountContext.accountId,
                    identity.movementId
                )
            ) {
                return failedPreparation(
                    "Invoice cancellation movement exists without its durable group.",
                    true
                );
            }

            const movement = buildCommercialStockMovement(
                accountContext,
                buildCancellationMovementInput(
                    invoice,
                    line.id,
                    originalMovement,
                    reason,
                    commandId
                ),
                identity,
                createdAt
            );
            const errors = this.stockMovementValidator.validate(movement);

            if (errors.length > 0) {
                return failedPreparation(errors);
            }

            movements.push(movement);
        }

        const movementIds = new Map(
            movements.map(movement => [
                String(movement.metadata?.reversalOfInvoiceLineId ?? ""),
                movement.id
            ])
        );
        const cancelledInvoice: Invoice = {
            ...invoice,
            status: "cancelled",
            revision: revisionOf(invoice) + 1,
            cancellationCommandId: commandId,
            lines: invoice.lines.map(line => ({
                ...line,
                reversalStockMovementId: movementIds.get(line.id) ?? null
            })),
            cancelledAt: createdAt,
            cancelledBy: accountContext.userId,
            cancelReason: reason,
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const invoiceErrors = this.invoiceValidator.validate(cancelledInvoice);

        return invoiceErrors.length > 0
            ? failedPreparation(invoiceErrors)
            : {
                success: true,
                conflict: false,
                errors: [],
                createdAt,
                cancelledInvoice,
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

        return invoice?.status === "cancelled"
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
                "Persisted cancellation group did not cancel the Invoice.",
                groupId
            );
    }

    private executeLocally(
        invoiceId: string,
        reason: string,
        commandId?: string
    ): InvoiceCommercialCommandResult {
        const result = this.localInvoiceService.markCancelled(
            invoiceId,
            reason,
            commandId
        );

        return result.success && result.invoice
            ? invoiceCommandSucceeded("local", "applied", result.invoice, null)
            : invoiceCommandFailed("local", "failed", result.errors);
    }

    private executeLegacyRetry(
        invoiceId: string,
        reason: string,
        commandId: string
    ): InvoiceCommercialCommandResult {
        const result = this.localInvoiceService.markCancelled(
            invoiceId,
            reason,
            commandId
        );

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

interface CancellationPreparationResult {
    success: boolean;
    conflict: boolean;
    errors: string[];
    createdAt: string;
    cancelledInvoice: Invoice;
    movements: StockMovement[];
}

function failedPreparation(
    errors: string | string[],
    conflict = false
): CancellationPreparationResult {
    return {
        success: false,
        conflict,
        errors: Array.isArray(errors) ? errors : [errors],
        createdAt: "",
        cancelledInvoice: null as unknown as Invoice,
        movements: []
    };
}

function isOriginalSaleMovement(
    movement: StockMovement | undefined,
    invoice: Invoice,
    invoiceLineId: string
): movement is StockMovement {
    const line = invoice.lines.find(candidate => candidate.id === invoiceLineId);

    return Boolean(
        movement
        && line
        && movement.accountId === invoice.accountId
        && movement.productId === line.productId
        && movement.type === "sale_deduction"
        && movement.quantityDelta === -line.quantity
        && movement.referenceType === "invoice"
        && movement.referenceId === invoice.id
        && !movement.voidedAt
    );
}

function buildCancellationMovementInput(
    invoice: Invoice,
    invoiceLineId: string,
    originalMovement: StockMovement,
    reason: string,
    commandId: string
): StockMovementInput {
    const line = invoice.lines.find(candidate => candidate.id === invoiceLineId);

    if (!line) {
        throw new Error("Invoice cancellation line was not found.");
    }

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

function revisionOf(invoice: Invoice): number {
    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;
}
