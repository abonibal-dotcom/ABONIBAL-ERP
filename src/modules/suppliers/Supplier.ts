export type SupplierStatus = "active" | "inactive";

export interface Supplier {

    id: string;
    accountId: string;
    displayName: string;
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    companyName?: string;
    taxNumber?: string;
    notes?: string;
    status: SupplierStatus;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deletedAt?: string;
    deletedBy?: string;
    isDeleted?: boolean;

}

export interface SupplierDraftInput {

    displayName: string;
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    companyName?: string;
    taxNumber?: string;
    notes?: string;
    status?: SupplierStatus;

}

export interface SupplierUpdateInput {

    displayName?: string;
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    companyName?: string;
    taxNumber?: string;
    notes?: string;
    status?: SupplierStatus;

}
