import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../SyncContracts";
import type { SyncOperation } from "../SyncOperation";
import {
    isMasterDataSyncModule,
    masterDataAccountPath,
    masterDataCloudReceiptPath,
    masterDataRecordPath,
    normalizeMasterDataCloudReceipt,
    normalizeMasterDataEnvelope,
    readMasterDataMutationPayload,
    type MasterDataCloudEnvelope,
    type MasterDataCloudReceipt
} from "./MasterDataSyncTypes";

const TEST_FIREBASE_PROJECT_ID = "abonibal-erp-test";

export interface MasterDataRealtimeStore {
    read<T>(path: string): Promise<T | null>;
    updateChildren(path: string, values: Record<string, unknown>): Promise<void>;
    serverTimestampValue(): object;
}

export type FirebaseProjectIdProvider = () => string | null;

export class MasterDataSyncOperationTransport implements SyncOperationTransport {
    private readonly store: MasterDataRealtimeStore;
    private readonly projectIdProvider: FirebaseProjectIdProvider;

    public constructor(
        store: MasterDataRealtimeStore,
        projectIdProvider: FirebaseProjectIdProvider
    ) {
        this.store = store;
        this.projectIdProvider = projectIdProvider;
    }

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.assertTestProject();

        if (!isMasterDataSyncModule(operation.module)) {
            throw new SyncTransportError(
                "sync_module_unconfigured",
                "No operational sync adapter is configured for this module."
            );
        }

        const { envelope } = readMasterDataMutationPayload(operation);
        const receiptPath = masterDataCloudReceiptPath(
            operation.accountId,
            operation.operationId
        );
        const recordPath = masterDataRecordPath(
            operation.accountId,
            operation.module,
            operation.recordId
        );
        const existingReceipt = normalizeMasterDataCloudReceipt(
            await this.store.read<unknown>(receiptPath)
        );

        if (existingReceipt) {
            return this.receiptResult(operation, existingReceipt);
        }

        const current = await this.readEnvelope(recordPath);
        const preflightConflict = this.preflightResult(
            operation,
            envelope,
            current
        );

        if (preflightConflict) {
            return preflightConflict;
        }

        const resultName = operation.operationType === "create"
            ? "created"
            : "updated";
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
            module: operation.module,
            recordId: operation.recordId,
            resultRevision: envelope.meta.revision,
            checksum: envelope.meta.writeSetChecksum,
            serverAppliedAt: timestamp
        };

        try {
            await this.store.updateChildren(
                masterDataAccountPath(operation.accountId),
                {
                    [`${operation.module}/${operation.recordId}`]: cloudEnvelope,
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
            result: resultName,
            cloudRevision: envelope.meta.revision,
            cloudChecksum: envelope.meta.writeSetChecksum
        };
    }

    private async recoverAfterWriteFailure(
        operation: SyncOperation,
        receiptPath: string,
        recordPath: string
    ): Promise<SyncExecutionResult | null> {
        try {
            const receipt = normalizeMasterDataCloudReceipt(
                await this.store.read<unknown>(receiptPath)
            );

            if (receipt) {
                return this.receiptResult(operation, receipt);
            }

            const current = await this.readEnvelope(recordPath);

            const intended = readMasterDataMutationPayload(operation).envelope;
            const recoveredResult = this.preflightResult(
                operation,
                intended,
                current
            );

            if (recoveredResult) {
                return recoveredResult;
            }
        } catch {
            return null;
        }

        return null;
    }

    private receiptResult(
        operation: SyncOperation,
        receipt: MasterDataCloudReceipt
    ): SyncExecutionResult {
        if (
            receipt.operationId !== operation.operationId
            || receipt.idempotencyKey !== operation.idempotencyKey
            || receipt.module !== operation.module
            || receipt.recordId !== operation.recordId
            || receipt.checksum !== operation.writeSetChecksum
        ) {
            return {
                kind: "conflict",
                actualRevision: receipt.resultRevision,
                summarySafe: "Cloud operation receipt identity conflicts with the local operation."
            };
        }

        return {
            kind: "acknowledged",
            result: "duplicate_acknowledged",
            cloudRevision: receipt.resultRevision,
            cloudChecksum: receipt.checksum
        };
    }

    private preflightResult(
        operation: SyncOperation,
        intended: MasterDataCloudEnvelope,
        current: MasterDataCloudEnvelope | null
    ): SyncExecutionResult | null {
        if (current && this.matchesOperation(operation, intended, current)) {
            return {
                kind: "acknowledged",
                result: "duplicate_acknowledged",
                cloudRevision: current.meta.revision,
                cloudChecksum: current.meta.writeSetChecksum
            };
        }

        if (operation.operationType === "create") {
            return current
                ? {
                    kind: "conflict",
                    actualRevision: current.meta.revision,
                    summarySafe: "Cloud create target already exists without a matching receipt."
                }
                : null;
        }

        if (operation.expectedRevision === undefined) {
            throw new SyncTransportError(
                "expected_revision_required",
                "Master-data update requires an expected revision."
            );
        }

        return current?.meta.revision === operation.expectedRevision
            ? null
            : {
                kind: "conflict",
                ...(current ? { actualRevision: current.meta.revision } : {}),
                summarySafe: "Cloud master-data revision does not match the update."
            };
    }

    private matchesOperation(
        operation: SyncOperation,
        intended: MasterDataCloudEnvelope,
        current: MasterDataCloudEnvelope
    ): boolean {
        return current.meta.lastOperationId === operation.operationId
            && current.meta.revision === intended.meta.revision
            && current.meta.writeSetChecksum === intended.meta.writeSetChecksum;
    }

    private async readEnvelope(path: string): Promise<MasterDataCloudEnvelope | null> {
        const value = await this.store.read<unknown>(path);

        return value === null ? null : normalizeMasterDataEnvelope(value);
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
