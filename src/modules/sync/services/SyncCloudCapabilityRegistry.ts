import type {
    SyncModule,
    SyncOperation,
    SyncOperationType
} from "../SyncOperation";

export class SyncCloudCapabilityRegistry {
    private readonly capabilities = new Set<string>();

    public register(
        module: SyncModule,
        operationTypes: readonly SyncOperationType[]
    ): void {
        for (const operationType of operationTypes) {
            this.capabilities.add(capabilityKey(module, operationType));
        }
    }

    public supports(operation: SyncOperation): boolean {
        return this.capabilities.has(
            capabilityKey(operation.module, operation.operationType)
        );
    }
}

function capabilityKey(
    module: SyncModule,
    operationType: SyncOperationType
): string {
    return `${module}:${operationType}`;
}
