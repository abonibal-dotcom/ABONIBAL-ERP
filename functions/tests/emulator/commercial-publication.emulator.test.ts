import { readFileSync } from "node:fs";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { get, ref, set } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirebaseReturnAllocationRepository } from "../../src/allocation/FirebaseReturnAllocationRepository.js";
import { FirebaseReturnAllocationCommitRepository } from "../../src/allocation/FirebaseReturnAllocationCommitRepository.js";
import {
    calculateReturnAllocationReservationChecksum
} from "../../src/allocation/ReturnAllocationTransaction.js";
import { AtomicCommercialPublicationService } from "../../src/publication/AtomicCommercialPublicationService.js";
import {
    calculateCanonicalDocumentNumberAllocationChecksum
} from "../../src/publication/CommercialPublicationPlanBuilder.js";
import { FirebaseAtomicCommercialPublicationRepository } from "../../src/publication/FirebaseAtomicCommercialPublicationRepository.js";
import type {
    AtomicCommercialPublicationPlan,
    ExecuteReturnPublicationRequest
} from "../../src/publication/CommercialPublicationTypes.js";
import { canonicalChecksum, normalizeJsonObject } from "../../src/trusted/CanonicalJson.js";

const PROJECT_ID = "abonibal-erp-test";
const ACCOUNT_ID = "publication-rules-account";
const MEMBER_UID = "publication-rules-member";
const NOW = 2_000;

let environment: RulesTestEnvironment;
let adminApp: App;
let database: Database;

beforeAll(async () => {
    const rules = readFileSync("../database.test.rules.json", "utf8");
    environment = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        database: { host: "127.0.0.1", port: 9001, rules }
    });
    adminApp = initializeApp({
        projectId: PROJECT_ID,
        databaseURL: `http://127.0.0.1:9001?ns=${PROJECT_ID}`
    }, "commercial-publication-emulator-test");
    database = getDatabase(adminApp);
});

beforeEach(async () => {
    await environment.clearDatabase();
    await environment.withSecurityRulesDisabled(async context => {
        await set(
            ref(context.database(), `accountMembers/${ACCOUNT_ID}/${MEMBER_UID}`),
            true
        );
    });
});

afterAll(async () => {
    await environment.cleanup();
    await deleteApp(adminApp);
});

describe("atomic commercial publication on RTDB", () => {
    it("publishes Return, N movements, receipt, and marker in one account-root update", async () => {
        const fixture = await createFixture("atomic", [1, 2]);
        const repository = new FirebaseAtomicCommercialPublicationRepository(database);
        const service = publicationService(repository);

        await expect(service.publishExecutedReturn(fixture.request)).resolves.toEqual({
            kind: "published",
            publicationId: fixture.request.commandId,
            movementCount: 2
        });
        const account = (await database.ref(`accounts/${ACCOUNT_ID}`).get()).val();
        expect(account.invoiceReturns[fixture.request.returnId].data.status).toBe("executed");
        expect(Object.keys(account.stockMovements)).toHaveLength(2);
        expect(account.commercialCommandReceipts[fixture.request.commandId].status)
            .toBe("accepted");
        expect(account.commercialGroupCommits[fixture.request.commandId].status)
            .toBe("committed");
        expect(account.returnAllocations[fixture.request.invoiceId]
            .lines["invoice-line-1"]).toMatchObject({
            reservedReturnedQuantity: 0,
            committedReturnedQuantity: 1
        });

        await expect(service.publishExecutedReturn(fixture.request)).resolves.toMatchObject({
            kind: "exactMatch"
        });
        const changedProofBase = {
            ...fixture.request.documentNumberProof,
            documentNumber: "RET-CONFLICTING-RETRY"
        };
        const conflictingRequest = {
            ...fixture.request,
            documentNumberProof: {
                ...changedProofBase,
                allocationChecksum:
                    calculateCanonicalDocumentNumberAllocationChecksum(changedProofBase)
            }
        };
        await expect(service.publishExecutedReturn(conflictingRequest)).resolves.toEqual({
            kind: "conflict",
            code: "PUBLICATION_MARKER_CONFLICT"
        });
        expect(repository.updateCount).toBe(1);
    });

    it("leaves no Phase B member when the atomic update is interrupted before write", async () => {
        const fixture = await createFixture("crash", [3]);
        let captured: AtomicCommercialPublicationPlan | null = null;
        const crashing = new FirebaseAtomicCommercialPublicationRepository(
            database,
            plan => {
                captured = plan;
                throw new Error("synthetic pre-update crash");
            }
        );
        await expect(publicationService(crashing).publishExecutedReturn(fixture.request))
            .rejects.toThrow("synthetic pre-update crash");

        const account = (await database.ref(`accounts/${ACCOUNT_ID}`).get()).val();
        expect(account.invoiceReturns[fixture.request.returnId].data.status).toBe("recorded");
        expect(account.stockMovements).toBeUndefined();
        expect(account.commercialGroupCommits).toBeUndefined();
        expect(account.commercialCommandReceipts[fixture.request.commandId].status)
            .toBe("processing");
        expect(account.returnAllocations[fixture.request.invoiceId]
            .commits[fixture.request.commandId]).toBeDefined();
        expect(captured).not.toBeNull();

        const retryRepository = new FirebaseAtomicCommercialPublicationRepository(database);
        await expect(publicationService(retryRepository)
            .publishExecutedReturn(fixture.request)).resolves.toMatchObject({
            kind: "published"
        });
    });

    it("serializes exact concurrent retries to one physical publication update", async () => {
        const fixture = await createFixture("concurrent", [2]);
        const repository = new FirebaseAtomicCommercialPublicationRepository(database);
        const service = publicationService(repository);
        const outcomes = await Promise.all([
            service.publishExecutedReturn(fixture.request),
            service.publishExecutedReturn(fixture.request)
        ]);

        expect(outcomes.map(result => result.kind).sort())
            .toEqual(["exactMatch", "published"]);
        expect(repository.updateCount).toBe(1);
        const movements = (await database.ref(
            `accounts/${ACCOUNT_ID}/stockMovements`
        ).get()).val();
        expect(Object.keys(movements)).toHaveLength(1);
    });

    it("preserves conflicts and never overwrites a deterministic movement identity", async () => {
        const fixture = await createFixture("movement-conflict", [2]);
        const movementId = `invoice-return-${fixture.request.returnId}-return-line-1`;
        await database.ref(
            `accounts/${ACCOUNT_ID}/stockMovements/${movementId}`
        ).set({ data: { id: movementId, conflicting: true }, meta: {} });

        const result = await publicationService(
            new FirebaseAtomicCommercialPublicationRepository(database)
        ).publishExecutedReturn(fixture.request);
        expect(result).toEqual({ kind: "conflict", code: "MOVEMENT_ID_CONFLICT" });
        const account = (await database.ref(`accounts/${ACCOUNT_ID}`).get()).val();
        expect(account.invoiceReturns[fixture.request.returnId].data.status).toBe("recorded");
        expect(account.stockMovements[movementId].data.conflicting).toBe(true);
        expect(account.commercialGroupCommits).toBeUndefined();
    });

    it("detects a marker without all members as partial publication evidence", async () => {
        const fixture = await createFixture("partial", [1]);
        let captured: AtomicCommercialPublicationPlan | null = null;
        const capture = new FirebaseAtomicCommercialPublicationRepository(
            database,
            plan => {
                captured = plan;
                throw new Error("capture");
            }
        );
        await expect(publicationService(capture).publishExecutedReturn(fixture.request))
            .rejects.toThrow("capture");
        await database.ref(
            `accounts/${ACCOUNT_ID}/commercialGroupCommits/${fixture.request.commandId}`
        ).set(captured!.marker);

        await expect(publicationService(
            new FirebaseAtomicCommercialPublicationRepository(database)
        ).publishExecutedReturn(fixture.request)).resolves.toEqual({
            kind: "conflict",
            code: "PARTIAL_PUBLICATION_STATE_CONFLICT"
        });
    });
});

describe("current TEST rules boundary", () => {
    it("denies client receipt, allocation, group marker, and executed Return writes", async () => {
        const member = environment.authenticatedContext(MEMBER_UID);
        const base = `accounts/${ACCOUNT_ID}`;
        await assertFails(set(ref(member.database(), `${base}/commercialCommandReceipts/x`), { x: 1 }));
        await assertFails(set(ref(member.database(), `${base}/returnAllocations/x`), { x: 1 }));
        await assertFails(set(ref(member.database(), `${base}/commercialGroupCommits/x`), { x: 1 }));
        await assertFails(set(ref(member.database(), `${base}/invoiceReturns/executed-client`), {
            data: { id: "executed-client", accountId: ACCOUNT_ID, status: "executed" },
            meta: { revision: 1 }
        }));
    });

    it("documents the pending trusted gate: a member can still create a commercial movement", async () => {
        const member = environment.authenticatedContext(MEMBER_UID);
        const movementId = "synthetic-client-sale-return";
        await assertSucceeds(set(ref(
            member.database(),
            `accounts/${ACCOUNT_ID}/stockMovements/${movementId}`
        ), {
            data: {
                id: movementId,
                accountId: ACCOUNT_ID,
                productId: "synthetic-product",
                type: "sale_return",
                quantityDelta: 1,
                reason: "synthetic emulator gate proof",
                referenceType: "invoice_return",
                createdAt: "2026-07-23T00:00:00.000Z",
                createdBy: "synthetic-actor",
                ledgerSemanticsVersion: 2
            },
            meta: {
                schemaVersion: 1,
                revision: 1,
                immutable: true,
                serverUpdatedAt: 1,
                lastOperationId: "synthetic-operation",
                idempotencyKey: "synthetic-idempotency",
                writeSetChecksum: "synthetic-checksum"
            }
        }));
    });
});

function publicationService(repository: FirebaseAtomicCommercialPublicationRepository) {
    return new AtomicCommercialPublicationService(
        new FirebaseReturnAllocationCommitRepository(database),
        repository,
        () => NOW
    );
}

async function createFixture(suffix: string, quantities: number[]) {
    const returnId = `return-${suffix}`;
    const invoiceId = `invoice-${suffix}`;
    const commandId = `invoice-return-execute-${returnId}`;
    const requestChecksum = canonicalChecksum(normalizeJsonObject({ suffix, quantities }));
    const lines = quantities.map((quantity, index) => ({
        returnLineId: `return-line-${index + 1}`,
        invoiceLineId: `invoice-line-${index + 1}`,
        quantity
    }));
    const allocationRepository = new FirebaseReturnAllocationRepository(database);
    const reserved = await allocationRepository.reserve({
        request: {
            schemaVersion: 1,
            accountId: ACCOUNT_ID,
            commandId,
            commandType: "invoiceReturn.execute",
            returnId,
            invoiceId,
            expectedReturnRevision: 0,
            expectedReturnChecksum: "a".repeat(64),
            requestChecksum,
            lines
        },
        invoiceLines: lines.map(line => ({
            id: line.invoiceLineId,
            soldQuantity: 10
        })),
        now: 1_000
    });
    if (reserved.kind !== "reserved") {
        throw new Error("Fixture reservation failed.");
    }
    const persistedAllocation = await allocationRepository.find(ACCOUNT_ID, invoiceId);
    if (!persistedAllocation?.reservations[commandId]) {
        throw new Error("Fixture allocation was not readable after persistence.");
    }
    const data = normalizeJsonObject({
        id: returnId,
        accountId: ACCOUNT_ID,
        returnNumber: `RET-LOCAL-${suffix}`,
        invoiceId,
        invoiceNumberSnapshot: `INV-${suffix}`,
        status: "recorded",
        revision: 0,
        reason: "Synthetic emulator return",
        lines: lines.map((line, index) => ({
            id: line.returnLineId,
            invoiceLineId: line.invoiceLineId,
            productId: `product-${suffix}-${index + 1}`,
            productNameSnapshot: `Product ${index + 1}`,
            quantity: 10,
            unitPriceSnapshot: 5,
            lineTotalSnapshot: 50,
            returnQuantity: line.quantity
        })),
        total: 10,
        createdAt: "2026-07-23T00:00:00.000Z",
        createdBy: "actor-a",
        updatedAt: "2026-07-23T00:00:00.000Z",
        updatedBy: "actor-a"
    });
    const recordChecksum = canonicalChecksum(data);
    const envelope = {
        data,
        meta: normalizeJsonObject({
            schemaVersion: 1,
            revision: 0,
            serverUpdatedAt: 1_000,
            lastOperationId: `create-${returnId}`,
            idempotencyKey: `create-${returnId}`,
            writeSetChecksum: recordChecksum,
            recordChecksum,
            tombstone: false,
            operationKind: "create_recorded",
            lifecycleStatus: "recorded"
        })
    };
    const receipt = {
        schemaVersion: 1 as const,
        accountId: ACCOUNT_ID,
        commandId,
        commandType: "invoiceReturn.execute",
        targetId: returnId,
        requestChecksum,
        status: "processing" as const,
        attemptCount: 1,
        createdAt: 1_000,
        updatedAt: 1_000,
        processingLeaseId: `lease-${suffix}`,
        processingLeaseExpiresAt: 20_000
    };
    await database.ref(`accounts/${ACCOUNT_ID}`).update({
        [`invoiceReturns/${returnId}`]: envelope,
        [`commercialCommandReceipts/${commandId}`]: receipt
    });
    const proofBase = {
        schemaVersion: 1 as const,
        allocationId: `number-${suffix}`,
        accountId: ACCOUNT_ID,
        documentType: "invoiceReturn" as const,
        targetId: returnId,
        documentNumber: `RET-CANONICAL-${suffix}`,
        businessDate: "2026-07-23",
        timezone: "Asia/Damascus"
    };
    const request: ExecuteReturnPublicationRequest = {
        schemaVersion: 1,
        accountId: ACCOUNT_ID,
        commandId,
        commandType: "invoiceReturn.execute",
        returnId,
        invoiceId,
        requestChecksum,
        reservationChecksum:
            calculateReturnAllocationReservationChecksum(reserved.reservation),
        recordedReturnEnvelope: envelope,
        processingReceipt: receipt,
        documentNumberProof: {
            ...proofBase,
            allocationChecksum:
                calculateCanonicalDocumentNumberAllocationChecksum(proofBase)
        },
        actorId: "trusted-actor"
    };
    return { request };
}
