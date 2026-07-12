import type { Supplier } from "../Supplier";

export class SupplierValidator {

    public validate(supplier: Supplier): string[] {

        const errors: string[] = [];

        if (!supplier.id.trim()) {
            errors.push("Supplier id is required.");
        }

        if (!supplier.accountId.trim()) {
            errors.push("Supplier accountId is required.");
        }

        if (!supplier.displayName.trim()) {
            errors.push("Supplier displayName is required.");
        }

        if (supplier.status !== "active" && supplier.status !== "inactive") {
            errors.push("Supplier status is invalid.");
        }

        if (!supplier.createdAt.trim()) {
            errors.push("Supplier createdAt is required.");
        }

        if (!supplier.createdBy.trim()) {
            errors.push("Supplier createdBy is required.");
        }

        if (!supplier.updatedAt.trim()) {
            errors.push("Supplier updatedAt is required.");
        }

        if (!supplier.updatedBy.trim()) {
            errors.push("Supplier updatedBy is required.");
        }

        return errors;

    }

}
