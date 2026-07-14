import { toJsonObject, type JsonObject } from "../../sync/master-data/CanonicalJson";
import type { MasterDataRecordCodec } from "../../sync/master-data/MasterDataSyncTypes";
import type { Customer } from "../Customer";

export const customerSyncCodec: MasterDataRecordCodec<Customer> = {
    module: "customers",

    toCloudRecord(record: Customer): JsonObject {
        validateCustomer(record, record.accountId, record.id);
        return toJsonObject(record);
    },

    fromCloudRecord(data: JsonObject): Customer {
        const customer = data as unknown as Customer;
        validateCustomer(customer, customer.accountId, customer.id);
        return customer;
    },

    validateRecord: validateCustomer,

    isTombstone(record: Customer): boolean {
        return record.isDeleted === true;
    }
};

function validateCustomer(
    customer: Customer,
    accountId: string,
    recordId: string
): void {
    if (
        requireText(customer.id, "id") !== requireText(recordId, "recordId")
        || requireText(customer.accountId, "accountId") !== requireText(accountId, "accountId")
        || !["active", "inactive"].includes(customer.status)
    ) {
        throw new Error("Customer sync identity or status is invalid.");
    }

    requireText(customer.displayName, "displayName");
    requireText(customer.createdAt, "createdAt");
    requireText(customer.createdBy, "createdBy");
    requireText(customer.updatedAt, "updatedAt");
    requireText(customer.updatedBy, "updatedBy");
}

function requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Customer ${field} is required for sync.`);
    }

    return value.trim();
}
