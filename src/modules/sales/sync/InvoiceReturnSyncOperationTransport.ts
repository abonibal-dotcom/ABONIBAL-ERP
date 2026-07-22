import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../../sync/SyncContracts";
import type { SyncOperation } from "../../sync/SyncOperation";
import { jsonValuesMatch } from "../../sync/master-data/CanonicalJson";
import { readInvoiceReturnCloudMutation } from "./InvoiceReturnSyncOperation";
import {
    createInvoiceReturnCloudEnvelope,
    invoiceReturnAccountPath,
    invoiceReturnCloudReceiptPath,
    invoiceReturnMutationExpectedChecksum,
    invoiceReturnRecordPath,
    normalizeInvoiceReturnCloudEnvelope,
    normalizeInvoiceReturnCloudReceipt,
    type InvoiceReturnCloudEnvelope,
    type InvoiceReturnCloudReceipt
} from "./InvoiceReturnSyncTypes";

const TEST_FIREBASE_PROJECT_ID = "abonibal-erp-test";

interface CreateIfAbsentResult<T> {
    created: boolean;
    value: T | null;
}

interface CompareAndSetResult<T> {
    updated: boolean;
    conflict: boolean;
    actualRevision?: number;
    actualChecksum?: string;
    value: T | null;
}

export interface InvoiceReturnRealtimeStore {
    read<T>(path: string): Promise<T | null>;
    createIfAbsent<T>(
        path: string,
        value: T
    ): Promise<CreateIfAbsentResult<T>>;
    compareAndSetMetaRevision<T extends {
        meta: { revision: number; recordChecksum: string };
    }>(
        path: string,
        expectedRevision: number,
        expectedChecksum: string,
        nextValue: T
    ): Promise<CompareAndSetResult<T>>;
    updateChildren(path: string, values: Record<string, unknown>): Promise<void>;
    serverTimestampValue(): object;
}

export type InvoiceReturnFirebaseProjectIdProvider = () => string | null;

export class InvoiceReturnSyncOperationTransport
implements SyncOperationTransport {
    private readonly store: InvoiceReturnRealtimeStore;
    private readonly projectIdProvider: InvoiceReturnFirebaseProjectIdProvider;

    public constructor(
        store: InvoiceReturnRealtimeStore,
        projectIdProvider: InvoiceReturnFirebaseProjectIdProvider
    ) {
        this.store = store;
        this.projectIdProvider = projectIdProvider;
    }

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.assertTestProject();
        this.assertRecordedRoute(operation);

        const mutation = readInvoiceReturnCloudMutation(operation);
        const recordPath = invoiceReturnRecordPath(
            operation.accountId,
            operation.recordId
        );
        const receiptPath = invoiceReturnCloudReceiptPath(
            operation.accountId,
            operation.operationId
        );
        const existingReceipt = normalizeInvoiceReturnCloudReceipt(
            await this.store.read<unknown>(receiptPath)
        );

        if (existingReceipt) {
            return this.receiptResult(operation, existingReceipt);
        }

        const intended = createInvoiceReturnCloudEnvelope(operation);
        const writeEnvelope = {
            ...intended,
            meta: {
                ...intended.meta,
                serverUpdatedAt: this.store.serverTimestampValue()
            }
        } as unknown as InvoiceReturnCloudEnvelope;

        if (mutation.kind === "create_recorded") {
            const created = await this.store.createIfAbsent(
                recordPath,
                writeEnvelope
            );

            if (!created.created) {
                const current = created.value
                    ? normalizeInvoiceReturnCloudEnvelope(
                        created.value,
                        operation.accountId,
                        operation.recordId
                    )
                    : null;

                if (!current || !envelopesMatch(current, intended)) {
                    return cloudConflict(
                        current?.meta.revision,
                        "Cloud InvoiceReturn create target already exists with different state."
                    );
                }

                await this.ensureReceipt(operation, intended.meta.revision);

                return acknowledged(
                    "duplicate_acknowledged",
                    intended.meta.revision,
                    operation.writeSetChecksum
                );
            }

            await this.ensureReceipt(operation, intended.meta.revision);

            return acknowledged(
                "created",
                intended.meta.revision,
                operation.writeSetChecksum
            );
        }

        if (
            mutation.kind !== "update_recorded"
            || operation.expectedRevision === undefined
            || !mutation.expected
        ) {
            throw new SyncTransportError(
                "invoice_return_route_denied",
                "InvoiceReturn transport accepts recorded-state mutations only."
            );
        }

        const currentValue = await this.store.read<unknown>(recordPath);

        if (currentValue === null) {
            return cloudConflict(
                undefined,
                "MISSING_CLOUD_BASELINE: InvoiceReturn update cannot create cloud history implicitly."
            );
        }

        const current = normalizeInvoiceReturnCloudEnvelope(
            currentValue,
            operation.accountId,
            operation.recordId
        );

        if (envelopesMatch(current, intended)) {
            await this.ensureReceipt(operation, intended.meta.revision);

            return acknowledged(
                "duplicate_acknowledged",
                intended.meta.revision,
                operation.writeSetChecksum
            );
        }

        const expectedChecksum = invoiceReturnMutationExpectedChecksum(mutation);

        if (
            expectedChecksum === null
            || current.meta.revision !== operation.expectedRevision
            || current.meta.recordChecksum !== expectedChecksum
            || !jsonValuesMatch(current.data, JSON.parse(
                JSON.stringify(mutation.expected)
            ))
        ) {
            return cloudConflict(
                current.meta.revision,
                "Cloud InvoiceReturn revision or recorded pre-state conflicts with the operation."
            );
        }

        const updated = await this.store.compareAndSetMetaRevision(
            recordPath,
            operation.expectedRevision,
            expectedChecksum,
            writeEnvelope
        );

        if (!updated.updated) {
            const actual = updated.value
                ? normalizeInvoiceReturnCloudEnvelope(
                    updated.value,
                    operation.accountId,
                    operation.recordId
                )
                : null;

            if (actual && envelopesMatch(actual, intended)) {
                await this.ensureReceipt(operation, intended.meta.revision);

                return acknowledged(
                    "duplicate_acknowledged",
                    intended.meta.revision,
                    operation.writeSetChecksum
                );
            }

            return cloudConflict(
                updated.actualRevision,
                "Cloud InvoiceReturn compare-and-set revision conflict."
            );
        }

        await this.ensureReceipt(operation, intended.meta.revision);

        return acknowledged(
            "updated",
            intended.meta.revision,
            operation.writeSetChecksum
        );
    }

    private assertRecordedRoute(operation: SyncOperation): void {
        const isCreate = operation.module === "invoiceReturns"
            && operation.operationType === "create"
            && operation.cloudAction === "createRecorded";
        const isUpdate = operation.module === "invoiceReturns"
            && operation.operationType === "update"
            && operation.cloudAction === "updateRecorded";

        if (!isCreate && !isUpdate) {
            throw new SyncTransportError(
                "invoice_return_route_denied",
                "InvoiceReturn execute and generic routes are not configured."
            );
        }
    }

    private async ensureReceipt(
        operation: SyncOperation,
        resultRevision: number
    ): Promise<void> {
        const receiptPath = invoiceReturnCloudReceiptPath(
            operation.accountId,
            operation.operationId
        );
        const existing = normalizeInvoiceReturnCloudReceipt(
            await this.store.read<unknown>(receiptPath)
        );

        if (existing) {
            const result = this.receiptResult(operation, existing);

            if (result.kind === "conflict") {
                throw new SyncTransportError(
                    "invoice_return_receipt_conflict",
                    result.summarySafe
                );
            }

            return;
        }

        const receipt = {
            operationId: operation.operationId,
            idempotencyKey: operation.idempotencyKey,
            state: "acknowledged",
            module: "invoiceReturns",
            recordId: operation.recordId,
            resultRevision,
            checksum: operation.writeSetChecksum,
            serverAppliedAt: this.store.serverTimestampValue()
        };

        try {
            await this.store.updateChildren(
                invoiceReturnAccountPath(operation.accountId),
                { [`_sync/operations/${operation.operationId}`]: receipt }
            );
        } catch (error) {
            const recovered = normalizeInvoiceReturnCloudReceipt(
                await this.store.read<unknown>(receiptPath)
            );

            if (
                !recovered
                || this.receiptResult(operation, recovered).kind === "conflict"
            ) {
                throw error;
            }
        }
    }

    private receiptResult(
        operation: SyncOperation,
        receipt: InvoiceReturnCloudReceipt
    ): SyncExecutionResult {
        if (
            receipt.operationId !== operation.operationId
            || receipt.idempotencyKey !== operation.idempotencyKey
            || receipt.module !== "invoiceReturns"
            || receipt.recordId !== operation.recordId
            || receipt.checksum !== operation.writeSetChecksum
        ) {
            return cloudConflict(
                receipt.resultRevision,
                "Cloud InvoiceReturn operation receipt conflicts with local identity."
            );
        }

        return acknowledged(
            "duplicate_acknowledged",
            receipt.resultRevision,
            receipt.checksum
        );
    }

    private assertTestProject(): void {
        if (this.projectIdProvider()?.trim() !== TEST_FIREBASE_PROJECT_ID) {
            throw new SyncTransportError(
                "firebase_project_mismatch",
                "InvoiceReturn synchronization is restricted to the approved TEST project."
            );
        }
    }
}

function envelopesMatch(
    current: InvoiceReturnCloudEnvelope,
    intended: InvoiceReturnCloudEnvelope
): boolean {
    return current.meta.lastOperationId === intended.meta.lastOperationId
        && current.meta.idempotencyKey === intended.meta.idempotencyKey
        && current.meta.revision === intended.meta.revision
        && current.meta.writeSetChecksum === intended.meta.writeSetChecksum
        && current.meta.recordChecksum === intended.meta.recordChecksum
        && current.meta.tombstone === false;
}

function acknowledged(
    result: "created" | "updated" | "duplicate_acknowledged",
    cloudRevision: number,
    cloudChecksum: string | undefined
): SyncExecutionResult {
    return {
        kind: "acknowledged",
        result,
        cloudRevision,
        ...(cloudChecksum ? { cloudChecksum } : {})
    };
}

function cloudConflict(
    actualRevision: number | undefined,
    summarySafe: string
): SyncExecutionResult {
    return {
        kind: "conflict",
        ...(actualRevision !== undefined ? { actualRevision } : {}),
        summarySafe
    };
}
