import type { SyncOperation } from "../../sync/SyncOperation";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../../sync/services/LocalMutationApplier";
import type { InvoiceReturn } from "../InvoiceReturn";
import type { InvoiceReturnRepository } from "../repositories/InvoiceReturnRepository";
import type { InvoiceReturnSyncStateRepository } from "../repositories/InvoiceReturnSyncStateRepository";
import type { InvoiceReturnValidator } from "../validators/InvoiceReturnValidator";
import { readInvoiceReturnCloudMutation } from "./InvoiceReturnSyncOperation";
import {
    invoiceReturnFromCloudData,
    normalizeInvoiceReturnCloudEnvelope,
    type InvoiceReturnCloudEnvelope
} from "./InvoiceReturnSyncTypes";

export type InvoiceReturnRemoteApplyOutcome =
    | "applied"
    | "duplicate"
    | "ignored_older"
    | "conflict";

export interface InvoiceReturnRemoteApplyResult {
    outcome: InvoiceReturnRemoteApplyOutcome;
    localRevision?: number;
    remoteRevision: number;
    summarySafe?: string;
}

export type InvoiceReturnApplyClock = () => string;

export class InvoiceReturnLocalMutationApplier
implements LocalMutationApplier {
    public readonly module = "invoiceReturns" as const;

    private readonly repository: InvoiceReturnRepository;
    private readonly validator: InvoiceReturnValidator;
    private readonly stateRepository: InvoiceReturnSyncStateRepository | null;
    private readonly clock: InvoiceReturnApplyClock;

    public constructor(
        repository: InvoiceReturnRepository,
        validator: InvoiceReturnValidator,
        stateRepository: InvoiceReturnSyncStateRepository | null = null,
        clock: InvoiceReturnApplyClock = () => new Date().toISOString()
    ) {
        this.repository = repository;
        this.validator = validator;
        this.stateRepository = stateRepository;
        this.clock = clock;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const mutation = readInvoiceReturnCloudMutation(operation);
        const current = this.repository.findForAccount(
            operation.accountId,
            operation.recordId
        );

        if (mutation.kind === "create_recorded") {
            if (!current) {
                return { state: "not_applied" };
            }

            return recordsMatch(current, mutation.intended)
                ? { state: "already_applied" }
                : conflict("InvoiceReturn recorded create conflicts with local cache.");
        }

        if (!current || !mutation.expected) {
            return conflict("InvoiceReturn lifecycle source record is missing.");
        }

        if (recordsMatch(current, mutation.intended)) {
            return { state: "already_applied" };
        }

        return recordsMatch(current, mutation.expected)
            ? { state: "not_applied" }
            : conflict("InvoiceReturn state diverges from durable intent.");
    }

    public apply(operation: SyncOperation): void {
        const mutation = readInvoiceReturnCloudMutation(operation);
        const errors = this.validator.validate(mutation.intended);

        if (errors.length > 0) {
            throw new Error("InvoiceReturn cloud mutation payload failed validation.");
        }

        if (mutation.kind === "create_recorded") {
            this.repository.appendForAccount(
                operation.accountId,
                mutation.intended
            );
        } else {
            const updated = this.repository.updateForAccount(
                operation.accountId,
                operation.recordId,
                mutation.intended
            );

            if (!updated) {
                throw new Error("InvoiceReturn lifecycle source record is missing.");
            }
        }

        this.saveState(operation);
    }

    public applyAuthoritativeEnvelope(
        accountId: string,
        invoiceReturnId: string,
        value: unknown
    ): InvoiceReturnRemoteApplyResult {
        const envelope = normalizeInvoiceReturnCloudEnvelope(
            value,
            accountId,
            invoiceReturnId
        );
        const remoteReturn = invoiceReturnFromCloudData(envelope.data);
        const errors = this.validator.validate(remoteReturn);

        if (errors.length > 0) {
            return remoteConflict(
                envelope.meta.revision,
                "Remote InvoiceReturn failed domain validation."
            );
        }

        const current = this.repository.findForAccount(
            accountId,
            invoiceReturnId
        );
        const state = this.stateRepository?.find(accountId, invoiceReturnId);

        if (!current) {
            this.repository.appendAuthoritativeForAccount(
                accountId,
                remoteReturn
            );
            this.saveRemoteState(accountId, invoiceReturnId, envelope);

            return {
                outcome: "applied",
                remoteRevision: envelope.meta.revision
            };
        }

        const localRevision = invoiceReturnRevision(current);

        if (!state) {
            if (recordsMatch(current, remoteReturn)) {
                this.saveRemoteState(accountId, invoiceReturnId, envelope);

                return {
                    outcome: "duplicate",
                    localRevision,
                    remoteRevision: envelope.meta.revision
                };
            }

            return remoteConflict(
                envelope.meta.revision,
                "Existing local InvoiceReturn has no verified cloud baseline.",
                localRevision
            );
        }

        if (envelope.meta.revision < state.revision) {
            return {
                outcome: "ignored_older",
                localRevision: state.revision,
                remoteRevision: envelope.meta.revision
            };
        }

        if (envelope.meta.revision === state.revision) {
            if (
                recordsMatch(current, remoteReturn)
                && state.checksum === envelope.meta.writeSetChecksum
            ) {
                return {
                    outcome: "duplicate",
                    localRevision: state.revision,
                    remoteRevision: envelope.meta.revision
                };
            }

            return remoteConflict(
                envelope.meta.revision,
                "Equal InvoiceReturn revisions contain different state.",
                state.revision
            );
        }

        try {
            const applied = this.repository.applyAuthoritativeForAccount(
                accountId,
                invoiceReturnId,
                remoteReturn
            );

            if (!applied) {
                return remoteConflict(
                    envelope.meta.revision,
                    "Remote InvoiceReturn cache target disappeared during apply.",
                    state.revision
                );
            }
        } catch {
            return remoteConflict(
                envelope.meta.revision,
                "Remote InvoiceReturn lifecycle conflicts with local cache.",
                state.revision
            );
        }

        this.saveRemoteState(accountId, invoiceReturnId, envelope);

        return {
            outcome: "applied",
            localRevision: state.revision,
            remoteRevision: envelope.meta.revision
        };
    }

    private saveState(operation: SyncOperation): void {
        if (!this.stateRepository) {
            return;
        }

        const mutation = readInvoiceReturnCloudMutation(operation);

        this.stateRepository.save({
            accountId: operation.accountId,
            recordId: operation.recordId,
            revision: invoiceReturnRevision(mutation.intended),
            checksum: operation.writeSetChecksum ?? "",
            lastOperationId: operation.operationId,
            updatedAt: this.clock()
        });
    }

    private saveRemoteState(
        accountId: string,
        invoiceReturnId: string,
        envelope: InvoiceReturnCloudEnvelope
    ): void {
        this.stateRepository?.save({
            accountId,
            recordId: invoiceReturnId,
            revision: envelope.meta.revision,
            checksum: envelope.meta.writeSetChecksum,
            lastOperationId: envelope.meta.lastOperationId,
            updatedAt: this.clock()
        });
    }
}

function recordsMatch(left: unknown, right: unknown): boolean {
    return jsonValuesMatch(
        toJsonObject(JSON.parse(JSON.stringify(left)) as unknown),
        toJsonObject(JSON.parse(JSON.stringify(right)) as unknown)
    );
}

function invoiceReturnRevision(invoiceReturn: InvoiceReturn): number {
    return typeof invoiceReturn.revision === "number"
        && Number.isInteger(invoiceReturn.revision)
        && invoiceReturn.revision >= 0
        ? invoiceReturn.revision
        : 0;
}

function conflict(summarySafe: string): LocalMutationInspection {
    return { state: "conflict", summarySafe };
}

function remoteConflict(
    remoteRevision: number,
    summarySafe: string,
    localRevision?: number
): InvoiceReturnRemoteApplyResult {
    return {
        outcome: "conflict",
        ...(localRevision !== undefined ? { localRevision } : {}),
        remoteRevision,
        summarySafe
    };
}
