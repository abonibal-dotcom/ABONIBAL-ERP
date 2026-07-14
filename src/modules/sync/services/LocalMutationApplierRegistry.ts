import type { SyncModule } from "../SyncOperation";
import type { LocalMutationApplier } from "./LocalMutationApplier";

export class LocalMutationApplierRegistry {
    private readonly appliers = new Map<SyncModule, LocalMutationApplier>();

    public register(applier: LocalMutationApplier): void {
        if (this.appliers.has(applier.module)) {
            throw new Error(`A local mutation applier is already registered for ${applier.module}.`);
        }

        this.appliers.set(applier.module, applier);
    }

    public resolve(module: SyncModule): LocalMutationApplier {
        const applier = this.appliers.get(module);

        if (!applier) {
            throw new Error(`No local mutation applier is registered for ${module}.`);
        }

        return applier;
    }

    public has(module: SyncModule): boolean {
        return this.appliers.has(module);
    }

    public unregister(module: SyncModule): void {
        this.appliers.delete(module);
    }

    public clear(): void {
        this.appliers.clear();
    }

    public count(): number {
        return this.appliers.size;
    }
}
