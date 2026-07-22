import type { Database } from "firebase-admin/database";
import {
    canonicalChecksum,
    normalizeJsonObject
} from "../trusted/CanonicalJson.js";
import type {
    AtomicCommercialPublicationPlan,
    AtomicCommercialPublicationResult
} from "./CommercialPublicationTypes.js";
import type { AtomicCommercialPublicationRepository } from "./AtomicCommercialPublicationRepository.js";

export type BeforeAtomicPublicationUpdate = (
    plan: AtomicCommercialPublicationPlan
) => void | Promise<void>;

export class FirebaseAtomicCommercialPublicationRepository
implements AtomicCommercialPublicationRepository {
    private readonly locks = new Map<string, Promise<void>>();
    public updateCount = 0;

    constructor(
        private readonly database: Database,
        private readonly beforeUpdate?: BeforeAtomicPublicationUpdate
    ) {}

    publish(
        plan: AtomicCommercialPublicationPlan
    ): Promise<AtomicCommercialPublicationResult> {
        return this.serialized(`${plan.accountId}/${plan.publicationId}`, () =>
            this.publishUnlocked(plan)
        );
    }

    private async publishUnlocked(
        plan: AtomicCommercialPublicationPlan
    ): Promise<AtomicCommercialPublicationResult> {
        const accountReference = this.database.ref(`accounts/${plan.accountId}`);
        const current = await accountReference.get();
        const root = asObject(current.val());
        const existingMarker = valueAt(
            root,
            "commercialGroupCommits",
            plan.publicationId
        );

        if (existingMarker !== undefined && existingMarker !== null) {
            if (!same(existingMarker, plan.marker)) {
                return conflict("PUBLICATION_MARKER_CONFLICT");
            }
            return allPublishedMembersMatch(root, plan)
                ? {
                    kind: "exactMatch",
                    publicationId: plan.publicationId,
                    movementCount: Object.keys(plan.movementEnvelopes).length
                }
                : conflict("PARTIAL_PUBLICATION_STATE_CONFLICT");
        }

        const allocationCommit = valueAt(
            root,
            "returnAllocations",
            plan.invoiceId,
            "commits",
            plan.commandId
        );
        if (!same(allocationCommit, plan.allocationCommit)) {
            return conflict("ALLOCATION_COMMIT_CONFLICT");
        }

        const recordedReturn = valueAt(
            root,
            "invoiceReturns",
            plan.returnId
        );
        if (!same(recordedReturn, plan.recordedReturnEnvelope)) {
            return conflict("RETURN_BASELINE_CONFLICT");
        }

        const receipt = valueAt(
            root,
            "commercialCommandReceipts",
            plan.commandId
        );
        if (
            !same(receipt, plan.expectedProcessingReceipt)
            || plan.expectedProcessingReceipt.status !== "processing"
            || plan.expectedProcessingReceipt.processingLeaseId
                !== plan.processingLeaseId
            || (plan.expectedProcessingReceipt.processingLeaseExpiresAt ?? 0)
                <= plan.marker.committedAt
        ) {
            return conflict("RECEIPT_STATE_CONFLICT");
        }

        for (const movementId of Object.keys(plan.movementEnvelopes)) {
            const existing = valueAt(root, "stockMovements", movementId);
            if (existing !== undefined && existing !== null) {
                return conflict("MOVEMENT_ID_CONFLICT");
            }
        }

        const updates: Record<string, unknown> = {
            [`invoiceReturns/${plan.returnId}`]: plan.executedReturnEnvelope,
            [`commercialCommandReceipts/${plan.commandId}`]: plan.acceptedReceipt,
            [`commercialGroupCommits/${plan.publicationId}`]: plan.marker
        };
        for (const [movementId, envelope] of Object.entries(
            plan.movementEnvelopes
        )) {
            updates[`stockMovements/${movementId}`] = envelope;
        }

        await this.beforeUpdate?.(plan);
        this.updateCount += 1;
        await accountReference.update(updates);
        return {
            kind: "published",
            publicationId: plan.publicationId,
            movementCount: Object.keys(plan.movementEnvelopes).length
        };
    }

    private serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
        const previous = this.locks.get(key) ?? Promise.resolve();
        let release!: () => void;
        const current = new Promise<void>(resolve => { release = resolve; });
        const queued = previous.then(() => current);
        this.locks.set(key, queued);
        return previous.then(work).finally(() => {
            release();
            if (this.locks.get(key) === queued) {
                this.locks.delete(key);
            }
        });
    }
}

function allPublishedMembersMatch(
    root: Record<string, unknown>,
    plan: AtomicCommercialPublicationPlan
): boolean {
    if (
        !same(valueAt(root, "invoiceReturns", plan.returnId), plan.executedReturnEnvelope)
        || !same(
            valueAt(root, "commercialCommandReceipts", plan.commandId),
            plan.acceptedReceipt
        )
    ) {
        return false;
    }
    return Object.entries(plan.movementEnvelopes).every(([movementId, value]) =>
        same(valueAt(root, "stockMovements", movementId), value)
    );
}

function valueAt(root: Record<string, unknown>, ...path: string[]): unknown {
    let current: unknown = root;
    for (const segment of path) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            return undefined;
        }
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function same(left: unknown, right: unknown): boolean {
    if (left === undefined || left === null) {
        return right === undefined || right === null;
    }
    try {
        return canonicalChecksum(normalizeJsonObject(left))
            === canonicalChecksum(normalizeJsonObject(right));
    } catch {
        return false;
    }
}

function conflict(
    code: Extract<AtomicCommercialPublicationResult, { kind: "conflict" }>["code"]
): AtomicCommercialPublicationResult {
    return { kind: "conflict", code };
}
