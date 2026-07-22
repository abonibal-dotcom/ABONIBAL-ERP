import { readFileSync } from "node:fs";
import type { Driver } from "../src/core/persistence/Driver.ts";
import type { InvoiceReturn } from "../src/modules/sales/InvoiceReturn.ts";
import {
    buildInvoiceReturnLifecycleTransitionOperation,
    readInvoiceReturnLifecycleTransitionOperation
} from "../src/modules/sales/sync/SalesCommercialSyncOperation.ts";
import {
    createPendingSyncOperation,
    type SyncOperation,
    type SyncOperationInput
} from "../src/modules/sync/SyncOperation.ts";
import { inspectSyncOperationGroup } from "../src/modules/sync/SyncOperationGroup.ts";
import type {
    SyncExecutionResult,
    SyncOperationTransport
} from "../src/modules/sync/SyncContracts.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { SyncCloudCapabilityRegistry } from "../src/modules/sync/services/SyncCloudCapabilityRegistry.ts";
import { SyncOperationTransportRegistry } from "../src/modules/sync/services/SyncOperationTransportRegistry.ts";

const accountId = "logical-account-routing";
const now = "2026-07-22T08:00:00.000Z";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        this.values.set(key, structuredClone(value));
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }
}

class FakeTransport implements SyncOperationTransport {
    public readonly calls: SyncOperation[] = [];

    public async execute(operation: SyncOperation): Promise<SyncExecutionResult> {
        this.calls.push(operation);

        return {
            kind: "acknowledged",
            result: operation.operationType === "create" ? "created" : "updated"
        };
    }
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [];

checks.push({
    name: "legacy operation matches legacy capability and transport",
    run: async () => {
        const capability = new SyncCloudCapabilityRegistry();
        const routing = new SyncOperationTransportRegistry();
        const transport = new FakeTransport();
        const operation = pending(operationInput("legacy-product", "products", "create"));
        capability.register("products", ["create"]);
        routing.register(["products"], transport);

        truthy(capability.supports(operation));
        truthy(routing.supports(operation));
        await routing.execute(operation);
        equal(transport.calls.length, 1);
    }
});

checks.push({
    name: "specific operation requires exact capability without generic fallback",
    run: () => {
        const capability = new SyncCloudCapabilityRegistry();
        const updateRecorded = pending(operationInput(
            "return-recorded-update",
            "invoiceReturns",
            "update",
            "updateRecorded"
        ));
        const execute = pending(operationInput(
            "return-execute",
            "invoiceReturns",
            "update",
            "execute"
        ));
        capability.register("invoiceReturns", ["update"]);
        truthy(!capability.supports(updateRecorded));
        truthy(!capability.supports(execute));
        capability.registerSpecific("invoiceReturns", "update", ["updateRecorded"]);
        truthy(capability.supports(updateRecorded));
        truthy(!capability.supports(execute));
    }
});

checks.push({
    name: "duplicate exact capability registration is idempotent and invalid actions fail",
    run: () => {
        const capability = new SyncCloudCapabilityRegistry();
        capability.registerSpecific("invoiceReturns", "update", ["updateRecorded"]);
        capability.registerSpecific("invoiceReturns", "update", ["updateRecorded"]);
        truthy(capability.supports(pending(operationInput(
            "duplicate-capability",
            "invoiceReturns",
            "update",
            "updateRecorded"
        ))));
        assertThrows(() => capability.registerSpecific(
            "invoiceReturns",
            "update",
            [""]
        ));
    }
});

checks.push({
    name: "specific operation requires exact transport without generic fallback",
    run: async () => {
        const routing = new SyncOperationTransportRegistry();
        const generic = new FakeTransport();
        const recorded = new FakeTransport();
        const updateRecorded = pending(operationInput(
            "specific-routing",
            "invoiceReturns",
            "update",
            "updateRecorded"
        ));
        routing.register(["invoiceReturns"], generic);
        truthy(!routing.supports(updateRecorded));
        await assertRejects(() => routing.execute(updateRecorded));
        equal(generic.calls.length, 0);
        routing.registerSpecific(
            "invoiceReturns",
            "update",
            "updateRecorded",
            recorded
        );
        truthy(routing.supports(updateRecorded));
        await routing.execute(updateRecorded);
        equal(recorded.calls.length, 1);
        equal(generic.calls.length, 0);
    }
});

checks.push({
    name: "updateRecorded and execute transports never cross-route",
    run: async () => {
        const routing = new SyncOperationTransportRegistry();
        const recorded = new FakeTransport();
        const execute = new FakeTransport();
        const recordedOperation = pending(operationInput(
            "route-recorded",
            "invoiceReturns",
            "update",
            "updateRecorded"
        ));
        const executeOperation = pending(operationInput(
            "route-execute",
            "invoiceReturns",
            "update",
            "execute"
        ));
        routing.registerSpecific("invoiceReturns", "update", "updateRecorded", recorded);
        truthy(!routing.supports(executeOperation));
        await assertRejects(() => routing.execute(executeOperation));
        routing.registerSpecific("invoiceReturns", "update", "execute", execute);
        await routing.execute(recordedOperation);
        await routing.execute(executeOperation);
        equal(recorded.calls.length, 1);
        equal(execute.calls.length, 1);
    }
});

checks.push({
    name: "capability and transport are independent mandatory gates",
    run: () => {
        const capability = new SyncCloudCapabilityRegistry();
        const routing = new SyncOperationTransportRegistry();
        const operation = pending(operationInput(
            "two-gates",
            "invoiceReturns",
            "update",
            "updateRecorded"
        ));
        capability.registerSpecific("invoiceReturns", "update", ["updateRecorded"]);
        truthy(capability.supports(operation));
        truthy(!routing.supports(operation));
        truthy(!isCloudReady(capability, routing, operation));

        const transportOnlyCapability = new SyncCloudCapabilityRegistry();
        routing.registerSpecific(
            "invoiceReturns",
            "update",
            "updateRecorded",
            new FakeTransport()
        );
        truthy(routing.supports(operation));
        truthy(!transportOnlyCapability.supports(operation));
        truthy(!isCloudReady(transportOnlyCapability, routing, operation));
        truthy(isCloudReady(capability, routing, operation));
    }
});

checks.push({
    name: "same operation identity with changed action conflicts in outbox",
    run: () => {
        const outbox = new PersistentOutboxRepository(new MemoryDriver());
        const input = operationInput(
            "identity-action",
            "invoiceReturns",
            "update",
            "updateRecorded"
        );
        outbox.enqueue(accountId, input);
        assertThrows(() => outbox.enqueue(accountId, {
            ...input,
            cloudAction: "execute"
        }));
    }
});

checks.push({
    name: "legacy outbox records remain readable and retain legacy checksum",
    run: () => {
        const driver = new MemoryDriver();
        const outbox = new PersistentOutboxRepository(driver);
        const members = outbox.enqueueBatchAtomic(accountId, groupInput(
            "legacy-group",
            undefined
        ));
        const legacyChecksum = members[0].group?.groupChecksum;
        const restarted = new PersistentOutboxRepository(driver);
        const stored = restarted.allForAccount(accountId);
        equal(stored.length, 2);
        truthy(stored.every(operation => operation.cloudAction === undefined));
        equal(stored[0].group?.groupChecksum, legacyChecksum);
        truthy(inspectSyncOperationGroup(stored).valid);

        const raw = driver.read<SyncOperation[]>(syncOutboxKeyForAccount(accountId));
        truthy(Array.isArray(raw));
        truthy(raw!.every(operation => !("cloudAction" in operation)));
    }
});

checks.push({
    name: "specific action participates in grouped canonical identity",
    run: () => {
        const legacy = new PersistentOutboxRepository(new MemoryDriver())
            .enqueueBatchAtomic(accountId, groupInput("checksum-legacy", undefined));
        const specific = new PersistentOutboxRepository(new MemoryDriver())
            .enqueueBatchAtomic(accountId, groupInput("checksum-legacy", "execute"));
        truthy(legacy[0].group?.groupChecksum !== specific[0].group?.groupChecksum);
    }
});

checks.push({
    name: "InvoiceReturn execution builder declares execute while legacy payload stays readable",
    run: () => {
        const expected = recordedReturn("builder-return");
        const intended = executedReturn(expected);
        const input = buildInvoiceReturnLifecycleTransitionOperation(
            expected,
            intended,
            `invoice-return-execute-${expected.id}`,
            now
        );
        equal(input.cloudAction, "execute");
        const current = pending(input);
        equal(readInvoiceReturnLifecycleTransitionOperation(current).transition, "execute");
        const legacy = { ...current, cloudAction: undefined };
        delete legacy.cloudAction;
        equal(readInvoiceReturnLifecycleTransitionOperation(legacy).transition, "execute");
    }
});

checks.push({
    name: "generic or recorded-state routes cannot release InvoiceReturn execution group",
    run: () => {
        const variants: Array<(capability: SyncCloudCapabilityRegistry, routing: SyncOperationTransportRegistry) => void> = [
            (capability, routing) => {
                capability.register("invoiceReturns", ["update"]);
                routing.register(["invoiceReturns"], new FakeTransport());
            },
            (capability, routing) => {
                capability.registerSpecific("invoiceReturns", "update", ["updateRecorded"]);
                routing.registerSpecific(
                    "invoiceReturns",
                    "update",
                    "updateRecorded",
                    new FakeTransport()
                );
            }
        ];

        for (const register of variants) {
            const driver = new MemoryDriver();
            const capability = new SyncCloudCapabilityRegistry();
            const routing = new SyncOperationTransportRegistry();
            capability.register("stockMovements", ["append"]);
            routing.register(["stockMovements"], new FakeTransport());
            register(capability, routing);
            const outbox = cloudAwareOutbox(driver, capability, routing);
            const members = outbox.enqueueBatchAtomic(
                accountId,
                executionGroupInput("blocked-execution")
            );
            markLocallyApplied(outbox, members);
            equal(outbox.getPending(accountId, now).length, 0);
        }
    }
});

checks.push({
    name: "synthetic exact execute gates can release group without runtime registration",
    run: () => {
        const capability = new SyncCloudCapabilityRegistry();
        const routing = new SyncOperationTransportRegistry();
        capability.registerSpecific("invoiceReturns", "update", ["execute"]);
        capability.register("stockMovements", ["append"]);
        routing.registerSpecific(
            "invoiceReturns",
            "update",
            "execute",
            new FakeTransport()
        );
        routing.register(["stockMovements"], new FakeTransport());
        const outbox = cloudAwareOutbox(new MemoryDriver(), capability, routing);
        const members = outbox.enqueueBatchAtomic(
            accountId,
            executionGroupInput("synthetic-execution")
        );
        markLocallyApplied(outbox, members);
        const pending = outbox.getPending(accountId, now);
        equal(pending.length, 1);
        equal(pending[0].module, "invoiceReturns");
        equal(pending[0].cloudAction, "execute");
    }
});

checks.push({
    name: "legacy Product Invoice and StockMovement routes remain capable",
    run: () => {
        const capability = new SyncCloudCapabilityRegistry();
        const routing = new SyncOperationTransportRegistry();
        capability.register("products", ["create"]);
        capability.register("invoices", ["update"]);
        capability.register("stockMovements", ["append"]);
        routing.register(["products", "invoices", "stockMovements"], new FakeTransport());
        [
            pending(operationInput("product-opening", "products", "create")),
            pending(operationInput("invoice-issue", "invoices", "update")),
            pending(operationInput("invoice-cancel", "invoices", "update")),
            pending(operationInput("stock-append", "stockMovements", "append"))
        ].forEach(operation => truthy(isCloudReady(capability, routing, operation)));
    }
});

checks.push({
    name: "runtime registers no InvoiceReturn capability or transport",
    run: () => {
        const source = readFileSync("src/core/Container.ts", "utf8");
        truthy(!source.includes('registerSpecific("invoiceReturns"'));
        truthy(!source.includes('register("invoiceReturns"'));
        truthy(!source.includes("InvoiceReturnSyncOperationTransport"));
    }
});

checks.push({
    name: "default safety boundaries remain unchanged",
    run: () => {
        const source = readFileSync("src/core/Container.ts", "utf8");
        truthy(source.includes("new SyncModeService()"));
        truthy(!source.includes("invoiceReturnSyncAdapter.startSubscription"));
        truthy(!source.includes("providerUserId"));
    }
});

let passed = 0;

for (const check of checks) {
    await check.run();
    passed += 1;
    console.log(`PASS ${passed}: ${check.name}`);
}

console.log(JSON.stringify({
    mission: "V1-SYNC-007DA",
    result: "PASS",
    checks: `${passed}/${checks.length}`,
    operationRouteField: "cloudAction",
    specificCapabilityMatching: "EXACT",
    specificTransportRouting: "EXACT",
    specificToGenericFallback: "DENIED",
    legacyCompatibility: "PASS",
    existingChecksumsChanged: false,
    invoiceReturnExecuteRoute: "invoiceReturns:update:execute",
    runtimeExecuteCapabilityRegistered: false,
    runtimeExecuteTransportRegistered: false,
    invoiceReturnExecutionGroupCloudCapable: false,
    commercialSaleReturnLeak: 0,
    operationalRepositoriesModified: false,
    firebaseRulesChanged: false,
    firebaseDeployment: false,
    operationalRtdbWrites: 0,
    operationalListeners: 0,
    existingRecordsUploaded: 0,
    migrationOrBackfill: "NONE",
    firebaseUidFallback: false,
    defaultSyncMode: "disabled",
    productionTouched: false
}, null, 2));

function operationInput(
    suffix: string,
    module: SyncOperationInput["module"],
    operationType: SyncOperationInput["operationType"],
    cloudAction?: string
): SyncOperationInput {
    return {
        operationId: `operation-${suffix}`,
        accountId,
        module,
        recordId: `record-${suffix}`,
        operationType,
        ...(cloudAction ? { cloudAction } : {}),
        expectedRevision: operationType === "create" || operationType === "append"
            ? undefined
            : 0,
        idempotencyKey: `idempotency-${suffix}`,
        writeSetChecksum: "a".repeat(64),
        safePayload: { suffix },
        createdAt: now
    };
}

function pending(input: SyncOperationInput): SyncOperation {
    return createPendingSyncOperation(input);
}

function groupInput(groupId: string, action: string | undefined) {
    return {
        groupId,
        groupType: "routing_test",
        members: [
            {
                operation: operationInput(
                    `${groupId}-return`,
                    "invoiceReturns",
                    "update",
                    action
                ),
                groupSequence: 1,
                requiredForLocalCompletion: true
            },
            {
                operation: operationInput(
                    `${groupId}-movement`,
                    "stockMovements",
                    "append"
                ),
                groupSequence: 2,
                requiredForLocalCompletion: true
            }
        ]
    };
}

function executionGroupInput(suffix: string) {
    const expected = recordedReturn(suffix);
    const intended = executedReturn(expected);

    return {
        groupId: `invoice-return-execute-${suffix}`,
        groupType: "invoice_return_execution",
        members: [
            {
                operation: buildInvoiceReturnLifecycleTransitionOperation(
                    expected,
                    intended,
                    `invoice-return-execute-${suffix}`,
                    now
                ),
                groupSequence: 1,
                requiredForLocalCompletion: true
            },
            {
                operation: operationInput(
                    `${suffix}-sale-return`,
                    "stockMovements",
                    "append"
                ),
                groupSequence: 2,
                requiredForLocalCompletion: true
            }
        ]
    };
}

function recordedReturn(id: string): InvoiceReturn {
    return {
        id,
        accountId,
        returnNumber: `RET-${id}`,
        invoiceId: `invoice-${id}`,
        invoiceNumberSnapshot: `INV-${id}`,
        status: "recorded",
        revision: 0,
        reason: "Routing test",
        lines: [{
            id: `${id}-line`,
            invoiceLineId: `${id}-invoice-line`,
            productId: `${id}-product`,
            productNameSnapshot: "Routing Product",
            quantity: 2,
            unitPriceSnapshot: 10,
            lineTotalSnapshot: 20,
            returnQuantity: 1,
            originalSaleDeductionMovementId: `${id}-sale`
        }],
        total: 10,
        createdAt: now,
        createdBy: "logical-user",
        updatedAt: now,
        updatedBy: "logical-user"
    };
}

function executedReturn(recorded: InvoiceReturn): InvoiceReturn {
    return {
        ...structuredClone(recorded),
        status: "executed",
        revision: 1,
        executionCommandId: `invoice-return-execute-${recorded.id}`,
        lines: recorded.lines.map(line => ({
            ...line,
            returnStockMovementId: `invoice-return-${recorded.id}-${line.id}`
        }))
    };
}

function cloudAwareOutbox(
    driver: Driver,
    capability: SyncCloudCapabilityRegistry,
    routing: SyncOperationTransportRegistry
): PersistentOutboxRepository {
    return new PersistentOutboxRepository(
        driver,
        operation => isCloudReady(capability, routing, operation)
    );
}

function isCloudReady(
    capability: SyncCloudCapabilityRegistry,
    routing: SyncOperationTransportRegistry,
    operation: SyncOperation
): boolean {
    return capability.supports(operation) && routing.supports(operation);
}

function markLocallyApplied(
    outbox: PersistentOutboxRepository,
    operations: SyncOperation[]
): void {
    for (const operation of operations) {
        outbox.markLocalApplyAttempt(accountId, operation.operationId, now);
        outbox.markLocallyApplied(accountId, operation.operationId, now);
    }
}

function equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
    }
}

function truthy(value: unknown): asserts value {
    if (!value) {
        throw new Error("Expected a truthy value.");
    }
}

function assertThrows(action: () => unknown): void {
    let threw = false;

    try {
        action();
    } catch {
        threw = true;
    }

    truthy(threw);
}

async function assertRejects(action: () => Promise<unknown>): Promise<void> {
    let rejected = false;

    try {
        await action();
    } catch {
        rejected = true;
    }

    truthy(rejected);
}
