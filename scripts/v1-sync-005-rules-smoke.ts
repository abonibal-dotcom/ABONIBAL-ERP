import { readFileSync } from "node:fs";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestContext
} from "@firebase/rules-unit-testing";
import {
    get,
    ref,
    remove,
    set,
    update
} from "firebase/database";

const projectId = "abonibal-erp-test";
const ownAccount = "rules-account-a";
const foreignAccount = "rules-account-b";
const memberUid = "rules-member-a";
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

function recordEnvelope(
    module: string,
    recordId: string,
    revision: number,
    operationId: string,
    checksum: string
): Record<string, unknown> {
    return {
        data: {
            id: recordId,
            accountId: ownAccount,
            displayName: `${module} record`,
            createdAt: "2026-07-14T12:00:00.000Z",
            createdBy: "rules-user",
            updatedAt: "2026-07-14T12:00:00.000Z",
            updatedBy: "rules-user"
        },
        meta: {
            schemaVersion: 1,
            revision,
            serverUpdatedAt: 1_720_000_000_000 + revision,
            lastOperationId: operationId,
            tombstone: false,
            writeSetChecksum: checksum
        }
    };
}

function operationReceipt(
    module: string,
    recordId: string,
    revision: number,
    operationId: string,
    checksum: string
): Record<string, unknown> {
    return {
        operationId,
        idempotencyKey: `${module}:${recordId}:r${revision}`,
        state: "acknowledged",
        module,
        recordId,
        resultRevision: revision,
        checksum,
        serverAppliedAt: 1_720_000_000_000 + revision
    };
}

async function atomicWrite(
    context: RulesTestContext,
    module: string,
    recordId: string,
    revision: number,
    operationId: string,
    checksum: string
): Promise<void> {
    await update(ref(context.database(), `accounts/${ownAccount}`), {
        [`${module}/${recordId}`]: recordEnvelope(
            module,
            recordId,
            revision,
            operationId,
            checksum
        ),
        [`_sync/operations/${operationId}`]: operationReceipt(
            module,
            recordId,
            revision,
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
    });

    const member = environment.authenticatedContext(memberUid);
    const unauthenticated = environment.unauthenticatedContext();

    for (const module of ["products", "customers", "suppliers"]) {
        const recordId = `${module}-record`;
        const createOperationId = `${module}-create`;
        const updateOperationId = `${module}-update`;

        await pass(`${module} create own account`, () => assertSucceeds(
            atomicWrite(member, module, recordId, 1, createOperationId, `${module}-checksum-1`)
        ));

        await pass(`${module} read own account`, () => assertSucceeds(
            get(ref(member.database(), `accounts/${ownAccount}/${module}/${recordId}`))
        ));

        await pass(`${module} valid revision update`, () => assertSucceeds(
            atomicWrite(member, module, recordId, 2, updateOperationId, `${module}-checksum-2`)
        ));

        await pass(`${module} stale revision denied`, () => assertFails(
            atomicWrite(member, module, recordId, 2, `${module}-stale`, `${module}-stale-checksum`)
        ));

        await pass(`${module} blind overwrite denied`, () => assertFails(
            set(
                ref(member.database(), `accounts/${ownAccount}/${module}/${recordId}`),
                { id: recordId, accountId: ownAccount, displayName: "Blind write" }
            )
        ));

        await pass(`${module} physical delete denied`, () => assertFails(
            remove(ref(member.database(), `accounts/${ownAccount}/${module}/${recordId}`))
        ));

        await pass(`${module} foreign account read denied`, () => assertFails(
            get(ref(member.database(), `accounts/${foreignAccount}/${module}/${recordId}`))
        ));

        await pass(`${module} foreign account write denied`, () => assertFails(
            set(
                ref(member.database(), `accounts/${foreignAccount}/${module}/${recordId}`),
                recordEnvelope(module, recordId, 1, `${module}-foreign`, `${module}-foreign-checksum`)
            )
        ));

        await pass(`${module} unauthenticated read denied`, () => assertFails(
            get(ref(unauthenticated.database(), `accounts/${ownAccount}/${module}/${recordId}`))
        ));

        await pass(`${module} unauthenticated write denied`, () => assertFails(
            set(
                ref(unauthenticated.database(), `accounts/${ownAccount}/${module}/${recordId}`),
                recordEnvelope(module, recordId, 3, `${module}-unauth`, `${module}-unauth-checksum`)
            )
        ));

        await pass(`${module} membership mutation denied`, () => assertFails(
            set(ref(member.database(), `accountMembers/${ownAccount}/${memberUid}`), false)
        ));
    }

    await pass("client membership create denied", () => assertFails(
        set(ref(member.database(), `accountMembers/${ownAccount}/new-member`), true)
    ));
    await pass("client membership update denied", () => assertFails(
        set(ref(member.database(), `accountMembers/${ownAccount}/${memberUid}`), false)
    ));
    await pass("client membership delete denied", () => assertFails(
        remove(ref(member.database(), `accountMembers/${ownAccount}/${memberUid}`))
    ));

    console.log(`V1-SYNC-005 rules smoke: PASS (${passed}/${passed})`);
} finally {
    await environment.cleanup();
}
