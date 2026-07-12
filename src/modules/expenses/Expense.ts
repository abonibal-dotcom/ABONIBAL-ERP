import type { ExpensePayeeType } from "./ExpensePayeeType";
import type { ExpensePaymentMethod } from "./ExpensePaymentMethod";
import type { ExpenseStatus } from "./ExpenseStatus";

export interface ExpenseCategorySnapshot {

    displayName: string;

}

export interface ExpensePayeeSnapshot {

    displayName: string;

}

export interface Expense {

    id: string;
    accountId: string;
    expenseNumber: string;
    status: ExpenseStatus;
    expenseDate: string;
    categorySnapshot: ExpenseCategorySnapshot;
    payeeType: ExpensePayeeType;
    payeeId?: string;
    payeeSnapshot: ExpensePayeeSnapshot | null;
    amount: number;
    paymentMethod: ExpensePaymentMethod;
    referenceNumber?: string;
    notes?: string;
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

export interface ExpenseDraftInput {

    expenseNumber?: string;
    expenseDate: string;
    categorySnapshot: ExpenseCategorySnapshot;
    payeeType: ExpensePayeeType;
    payeeId?: string;
    payeeSnapshot?: ExpensePayeeSnapshot | null;
    amount: number;
    paymentMethod: ExpensePaymentMethod;
    referenceNumber?: string;
    notes?: string;

}

export interface ExpenseDraftUpdateInput {

    expenseDate?: string;
    categorySnapshot?: ExpenseCategorySnapshot;
    payeeType?: ExpensePayeeType;
    payeeId?: string;
    payeeSnapshot?: ExpensePayeeSnapshot | null;
    amount?: number;
    paymentMethod?: ExpensePaymentMethod;
    referenceNumber?: string;
    notes?: string;

}
