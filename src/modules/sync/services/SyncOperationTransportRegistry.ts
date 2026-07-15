import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../SyncContracts";
import type { SyncModule, SyncOperation } from "../SyncOperation";

export class SyncOperationTransportRegistry implements SyncOperationTransport {
    private readonly transports = new Map<SyncModule, SyncOperationTransport>();

    public register(
        modules: readonly SyncModule[],
        transport: SyncOperationTransport
    ): void {
        for (const module of modules) {
            if (this.transports.has(module)) {
                throw new Error(`Sync transport is already registered for ${module}.`);
            }

            this.transports.set(module, transport);
        }
    }

    public execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        const transport = this.transports.get(operation.module);

        if (!transport) {
            return Promise.reject(new SyncTransportError(
                "sync_module_unconfigured",
                "No operational sync adapter is configured for this module."
            ));
        }

        return transport.execute(operation);
    }
}
