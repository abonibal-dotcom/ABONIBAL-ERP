import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../../sync/SyncContracts";
import type { SyncOperation } from "../../sync/SyncOperation";
import { jsonValuesMatch } from "../../sync/master-data/CanonicalJson";
import {
    createInvoiceCloudEnvelope,
    invoiceAccountPath,
    invoiceCloudReceiptPath,
    invoiceRecordPath,
    mutationExpectedChecksum,
    normalizeInvoiceCloudEnvelope,
    normalizeInvoiceCloudReceipt,
    type InvoiceCloudEnvelope,
    type InvoiceCloudReceipt
} from "./InvoiceSyncTypes";
import { readInvoiceCloudMutation } from "./InvoiceSyncOperation";

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

export interface InvoiceRealtimeStore {
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

export type InvoiceFirebaseProjectIdProvider = () => string | null;

export class InvoiceSyncOperationTransport implements SyncOperationTransport {
    private readonly store: InvoiceRealtimeStore;
    private readonly projectIdProvider: InvoiceFirebaseProjectIdProvider;

    public constructor(
        store: InvoiceRealtimeStore,
        projectIdProvider: InvoiceFirebaseProjectIdProvider
    ) {
        this.store = store;
        this.projectIdProvider = projectIdProvider;
    }

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.assertTestProject();

        if (operation.module !== "invoices") {
            throw new SyncTransportError(
                "sync_module_unconfigured",
                "Invoice transport received an unsupported module."
            );
        }

        const mutation = readInvoiceCloudMutation(operation);
        const recordPath = invoiceRecordPath(
            operation.accountId,
            operation.recordId
        );
        const receiptPath = invoiceCloudReceiptPath(
            operation.accountId,
            operation.operationId
        );
        const existingReceipt = normalizeInvoiceCloudReceipt(
            await this.store.read<unknown>(receiptPath)
        );

        if (existingReceipt) {
            return this.receiptResult(operation, existingReceipt);
        }

        const intended = createInvoiceCloudEnvelope(operation);
        const timestamp = this.store.serverTimestampValue();
        const writeEnvelope = {
            ...intended,
            meta: {
                ...intended.meta,
                serverUpdatedAt: timestamp
            }
        } as unknown as InvoiceCloudEnvelope;

        if (operation.operationType === "create") {
            const created = await this.store.createIfAbsent(
                recordPath,
                writeEnvelope
            );

            if (!created.created) {
                const current = created.value
                    ? normalizeInvoiceCloudEnvelope(
                        created.value,
                        operation.accountId,
                        operation.recordId
                    )
                    : null;

                if (!current || !envelopesMatch(current, intended)) {
                    return cloudConflict(
                        current?.meta.revision,
                        "Cloud Invoice create target already exists with different state."
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

        if (operation.expectedRevision === undefined || !mutation.expected) {
            throw new SyncTransportError(
                "expected_revision_required",
                "Invoice cloud transition requires an expected revision."
            );
        }

        const currentValue = await this.store.read<unknown>(recordPath);

        if (currentValue === null) {
            return cloudConflict(
                undefined,
                "MISSING_CLOUD_BASELINE: Invoice transition cannot create cloud history implicitly."
            );
        }

        const current = normalizeInvoiceCloudEnvelope(
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

        const expectedChecksum = mutationExpectedChecksum(mutation);

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
                "Cloud Invoice revision or immutable pre-state conflicts with the operation."
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
                ? normalizeInvoiceCloudEnvelope(
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
                "Cloud Invoice compare-and-set revision conflict."
            );
        }

        await this.ensureReceipt(operation, intended.meta.revision);

        return acknowledged(
            "updated",
            intended.meta.revision,
            operation.writeSetChecksum
        );
    }

    private async ensureReceipt(
        operation: SyncOperation,
        resultRevision: number
    ): Promise<void> {
        const receiptPath = invoiceCloudReceiptPath(
            operation.accountId,
            operation.operationId
        );
        const existing = normalizeInvoiceCloudReceipt(
            await this.store.read<unknown>(receiptPath)
        );

        if (existing) {
            const result = this.receiptResult(operation, existing);

            if (result.kind === "conflict") {
                throw new SyncTransportError(
                    "invoice_receipt_conflict",
                    result.summarySafe
                );
            }

            return;
        }

        const receipt = {
            operationId: operation.operationId,
            idempotencyKey: operation.idempotencyKey,
            state: "acknowledged",
            module: "invoices",
            recordId: operation.recordId,
            resultRevision,
            checksum: operation.writeSetChecksum,
            serverAppliedAt: this.store.serverTimestampValue()
        };

        try {
            await this.store.updateChildren(
                invoiceAccountPath(operation.accountId),
                { [`_sync/operations/${operation.operationId}`]: receipt }
            );
        } catch (error) {
            const recovered = normalizeInvoiceCloudReceipt(
                await this.store.read<unknown>(receiptPath)
            );

            if (!recovered || this.receiptResult(operation, recovered).kind === "conflict") {
                throw error;
            }
        }
    }

    private receiptResult(
        operation: SyncOperation,
        receipt: InvoiceCloudReceipt
    ): SyncExecutionResult {
        if (
            receipt.operationId !== operation.operationId
            || receipt.idempotencyKey !== operation.idempotencyKey
            || receipt.module !== "invoices"
            || receipt.recordId !== operation.recordId
            || receipt.checksum !== operation.writeSetChecksum
        ) {
            return cloudConflict(
                receipt.resultRevision,
                "Cloud Invoice operation receipt conflicts with local identity."
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
                "Invoice synchronization is restricted to the approved TEST project."
            );
        }
    }
}

function envelopesMatch(
    current: InvoiceCloudEnvelope,
    intended: InvoiceCloudEnvelope
): boolean {
    return current.meta.lastOperationId === intended.meta.lastOperationId
        && current.meta.idempotencyKey === intended.meta.idempotencyKey
        && current.meta.revision === intended.meta.revision
        && current.meta.writeSetChecksum === intended.meta.writeSetChecksum
        && current.meta.recordChecksum === intended.meta.recordChecksum
        && current.meta.tombstone === intended.meta.tombstone;
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
