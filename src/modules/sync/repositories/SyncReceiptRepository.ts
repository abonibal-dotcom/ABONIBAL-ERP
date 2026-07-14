import type { Driver } from "../../../core/persistence/Driver";
import { isSyncModule } from "../SyncOperation";
import {
    isSyncReceiptResult,
    type SyncReceipt
} from "../SyncReceipt";
import { syncReceiptsKeyForAccount } from "../persistence/SyncPersistenceKeys";

export class SyncReceiptRepository {
    private readonly driver: Driver;

    public constructor(driver: Driver) {
        this.driver = driver;
    }

    public allForAccount(accountId: string): SyncReceipt[] {
        const normalizedAccountId = normalizeAccountId(accountId);
        const stored = this.driver.read<unknown>(
            syncReceiptsKeyForAccount(normalizedAccountId)
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(isSyncReceipt)
            .filter(receipt => receipt.accountId === normalizedAccountId);
    }

    public save(receipt: SyncReceipt): SyncReceipt {
        const normalizedAccountId = normalizeAccountId(receipt.accountId);
        const receipts = this.allForAccount(normalizedAccountId);
        const existing = receipts.find(candidate =>
            candidate.operationId === receipt.operationId
            || candidate.idempotencyKey === receipt.idempotencyKey
        );

        if (existing) {
            if (
                existing.operationId !== receipt.operationId
                || existing.idempotencyKey !== receipt.idempotencyKey
            ) {
                throw new Error("Sync receipt identity collision detected.");
            }

            return existing;
        }

        if (!isSyncReceipt(receipt)) {
            throw new Error("Sync receipt is invalid.");
        }

        receipts.push(receipt);
        this.driver.write<SyncReceipt[]>(
            syncReceiptsKeyForAccount(normalizedAccountId),
            receipts
        );

        return receipt;
    }

    public findByOperationId(
        accountId: string,
        operationId: string
    ): SyncReceipt | undefined {
        const normalizedOperationId = requireText(operationId, "operationId");

        return this
            .allForAccount(accountId)
            .find(receipt => receipt.operationId === normalizedOperationId);
    }
}

function isSyncReceipt(value: unknown): value is SyncReceipt {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const receipt = value as Partial<SyncReceipt>;

    return isNonEmptyText(receipt.operationId)
        && isNonEmptyText(receipt.accountId)
        && isSyncModule(receipt.module)
        && isNonEmptyText(receipt.recordId)
        && isNonEmptyText(receipt.idempotencyKey)
        && isSyncReceiptResult(receipt.result)
        && isNonEmptyText(receipt.acknowledgedAt)
        && (
            receipt.cloudRevision === undefined
            || isNonNegativeInteger(receipt.cloudRevision)
        );
}

function normalizeAccountId(accountId: string): string {
    return requireText(accountId, "accountId");
}

function requireText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Sync receipt ${field} is required.`);
    }

    return normalized;
}

function isNonEmptyText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0;
}
