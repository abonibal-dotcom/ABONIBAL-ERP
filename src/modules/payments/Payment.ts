import type { PaymentDirection } from "./PaymentDirection";
import type { PaymentMethod } from "./PaymentMethod";
import type { PaymentPartyType } from "./PaymentPartyType";
import type { PaymentStatus } from "./PaymentStatus";

export interface Payment {

    id: string;
    accountId: string;
    paymentNumber: string;
    direction: PaymentDirection;
    partyType: PaymentPartyType;
    partyId?: string;
    partySnapshot: Record<string, unknown> | null;
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    status: PaymentStatus;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    postedAt?: string;
    postedBy?: string;
    voidedAt?: string;
    voidedBy?: string;
    voidReason?: string;

}

export interface PaymentDraftInput {

    paymentNumber?: string;
    direction: PaymentDirection;
    partyType: PaymentPartyType;
    partyId?: string;
    partySnapshot?: Record<string, unknown> | null;
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    notes?: string;

}

export interface PaymentUpdateInput {

    paymentNumber?: string;
    direction?: PaymentDirection;
    partyType?: PaymentPartyType;
    partyId?: string;
    partySnapshot?: Record<string, unknown> | null;
    amount?: number;
    method?: PaymentMethod;
    referenceNumber?: string;
    notes?: string;

}
