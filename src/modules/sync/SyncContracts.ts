import type { AuthState } from "../auth/AuthState";
import type { SyncOperation } from "./SyncOperation";
import type { SyncReceiptResult } from "./SyncReceipt";

export interface SyncExecutionAcknowledgement {
    kind: "acknowledged";
    result: SyncReceiptResult;
    cloudRevision?: number;
    cloudChecksum?: string;
}

export interface SyncExecutionConflict {
    kind: "conflict";
    actualRevision?: number;
    summarySafe: string;
}

export type SyncExecutionResult =
    | SyncExecutionAcknowledgement
    | SyncExecutionConflict;

export interface SyncOperationTransport {
    execute(operation: SyncOperation): Promise<SyncExecutionResult>;
}

export interface SyncAuthStateSource {
    getState(): AuthState;
    subscribe(subscriber: (state: AuthState) => void): () => void;
}

export interface CacheOnlyRemoteRecord<T> {
    accountId: string;
    module: string;
    recordId: string;
    revision: number;
    record: T;
}

export interface SyncCacheWriter<T> {
    // Implementations update validated cache/state only. They must never call
    // business commands that create financial or inventory side effects.
    applyAuthoritativeRecordToCache(input: CacheOnlyRemoteRecord<T>): void;
}

export class SyncTransportError extends Error {
    public readonly code: string;

    public constructor(code: string, messageSafe: string) {
        super(messageSafe);
        this.name = "SyncTransportError";
        this.code = code;
    }
}
