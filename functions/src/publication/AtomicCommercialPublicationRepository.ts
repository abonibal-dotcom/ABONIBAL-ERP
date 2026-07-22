import type {
    AtomicCommercialPublicationPlan,
    AtomicCommercialPublicationResult
} from "./CommercialPublicationTypes.js";

export interface AtomicCommercialPublicationRepository {
    publish(
        plan: AtomicCommercialPublicationPlan
    ): Promise<AtomicCommercialPublicationResult>;
}
