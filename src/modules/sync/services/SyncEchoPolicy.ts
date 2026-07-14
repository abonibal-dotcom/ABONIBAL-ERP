import type { SyncReceipt } from "../SyncReceipt";

export interface RemoteEchoIdentity {
    operationId?: string;
    idempotencyKey?: string;
    revision?: number;
}

export class SyncEchoPolicy {
    public shouldApplyRemoteRecord(
        identity: RemoteEchoIdentity,
        receipt: SyncReceipt | undefined
    ): boolean {
        if (!receipt) {
            return true;
        }

        const sameOperation = Boolean(identity.operationId)
            && identity.operationId === receipt.operationId;
        const sameIdempotency = Boolean(identity.idempotencyKey)
            && identity.idempotencyKey === receipt.idempotencyKey;
        const revisionMatches = identity.revision === undefined
            || receipt.cloudRevision === undefined
            || identity.revision === receipt.cloudRevision;

        return !(revisionMatches && (sameOperation || sameIdempotency));
    }
}
