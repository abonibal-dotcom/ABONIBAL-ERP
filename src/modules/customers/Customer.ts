export type CustomerStatus = "active" | "inactive";

export interface Customer {

    id: string;
    accountId: string;
    displayName: string;
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    notes?: string;
    status: CustomerStatus;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deletedAt?: string;
    deletedBy?: string;
    isDeleted?: boolean;

}

export interface CustomerDraftInput {

    displayName: string;
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    notes?: string;
    status?: CustomerStatus;

}

export interface CustomerUpdateInput {

    displayName?: string;
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    notes?: string;
    status?: CustomerStatus;

}
