import type { Safe } from "../Safe";
import { isSafeStatus } from "../SafeStatus";

export class SafeValidator {

    public validate(safe: Safe): string[] {

        const errors: string[] = [];

        if (!safe.id.trim()) {
            errors.push("Safe id is required.");
        }

        if (!safe.accountId.trim()) {
            errors.push("Safe accountId is required.");
        }

        if (!safe.displayName.trim()) {
            errors.push("Safe displayName is required.");
        }

        if (!/^[A-Z]{3}$/.test(safe.currency)) {
            errors.push("Safe currency must be a three-letter code.");
        }

        if (!isSafeStatus(safe.status)) {
            errors.push("Safe status is invalid.");
        }

        if (safe.status === "inactive" && !safe.deactivatedAt) {
            errors.push("Inactive Safe deactivatedAt is required.");
        }

        if (safe.status === "inactive" && !safe.deactivatedBy) {
            errors.push("Inactive Safe deactivatedBy is required.");
        }

        if (safe.status === "inactive" && safe.isDefault) {
            errors.push("Inactive Safe cannot be the default Safe.");
        }

        if (!safe.createdAt.trim()) {
            errors.push("Safe createdAt is required.");
        }

        if (!safe.createdBy.trim()) {
            errors.push("Safe createdBy is required.");
        }

        if (!safe.updatedAt.trim()) {
            errors.push("Safe updatedAt is required.");
        }

        if (!safe.updatedBy.trim()) {
            errors.push("Safe updatedBy is required.");
        }

        return errors;

    }

}
