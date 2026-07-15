import type { AuthStateService } from "../../auth/AuthStateService";
import {
    IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
    type StockMovement,
    type StockMovementCreateIdentity,
    type StockMovementInput
} from "../../inventory/StockMovement";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type { Invoice } from "../Invoice";
import type { InvoiceReturn } from "../InvoiceReturn";

export type CommercialCommandOutcome =
    | "applied"
    | "already_applied"
    | "conflict"
    | "failed";

export type CommercialCommandPath = "local" | "durable_group";

export interface SalesAccountContext {
    accountId: string;
    userId: string;
}

export interface InvoiceCommercialCommandResult {
    success: boolean;
    outcome: CommercialCommandOutcome;
    path: CommercialCommandPath;
    groupId: string | null;
    invoice: Invoice | null;
    errors: string[];
}

export interface InvoiceReturnCommercialCommandResult {
    success: boolean;
    outcome: CommercialCommandOutcome;
    path: CommercialCommandPath;
    groupId: string | null;
    invoiceReturn: InvoiceReturn | null;
    errors: string[];
}

export function resolveSalesAccountContext(
    authStateService: AuthStateService
): SalesAccountContext | null {
    const state = authStateService.getState();

    if (state.status !== "authenticated") {
        return null;
    }

    const accountId = state.session.account.id.trim();
    const userAccountId = state.session.user.accountId.trim();
    const userId = state.session.user.id.trim();

    return accountId && accountId === userAccountId && userId
        ? { accountId, userId }
        : null;
}

export function buildCommercialStockMovement(
    accountContext: SalesAccountContext,
    input: StockMovementInput,
    identity: StockMovementCreateIdentity,
    createdAt: string
): StockMovement {
    return {
        id: identity.movementId,
        accountId: accountContext.accountId,
        productId: input.productId.trim(),
        type: input.type,
        quantityDelta: input.quantityDelta,
        reason: input.reason.trim(),
        referenceType: input.referenceType,
        referenceId: input.referenceId?.trim(),
        unitCost: input.unitCost,
        totalCost: input.totalCost,
        createdAt,
        createdBy: accountContext.userId,
        ledgerSemanticsVersion: IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
        idempotencyKey: identity.idempotencyKey,
        metadata: input.metadata
    };
}

export function recordsMatch(left: unknown, right: unknown): boolean {
    return jsonValuesMatch(
        toJsonObject(JSON.parse(JSON.stringify(left)) as unknown),
        toJsonObject(JSON.parse(JSON.stringify(right)) as unknown)
    );
}

export function invoiceCommandSucceeded(
    path: CommercialCommandPath,
    outcome: "applied" | "already_applied",
    invoice: Invoice,
    groupId: string | null
): InvoiceCommercialCommandResult {
    return {
        success: true,
        outcome,
        path,
        groupId,
        invoice,
        errors: []
    };
}

export function invoiceCommandFailed(
    path: CommercialCommandPath,
    outcome: "conflict" | "failed",
    errors: string | string[],
    groupId: string | null = null
): InvoiceCommercialCommandResult {
    return {
        success: false,
        outcome,
        path,
        groupId,
        invoice: null,
        errors: Array.isArray(errors) ? errors : [errors]
    };
}

export function invoiceReturnCommandSucceeded(
    path: CommercialCommandPath,
    outcome: "applied" | "already_applied",
    invoiceReturn: InvoiceReturn,
    groupId: string | null
): InvoiceReturnCommercialCommandResult {
    return {
        success: true,
        outcome,
        path,
        groupId,
        invoiceReturn,
        errors: []
    };
}

export function invoiceReturnCommandFailed(
    path: CommercialCommandPath,
    outcome: "conflict" | "failed",
    errors: string | string[],
    groupId: string | null = null
): InvoiceReturnCommercialCommandResult {
    return {
        success: false,
        outcome,
        path,
        groupId,
        invoiceReturn: null,
        errors: Array.isArray(errors) ? errors : [errors]
    };
}
