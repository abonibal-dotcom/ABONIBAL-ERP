import { readFileSync } from "node:fs";
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { get, ref, remove, set } from "firebase/database";

const projectId = "abonibal-erp-test";
const ownAccount = "invoice-rules-account-a";
const foreignAccount = "invoice-rules-account-b";
const memberUid = "invoice-rules-member-a";
const rules = readFileSync("database.test.rules.json", "utf8");
const timestamp = "2026-07-21T08:00:00.000Z";

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

function draftData(accountId: string, invoiceId: string, revision = 0) {
    return {
        id: invoiceId,
        accountId,
        invoiceNumber: `INV-20260721-${invoiceId}`,
        status: "draft",
        revision,
        customerSnapshot: { displayName: "Rules Customer" },
        lines: [{
            id: `${invoiceId}-line-1`,
            productId: "rules-product",
            productNameSnapshot: "Rules Product",
            quantity: 2,
            unitPrice: 10,
            discount: 0,
            tax: 0,
            lineSubtotal: 20,
            lineTotal: 20
        }],
        subtotal: 20,
        discount: 0,
        tax: 0,
        total: 20,
        createdAt: timestamp,
        createdBy: "logical-user",
        updatedAt: timestamp,
        updatedBy: "logical-user"
    };
}

function envelope(
    data: Record<string, unknown>,
    operationKind: string,
    tombstone = false
) {
    const revision = data.revision as number;

    return {
        data,
        meta: {
            schemaVersion: 1,
            revision,
            serverUpdatedAt: 1_784_620_800_000 + revision,
            lastOperationId: `${operationKind}-${String(data.id)}-r${revision}`,
            idempotencyKey: `invoice:${operationKind}:${String(data.id)}:r${revision}`,
            writeSetChecksum: `${operationKind}-write-${revision}`,
            recordChecksum: `${operationKind}-record-${revision}`,
            tombstone,
            operationKind,
            lifecycleStatus: data.status,
            ...(tombstone
                ? { tombstonedAt: timestamp, tombstonedBy: "logical-user" }
                : {})
        }
    };
}

function issuedData(draft: ReturnType<typeof draftData>) {
    return {
        ...structuredClone(draft),
        status: "issued",
        revision: draft.revision + 1,
        issueCommandId: `invoice-issue-${draft.id}`,
        issuedAt: timestamp,
        issuedBy: "logical-user",
        updatedAt: timestamp,
        lines: draft.lines.map(line => ({
            ...line,
            stockMovementId: `sale-${draft.id}-${line.id}`
        }))
    };
}

function cancelledData(issued: ReturnType<typeof issuedData>) {
    return {
        ...structuredClone(issued),
        status: "cancelled",
        revision: issued.revision + 1,
        cancellationCommandId: `invoice-cancel-${issued.id}`,
        cancelledAt: timestamp,
        cancelledBy: "logical-user",
        cancelReason: "Rules cancellation",
        updatedAt: timestamp,
        lines: issued.lines.map(line => ({
            ...line,
            reversalStockMovementId: `invoice-cancel-return-${issued.id}-${line.id}`
        }))
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
            serverUpdatedAt: 1_784_620_800_000,
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
            serverUpdatedAt: 1_784_620_800_000,
            lastOperationId: `${id}-append`,
            idempotencyKey: `stockMovement:append:${id}`,
            writeSetChecksum: `${id}-checksum`
        }
    };
}

try {
    await environment.withSecurityRulesDisabled(async context => {
        await set(
            ref(context.database(), `accountMembers/${ownAccount}/${memberUid}`),
            true
        );
        await set(
            ref(context.database(), `accounts/${foreignAccount}/invoices/foreign-invoice`),
            envelope(draftData(foreignAccount, "foreign-invoice"), "create_draft")
        );
    });

    const member = environment.authenticatedContext(memberUid);
    const unauthenticated = environment.unauthenticatedContext();
    const invoiceId = "invoice-a";
    const initial = draftData(ownAccount, invoiceId);

    await pass("own-account create draft", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope(initial, "create_draft")
    )));
    await pass("own-account read", () => assertSucceeds(get(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`)
    )));

    const updated = {
        ...initial,
        revision: 1,
        notes: "Valid CAS update",
        updatedAt: "2026-07-21T08:01:00.000Z"
    };
    await pass("valid draft CAS update", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope(updated, "update_draft")
    )));
    await pass("stale draft update denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope({ ...updated, notes: "stale" }, "update_draft")
    )));
    await pass("blind identity overwrite denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope({ ...updated, revision: 2, createdBy: "other" }, "update_draft")
    )));

    const issued = issuedData(updated);
    await pass("valid draft to issued", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope(issued, "issue_invoice")
    )));
    await pass("issued core edit denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope({ ...issued, revision: 3, total: 999 }, "update_draft")
    )));

    const cancelled = cancelledData(issued);
    await pass("valid issued to cancelled", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope(cancelled, "cancel_invoice")
    )));
    await pass("cancelled edit denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope({ ...cancelled, revision: 4, notes: "changed" }, "cancel_invoice")
    )));
    await pass("cancelled to issued denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${invoiceId}`),
        envelope({ ...issued, revision: 4 }, "issue_invoice")
    )));

    const transitionId = "transition-denial";
    const transitionDraft = draftData(ownAccount, transitionId);
    const transitionIssued = issuedData(transitionDraft);
    await set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${transitionId}`),
        envelope(transitionDraft, "create_draft")
    );
    await set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${transitionId}`),
        envelope(transitionIssued, "issue_invoice")
    );
    await pass("issued to draft denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${transitionId}`),
        envelope({ ...transitionDraft, revision: 2 }, "update_draft")
    )));

    const tombstoneId = "tombstone-draft";
    const tombstoneDraft = draftData(ownAccount, tombstoneId);
    await set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${tombstoneId}`),
        envelope(tombstoneDraft, "create_draft")
    );
    await pass("valid draft tombstone", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${tombstoneId}`),
        envelope({ ...tombstoneDraft, revision: 1 }, "tombstone_draft", true)
    )));
    await pass("issued tombstone denied", () => assertFails(set(
        ref(member.database(), `accounts/${ownAccount}/invoices/${transitionId}`),
        envelope({ ...transitionIssued, revision: 2 }, "tombstone_draft", true)
    )));
    await pass("physical delete denied", () => assertFails(remove(
        ref(member.database(), `accounts/${ownAccount}/invoices/${tombstoneId}`)
    )));
    await pass("foreign account read denied", () => assertFails(get(
        ref(member.database(), `accounts/${foreignAccount}/invoices/foreign-invoice`)
    )));
    await pass("foreign account create denied", () => assertFails(set(
        ref(member.database(), `accounts/${foreignAccount}/invoices/foreign-create`),
        envelope(draftData(foreignAccount, "foreign-create"), "create_draft")
    )));
    await pass("unauthenticated read denied", () => assertFails(get(
        ref(unauthenticated.database(), `accounts/${ownAccount}/invoices/${invoiceId}`)
    )));
    await pass("unauthenticated write denied", () => assertFails(set(
        ref(unauthenticated.database(), `accounts/${ownAccount}/invoices/unauth`),
        envelope(draftData(ownAccount, "unauth"), "create_draft")
    )));
    await pass("client membership mutation denied", () => assertFails(set(
        ref(member.database(), `accountMembers/${ownAccount}/other-user`),
        true
    )));
    await pass("master-data rules regression", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/products/regression-product`),
        masterEnvelope(ownAccount, "regression-product")
    )));
    await pass("StockMovement rules regression", () => assertSucceeds(set(
        ref(member.database(), `accounts/${ownAccount}/stockMovements/regression-movement`),
        movementEnvelope(ownAccount, "regression-movement")
    )));

    console.log(JSON.stringify({
        mission: "V1-SYNC-007C",
        result: "PASS",
        checks: `${passed}/${passed}`,
        ownAccountDraft: "PASS",
        draftCas: "PASS",
        staleUpdate: "DENIED",
        issuedImmutability: "PASS",
        cancelledImmutability: "PASS",
        tombstone: "PASS",
        physicalDelete: "DENIED",
        crossAccount: "DENIED",
        unauthenticated: "DENIED",
        membershipMutation: "DENIED",
        masterDataRegression: "PASS",
        stockMovementRegression: "PASS",
        firebaseProject: projectId,
        productionTouched: false
    }, null, 2));
} finally {
    await environment.cleanup();
}
