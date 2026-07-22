import { describe, expect, it } from "vitest";
import type { AtomicCommercialPublicationRepository } from "../../src/publication/AtomicCommercialPublicationRepository.js";
import { AtomicCommercialPublicationService } from "../../src/publication/AtomicCommercialPublicationService.js";
import {
    calculateCanonicalDocumentNumberAllocationChecksum
} from "../../src/publication/CommercialPublicationPlanBuilder.js";
import type {
    AtomicCommercialPublicationPlan,
    AtomicCommercialPublicationResult,
    ExecuteReturnPublicationRequest
} from "../../src/publication/CommercialPublicationTypes.js";
import {
    calculateReturnAllocationReservationChecksum
} from "../../src/allocation/ReturnAllocationTransaction.js";
import { canonicalChecksum, normalizeJsonObject } from "../../src/trusted/CanonicalJson.js";
import { InMemoryReturnAllocationRepository } from "../helpers/InMemoryReturnAllocationRepository.js";

const NOW = 2_000;
const ACCOUNT_ID = "publication-account";
const INVOICE_ID = "invoice-publication";
const RETURN_ID = "return-publication";
const COMMAND_ID = `invoice-return-execute-${RETURN_ID}`;
const REQUEST_CHECKSUM = "a".repeat(64);

class CapturingPublicationRepository
implements AtomicCommercialPublicationRepository {
    calls = 0;
    plan: AtomicCommercialPublicationPlan | null = null;
    failOnce = false;

    async publish(
        plan: AtomicCommercialPublicationPlan
    ): Promise<AtomicCommercialPublicationResult> {
        this.calls += 1;
        this.plan = plan;
        if (this.failOnce) {
            this.failOnce = false;
            throw new Error("synthetic publication failure");
        }
        return {
            kind: "published",
            publicationId: plan.publicationId,
            movementCount: Object.keys(plan.movementEnvelopes).length
        };
    }
}

async function fixture(lineCount = 2) {
    const allocations = new InMemoryReturnAllocationRepository();
    const lines = Array.from({ length: lineCount }, (_, index) => ({
        returnLineId: `return-line-${index + 1}`,
        invoiceLineId: `invoice-line-${index + 1}`,
        quantity: index + 1
    }));
    const reserved = await allocations.reserve({
        request: {
            schemaVersion: 1,
            accountId: ACCOUNT_ID,
            commandId: COMMAND_ID,
            commandType: "invoiceReturn.execute",
            returnId: RETURN_ID,
            invoiceId: INVOICE_ID,
            expectedReturnRevision: 0,
            expectedReturnChecksum: "b".repeat(64),
            requestChecksum: REQUEST_CHECKSUM,
            lines
        },
        invoiceLines: lines.map((line, index) => ({
            id: line.invoiceLineId,
            soldQuantity: 10 + index
        })),
        now: 1_000
    });
    if (reserved.kind !== "reserved") {
        throw new Error("Fixture reservation failed.");
    }
    const repository = new CapturingPublicationRepository();
    const service = new AtomicCommercialPublicationService(
        allocations,
        repository,
        () => NOW
    );
    const data = normalizeJsonObject({
        id: RETURN_ID,
        accountId: ACCOUNT_ID,
        returnNumber: "RET-LOCAL-001",
        invoiceId: INVOICE_ID,
        invoiceNumberSnapshot: "INV-LOCAL-001",
        status: "recorded",
        revision: 0,
        reason: "QA return",
        lines: lines.map((line, index) => ({
            id: line.returnLineId,
            invoiceLineId: line.invoiceLineId,
            productId: `product-${index + 1}`,
            productNameSnapshot: `Product ${index + 1}`,
            quantity: 10 + index,
            unitPriceSnapshot: 5,
            lineTotalSnapshot: 50,
            returnQuantity: line.quantity
        })),
        total: 15,
        createdAt: "2026-07-23T00:00:00.000Z",
        createdBy: "actor-a",
        updatedAt: "2026-07-23T00:00:00.000Z",
        updatedBy: "actor-a"
    });
    const proofBase = {
        schemaVersion: 1 as const,
        allocationId: "number-allocation-001",
        accountId: ACCOUNT_ID,
        documentType: "invoiceReturn" as const,
        targetId: RETURN_ID,
        documentNumber: "RET-CANONICAL-001",
        businessDate: "2026-07-23",
        timezone: "Asia/Damascus"
    };
    const request: ExecuteReturnPublicationRequest = {
        schemaVersion: 1,
        accountId: ACCOUNT_ID,
        commandId: COMMAND_ID,
        commandType: "invoiceReturn.execute",
        returnId: RETURN_ID,
        invoiceId: INVOICE_ID,
        requestChecksum: REQUEST_CHECKSUM,
        reservationChecksum:
            calculateReturnAllocationReservationChecksum(reserved.reservation),
        recordedReturnEnvelope: {
            data,
            meta: normalizeJsonObject({
                schemaVersion: 1,
                revision: 0,
                serverUpdatedAt: 1_000,
                lastOperationId: "create-return",
                idempotencyKey: "create-return",
                writeSetChecksum: canonicalChecksum(data),
                recordChecksum: canonicalChecksum(data),
                tombstone: false,
                operationKind: "create_recorded",
                lifecycleStatus: "recorded"
            })
        },
        processingReceipt: {
            schemaVersion: 1,
            accountId: ACCOUNT_ID,
            commandId: COMMAND_ID,
            commandType: "invoiceReturn.execute",
            targetId: RETURN_ID,
            requestChecksum: REQUEST_CHECKSUM,
            status: "processing",
            attemptCount: 1,
            createdAt: 1_000,
            updatedAt: 1_000,
            processingLeaseId: "lease-001",
            processingLeaseExpiresAt: 20_000
        },
        documentNumberProof: {
            ...proofBase,
            allocationChecksum:
                calculateCanonicalDocumentNumberAllocationChecksum(proofBase)
        },
        actorId: "trusted-actor"
    };
    return { allocations, repository, service, request };
}

describe("atomic commercial publication foundation", () => {
    it("builds one executed Return, deterministic movements, accepted receipt, and marker", async () => {
        const { service, repository, request, allocations } = await fixture(2);
        await expect(service.publishExecutedReturn(request)).resolves.toEqual({
            kind: "published",
            publicationId: COMMAND_ID,
            movementCount: 2
        });

        const plan = repository.plan!;
        expect(plan.publicationId).toBe(COMMAND_ID);
        expect(Object.keys(plan.movementEnvelopes)).toEqual([
            `invoice-return-${RETURN_ID}-return-line-1`,
            `invoice-return-${RETURN_ID}-return-line-2`
        ]);
        expect(plan.executedReturnEnvelope.data.status).toBe("executed");
        expect(plan.acceptedReceipt.status).toBe("accepted");
        expect(plan.marker.status).toBe("committed");
        expect(plan.marker.movementMembers).toHaveProperty(
            `invoice-return-${RETURN_ID}-return-line-1`
        );
        expect((await allocations.find(ACCOUNT_ID, INVOICE_ID))
            ?.lines["invoice-line-1"]).toMatchObject({
            reservedReturnedQuantity: 0,
            committedReturnedQuantity: 1
        });
    });

    it("rejects a missing numbering proof before allocation commit", async () => {
        const { service, request, allocations, repository } = await fixture(1);
        const invalid = {
            ...request,
            documentNumberProof: undefined
        } as unknown as ExecuteReturnPublicationRequest;

        await expect(service.publishExecutedReturn(invalid)).resolves.toEqual({
            kind: "rejected",
            code: "DOCUMENT_NUMBER_PROOF_REQUIRED"
        });
        expect(allocations.commitCalls).toBe(0);
        expect(repository.calls).toBe(0);
    });

    it("recovers after allocation commit but before publication without double commit", async () => {
        const { service, request, allocations, repository } = await fixture(1);
        repository.failOnce = true;
        await expect(service.publishExecutedReturn(request))
            .rejects.toThrow("synthetic publication failure");
        await expect(service.publishExecutedReturn(request))
            .resolves.toMatchObject({ kind: "published" });

        const state = await allocations.find(ACCOUNT_ID, INVOICE_ID);
        expect(state?.revision).toBe(2);
        expect(Object.keys(state?.commits ?? {})).toHaveLength(1);
        expect(state?.lines["invoice-line-1"]?.committedReturnedQuantity).toBe(1);
    });
});
