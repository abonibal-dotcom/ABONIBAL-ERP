import { readFileSync } from "node:fs";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { ref, set } from "firebase/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FirebaseCommercialCommandReceiptStore } from "../../src/trusted/FirebaseCommercialCommandReceiptStore.js";
import type { CommercialCommandRequest } from "../../src/trusted/CommercialCommandTypes.js";
import { calculateCommandRequestChecksum } from "../../src/trusted/CommercialCommandValidation.js";

const PROJECT_ID = "abonibal-erp-test";
const ACCOUNT_ID = "receipt-rules-account-a";
const FOREIGN_ACCOUNT_ID = "receipt-rules-account-b";
const MEMBER_UID = "receipt-rules-member-a";

let environment: RulesTestEnvironment;

beforeAll(async () => {
    const rules = readFileSync("../database.test.rules.json", "utf8");
    environment = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        database: { host: "127.0.0.1", port: 9001, rules }
    });

    await environment.withSecurityRulesDisabled(async context => {
        await set(
            ref(context.database(), `accountMembers/${ACCOUNT_ID}/${MEMBER_UID}`),
            true
        );
    });
});

afterAll(async () => {
    await environment.cleanup();
});

describe("trusted commercial receipt rules boundary", () => {
    it("denies direct receipt writes by an authenticated member", async () => {
        const member = environment.authenticatedContext(MEMBER_UID);
        const path = `accounts/${ACCOUNT_ID}/commercialCommandReceipts/client-command`;

        await assertFails(set(ref(member.database(), path), clientReceipt()));
    });

    it("denies foreign and unauthenticated direct receipt writes", async () => {
        const member = environment.authenticatedContext(MEMBER_UID);
        const unauthenticated = environment.unauthenticatedContext();

        await assertFails(set(
            ref(
                member.database(),
                `accounts/${FOREIGN_ACCOUNT_ID}/commercialCommandReceipts/foreign-command`
            ),
            clientReceipt()
        ));
        await assertFails(set(
            ref(
                unauthenticated.database(),
                `accounts/${ACCOUNT_ID}/commercialCommandReceipts/unauth-command`
            ),
            clientReceipt()
        ));
    });

    it("allows the Admin receipt repository to claim and complete in the emulator", async () => {
        const app = initializeApp({
            projectId: PROJECT_ID,
            databaseURL: `http://127.0.0.1:9001?ns=${PROJECT_ID}`
        }, "trusted-receipt-emulator-test");

        try {
            const store = new FirebaseCommercialCommandReceiptStore(getDatabase(app));
            const command: CommercialCommandRequest = {
                schemaVersion: 1,
                accountId: ACCOUNT_ID,
                commandId: "admin-command-001",
                commandType: "test.synthetic",
                targetId: "target-001",
                payload: { testOnly: true }
            };
            const requestChecksum = calculateCommandRequestChecksum(command);
            const claimInputs = ["lease-admin-001", "lease-admin-002"].map(
                leaseId => ({
                    request: command,
                    requestChecksum,
                    now: 1_000,
                    leaseId,
                    leaseDurationMs: 100
                })
            );
            const claims = await Promise.all(claimInputs.map(input => store.claim(input)));
            const acquired = claims.find(claim => claim.kind === "acquired");

            expect(claims.map(claim => claim.kind).sort()).toEqual([
                "acquired",
                "processing"
            ]);
            expect(acquired?.receipt.attemptCount).toBe(1);

            const conflictCommand = {
                ...command,
                payload: { testOnly: false }
            };
            const conflictingClaim = await store.claim({
                request: conflictCommand,
                requestChecksum: calculateCommandRequestChecksum(conflictCommand),
                now: 1_001,
                leaseId: "lease-conflict",
                leaseDurationMs: 100
            });

            expect(conflictingClaim.kind).toBe("conflicting-request");

            if (!acquired?.receipt.processingLeaseId) {
                throw new Error("The emulator claim did not return an acquired lease.");
            }

            const completed = await store.complete({
                accountId: ACCOUNT_ID,
                commandId: command.commandId,
                requestChecksum,
                leaseId: acquired.receipt.processingLeaseId,
                now: 1_010,
                result: {
                    status: "accepted",
                    safeResultSummary: { emulatorOnly: true }
                }
            });

            expect(completed.status).toBe("accepted");
            const terminalRetry = await store.claim({
                request: command,
                requestChecksum,
                now: 1_011,
                leaseId: "lease-admin-retry",
                leaseDurationMs: 100
            });
            expect(terminalRetry.kind).toBe("terminal");
            await assertSucceeds(Promise.resolve(terminalRetry));
        } finally {
            await deleteApp(app);
        }
    });
});

function clientReceipt() {
    return {
        schemaVersion: 1,
        accountId: ACCOUNT_ID,
        commandId: "client-command",
        commandType: "test.synthetic",
        targetId: "target-001",
        requestChecksum: "0".repeat(64),
        status: "accepted",
        attemptCount: 1,
        createdAt: 1,
        updatedAt: 1
    };
}
