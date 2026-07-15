import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../../sync/SyncContracts";
import type { SyncOperation } from "../../sync/SyncOperation";
import type { FirebaseProjectIdProvider } from "../../sync/master-data/MasterDataSyncOperationTransport";
import {
    createStockMovementCloudEnvelope,
    normalizeStockMovementCloudEnvelope,
    normalizeStockMovementCloudReceipt,
    stockMovementAccountPath,
    stockMovementCloudReceiptPath,
    stockMovementRecordPath,
    type StockMovementCloudEnvelope,
    type StockMovementCloudReceipt
} from "./StockMovementSyncTypes";

const TEST_FIREBASE_PROJECT_ID = "abonibal-erp-test";

export interface StockMovementRealtimeStore {
    read<T>(path: string): Promise<T | null>;
    updateChildren(path: string, values: Record<string, unknown>): Promise<void>;
    serverTimestampValue(): object;
}

export class StockMovementSyncOperationTransport
implements SyncOperationTransport {
    private readonly store: StockMovementRealtimeStore;
    private readonly projectIdProvider: FirebaseProjectIdProvider;

    public constructor(
        store: StockMovementRealtimeStore,
        projectIdProvider: FirebaseProjectIdProvider
    ) {
        this.store = store;
        this.projectIdProvider = projectIdProvider;
    }

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.assertTestProject();

        if (
            operation.module !== "stockMovements"
            || operation.operationType !== "append"
        ) {
            throw new SyncTransportError(
                "sync_module_unconfigured",
                "No StockMovement append transport is configured for this operation."
            );
        }

        const envelope = createStockMovementCloudEnvelope(operation);
        const receiptPath = stockMovementCloudReceiptPath(
            operation.accountId,
            operation.operationId
        );
        const recordPath = stockMovementRecordPath(
            operation.accountId,
            operation.recordId
        );
        const existingReceipt = normalizeStockMovementCloudReceipt(
            await this.store.read<unknown>(receiptPath)
        );

        if (existingReceipt) {
            return this.receiptResult(operation, existingReceipt);
        }

        const current = await this.readEnvelope(
            recordPath,
            operation.accountId,
            operation.recordId
        );
        const preflight = this.preflightResult(operation, current);

        if (preflight) {
            return preflight;
        }

        const timestamp = this.store.serverTimestampValue();
        const cloudEnvelope = {
            ...envelope,
            meta: {
                ...envelope.meta,
                serverUpdatedAt: timestamp
            }
        };
        const cloudReceipt = {
            operationId: operation.operationId,
            idempotencyKey: operation.idempotencyKey,
            state: "acknowledged",
            module: "stockMovements",
            recordId: operation.recordId,
            resultRevision: 1,
            checksum: envelope.meta.writeSetChecksum,
            serverAppliedAt: timestamp
        };

        try {
            await this.store.updateChildren(
                stockMovementAccountPath(operation.accountId),
                {
                    [`stockMovements/${operation.recordId}`]: cloudEnvelope,
                    [`_sync/operations/${operation.operationId}`]: cloudReceipt
                }
            );
        } catch (error) {
            const recovered = await this.recoverAfterWriteFailure(
                operation,
                receiptPath,
                recordPath
            );

            if (recovered) {
                return recovered;
            }

            throw error;
        }

        return {
            kind: "acknowledged",
            result: "appended",
            cloudRevision: 1,
            cloudChecksum: envelope.meta.writeSetChecksum
        };
    }

    private preflightResult(
        operation: SyncOperation,
        current: StockMovementCloudEnvelope | null
    ): SyncExecutionResult | null {
        if (!current) {
            return null;
        }

        return current.meta.writeSetChecksum === operation.writeSetChecksum
            ? {
                kind: "acknowledged",
                result: "duplicate_acknowledged",
                cloudRevision: 1,
                cloudChecksum: current.meta.writeSetChecksum
            }
            : {
                kind: "conflict",
                actualRevision: 1,
                summarySafe: "Cloud StockMovement identity has divergent immutable data."
            };
    }

    private receiptResult(
        operation: SyncOperation,
        receipt: StockMovementCloudReceipt
    ): SyncExecutionResult {
        if (
            receipt.operationId !== operation.operationId
            || receipt.idempotencyKey !== operation.idempotencyKey
            || receipt.recordId !== operation.recordId
            || receipt.checksum !== operation.writeSetChecksum
        ) {
            return {
                kind: "conflict",
                actualRevision: receipt.resultRevision,
                summarySafe: "Cloud StockMovement receipt conflicts with the local operation."
            };
        }

        return {
            kind: "acknowledged",
            result: "duplicate_acknowledged",
            cloudRevision: 1,
            cloudChecksum: receipt.checksum
        };
    }

    private async recoverAfterWriteFailure(
        operation: SyncOperation,
        receiptPath: string,
        recordPath: string
    ): Promise<SyncExecutionResult | null> {
        try {
            const receipt = normalizeStockMovementCloudReceipt(
                await this.store.read<unknown>(receiptPath)
            );

            if (receipt) {
                return this.receiptResult(operation, receipt);
            }

            const current = await this.readEnvelope(
                recordPath,
                operation.accountId,
                operation.recordId
            );

            return this.preflightResult(operation, current);
        } catch {
            return null;
        }
    }

    private async readEnvelope(
        path: string,
        accountId: string,
        movementId: string
    ): Promise<StockMovementCloudEnvelope | null> {
        const value = await this.store.read<unknown>(path);

        if (value === null) {
            return null;
        }

        try {
            return normalizeStockMovementCloudEnvelope(
                value,
                accountId,
                movementId
            );
        } catch {
            throw new SyncTransportError(
                "cloud_record_invalid",
                "Cloud StockMovement record is invalid."
            );
        }
    }

    private assertTestProject(): void {
        if (this.projectIdProvider()?.trim() !== TEST_FIREBASE_PROJECT_ID) {
            throw new SyncTransportError(
                "firebase_project_mismatch",
                "Operational synchronization is restricted to the approved TEST project."
            );
        }
    }
}
