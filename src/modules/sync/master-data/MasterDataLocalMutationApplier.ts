import type { SyncOperation } from "../SyncOperation";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../services/LocalMutationApplier";
import type { MasterDataSyncStateRepository } from "../repositories/MasterDataSyncStateRepository";
import { jsonValuesMatch } from "./CanonicalJson";
import {
    normalizeMasterDataEnvelope,
    readMasterDataMutationPayload,
    type MasterDataCacheRepository,
    type MasterDataCloudEnvelope,
    type MasterDataRecordCodec
} from "./MasterDataSyncTypes";

export type RemoteCacheApplyOutcome =
    | "applied"
    | "duplicate"
    | "ignored_older"
    | "conflict";

export interface RemoteCacheApplyResult {
    outcome: RemoteCacheApplyOutcome;
    localRevision?: number;
    remoteRevision: number;
    summarySafe?: string;
}

export type MasterDataApplyClock = () => string;

export class MasterDataLocalMutationApplier<T extends object>
implements LocalMutationApplier {
    public readonly module: MasterDataRecordCodec<T>["module"];

    private readonly cacheRepository: MasterDataCacheRepository<T>;
    private readonly stateRepository: MasterDataSyncStateRepository;
    private readonly codec: MasterDataRecordCodec<T>;
    private readonly clock: MasterDataApplyClock;

    public constructor(
        cacheRepository: MasterDataCacheRepository<T>,
        stateRepository: MasterDataSyncStateRepository,
        codec: MasterDataRecordCodec<T>,
        clock: MasterDataApplyClock = () => new Date().toISOString()
    ) {
        this.cacheRepository = cacheRepository;
        this.stateRepository = stateRepository;
        this.codec = codec;
        this.module = codec.module;
        this.clock = clock;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        const intended = this.readIntended(operation);
        const current = this.cacheRepository.findForAccount(
            operation.accountId,
            operation.recordId
        );
        const state = this.stateRepository.find(
            operation.accountId,
            this.module,
            operation.recordId
        );

        if (!current) {
            return operation.operationType === "create"
                ? { state: "not_applied" }
                : conflict("Local update target is missing from cache.");
        }

        const currentData = this.codec.toCloudRecord(current);

        if (jsonValuesMatch(currentData, intended.envelope.data)) {
            if (
                state?.revision === intended.envelope.meta.revision
                && state.checksum === intended.envelope.meta.writeSetChecksum
            ) {
                return { state: "already_applied" };
            }

            return { state: "not_applied" };
        }

        if (operation.operationType === "create") {
            return conflict("Local create target already exists with different data.");
        }

        if (state?.revision === operation.expectedRevision) {
            return { state: "not_applied" };
        }

        return conflict("Local update revision does not match the captured mutation.");
    }

    public apply(operation: SyncOperation): void {
        const intended = this.readIntended(operation);
        const current = this.cacheRepository.findForAccount(
            operation.accountId,
            operation.recordId
        );
        const state = this.stateRepository.find(
            operation.accountId,
            this.module,
            operation.recordId
        );
        const record = this.codec.fromCloudRecord(intended.envelope.data);

        this.codec.validateRecord(record, operation.accountId, operation.recordId);

        if (current && jsonValuesMatch(
            this.codec.toCloudRecord(current),
            intended.envelope.data
        )) {
            this.saveState(operation.accountId, intended.envelope);
            return;
        }

        if (operation.operationType === "create") {
            if (current) {
                throw new Error("Local create conflicts with an existing cache record.");
            }

            this.cacheRepository.addToAccount(operation.accountId, record);
            this.saveState(operation.accountId, intended.envelope);
            return;
        }

        if (
            !current
            || state?.revision !== operation.expectedRevision
        ) {
            throw new Error("Local update cannot be applied at the current revision.");
        }

        this.cacheRepository.updateForAccount(
            operation.accountId,
            operation.recordId,
            record
        );
        this.saveState(operation.accountId, intended.envelope);
    }

    public applyAuthoritativeEnvelope(
        accountId: string,
        recordId: string,
        value: unknown
    ): RemoteCacheApplyResult {
        const envelope = normalizeMasterDataEnvelope(value);

        if (
            envelope.data.accountId !== accountId
            || envelope.data.id !== recordId
        ) {
            return {
                outcome: "conflict",
                remoteRevision: envelope.meta.revision,
                summarySafe: "Remote master-data identity does not match its path."
            };
        }

        const remoteRecord = this.codec.fromCloudRecord(envelope.data);
        this.codec.validateRecord(remoteRecord, accountId, recordId);

        const current = this.cacheRepository.findForAccount(accountId, recordId);
        const state = this.stateRepository.find(accountId, this.module, recordId);

        if (!current) {
            this.cacheRepository.addToAccount(accountId, remoteRecord);
            this.saveState(accountId, envelope);

            return {
                outcome: "applied",
                remoteRevision: envelope.meta.revision
            };
        }

        if (!state) {
            return {
                outcome: "conflict",
                remoteRevision: envelope.meta.revision,
                summarySafe: "Existing local record has no verified cloud revision."
            };
        }

        if (envelope.meta.revision < state.revision) {
            return {
                outcome: "ignored_older",
                localRevision: state.revision,
                remoteRevision: envelope.meta.revision
            };
        }

        if (envelope.meta.revision === state.revision) {
            const sameRecord = jsonValuesMatch(
                this.codec.toCloudRecord(current),
                envelope.data
            );

            if (
                sameRecord
                && state.checksum === envelope.meta.writeSetChecksum
            ) {
                return {
                    outcome: "duplicate",
                    localRevision: state.revision,
                    remoteRevision: envelope.meta.revision
                };
            }

            return {
                outcome: "conflict",
                localRevision: state.revision,
                remoteRevision: envelope.meta.revision,
                summarySafe: "Equal master-data revisions contain different state."
            };
        }

        this.cacheRepository.updateForAccount(accountId, recordId, remoteRecord);
        this.saveState(accountId, envelope);

        return {
            outcome: "applied",
            localRevision: state.revision,
            remoteRevision: envelope.meta.revision
        };
    }

    private readIntended(operation: SyncOperation) {
        if (operation.module !== this.module) {
            throw new Error("Master-data local applier module mismatch.");
        }

        return readMasterDataMutationPayload(operation);
    }

    private saveState(
        accountId: string,
        envelope: MasterDataCloudEnvelope
    ): void {
        this.stateRepository.save({
            accountId,
            module: this.module,
            recordId: String(envelope.data.id),
            revision: envelope.meta.revision,
            checksum: envelope.meta.writeSetChecksum,
            lastOperationId: envelope.meta.lastOperationId,
            updatedAt: this.clock()
        });
    }
}

function conflict(summarySafe: string): LocalMutationInspection {
    return {
        state: "conflict",
        summarySafe
    };
}
