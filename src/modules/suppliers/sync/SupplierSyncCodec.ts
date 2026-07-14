import { toJsonObject, type JsonObject } from "../../sync/master-data/CanonicalJson";
import type { MasterDataRecordCodec } from "../../sync/master-data/MasterDataSyncTypes";
import type { Supplier } from "../Supplier";

export const supplierSyncCodec: MasterDataRecordCodec<Supplier> = {
    module: "suppliers",

    toCloudRecord(record: Supplier): JsonObject {
        validateSupplier(record, record.accountId, record.id);
        return toJsonObject(record);
    },

    fromCloudRecord(data: JsonObject): Supplier {
        const supplier = data as unknown as Supplier;
        validateSupplier(supplier, supplier.accountId, supplier.id);
        return supplier;
    },

    validateRecord: validateSupplier,

    isTombstone(record: Supplier): boolean {
        return record.isDeleted === true;
    }
};

function validateSupplier(
    supplier: Supplier,
    accountId: string,
    recordId: string
): void {
    if (
        requireText(supplier.id, "id") !== requireText(recordId, "recordId")
        || requireText(supplier.accountId, "accountId") !== requireText(accountId, "accountId")
        || !["active", "inactive"].includes(supplier.status)
    ) {
        throw new Error("Supplier sync identity or status is invalid.");
    }

    requireText(supplier.displayName, "displayName");
    requireText(supplier.createdAt, "createdAt");
    requireText(supplier.createdBy, "createdBy");
    requireText(supplier.updatedAt, "updatedAt");
    requireText(supplier.updatedBy, "updatedBy");
}

function requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Supplier ${field} is required for sync.`);
    }

    return value.trim();
}
