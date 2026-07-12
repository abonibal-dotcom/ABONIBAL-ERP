import type { CashMovementReferenceType } from "./CashMovementReferenceType";
import type { CashMovementStatus } from "./CashMovementStatus";
import type { CashMovementType } from "./CashMovementType";

export interface CashMovementSafeSnapshot {

    id: string;
    displayName: string;
    currency: string;

}

export interface CashMovement {

    id: string;
    accountId: string;
    movementNumber: string;
    safeId: string;
    safeSnapshot: CashMovementSafeSnapshot;
    type: CashMovementType;
    status: CashMovementStatus;
    amount: number;
    currency: string;
    movementDate: string;
    idempotencyKey: string;
    reason: string;
    referenceType: CashMovementReferenceType;
    referenceId?: string;
    referenceSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    notes?: string;
    reversalOfMovementId?: string;
    reversedByMovementId?: string;
    transferId?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    postedAt?: string;
    postedBy?: string;
    reversedAt?: string;
    reversedBy?: string;
    reversalReason?: string;

}

export interface CashMovementDraftInput {

    safeId: string;
    type: CashMovementType;
    amount: number;
    movementDate: string;
    idempotencyKey?: string;
    reason: string;
    referenceType?: CashMovementReferenceType;
    referenceId?: string;
    referenceSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    notes?: string;

}

export interface CashMovementUpdateInput {

    safeId?: string;
    type?: CashMovementType;
    amount?: number;
    movementDate?: string;
    reason?: string;
    referenceType?: CashMovementReferenceType;
    referenceId?: string;
    referenceSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    notes?: string;

}
