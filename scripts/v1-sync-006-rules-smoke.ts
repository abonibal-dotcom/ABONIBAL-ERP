import { readFileSync } from "node:fs";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestContext
} from "@firebase/rules-unit-testing";
import { get, ref, remove, set, update } from "firebase/database";

const projectId = "abonibal-erp-test";
const ownAccount = "stock-rules-account-a";
const foreignAccount = "stock-rules-account-b";
const memberUid = "stock-rules-member-a";
const rules = readFileSync("database.test.rules.json", "utf8");

const environment = await initializeTestEnvironment({
    projectId,
    database: {
        host: "127.0.0.1",
        port: 9001,
        rules
    }
});

let passed = 0;

async function pass(name: string, action: () => Promise<unknown>): Promise<void> {
    await action();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
}

function movementEnvelope(
    accountId: string,
    movementId: string,
    operationId: string,
    checksum: string,
    quantityDelta = 10
): Record<string, unknown> {
    return {
        data: {
            id: movementId,
            accountId,
            productId: "rules-product-a",
            type: "manual_adjustment",
            quantityDelta,
            reason: "Rules append test",
            referenceType: "manual",
            referenceId: "rules-reference-a",
            createdAt: "2026-07-15T16:00:00.000Z",
            createdBy: "logical-user-a",
            ledgerSemanticsVersion: 2
        },
        meta: {
            schemaVersion: 1,
            revision: 1,
            immutable: true,
            serverUpdatedAt: 1_721_000_000_000,
            lastOperationId: operationId,
            idempotencyKey: `stockMovement:append:${movementId}`,
            writeSetChecksum: checksum
        }
    };
}

function operationReceipt(
    movementId: string,
    operationId: string,
    checksum: string
): Record<string, unknown> {
    return {
        operationId,
        idempotencyKey: `stockMovement:append:${movementId}`,
        state: "acknowledged",
        module: "stockMovements",
        recordId: movementId,
        resultRevision: 1,
        checksum,
        serverAppliedAt: 1_721_000_000_000
    };
}

async function atomicAppend(
    context: RulesTestContext,
    accountId: string,
    movementId: string,
    operationId: string,
    checksum: string
): Promise<void> {
    await update(ref(context.database(), `accounts/${accountId}`), {
        [`stockMovements/${movementId}`]: movementEnvelope(
            accountId,
            movementId,
            operationId,
            checksum
        ),
        [`_sync/operations/${operationId}`]: operationReceipt(
            movementId,
            operationId,
            checksum
        )
    });
}

try {
    await environment.withSecurityRulesDisabled(async context => {
        await set(
            ref(context.database(), `accountMembers/${ownAccount}/${memberUid}`),
            true
        );
        await set(
            ref(context.database(), `accounts/${foreignAccount}/stockMovements/foreign-existing`),
            movementEnvelope(
                foreignAccount,
                "foreign-existing",
                "foreign-existing-op",
                "foreign-existing-checksum"
            )
        );
    });

    const member = environment.authenticatedContext(memberUid);
    const unauthenticated = environment.unauthenticatedContext();
    const movementId = "movement-a";
    const operationId = "movement-a-create";
    const checksum = "movement-a-checksum";

    await pass("own-account StockMovement create", () => assertSucceeds(
        atomicAppend(member, ownAccount, movementId, operationId, checksum)
    ));
    await pass("own-account StockMovement read", () => assertSucceeds(
        get(ref(member.database(), `accounts/${ownAccount}/stockMovements/${movementId}`))
    ));
    await pass("existing StockMovement update denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${ownAccount}/stockMovements/${movementId}`),
            movementEnvelope(ownAccount, movementId, operationId, "changed-checksum", 11)
        )
    ));
    await pass("identical StockMovement overwrite denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${ownAccount}/stockMovements/${movementId}`),
            movementEnvelope(ownAccount, movementId, operationId, checksum)
        )
    ));
    await pass("StockMovement physical delete denied", () => assertFails(
        remove(ref(member.database(), `accounts/${ownAccount}/stockMovements/${movementId}`))
    ));
    await pass("foreign account read denied", () => assertFails(
        get(ref(member.database(), `accounts/${foreignAccount}/stockMovements/foreign-existing`))
    ));
    await pass("foreign account create denied", () => assertFails(
        atomicAppend(
            member,
            foreignAccount,
            "foreign-create",
            "foreign-create-op",
            "foreign-create-checksum"
        )
    ));
    await pass("foreign account overwrite denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${foreignAccount}/stockMovements/foreign-existing`),
            movementEnvelope(
                foreignAccount,
                "foreign-existing",
                "foreign-overwrite-op",
                "foreign-overwrite-checksum",
                99
            )
        )
    ));
    await pass("unauthenticated StockMovement read denied", () => assertFails(
        get(ref(unauthenticated.database(), `accounts/${ownAccount}/stockMovements/${movementId}`))
    ));
    await pass("unauthenticated StockMovement write denied", () => assertFails(
        atomicAppend(
            unauthenticated,
            ownAccount,
            "unauth-create",
            "unauth-create-op",
            "unauth-create-checksum"
        )
    ));
    await pass("movement accountId/path mismatch denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${ownAccount}/stockMovements/account-mismatch`),
            movementEnvelope(
                foreignAccount,
                "account-mismatch",
                "account-mismatch-op",
                "account-mismatch-checksum"
            )
        )
    ));
    await pass("movement ID/path mismatch denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${ownAccount}/stockMovements/path-id`),
            movementEnvelope(
                ownAccount,
                "payload-id",
                "path-id-op",
                "path-id-checksum"
            )
        )
    ));
    await pass("invalid StockMovement schema denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${ownAccount}/stockMovements/invalid-schema`),
            { data: { id: "invalid-schema", accountId: ownAccount }, meta: {} }
        )
    ));
    await pass("unknown operational module write denied", () => assertFails(
        set(
            ref(member.database(), `accounts/${ownAccount}/unknownModule/record-a`),
            { id: "record-a", accountId: ownAccount }
        )
    ));
    await pass("client membership create denied", () => assertFails(
        set(ref(member.database(), `accountMembers/${ownAccount}/new-member`), true)
    ));
    await pass("client membership update denied", () => assertFails(
        set(ref(member.database(), `accountMembers/${ownAccount}/${memberUid}`), false)
    ));
    await pass("client membership delete denied", () => assertFails(
        remove(ref(member.database(), `accountMembers/${ownAccount}/${memberUid}`))
    ));

    console.log(JSON.stringify({
        mission: "V1-SYNC-006",
        result: "PASS",
        checks: `${passed}/${passed}`,
        ownAccountCreate: "PASS",
        ownAccountRead: "PASS",
        update: "DENIED",
        delete: "DENIED",
        foreignAccount: "DENIED",
        unauthenticated: "DENIED",
        membershipMutation: "DENIED",
        firebaseProject: projectId,
        productionTouched: false
    }));
} finally {
    await environment.cleanup();
}
