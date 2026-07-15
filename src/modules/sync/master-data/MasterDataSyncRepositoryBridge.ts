import type { SyncModeService } from "../services/SyncModeService";
import type { DurableMutationCapture } from "../services/DurableMutationCapture";
import type { MasterDataSyncStateRepository } from "../repositories/MasterDataSyncStateRepository";
import type { SyncOperationInput } from "../SyncOperation";
import { sha256Hex } from "./CanonicalJson";
import type { MasterDataLocalMutationApplier } from "./MasterDataLocalMutationApplier";
import {
    createMasterDataEnvelope,
    type MasterDataCacheRepository,
    type MasterDataMutationPayload,
    type MasterDataRecordCodec
} from "./MasterDataSyncTypes";

export class MasterDataSyncMutationError extends Error {
    public readonly messageSafe: string;

    public constructor(messageSafe: string) {
        super(messageSafe);
        this.name = "MasterDataSyncMutationError";
        this.messageSafe = messageSafe;
    }
}

export type MasterDataBridgeClock = () => string;

export class MasterDataSyncRepositoryBridge<T extends object> {
    private readonly cacheRepository: MasterDataCacheRepository<T>;
    private readonly modeService: SyncModeService;
    private readonly capture: DurableMutationCapture;
    private readonly localApplier: MasterDataLocalMutationApplier<T>;
    private readonly stateRepository: MasterDataSyncStateRepository;
    private readonly codec: MasterDataRecordCodec<T>;
    private readonly clock: MasterDataBridgeClock;

    public constructor(
        cacheRepository: MasterDataCacheRepository<T>,
        modeService: SyncModeService,
        capture: DurableMutationCapture,
        localApplier: MasterDataLocalMutationApplier<T>,
        stateRepository: MasterDataSyncStateRepository,
        codec: MasterDataRecordCodec<T>,
        clock: MasterDataBridgeClock = () => new Date().toISOString()
    ) {
        this.cacheRepository = cacheRepository;
        this.modeService = modeService;
        this.capture = capture;
        this.localApplier = localApplier;
        this.stateRepository = stateRepository;
        this.codec = codec;
        this.clock = clock;
    }

    public addToAccount(accountId: string, record: T): void {
        if (this.modeService.getMode() !== "active") {
            this.cacheRepository.addToAccount(accountId, record);
            return;
        }

        this.captureRecord(accountId, record, "create", undefined);
    }

    public updateForAccount(
        accountId: string,
        recordId: string,
        data: Partial<T>
    ): void {
        if (this.modeService.getMode() !== "active") {
            this.cacheRepository.updateForAccount(accountId, recordId, data);
            return;
        }

        const current = this.cacheRepository.findForAccount(accountId, recordId);

        if (!current) {
            throw new MasterDataSyncMutationError(
                "Master-data update target was not found in local cache."
            );
        }

        const state = this.stateRepository.find(
            accountId,
            this.codec.module,
            recordId
        );

        if (!state) {
            throw new MasterDataSyncMutationError(
                "Existing local record has no verified cloud revision; migration is required before active update."
            );
        }

        this.captureRecord(
            accountId,
            { ...current, ...data },
            "update",
            state.revision
        );
    }

    public prepareCreateOperation(
        accountId: string,
        record: T,
        createdAt: string = this.clock()
    ): SyncOperationInput {
        return this.prepareRecordOperation(
            accountId,
            record,
            "create",
            undefined,
            createdAt
        );
    }

    private captureRecord(
        accountId: string,
        record: T,
        operationType: "create" | "update",
        expectedRevision: number | undefined
    ): void {
        const operation = this.prepareRecordOperation(
            accountId,
            record,
            operationType,
            expectedRevision,
            this.clock()
        );
        const result = this.capture.capture({
            accountId,
            localApplier: this.localApplier,
            operation
        });

        if (!result.success) {
            throw new MasterDataSyncMutationError(
                result.errors[0] ?? "Master-data mutation capture failed."
            );
        }
    }

    private prepareRecordOperation(
        accountId: string,
        record: T,
        operationType: "create" | "update",
        expectedRevision: number | undefined,
        createdAt: string
    ): SyncOperationInput {
        const recordId = readRecordIdentity(record, "id");
        const recordAccountId = readRecordIdentity(record, "accountId");

        if (recordAccountId !== accountId.trim()) {
            throw new MasterDataSyncMutationError(
                "Master-data record account does not match the active account."
            );
        }

        this.codec.validateRecord(record, recordAccountId, recordId);

        const data = this.codec.toCloudRecord(record);
        const revision = operationType === "create"
            ? 1
            : (expectedRevision as number) + 1;
        const tombstone = this.codec.isTombstone(record);
        const checksumSeed = createMasterDataEnvelope(
            data,
            revision,
            "checksum-seed",
            tombstone
        ).meta.writeSetChecksum;
        const idempotencyKey = `${this.codec.module}:${operationType}:${recordId}:r${revision}`;
        const operationId = `${this.codec.module}-${sha256Hex(
            `${idempotencyKey}:${checksumSeed}`
        ).slice(0, 32)}`;
        const envelope = createMasterDataEnvelope(
            data,
            revision,
            operationId,
            tombstone
        );
        const payload: MasterDataMutationPayload = { envelope };

        return {
            operationId,
            accountId,
            module: this.codec.module,
            recordId,
            operationType,
            ...(expectedRevision !== undefined ? { expectedRevision } : {}),
            idempotencyKey,
            writeSetChecksum: envelope.meta.writeSetChecksum,
            safePayload: payload,
            createdAt
        };
    }
}

function readRecordIdentity(record: object, field: "id" | "accountId"): string {
    const value = (record as Record<string, unknown>)[field];

    if (typeof value !== "string" || !value.trim()) {
        throw new MasterDataSyncMutationError(
            `Master-data record ${field} is required.`
        );
    }

    return value.trim();
}
