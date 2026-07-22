import type { SyncOperation } from "../../sync/SyncOperation";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../../sync/services/LocalMutationApplier";
import type { InvoiceReturnRepository } from "../repositories/InvoiceReturnRepository";
import type { InvoiceReturnValidator } from "../validators/InvoiceReturnValidator";
import { readInvoiceReturnLifecycleTransitionOperation } from "./SalesCommercialSyncOperation";

export class InvoiceReturnLocalMutationApplier
implements LocalMutationApplier {
    public readonly module = "invoiceReturns" as const;

    private readonly repository: InvoiceReturnRepository;
    private readonly validator: InvoiceReturnValidator;

    public constructor(
        repository: InvoiceReturnRepository,
        validator: InvoiceReturnValidator
    ) {
        this.repository = repository;
        this.validator = validator;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const transition = readInvoiceReturnLifecycleTransitionOperation(
            operation
        );
        const current = this.repository.findForAccount(
            operation.accountId,
            operation.recordId
        );

        if (!current) {
            return {
                state: "conflict",
                summarySafe: "Invoice return lifecycle source record is missing."
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
                summarySafe: "Invoice return state diverges from durable intent."
            };
    }

    public apply(operation: SyncOperation): void {
        const transition = readInvoiceReturnLifecycleTransitionOperation(
            operation
        );
        const errors = this.validator.validate(transition.intended);

        if (errors.length > 0) {
            throw new Error("Invoice return lifecycle payload failed validation.");
        }

        const updated = this.repository.updateForAccount(
            operation.accountId,
            operation.recordId,
            transition.intended
        );

        if (!updated) {
            throw new Error("Invoice return lifecycle source record is missing.");
        }
    }
}

function toComparableRecord(value: unknown) {
    return toJsonObject(JSON.parse(JSON.stringify(value)) as unknown);
}
