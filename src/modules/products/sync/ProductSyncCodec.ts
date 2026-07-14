import type { MasterDataRecordCodec } from "../../sync/master-data/MasterDataSyncTypes";
import { toJsonObject, type JsonObject } from "../../sync/master-data/CanonicalJson";
import type { Product } from "../Product";

const MAX_PRODUCT_PAYLOAD_CHARACTERS = 256_000;

export const productSyncCodec: MasterDataRecordCodec<Product> = {
    module: "products",

    toCloudRecord(record: Product): JsonObject {
        validateProduct(record, requireText(record.accountId, "accountId"), record.id);

        const data = toJsonObject(record);

        if (JSON.stringify(data).length > MAX_PRODUCT_PAYLOAD_CHARACTERS) {
            throw new Error("Product payload is too large for master-data sync.");
        }

        return data;
    },

    fromCloudRecord(data: JsonObject): Product {
        const createdAt = parseDate(data.createdAt, "createdAt");
        const updatedAt = parseDate(data.updatedAt, "updatedAt");
        const product = {
            ...(data as unknown as Omit<Product, "createdAt" | "updatedAt">),
            createdAt,
            updatedAt
        };

        validateProduct(product, requireText(product.accountId, "accountId"), product.id);

        return product;
    },

    validateRecord: validateProduct,

    isTombstone(record: Product): boolean {
        return record.isDeleted === true;
    }
};

function validateProduct(
    product: Product,
    accountId: string,
    recordId: string
): void {
    if (
        requireText(product.id, "id") !== requireText(recordId, "recordId")
        || requireText(product.accountId, "accountId") !== requireText(accountId, "accountId")
    ) {
        throw new Error("Product sync identity is invalid.");
    }

    for (const field of ["name", "barcode"] as const) {
        requireText(product[field], field);
    }

    for (const field of [
        "purchasePrice",
        "salePrice",
        "taxRate",
        "quantity",
        "minimumQuantity"
    ] as const) {
        if (!Number.isFinite(product[field])) {
            throw new Error(`Product ${field} must be finite.`);
        }
    }

    if (!Array.isArray(product.images) || product.images.some(image =>
        typeof image !== "string"
        || image.trim().toLowerCase().startsWith("data:")
    )) {
        throw new Error("Product sync supports image references only.");
    }

    if (
        !(product.createdAt instanceof Date)
        || Number.isNaN(product.createdAt.getTime())
        || !(product.updatedAt instanceof Date)
        || Number.isNaN(product.updatedAt.getTime())
    ) {
        throw new Error("Product sync dates are invalid.");
    }
}

function parseDate(value: unknown, field: string): Date {
    if (typeof value !== "string") {
        throw new Error(`Product ${field} must be an ISO date string.`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
        throw new Error(`Product ${field} is invalid.`);
    }

    return date;
}

function requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Product ${field} is required for sync.`);
    }

    return value.trim();
}
