import type { AuthStateService } from "../../auth/AuthStateService";
import type { StockMovement, StockMovementInput } from "../../inventory/StockMovement";
import type { StockMovementRepository } from "../../inventory/repositories/StockMovementRepository";
import { buildStockMovementAppendOperation } from "../../inventory/sync/StockMovementSyncOperation";
import type { StockMovementValidator } from "../../inventory/validators/StockMovementValidator";
import type { PersistentOutboxRepository } from "../../sync/repositories/PersistentOutboxRepository";
import type { DurableMutationGroupCapture } from "../../sync/services/DurableMutationGroupCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { Invoice, InvoiceLine } from "../Invoice";
import type { InvoiceReturn, InvoiceReturnLine } from "../InvoiceReturn";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { InvoiceReturnRepository } from "../repositories/InvoiceReturnRepository";
import {
    buildInvoiceReturnExecutionCommandId,
    buildInvoiceReturnMovementIdentity,
    isStableSalesIdentity
} from "../SalesIdentity";
import { buildInvoiceReturnLifecycleTransitionOperation } from "../sync/SalesCommercialSyncOperation";
import type { InvoiceReturnValidator } from "../validators/InvoiceReturnValidator";
import type { InvoiceReturnService } from "./InvoiceReturnService";
import {
    buildCommercialStockMovement,
    invoiceReturnCommandFailed,
    invoiceReturnCommandSucceeded,
    resolveSalesAccountContext,
    type InvoiceReturnCommercialCommandResult,
    type SalesAccountContext
} from "./SalesCommercialCommandSupport";
import type { SalesCommandClock } from "./IssueInvoiceDurableCommandService";

export class ExecuteInvoiceReturnDurableCommandService {
    private readonly localInvoiceReturnService: InvoiceReturnService;
    private readonly invoiceReturnRepository: InvoiceReturnRepository;
    private readonly invoiceReturnValidator: InvoiceReturnValidator;
    private readonly invoiceRepository: InvoiceRepository;
    private readonly stockMovementRepository: StockMovementRepository;
    private readonly stockMovementValidator: StockMovementValidator;
    private readonly groupCapture: DurableMutationGroupCapture;
    private readonly outboxRepository: PersistentOutboxRepository;
    private readonly syncModeService: SyncModeService;
    private readonly authStateService: AuthStateService;
    private readonly clock: SalesCommandClock;

    public constructor(
        localInvoiceReturnService: InvoiceReturnService,
        invoiceReturnRepository: InvoiceReturnRepository,
        invoiceReturnValidator: InvoiceReturnValidator,
        invoiceRepository: InvoiceRepository,
        stockMovementRepository: StockMovementRepository,
        stockMovementValidator: StockMovementValidator,
        groupCapture: DurableMutationGroupCapture,
        outboxRepository: PersistentOutboxRepository,
        syncModeService: SyncModeService,
        authStateService: AuthStateService,
        clock: SalesCommandClock = () => new Date().toISOString()
    ) {
        this.localInvoiceReturnService = localInvoiceReturnService;
        this.invoiceReturnRepository = invoiceReturnRepository;
        this.invoiceReturnValidator = invoiceReturnValidator;
        this.invoiceRepository = invoiceRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.stockMovementValidator = stockMovementValidator;
        this.groupCapture = groupCapture;
        this.outboxRepository = outboxRepository;
        this.syncModeService = syncModeService;
        this.authStateService = authStateService;
        this.clock = clock;
    }

    public execute(
        invoiceReturnId: string,
        commandId?: string
    ): InvoiceReturnCommercialCommandResult {
        if (this.syncModeService.getMode() !== "active") {
            return this.executeLocally(invoiceReturnId, commandId);
        }

        const accountContext = resolveSalesAccountContext(this.authStateService);
        const normalizedReturnId = invoiceReturnId.trim();

        if (!accountContext) {
            return invoiceReturnCommandFailed(
                "durable_group",
                "failed",
                "Authenticated account is required."
            );
        }

        const expectedCommandId = buildInvoiceReturnExecutionCommandId(
            normalizedReturnId
        );
        const requestedCommandId = commandId?.trim() || expectedCommandId;

        if (!expectedCommandId || requestedCommandId !== expectedCommandId) {
            return invoiceReturnCommandFailed(
                "durable_group",
                "conflict",
                "Invoice return execution command identity conflicts."
            );
        }

        const existingMembers = this.outboxRepository.getGroupMembers(
            accountContext.accountId,
            expectedCommandId
        );

        if (existingMembers.length > 0) {
            return this.recoverExistingGroup(
                accountContext.accountId,
                normalizedReturnId,
                expectedCommandId
            );
        }

        const currentReturn = this.invoiceReturnRepository.findForAccount(
            accountContext.accountId,
            normalizedReturnId
        );

        if (!currentReturn) {
            return invoiceReturnCommandFailed(
                "durable_group",
                "failed",
                "Invoice return not found."
            );
        }

        if (currentReturn.status === "executed") {
            return this.executeLegacyRetry(normalizedReturnId, expectedCommandId);
        }

        if (currentReturn.status !== "recorded") {
            return invoiceReturnCommandFailed(
                "durable_group",
                "failed",
                "Only recorded invoice returns can be executed."
            );
        }

        const invoice = this.invoiceRepository.findForAccount(
            accountContext.accountId,
            currentReturn.invoiceId
        );

        if (!invoice || invoice.status !== "issued") {
            return invoiceReturnCommandFailed(
                "durable_group",
                "failed",
                "Invoice return requires its issued Invoice."
            );
        }

        const preparation = this.prepare(
            currentReturn,
            invoice,
            expectedCommandId,
            accountContext
        );

        if (!preparation.success) {
            return invoiceReturnCommandFailed(
                "durable_group",
                preparation.conflict ? "conflict" : "failed",
                preparation.errors
            );
        }

        const commercialOperation =
            buildInvoiceReturnLifecycleTransitionOperation(
                currentReturn,
                preparation.executedReturn,
                expectedCommandId,
                preparation.createdAt
            );
        const movementOperations = preparation.movements.map(movement =>
            buildStockMovementAppendOperation(movement, preparation.createdAt)
        );
        const result = this.groupCapture.capture({
            accountId: accountContext.accountId,
            group: {
                groupId: expectedCommandId,
                groupType: "invoice_return_execution",
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
            return invoiceReturnCommandFailed(
                "durable_group",
                result.outcome === "conflict" ? "conflict" : "failed",
                result.errors,
                expectedCommandId
            );
        }

        const executedReturn = this.invoiceReturnRepository.findForAccount(
            accountContext.accountId,
            normalizedReturnId
        );

        return executedReturn
            ? invoiceReturnCommandSucceeded(
                "durable_group",
                result.outcome === "already_applied"
                    ? "already_applied"
                    : "applied",
                executedReturn,
                expectedCommandId
            )
            : invoiceReturnCommandFailed(
                "durable_group",
                "failed",
                "Executed InvoiceReturn was not found after local group application.",
                expectedCommandId
            );
    }

    private prepare(
        invoiceReturn: InvoiceReturn,
        invoice: Invoice,
        commandId: string,
        accountContext: SalesAccountContext
    ): ReturnExecutionPreparationResult {
        if (
            invoiceReturn.accountId !== accountContext.accountId
            || invoice.accountId !== accountContext.accountId
        ) {
            return failedPreparation("Invoice return account mismatch.");
        }

        const createdAt = this.clock();
        const movements: StockMovement[] = [];
        const invoiceLineIds = new Set<string>();
        const returnLineIds = new Set<string>();

        for (const returnLine of invoiceReturn.lines) {
            if (
                !isStableSalesIdentity(returnLine.id)
                || returnLineIds.has(returnLine.id)
                || invoiceLineIds.has(returnLine.invoiceLineId)
            ) {
                return failedPreparation(
                    "Invoice return line identity is invalid or duplicated."
                );
            }

            returnLineIds.add(returnLine.id);
            invoiceLineIds.add(returnLine.invoiceLineId);

            const invoiceLine = invoice.lines.find(
                line => line.id === returnLine.invoiceLineId
            );

            if (!invoiceLine || returnLine.productId !== invoiceLine.productId) {
                return failedPreparation("Invoice return line source is invalid.");
            }

            if (
                !Number.isFinite(returnLine.returnQuantity)
                || returnLine.returnQuantity <= 0
                || returnLine.returnQuantity > this.remainingQuantity(
                    accountContext.accountId,
                    invoice,
                    invoiceLine,
                    invoiceReturn.id
                )
            ) {
                return failedPreparation(
                    "Return quantity exceeds remaining returnable quantity."
                );
            }

            const originalMovementId = (
                returnLine.originalSaleDeductionMovementId
                ?? invoiceLine.stockMovementId
                ?? ""
            ).trim();
            const originalMovement = this.stockMovementRepository.findForAccount(
                accountContext.accountId,
                originalMovementId
            );

            if (!isOriginalSaleMovement(originalMovement, invoice, invoiceLine)) {
                return failedPreparation(
                    "Original sale deduction movement is invalid."
                );
            }

            const identity = buildInvoiceReturnMovementIdentity(
                invoiceReturn.id,
                returnLine.id
            );

            if (!identity) {
                return failedPreparation(
                    "Invoice return movement identity is invalid."
                );
            }

            if (
                returnLine.returnStockMovementId
                || this.stockMovementRepository.findForAccount(
                    accountContext.accountId,
                    identity.movementId
                )
            ) {
                return failedPreparation(
                    "Invoice return movement exists without its durable group.",
                    true
                );
            }

            const movement = buildCommercialStockMovement(
                accountContext,
                buildReturnMovementInput(
                    invoiceReturn,
                    returnLine,
                    invoice,
                    invoiceLine,
                    originalMovement,
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
                String(movement.metadata?.invoiceReturnLineId ?? ""),
                movement.id
            ])
        );
        const executedReturn: InvoiceReturn = {
            ...invoiceReturn,
            status: "executed",
            revision: revisionOf(invoiceReturn) + 1,
            executionCommandId: commandId,
            lines: invoiceReturn.lines.map(line => ({
                ...line,
                returnStockMovementId: movementIds.get(line.id) ?? null
            })),
            updatedAt: createdAt,
            updatedBy: accountContext.userId
        };
        const returnErrors = this.invoiceReturnValidator.validate(executedReturn);

        return returnErrors.length > 0
            ? failedPreparation(returnErrors)
            : {
                success: true,
                conflict: false,
                errors: [],
                createdAt,
                executedReturn,
                movements
            };
    }

    private remainingQuantity(
        accountId: string,
        invoice: Invoice,
        invoiceLine: InvoiceLine,
        excludedReturnId: string
    ): number {
        const returned = this.invoiceReturnRepository
            .allForInvoice(accountId, invoice.id)
            .filter(invoiceReturn => invoiceReturn.id !== excludedReturnId)
            .flatMap(invoiceReturn => invoiceReturn.lines)
            .filter(line => line.invoiceLineId === invoiceLine.id)
            .reduce((total, line) => total + line.returnQuantity, 0);

        return Math.max(0, invoiceLine.quantity - returned);
    }

    private recoverExistingGroup(
        accountId: string,
        invoiceReturnId: string,
        groupId: string
    ): InvoiceReturnCommercialCommandResult {
        const result = this.groupCapture.applyPersistedGroup(accountId, groupId);

        if (!result.success) {
            return invoiceReturnCommandFailed(
                "durable_group",
                result.outcome === "conflict" ? "conflict" : "failed",
                result.errors,
                groupId
            );
        }

        const invoiceReturn = this.invoiceReturnRepository.findForAccount(
            accountId,
            invoiceReturnId
        );

        return invoiceReturn?.status === "executed"
            ? invoiceReturnCommandSucceeded(
                "durable_group",
                result.outcome === "already_applied"
                    ? "already_applied"
                    : "applied",
                invoiceReturn,
                groupId
            )
            : invoiceReturnCommandFailed(
                "durable_group",
                "failed",
                "Persisted return group did not execute the InvoiceReturn.",
                groupId
            );
    }

    private executeLocally(
        invoiceReturnId: string,
        commandId?: string
    ): InvoiceReturnCommercialCommandResult {
        const result = this.localInvoiceReturnService.executeReturn(
            invoiceReturnId,
            commandId
        );

        return result.success && result.invoiceReturn
            ? invoiceReturnCommandSucceeded(
                "local",
                "applied",
                result.invoiceReturn,
                null
            )
            : invoiceReturnCommandFailed("local", "failed", result.errors);
    }

    private executeLegacyRetry(
        invoiceReturnId: string,
        commandId: string
    ): InvoiceReturnCommercialCommandResult {
        const result = this.localInvoiceReturnService.executeReturn(
            invoiceReturnId,
            commandId
        );

        return result.success && result.invoiceReturn
            ? invoiceReturnCommandSucceeded(
                "local",
                "already_applied",
                result.invoiceReturn,
                null
            )
            : invoiceReturnCommandFailed("local", "conflict", result.errors);
    }
}

interface ReturnExecutionPreparationResult {
    success: boolean;
    conflict: boolean;
    errors: string[];
    createdAt: string;
    executedReturn: InvoiceReturn;
    movements: StockMovement[];
}

function failedPreparation(
    errors: string | string[],
    conflict = false
): ReturnExecutionPreparationResult {
    return {
        success: false,
        conflict,
        errors: Array.isArray(errors) ? errors : [errors],
        createdAt: "",
        executedReturn: null as unknown as InvoiceReturn,
        movements: []
    };
}

function isOriginalSaleMovement(
    movement: StockMovement | undefined,
    invoice: Invoice,
    invoiceLine: InvoiceLine
): movement is StockMovement {
    return Boolean(
        movement
        && movement.accountId === invoice.accountId
        && movement.productId === invoiceLine.productId
        && movement.type === "sale_deduction"
        && movement.referenceType === "invoice"
        && movement.referenceId === invoice.id
        && !movement.voidedAt
    );
}

function buildReturnMovementInput(
    invoiceReturn: InvoiceReturn,
    returnLine: InvoiceReturnLine,
    invoice: Invoice,
    invoiceLine: InvoiceLine,
    originalMovement: StockMovement,
    commandId: string
): StockMovementInput {
    return {
        productId: returnLine.productId,
        type: "sale_return",
        quantityDelta: returnLine.returnQuantity,
        reason: `Invoice return ${invoiceReturn.returnNumber}`,
        referenceType: "invoice_return",
        referenceId: invoiceReturn.id,
        metadata: {
            commandId,
            invoiceReturnId: invoiceReturn.id,
            invoiceReturnLineId: returnLine.id,
            invoiceId: invoice.id,
            invoiceLineId: invoiceLine.id,
            invoiceNumber: invoice.invoiceNumber,
            originalSaleDeductionMovementId: originalMovement.id,
            originalStockMovementId: originalMovement.id,
            reversesMovementId: originalMovement.id,
            originalMovementType: originalMovement.type
        }
    };
}

function revisionOf(invoiceReturn: InvoiceReturn): number {
    return typeof invoiceReturn.revision === "number"
        && Number.isInteger(invoiceReturn.revision)
        && invoiceReturn.revision >= 0
        ? invoiceReturn.revision
        : 0;
}
