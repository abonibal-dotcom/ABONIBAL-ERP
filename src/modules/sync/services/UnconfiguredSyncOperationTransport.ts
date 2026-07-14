import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../SyncContracts";
import type { SyncOperation } from "../SyncOperation";

export class UnconfiguredSyncOperationTransport implements SyncOperationTransport {
    public execute(_operation: SyncOperation): Promise<SyncExecutionResult> {
        return Promise.reject(new SyncTransportError(
            "sync_transport_unconfigured",
            "No operational sync adapter is configured."
        ));
    }
}
