import type { Driver } from "../../../core/persistence/Driver";

const INVOICE_RETURN_SYNC_STATE_PREFIX = "syncInvoiceReturnState:";

export interface InvoiceReturnSyncState {
    accountId: string;
    recordId: string;
    revision: number;
    checksum: string;
    lastOperationId: string;
    updatedAt: string;
}

export class InvoiceReturnSyncStateRepository {
    private readonly driver: Driver;

    public constructor(driver: Driver) {
        this.driver = driver;
    }

    public allForAccount(accountId: string): InvoiceReturnSyncState[] {
        const normalizedAccountId = requireText(accountId, "accountId");
        const stored = this.driver.read<unknown>(
            invoiceReturnSyncStateKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(isInvoiceReturnSyncState)
            .filter(state => state.accountId === normalizedAccountId);
    }

    public find(
        accountId: string,
        recordId: string
    ): InvoiceReturnSyncState | undefined {
        const normalizedRecordId = requireText(recordId, "recordId");

        return this.allForAccount(accountId).find(
            state => state.recordId === normalizedRecordId
        );
    }

    public save(state: InvoiceReturnSyncState): InvoiceReturnSyncState {
        if (!isInvoiceReturnSyncState(state)) {
            throw new Error("InvoiceReturn sync state is invalid.");
        }

        const states = this.allForAccount(state.accountId);
        const index = states.findIndex(
            candidate => candidate.recordId === state.recordId
        );

        if (index === -1) {
            states.push(state);
        } else {
            states[index] = state;
        }

        this.driver.write<InvoiceReturnSyncState[]>(
            invoiceReturnSyncStateKeyForAccount(state.accountId),
            states
        );

        return state;
    }
}

export function invoiceReturnSyncStateKeyForAccount(
    accountId: string
): string {
    return `${INVOICE_RETURN_SYNC_STATE_PREFIX}${requireText(
        accountId,
        "accountId"
    )}`;
}

function isInvoiceReturnSyncState(
    value: unknown
): value is InvoiceReturnSyncState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const state = value as Partial<InvoiceReturnSyncState>;

    return isText(state.accountId)
        && isText(state.recordId)
        && typeof state.revision === "number"
        && Number.isInteger(state.revision)
        && state.revision >= 0
        && isText(state.checksum)
        && isText(state.lastOperationId)
        && isText(state.updatedAt);
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`InvoiceReturn sync state ${field} is required.`);
    }

    return normalized;
}

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
