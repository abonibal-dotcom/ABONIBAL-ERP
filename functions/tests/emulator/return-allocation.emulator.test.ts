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
import { CanonicalReturnAllocationService } from "../../src/allocation/CanonicalReturnAllocationService.js";
import { FirebaseCanonicalCommercialRecordReader } from "../../src/allocation/FirebaseCanonicalCommercialRecordReader.js";
import { FirebaseReturnAllocationRepository } from "../../src/allocation/FirebaseReturnAllocationRepository.js";
import type {
    ReserveReturnAllocationRequest,
    ReturnAllocationTransactionInput
} from "../../src/allocation/ReturnAllocationTypes.js";
import {
    calculateReturnAllocationRequestChecksum
} from "../../src/allocation/ReturnAllocationValidation.js";
import { canonicalChecksum, normalizeJsonObject } from "../../src/trusted/CanonicalJson.js";

const PROJECT_ID = "abonibal-erp-test";
const ACCOUNT_ID = "allocation-rules-account-a";
const FOREIGN_ACCOUNT_ID = "allocation-rules-account-b";
const MEMBER_UID = "allocation-rules-member-a";

let environment: RulesTestEnvironment;
let adminApp: App;
let adminDatabase: Database;

beforeAll(async () => {
    const rules = readFileSync("../database.test.rules.json", "utf8");
    environment = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        database: { host: "127.0.0.1", port: 9001, rules }
    });
    adminApp = initializeApp({
        projectId: PROJECT_ID,
        databaseURL: `http://127.0.0.1:9001?ns=${PROJECT_ID}`
    }, "return-allocation-emulator-test");
    adminDatabase = getDatabase(adminApp);
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

describe("canonical Return allocation RTDB transaction", () => {
    it("accepts exactly one concurrent 6 + 6 reservation against sold 10", async () => {
        await seedInvoice("invoice-six-six", [10]);
        const commands = await Promise.all([
            seedReturn("return-six-a", "invoice-six-six", [6]),
            seedReturn("return-six-b", "invoice-six-six", [6])
        ]);
        const service = allocationService();

        const outcomes = await Promise.all(commands.map(command => service.reserve(command)));
        expect(outcomes.map(outcome => outcome.kind).sort()).toEqual(["rejected", "reserved"]);
        const state = await allocationRepository().find(ACCOUNT_ID, "invoice-six-six");
        expect(state?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(6);
        expect(Object.keys(state?.reservations ?? {})).toHaveLength(1);
    });

    it("accepts concurrent 4 + 6 reservations and reaches exactly sold 10", async () => {
        await seedInvoice("invoice-four-six", [10]);
        const commands = await Promise.all([
            seedReturn("return-four", "invoice-four-six", [4]),
            seedReturn("return-six", "invoice-four-six", [6])
        ]);

        const outcomes = await Promise.all(commands.map(command =>
            allocationService().reserve(command)
        ));
        expect(outcomes.every(outcome => outcome.kind === "reserved")).toBe(true);
        expect((await allocationRepository().find(ACCOUNT_ID, "invoice-four-six"))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(10);
    });

    it("keeps a multi-line request all-or-nothing when one line exceeds capacity", async () => {
        await seedInvoice("invoice-multi-overflow", [5, 3]);
        const command = await seedReturn(
            "return-multi-overflow",
            "invoice-multi-overflow",
            [2, 4]
        );

        await expect(allocationService().reserve(command)).resolves.toEqual({
            kind: "rejected",
            code: "RETURN_ALLOCATION_EXCEEDED"
        });
        expect(await allocationRepository().find(
            ACCOUNT_ID,
            "invoice-multi-overflow"
        )).toBeNull();
    });

    it("deduplicates concurrent exact commands with one aggregate increment", async () => {
        await seedInvoice("invoice-exact", [10]);
        const command = await seedReturn("return-exact", "invoice-exact", [4]);
        const service = allocationService();

        const outcomes = await Promise.all([
            service.reserve(command),
            service.reserve(command)
        ]);
        expect(outcomes.map(outcome => outcome.kind).sort()).toEqual([
            "exactMatch",
            "reserved"
        ]);
        const state = await allocationRepository().find(ACCOUNT_ID, "invoice-exact");
        expect(state?.revision).toBe(1);
        expect(state?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(4);
    });

    it("conflicts a concurrent same-command different-payload transaction", async () => {
        const repository = allocationRepository();
        const first = unsignedRequest("return-conflict", "invoice-conflict", [4]);
        const firstRequest = signedRequest(first);
        const secondUnsigned = {
            ...first,
            lines: [{ ...first.lines[0]!, quantity: 5 }]
        };
        const secondRequest = signedRequest(secondUnsigned);
        const invoiceLines = [{ id: "invoice-line-1", soldQuantity: 10 }];
        const inputs: ReturnAllocationTransactionInput[] = [firstRequest, secondRequest]
            .map((request, index) => ({ request, invoiceLines, now: 1_000 + index }));

        const outcomes = await Promise.all(inputs.map(input => repository.reserve(input)));
        expect(outcomes.map(outcome => outcome.kind).sort()).toEqual([
            "conflict",
            "reserved"
        ]);
        const state = await repository.find(ACCOUNT_ID, "invoice-conflict");
        expect(Object.keys(state?.reservations ?? {})).toHaveLength(1);
        expect([4, 5]).toContain(
            state?.lines["invoice-line-1"]?.reservedReturnedQuantity
        );
    });

    it("isolates concurrent transactions for distinct Invoices", async () => {
        await Promise.all([
            seedInvoice("invoice-isolated-a", [5]),
            seedInvoice("invoice-isolated-b", [7])
        ]);
        const commands = await Promise.all([
            seedReturn("return-isolated-a", "invoice-isolated-a", [5]),
            seedReturn("return-isolated-b", "invoice-isolated-b", [7])
        ]);

        await Promise.all(commands.map(command => allocationService().reserve(command)));
        expect((await allocationRepository().find(ACCOUNT_ID, "invoice-isolated-a"))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(5);
        expect((await allocationRepository().find(ACCOUNT_ID, "invoice-isolated-b"))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(7);
    });

    it("recovers the same canonical result after a simulated post-transaction timeout", async () => {
        await seedInvoice("invoice-timeout", [10]);
        const command = await seedReturn("return-timeout", "invoice-timeout", [3]);
        const repository = allocationRepository();
        const service = new CanonicalReturnAllocationService(
            new FirebaseCanonicalCommercialRecordReader(adminDatabase),
            {
                reserve: async input => {
                    await repository.reserve(input);
                    throw new Error("synthetic timeout after commit");
                },
                find: (accountId, invoiceId) => repository.find(accountId, invoiceId)
            },
            () => 1_000
        );

        await expect(service.reserve(command)).rejects.toThrow("synthetic timeout after commit");
        await expect(allocationService().reserve(command)).resolves.toMatchObject({
            kind: "exactMatch"
        });
        expect((await repository.find(ACCOUNT_ID, "invoice-timeout"))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(3);
    });

    it("rejects corrupt aggregate state without overwriting it", async () => {
        await seedInvoice("invoice-corrupt", [10]);
        const command = await seedReturn("return-corrupt", "invoice-corrupt", [2]);
        await adminDatabase.ref(
            `accounts/${ACCOUNT_ID}/returnAllocations/invoice-corrupt`
        ).set({
            schemaVersion: 99,
            accountId: ACCOUNT_ID,
            invoiceId: "invoice-corrupt",
            revision: 1,
            lines: { corrupt: true },
            reservations: { corrupt: true }
        });

        await expect(allocationService().reserve(command)).resolves.toEqual({
            kind: "conflict",
            code: "ALLOCATION_STATE_CONFLICT"
        });
        expect((await adminDatabase.ref(
            `accounts/${ACCOUNT_ID}/returnAllocations/invoice-corrupt/schemaVersion`
        ).get()).val()).toBe(99);
    });

    it("denies member, foreign, and unauthenticated writes while Admin transacts", async () => {
        const ownMember = environment.authenticatedContext(MEMBER_UID);
        const unauthenticated = environment.unauthenticatedContext();
        const payload = { testOnly: true };

        await assertFails(set(
            ref(ownMember.database(), `accounts/${ACCOUNT_ID}/returnAllocations/client-write`),
            payload
        ));
        await assertFails(set(
            ref(ownMember.database(), `accounts/${FOREIGN_ACCOUNT_ID}/returnAllocations/foreign-write`),
            payload
        ));
        await assertFails(set(
            ref(unauthenticated.database(), `accounts/${ACCOUNT_ID}/returnAllocations/unauth-write`),
            payload
        ));
        await assertFails(get(ref(
            ownMember.database(),
            `accounts/${FOREIGN_ACCOUNT_ID}/returnAllocations/foreign-read`
        )));

        await seedInvoice("invoice-admin", [2]);
        const command = await seedReturn("return-admin", "invoice-admin", [1]);
        await expect(allocationService().reserve(command)).resolves.toMatchObject({
            kind: "reserved"
        });
        await assertSucceeds(Promise.resolve(
            allocationRepository().find(ACCOUNT_ID, "invoice-admin")
        ));
    });
});

function allocationRepository(): FirebaseReturnAllocationRepository {
    return new FirebaseReturnAllocationRepository(adminDatabase);
}

function allocationService(): CanonicalReturnAllocationService {
    return new CanonicalReturnAllocationService(
        new FirebaseCanonicalCommercialRecordReader(adminDatabase),
        allocationRepository(),
        () => 1_000
    );
}

async function seedInvoice(invoiceId: string, quantities: number[]): Promise<void> {
    const data = normalizeJsonObject({
        id: invoiceId,
        accountId: ACCOUNT_ID,
        status: "issued",
        revision: 1,
        lines: quantities.map((quantity, index) => ({
            id: `invoice-line-${index + 1}`,
            quantity
        }))
    });
    await adminDatabase.ref(`accounts/${ACCOUNT_ID}/invoices/${invoiceId}`).set({
        data,
        meta: {
            schemaVersion: 1,
            revision: 1,
            lifecycleStatus: "issued",
            tombstone: false,
            recordChecksum: canonicalChecksum(data)
        }
    });
}

async function seedReturn(
    returnId: string,
    invoiceId: string,
    quantities: number[]
): Promise<ReserveReturnAllocationRequest> {
    const data = normalizeJsonObject({
        id: returnId,
        accountId: ACCOUNT_ID,
        invoiceId,
        status: "recorded",
        revision: 0,
        lines: quantities.map((quantity, index) => ({
            id: `return-line-${index + 1}`,
            invoiceLineId: `invoice-line-${index + 1}`,
            returnQuantity: quantity
        }))
    });
    const recordChecksum = canonicalChecksum(data);
    await adminDatabase.ref(`accounts/${ACCOUNT_ID}/invoiceReturns/${returnId}`).set({
        data,
        meta: {
            schemaVersion: 1,
            revision: 0,
            lifecycleStatus: "recorded",
            tombstone: false,
            recordChecksum
        }
    });
    return signedRequest(unsignedRequest(returnId, invoiceId, quantities, recordChecksum));
}

function unsignedRequest(
    returnId: string,
    invoiceId: string,
    quantities: number[],
    expectedReturnChecksum = "a".repeat(64)
) {
    return {
        schemaVersion: 1 as const,
        accountId: ACCOUNT_ID,
        commandId: `invoice-return-execute-${returnId}`,
        commandType: "invoiceReturn.execute" as const,
        returnId,
        invoiceId,
        expectedReturnRevision: 0,
        expectedReturnChecksum,
        lines: quantities.map((quantity, index) => ({
            returnLineId: `return-line-${index + 1}`,
            invoiceLineId: `invoice-line-${index + 1}`,
            quantity
        }))
    };
}

function signedRequest(
    unsigned: ReturnType<typeof unsignedRequest>
): ReserveReturnAllocationRequest {
    return {
        ...unsigned,
        requestChecksum: calculateReturnAllocationRequestChecksum(unsigned)
    };
}
