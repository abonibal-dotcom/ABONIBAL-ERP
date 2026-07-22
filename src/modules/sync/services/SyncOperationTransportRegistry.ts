import {
    SyncTransportError,
    type SyncExecutionResult,
    type SyncOperationTransport
} from "../SyncContracts";
import {
    requireSyncCloudAction,
    syncOperationRouteKey,
    type SyncCloudAction,
    type SyncModule,
    type SyncOperation,
    type SyncOperationType
} from "../SyncOperation";

export class SyncOperationTransportRegistry implements SyncOperationTransport {
    private readonly transports = new Map<SyncModule, SyncOperationTransport>();
    private readonly specificTransports = new Map<string, SyncOperationTransport>();

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

    public registerSpecific(
        module: SyncModule,
        operationType: SyncOperationType,
        cloudAction: SyncCloudAction,
        transport: SyncOperationTransport
    ): void {
        const routeKey = syncOperationRouteKey(
            module,
            operationType,
            requireSyncCloudAction(cloudAction)
        );

        if (this.specificTransports.has(routeKey)) {
            throw new Error(`Sync transport is already registered for ${routeKey}.`);
        }

        this.specificTransports.set(routeKey, transport);
    }

    public supports(operation: SyncOperation): boolean {
        if (operation.cloudAction) {
            return this.specificTransports.has(syncOperationRouteKey(
                operation.module,
                operation.operationType,
                operation.cloudAction
            ));
        }

        return this.transports.has(operation.module);
    }

    public execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        const transport = operation.cloudAction
            ? this.specificTransports.get(syncOperationRouteKey(
                operation.module,
                operation.operationType,
                operation.cloudAction
            ))
            : this.transports.get(operation.module);

        if (!transport) {
            return Promise.reject(new SyncTransportError(
                operation.cloudAction
                    ? "sync_route_unconfigured"
                    : "sync_module_unconfigured",
                operation.cloudAction
                    ? "No exact operational sync route is configured for this action."
                    : "No operational sync adapter is configured for this module."
            ));
        }

        return transport.execute(operation);
    }
}
