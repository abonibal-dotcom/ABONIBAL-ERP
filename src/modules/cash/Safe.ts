import type { SafeStatus } from "./SafeStatus";

export interface Safe {

    id: string;
    accountId: string;
    displayName: string;
    code?: string;
    currency: string;
    status: SafeStatus;
    isDefault: boolean;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deactivatedAt?: string;
    deactivatedBy?: string;

}

export interface SafeDraftInput {

    displayName: string;
    code?: string;
    currency: string;
    isDefault?: boolean;
    notes?: string;

}

export interface SafeUpdateInput {

    displayName?: string;
    code?: string;
    currency?: string;
    notes?: string;

}
