import type { Driver } from "../../../core/persistence/Driver";
import type { MasterDataSyncModule } from "../master-data/MasterDataSyncTypes";

const MASTER_DATA_SYNC_STATE_PREFIX = "syncMasterDataState:";

export interface MasterDataSyncState {
    accountId: string;
    module: MasterDataSyncModule;
    recordId: string;
    revision: number;
    checksum: string;
    lastOperationId: string;
    updatedAt: string;
}

export class MasterDataSyncStateRepository {
    private readonly driver: Driver;

    public constructor(driver: Driver) {
        this.driver = driver;
    }

    public allForAccount(accountId: string): MasterDataSyncState[] {
        const normalizedAccountId = normalizeText(accountId, "accountId");
        const stored = this.driver.read<unknown>(
            masterDataSyncStateKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(isMasterDataSyncState)
            .filter(state => state.accountId === normalizedAccountId);
    }

    public find(
        accountId: string,
        module: MasterDataSyncModule,
        recordId: string
    ): MasterDataSyncState | undefined {
        const normalizedRecordId = normalizeText(recordId, "recordId");

        return this
            .allForAccount(accountId)
            .find(state =>
                state.module === module
                && state.recordId === normalizedRecordId
            );
    }

    public save(state: MasterDataSyncState): MasterDataSyncState {
        if (!isMasterDataSyncState(state)) {
            throw new Error("Master-data sync state is invalid.");
        }

        const states = this.allForAccount(state.accountId);
        const index = states.findIndex(candidate =>
            candidate.module === state.module
            && candidate.recordId === state.recordId
        );

        if (index === -1) {
            states.push(state);
        } else {
            states[index] = state;
        }

        this.driver.write<MasterDataSyncState[]>(
            masterDataSyncStateKeyForAccount(state.accountId),
            states
        );

        return state;
    }
}

export function masterDataSyncStateKeyForAccount(accountId: string): string {
    return `${MASTER_DATA_SYNC_STATE_PREFIX}${normalizeText(accountId, "accountId")}`;
}

function isMasterDataSyncState(value: unknown): value is MasterDataSyncState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const state = value as Partial<MasterDataSyncState>;

    return isText(state.accountId)
        && ["products", "customers", "suppliers"].includes(state.module ?? "")
        && isText(state.recordId)
        && typeof state.revision === "number"
        && Number.isInteger(state.revision)
        && state.revision > 0
        && isText(state.checksum)
        && isText(state.lastOperationId)
        && isText(state.updatedAt);
}

function normalizeText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Master-data sync state ${field} is required.`);
    }

    return normalized;
}

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
