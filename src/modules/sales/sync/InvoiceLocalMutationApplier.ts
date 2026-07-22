import type { SyncOperation } from "../../sync/SyncOperation";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../../sync/services/LocalMutationApplier";
import type { Invoice } from "../Invoice";
import type { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { InvoiceSyncStateRepository } from "../repositories/InvoiceSyncStateRepository";
import type { InvoiceValidator } from "../validators/InvoiceValidator";
import { readInvoiceCloudMutation } from "./InvoiceSyncOperation";
import {
    invoiceFromCloudData,
    normalizeInvoiceCloudEnvelope,
    type InvoiceCloudEnvelope
} from "./InvoiceSyncTypes";

export type InvoiceRemoteApplyOutcome =
    | "applied"
    | "duplicate"
    | "ignored_older"
    | "conflict";

export interface InvoiceRemoteApplyResult {
    outcome: InvoiceRemoteApplyOutcome;
    localRevision?: number;
    remoteRevision: number;
    summarySafe?: string;
}

export type InvoiceApplyClock = () => string;

export class InvoiceLocalMutationApplier implements LocalMutationApplier {
    public readonly module = "invoices" as const;

    private readonly repository: InvoiceRepository;
    private readonly validator: InvoiceValidator;
    private readonly stateRepository: InvoiceSyncStateRepository | null;
    private readonly clock: InvoiceApplyClock;

    public constructor(
        repository: InvoiceRepository,
        validator: InvoiceValidator,
        stateRepository: InvoiceSyncStateRepository | null = null,
        clock: InvoiceApplyClock = () => new Date().toISOString()
    ) {
        this.repository = repository;
        this.validator = validator;
        this.stateRepository = stateRepository;
        this.clock = clock;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const mutation = readInvoiceCloudMutation(operation);
        const current = this.repository.findForAccount(
            operation.accountId,
            operation.recordId
        );

        if (mutation.kind === "create_draft") {
            if (!current) {
                return { state: "not_applied" };
            }

            return recordsMatch(current, mutation.intended)
                ? { state: "already_applied" }
                : conflict("Invoice draft create conflicts with local cache.");
        }

        if (mutation.kind === "tombstone_draft") {
            if (!current) {
                return { state: "already_applied" };
            }

            return mutation.expected && recordsMatch(current, mutation.expected)
                ? { state: "not_applied" }
                : conflict("Invoice draft tombstone conflicts with local cache.");
        }

        if (!current || !mutation.expected) {
            return conflict("Invoice lifecycle source record is missing.");
        }

        if (recordsMatch(current, mutation.intended)) {
            return { state: "already_applied" };
        }

        return recordsMatch(current, mutation.expected)
            ? { state: "not_applied" }
            : conflict("Invoice lifecycle state diverges from durable intent.");
    }

    public apply(operation: SyncOperation): void {
        const mutation = readInvoiceCloudMutation(operation);
        const errors = this.validator.validate(mutation.intended);

        if (errors.length > 0) {
            throw new Error("Invoice cloud mutation payload failed validation.");
        }

        if (mutation.kind === "create_draft") {
            this.repository.appendForAccount(
                operation.accountId,
                mutation.intended
            );
        } else if (mutation.kind === "tombstone_draft") {
            if (!this.repository.removeForAccount(
                operation.accountId,
                operation.recordId
            )) {
                throw new Error("Invoice draft tombstone local removal failed.");
            }
        } else {
            const updated = this.repository.updateForAccount(
                operation.accountId,
                operation.recordId,
                mutation.intended
            );

            if (!updated) {
                throw new Error("Invoice lifecycle source record is missing.");
            }
        }

        this.saveState(operation, mutation.kind === "tombstone_draft");
    }

    public applyAuthoritativeEnvelope(
        accountId: string,
        invoiceId: string,
        value: unknown
    ): InvoiceRemoteApplyResult {
        const envelope = normalizeInvoiceCloudEnvelope(
            value,
            accountId,
            invoiceId
        );
        const remoteInvoice = invoiceFromCloudData(envelope.data);
        const errors = this.validator.validate(remoteInvoice);

        if (errors.length > 0) {
            return remoteConflict(
                envelope.meta.revision,
                "Remote Invoice failed domain validation."
            );
        }

        const current = this.repository.findForAccount(accountId, invoiceId);
        const state = this.stateRepository?.find(accountId, invoiceId);

        if (envelope.meta.tombstone) {
            return this.applyRemoteTombstone(
                accountId,
                invoiceId,
                envelope,
                current,
                state?.revision
            );
        }

        if (!current) {
            this.repository.appendAuthoritativeForAccount(
                accountId,
                remoteInvoice
            );
            this.saveRemoteState(accountId, invoiceId, envelope);

            return {
                outcome: "applied",
                remoteRevision: envelope.meta.revision
            };
        }

        const localRevision = invoiceRevision(current);

        if (!state) {
            if (recordsMatch(current, remoteInvoice)) {
                this.saveRemoteState(accountId, invoiceId, envelope);

                return {
                    outcome: "duplicate",
                    localRevision,
                    remoteRevision: envelope.meta.revision
                };
            }

            return remoteConflict(
                envelope.meta.revision,
                "Existing local Invoice has no verified cloud baseline.",
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
                recordsMatch(current, remoteInvoice)
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
                "Equal Invoice revisions contain different state.",
                state.revision
            );
        }

        try {
            const applied = this.repository.applyAuthoritativeForAccount(
                accountId,
                invoiceId,
                remoteInvoice
            );

            if (!applied) {
                return remoteConflict(
                    envelope.meta.revision,
                    "Remote Invoice cache target disappeared during apply.",
                    state.revision
                );
            }
        } catch {
            return remoteConflict(
                envelope.meta.revision,
                "Remote Invoice lifecycle conflicts with local cache.",
                state.revision
            );
        }

        this.saveRemoteState(accountId, invoiceId, envelope);

        return {
            outcome: "applied",
            localRevision: state.revision,
            remoteRevision: envelope.meta.revision
        };
    }

    private applyRemoteTombstone(
        accountId: string,
        invoiceId: string,
        envelope: InvoiceCloudEnvelope,
        current: Invoice | undefined,
        stateRevision: number | undefined
    ): InvoiceRemoteApplyResult {
        if (!current) {
            this.saveRemoteState(accountId, invoiceId, envelope);

            return {
                outcome: stateRevision === envelope.meta.revision
                    ? "duplicate"
                    : "applied",
                ...(stateRevision !== undefined
                    ? { localRevision: stateRevision }
                    : {}),
                remoteRevision: envelope.meta.revision
            };
        }

        if (stateRevision === undefined) {
            return remoteConflict(
                envelope.meta.revision,
                "Draft tombstone cannot remove a local Invoice without a verified cloud baseline.",
                invoiceRevision(current)
            );
        }

        if (envelope.meta.revision < stateRevision) {
            return {
                outcome: "ignored_older",
                localRevision: stateRevision,
                remoteRevision: envelope.meta.revision
            };
        }

        if (envelope.meta.revision === stateRevision) {
            return remoteConflict(
                envelope.meta.revision,
                "Local Invoice remains visible at a tombstoned cloud revision.",
                stateRevision
            );
        }

        if (
            current.status !== "draft"
            || !this.repository.removeForAccount(accountId, invoiceId)
        ) {
            return remoteConflict(
                envelope.meta.revision,
                "Remote tombstone cannot remove a non-draft Invoice.",
                stateRevision
            );
        }

        this.saveRemoteState(accountId, invoiceId, envelope);

        return {
            outcome: "applied",
            localRevision: stateRevision,
            remoteRevision: envelope.meta.revision
        };
    }

    private saveState(operation: SyncOperation, tombstone: boolean): void {
        if (!this.stateRepository) {
            return;
        }

        const mutation = readInvoiceCloudMutation(operation);

        this.stateRepository.save({
            accountId: operation.accountId,
            recordId: operation.recordId,
            revision: invoiceRevision(mutation.intended),
            checksum: operation.writeSetChecksum ?? "",
            lastOperationId: operation.operationId,
            tombstone,
            updatedAt: this.clock()
        });
    }

    private saveRemoteState(
        accountId: string,
        invoiceId: string,
        envelope: InvoiceCloudEnvelope
    ): void {
        this.stateRepository?.save({
            accountId,
            recordId: invoiceId,
            revision: envelope.meta.revision,
            checksum: envelope.meta.writeSetChecksum,
            lastOperationId: envelope.meta.lastOperationId,
            tombstone: envelope.meta.tombstone,
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

function invoiceRevision(invoice: Invoice): number {
    return typeof invoice.revision === "number"
        && Number.isInteger(invoice.revision)
        && invoice.revision >= 0
        ? invoice.revision
        : 0;
}

function conflict(summarySafe: string): LocalMutationInspection {
    return { state: "conflict", summarySafe };
}

function remoteConflict(
    remoteRevision: number,
    summarySafe: string,
    localRevision?: number
): InvoiceRemoteApplyResult {
    return {
        outcome: "conflict",
        ...(localRevision !== undefined ? { localRevision } : {}),
        remoteRevision,
        summarySafe
    };
}
