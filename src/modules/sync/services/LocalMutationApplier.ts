import type { SyncModule, SyncOperation } from "../SyncOperation";

export const localMutationInspectionStates = [
    "not_applied",
    "already_applied",
    "conflict"
] as const;

export type LocalMutationInspectionState =
    typeof localMutationInspectionStates[number];

export interface LocalMutationInspection {
    state: LocalMutationInspectionState;
    summarySafe?: string;
}

export interface LocalMutationApplier {
    readonly module: SyncModule;

    // Inspection and application are cache-only. Implementations must never
    // call domain commands or create financial/inventory side effects.
    inspect(operation: SyncOperation): LocalMutationInspection;

    apply(operation: SyncOperation): void;
}
