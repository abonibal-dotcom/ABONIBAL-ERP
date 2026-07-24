import { readFileSync } from "node:fs";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { get, ref, remove, set } from "firebase/database";

const projectId = "abonibal-erp-test";
const ownAccount = "invoice-return-rules-account-a";
const foreignAccount = "invoice-return-rules-account-b";
const memberUid = "invoice-return-rules-member-a";
const rules = readFileSync("database.test.rules.json", "utf8");
const timestamp = "2026-07-22T08:00:00.000Z";

const environment = await initializeTestEnvironment({
    projectId,
    database: { host: "127.0.0.1", port: 9001, rules }
});

let passed = 0;

async function pass(name: string, action: () => Promise<unknown>): Promise<void> {
    await action();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
}

function recordedData(accountId: string, returnId: string, revision = 0) {
    return {
        id: returnId,
        accountId,
        returnNumber: `RET-20260722-${returnId}`,
        invoiceId: `invoice-${returnId}`,
        invoiceNumberSnapshot: `INV-20260722-${returnId}`,
        status: "recorded",
        revision,
        reason: "Rules return",
        lines: [{
            id: `${returnId}-line-1`,
            invoiceLineId: `${returnId}-invoice-line-1`,
            productId: "rules-product",
            productNameSnapshot: "Rules Product",
            quantity: 2,
            unitPriceSnapshot: 10,
            lineTotalSnapshot: 20,
            returnQuantity: 1,
            originalSaleDeductionMovementId: `sale-${returnId}`
        }],
        total: 10,
        createdAt: timestamp,
        createdBy: "logical-user",
        updatedAt: timestamp,
        updatedBy: "logical-user"
    };
}

function executedData(recorded: ReturnType<typeof recordedData>) {
    return {
        ...structuredClone(recorded),
        status: "executed",
        revision: recorded.revision + 1,
        executionCommandId: `invoice-return-execute-${recorded.id}`,
        lines: recorded.lines.map(line => ({
            ...line,
            returnStockMovementId: `invoice-return-${recorded.id}-${line.id}`
        }))
    };
}

function envelope(
    data: Record<string, unknown>,
    operationKind: string
) {
    const revision = data.revision as number;

    return {
        data,
        meta: {
            schemaVersion: 1,
            revision,
            serverUpdatedAt: 1_784_707_200_000 + revision,
            lastOperationId: `${operationKind}-${String(data.id)}-r${revision}`,
            idempotencyKey: `invoiceReturn:${operationKind}:${String(data.id)}:r${revision}`,
            writeSetChecksum: `${operationKind}-write-${revision}`,
            recordChecksum: `${operationKind}-record-${revision}`,
            tombstone: false,
            operationKind,
            lifecycleStatus: data.status
        }
    };
}

function invoiceDraft(accountId: string, id: string) {
    return {
        data: {
            id,
            accountId,
            invoiceNumber: `INV-${id}`,
            status: "draft",
            revision: 0,
            customerSnapshot: { displayName: "Regression Customer" },
            lines: [{
                id: `${id}-line-1`,
                productId: "rules-product",
                productNameSnapshot: "Rules Product",
                quantity: 1,
                unitPrice: 10,
                discount: 0,
                tax: 0,
                lineSubtotal: 10,
                lineTotal: 10
            }],
            subtotal: 10,
            discount: 0,
            tax: 0,
            total: 10,
            createdAt: timestamp,
            createdBy: "logical-user",
            updatedAt: timestamp,
            updatedBy: "logical-user"
        },
        meta: {
            schemaVersion: 1,
            revision: 0,
            serverUpdatedAt: 1_784_707_200_000,
            lastOperationId: `${id}-create`,
            idempotencyKey: `invoice:create:${id}`,
            writeSetChecksum: `${id}-write`,
            recordChecksum: `${id}-record`,
            tombstone: false,
            operationKind: "create_draft",
            lifecycleStatus: "draft"
        }
    };
}

function masterEnvelope(accountId: string, id: string) {
    return {
        data: {
            id,
            accountId,
            displayName: "Regression Master",
            createdAt: timestamp,
            createdBy: "logical-user"
        },
        meta: {
            schemaVersion: 1,
            revision: 1,
            serverUpdatedAt: 1_784_707_200_000,
            lastOperationId: `${id}-create`,
            tombstone: false,
            writeSetChecksum: `${id}-checksum`
        }
    };
}

function movementEnvelope(accountId: string, id: string) {
    return {
        data: {
            id,
            accountId,
            productId: "rules-product",
            type: "manual_adjustment",
            quantityDelta: 1,
            reason: "Rules regression",
            referenceType: "manual",
            createdAt: timestamp,
            createdBy: "logical-user",
            ledgerSemanticsVersion: 2
        },
        meta: {
            schemaVersion: 1,
            revision: 1,
            immutable: true,
            serverUpdatedAt: 1_784_707_200_000,
            lastOperationId: `${id}-append`,
            idempotencyKey: `stockMovement:append:${id}`,
            writeSetChecksum: `${id}-checksum`
        }
    };
}

try {
    const foreignReturn = recordedData(foreignAccount, "foreign-return");
    const immutableExecuted = executedData(
        recordedData(ownAccount, "immutable-executed")
    );

    await environment.withSecurityRulesDisabled(async context => {
        await set(
            ref(context.database(), `accountMembers/${ownAccount}/${memberUid}`),
            true
        );
        await set(
            ref(context.database(), `accounts/${foreignAccount}/invoiceReturns/${foreignReturn.id}`),
            envelope(foreignReturn, "create_recorded")
        );
        await set(
            ref(context.database(), `accounts/${ownAccount}/invoiceReturns/${immutableExecuted.id}`),
            envelope(immutableExecuted, "execute_invoice_return")
        );
    });

    const member = environment.authenticatedContext(memberUid);
    const unauthenticated = environment.unauthenticatedContext();
    const returnId = "return-a";
    const initial = recordedData(ownAccount, returnId);

    await pass("own-account create recorded", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`),
        envelope(initial, "create_recorded")
    )));
    await pass("own-account read", () => assertSucceeds(get(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`)
    )));

    const updated = {
        ...initial,
        revision: 1,
        reason: "Valid recorded CAS update",
        updatedAt: "2026-07-22T08:01:00.000Z"
    };
    await pass("valid recorded CAS update", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`),
        envelope(updated, "update_recorded")
    )));
    await pass("stale recorded update denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`),
        envelope({ ...updated, reason: "stale" }, "update_recorded")
    )));
    await pass("blind identity overwrite denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`),
        envelope({ ...updated, revision: 2, createdBy: "other" }, "update_recorded")
    )));

    const directExecuted = executedData(recordedData(ownAccount, "direct-executed"));
    await pass("create directly as executed denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${directExecuted.id}`),
        envelope(directExecuted, "execute_invoice_return")
    )));
    await pass("recorded to executed denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`),
        envelope(executedData(updated), "execute_invoice_return")
    )));
    await pass("executed edit denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${immutableExecuted.id}`),
        envelope({
            ...immutableExecuted,
            revision: immutableExecuted.revision + 1,
            reason: "forbidden edit"
        }, "update_recorded")
    )));
    await pass("physical delete denied", () => assertFails(remove(
        ref(member.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`)
    )));
    await pass("foreign account read denied", () => assertFails(get(
        ref(member.database(), `accounts/${foreignAccount}/invoiceReturns/${foreignReturn.id}`)
    )));
    await pass("foreign account create denied", () => assertFails(set(
        ref(member.database(), `accounts/${foreignAccount}/invoiceReturns/foreign-create`),
        envelope(
            recordedData(foreignAccount, "foreign-create"),
            "create_recorded"
        )
    )));
    await pass("unauthenticated read denied", () => assertFails(get(
        ref(unauthenticated.database(), `accounts/${ownAccount}/invoiceReturns/${returnId}`)
    )));
    await pass("unauthenticated write denied", () => assertFails(set(
        ref(unauthenticated.database(), `accounts/${ownAccount}/invoiceReturns/unauth`),
        envelope(recordedData(ownAccount, "unauth"), "create_recorded")
    )));
    await pass("membership mutation denied", () => assertFails(set(
        ref(member.database(), `accountMembers/${ownAccount}/other-user`),
        true
    )));
    await pass("Invoice rules regression", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/regression-invoice`),
        invoiceDraft(ownAccount, "regression-invoice")
    )));
    await pass("StockMovement rules regression", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/stockMovements/regression-movement`),
        movementEnvelope(ownAccount, "regression-movement")
    )));
    await pass("master-data rules regression", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/products/regression-product`),
        masterEnvelope(ownAccount, "regression-product")
    )));

    console.log(JSON.stringify({
        mission: "V1-SYNC-007D",
        result: "PASS",
        checks: `${passed}/${passed}`,
        ownAccountRecorded: "PASS",
        recordedCas: "PASS",
        staleUpdate: "DENIED",
        executeCreateOrTransition: "DENIED",
        executedImmutability: "PASS",
        physicalDelete: "DENIED",
        crossAccount: "DENIED",
        unauthenticated: "DENIED",
        membershipMutation: "DENIED",
        invoiceRegression: "PASS",
        stockMovementRegression: "PASS",
        masterDataRegression: "PASS",
        firebaseProject: projectId,
        productionTouched: false
    }, null, 2));
} finally {
    await environment.cleanup();
}
