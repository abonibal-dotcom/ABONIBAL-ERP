import type { SyncOperation } from "../../sync/SyncOperation";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../../sync/services/LocalMutationApplier";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { InvoiceValidator } from "../validators/InvoiceValidator";
import { readInvoiceLifecycleTransitionOperation } from "./SalesCommercialSyncOperation";

export class InvoiceLocalMutationApplier implements LocalMutationApplier {
    public readonly module = "invoices" as const;

    private readonly repository: InvoiceRepository;
    private readonly validator: InvoiceValidator;

    public constructor(
        repository: InvoiceRepository,
        validator: InvoiceValidator
    ) {
        this.repository = repository;
        this.validator = validator;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const transition = readInvoiceLifecycleTransitionOperation(operation);
        const current = this.repository.findForAccount(
            operation.accountId,
            operation.recordId
        );

        if (!current) {
            return {
                state: "conflict",
                summarySafe: "Invoice lifecycle source record is missing."
            };
        }

        if (jsonValuesMatch(
            toComparableRecord(current),
            toComparableRecord(transition.intended)
        )) {
            return { state: "already_applied" };
        }

        return jsonValuesMatch(
            toComparableRecord(current),
            toComparableRecord(transition.expected)
        )
            ? { state: "not_applied" }
            : {
                state: "conflict",
                summarySafe: "Invoice lifecycle state diverges from durable intent."
            };
    }

    public apply(operation: SyncOperation): void {
        const transition = readInvoiceLifecycleTransitionOperation(operation);
        const errors = this.validator.validate(transition.intended);

        if (errors.length > 0) {
            throw new Error("Invoice lifecycle payload failed validation.");
        }

        const updated = this.repository.updateForAccount(
            operation.accountId,
            operation.recordId,
            transition.intended
        );

        if (!updated) {
            throw new Error("Invoice lifecycle source record is missing.");
        }
    }
}

function toComparableRecord(value: unknown) {
    return toJsonObject(JSON.parse(JSON.stringify(value)) as unknown);
}
