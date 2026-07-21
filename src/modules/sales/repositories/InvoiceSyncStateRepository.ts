import type { Driver } from "../../../core/persistence/Driver";

const INVOICE_SYNC_STATE_PREFIX = "syncInvoiceState:";

export interface InvoiceSyncState {
    accountId: string;
    recordId: string;
    revision: number;
    checksum: string;
    lastOperationId: string;
    tombstone: boolean;
    updatedAt: string;
}

export class InvoiceSyncStateRepository {
    private readonly driver: Driver;

    public constructor(driver: Driver) {
        this.driver = driver;
    }

    public allForAccount(accountId: string): InvoiceSyncState[] {
        const normalizedAccountId = requireText(accountId, "accountId");
        const stored = this.driver.read<unknown>(
            invoiceSyncStateKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(isInvoiceSyncState)
            .filter(state => state.accountId === normalizedAccountId);
    }

    public find(
        accountId: string,
        recordId: string
    ): InvoiceSyncState | undefined {
        const normalizedRecordId = requireText(recordId, "recordId");

        return this.allForAccount(accountId).find(
            state => state.recordId === normalizedRecordId
        );
    }

    public save(state: InvoiceSyncState): InvoiceSyncState {
        if (!isInvoiceSyncState(state)) {
            throw new Error("Invoice sync state is invalid.");
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

        this.driver.write<InvoiceSyncState[]>(
            invoiceSyncStateKeyForAccount(state.accountId),
            states
        );

        return state;
    }
}

export function invoiceSyncStateKeyForAccount(accountId: string): string {
    return `${INVOICE_SYNC_STATE_PREFIX}${requireText(accountId, "accountId")}`;
}

function isInvoiceSyncState(value: unknown): value is InvoiceSyncState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const state = value as Partial<InvoiceSyncState>;

    return isText(state.accountId)
        && isText(state.recordId)
        && typeof state.revision === "number"
        && Number.isInteger(state.revision)
        && state.revision >= 0
        && isText(state.checksum)
        && isText(state.lastOperationId)
        && typeof state.tombstone === "boolean"
        && isText(state.updatedAt);
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Invoice sync state ${field} is required.`);
    }

    return normalized;
}

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
