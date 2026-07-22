import {
    requireSyncCloudAction,
    syncOperationRouteKey,
    type SyncCloudAction,
    type SyncModule,
    type SyncOperation,
    type SyncOperationType
} from "../SyncOperation";

export class SyncCloudCapabilityRegistry {
    private readonly capabilities = new Set<string>();

    public register(
        module: SyncModule,
        operationTypes: readonly SyncOperationType[]
    ): void {
        for (const operationType of operationTypes) {
            this.capabilities.add(syncOperationRouteKey(module, operationType));
        }
    }

    public registerSpecific(
        module: SyncModule,
        operationType: SyncOperationType,
        cloudActions: readonly SyncCloudAction[]
    ): void {
        for (const cloudAction of cloudActions) {
            this.capabilities.add(syncOperationRouteKey(
                module,
                operationType,
                requireSyncCloudAction(cloudAction)
            ));
        }
    }

    public supports(operation: SyncOperation): boolean {
        return this.capabilities.has(
            syncOperationRouteKey(
                operation.module,
                operation.operationType,
                operation.cloudAction
            )
        );
    }
}
