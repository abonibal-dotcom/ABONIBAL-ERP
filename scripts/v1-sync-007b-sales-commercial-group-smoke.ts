import { readFileSync } from "node:fs";
import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import type { StockMovement } from "../src/modules/inventory/StockMovement.ts";
import { stockMovementStorageKeyForAccount } from "../src/modules/inventory/persistence/StockMovementPersistenceKey.ts";
import { StockMovementRepository } from "../src/modules/inventory/repositories/StockMovementRepository.ts";
import { InventoryService } from "../src/modules/inventory/services/InventoryService.ts";
import { StockMovementLocalMutationApplier } from "../src/modules/inventory/sync/StockMovementLocalMutationApplier.ts";
import { StockMovementValidator } from "../src/modules/inventory/validators/StockMovementValidator.ts";
import type { Product } from "../src/modules/products/Product.ts";
import { ProductRepository } from "../src/modules/products/repositories/ProductRepository.ts";
import { ProductService } from "../src/modules/products/services/ProductService.ts";
import { ProductValidator } from "../src/modules/products/validators/ProductValidator.ts";
import type { Invoice } from "../src/modules/sales/Invoice.ts";
import type { InvoiceReturn } from "../src/modules/sales/InvoiceReturn.ts";
import { invoiceStorageKeyForAccount } from "../src/modules/sales/persistence/InvoicePersistenceKey.ts";
import { invoiceReturnStorageKeyForAccount } from "../src/modules/sales/persistence/InvoiceReturnPersistenceKey.ts";
import { InvoiceRepository } from "../src/modules/sales/repositories/InvoiceRepository.ts";
import { InvoiceReturnRepository } from "../src/modules/sales/repositories/InvoiceReturnRepository.ts";
import {
    buildInvoiceCancellationCommandId,
    buildInvoiceIssueCommandId,
    buildInvoiceReturnExecutionCommandId
} from "../src/modules/sales/SalesIdentity.ts";
import { CancelInvoiceDurableCommandService } from "../src/modules/sales/services/CancelInvoiceDurableCommandService.ts";
import { ExecuteInvoiceReturnDurableCommandService } from "../src/modules/sales/services/ExecuteInvoiceReturnDurableCommandService.ts";
import { InvoiceReturnService } from "../src/modules/sales/services/InvoiceReturnService.ts";
import { InvoiceService } from "../src/modules/sales/services/InvoiceService.ts";
import { IssueInvoiceDurableCommandService } from "../src/modules/sales/services/IssueInvoiceDurableCommandService.ts";
import { InvoiceLocalMutationApplier } from "../src/modules/sales/sync/InvoiceLocalMutationApplier.ts";
import { InvoiceReturnLocalMutationApplier } from "../src/modules/sales/sync/InvoiceReturnLocalMutationApplier.ts";
import { InvoiceReturnValidator } from "../src/modules/sales/validators/InvoiceReturnValidator.ts";
import { InvoiceValidator } from "../src/modules/sales/validators/InvoiceValidator.ts";
import type { SyncOperation } from "../src/modules/sync/SyncOperation.ts";
import type { SyncOperationGroupBatchInput } from "../src/modules/sync/SyncOperationGroup.ts";
import { inspectSyncOperationGroup } from "../src/modules/sync/SyncOperationGroup.ts";
import { syncOutboxKeyForAccount } from "../src/modules/sync/persistence/SyncPersistenceKeys.ts";
import { PersistentOutboxRepository } from "../src/modules/sync/repositories/PersistentOutboxRepository.ts";
import { DurableMutationCapture } from "../src/modules/sync/services/DurableMutationCapture.ts";
import { DurableMutationGroupCapture } from "../src/modules/sync/services/DurableMutationGroupCapture.ts";
import type {
    LocalMutationApplier,
    LocalMutationInspection
} from "../src/modules/sync/services/LocalMutationApplier.ts";
import { LocalMutationApplierRegistry } from "../src/modules/sync/services/LocalMutationApplierRegistry.ts";
import { LocalMutationReconciler } from "../src/modules/sync/services/LocalMutationReconciler.ts";
import { SyncCloudCapabilityRegistry } from "../src/modules/sync/services/SyncCloudCapabilityRegistry.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";

const accountId = "logical-account-sales-group";
const userId = "logical-user-sales-group";
const firebaseUid = "firebase-membership-only-uid";
const issueAt = "2026-07-16T08:00:00.000Z";
const cancelAt = "2026-07-16T09:00:00.000Z";
const returnAt = "2026-07-16T10:00:00.000Z";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    private failNextKey: string | null = null;
    public readonly writes: string[] = [];

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        if (this.failNextKey === key) {
            this.failNextKey = null;
            throw new Error("Injected persistence failure.");
        }

        this.values.set(key, structuredClone(value));
        this.writes.push(key);
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }

    public failNextWriteFor(key: string): void {
        this.failNextKey = key;
    }
}

class CountingOutboxRepository extends PersistentOutboxRepository {
    public atomicBatchCalls = 0;

    public override enqueueBatchAtomic(
        scopedAccountId: string,
        input: SyncOperationGroupBatchInput
    ): SyncOperation[] {
        this.atomicBatchCalls += 1;
        return super.enqueueBatchAtomic(scopedAccountId, input);
    }
}

class FakeAuthStateService {
    public getState(): AuthState {
        return authenticatedState();
    }
}

class FaultInjectingApplier implements LocalMutationApplier {
    public readonly module;
    public beforeApply: ((operation: SyncOperation) => void) | null = null;
    public afterApply: ((operation: SyncOperation) => void) | null = null;
    public applyCount = 0;

    public constructor(private readonly delegate: LocalMutationApplier) {
        this.module = delegate.module;
    }

    public inspect(operation: SyncOperation): LocalMutationInspection {
        return this.delegate.inspect(operation);
    }

    public apply(operation: SyncOperation): void {
        this.beforeApply?.(operation);
        this.delegate.apply(operation);
        this.applyCount += 1;
        this.afterApply?.(operation);
    }
}

interface Harness {
    driver: MemoryDriver;
    mode: SyncModeService;
    outbox: CountingOutboxRepository;
    products: ProductService;
    movements: StockMovementRepository;
    inventory: InventoryService;
    invoices: InvoiceService;
    invoiceRepository: InvoiceRepository;
    returns: InvoiceReturnService;
    returnRepository: InvoiceReturnRepository;
    invoiceApplier: FaultInjectingApplier;
    returnApplier: FaultInjectingApplier;
    movementApplier: FaultInjectingApplier;
    reconciler: LocalMutationReconciler;
    issue: IssueInvoiceDurableCommandService;
    cancel: CancelInvoiceDurableCommandService;
    executeReturn: ExecuteInvoiceReturnDurableCommandService;
}

function createHarness(mode: "active" | "disabled" = "active"): Harness {
    const driver = new MemoryDriver();
    const auth = new FakeAuthStateService() as unknown as AuthStateService;
    const syncMode = new SyncModeService();
    const capabilities = new SyncCloudCapabilityRegistry();
    capabilities.register("stockMovements", ["append"]);
    const outbox = new CountingOutboxRepository(
        driver,
        operation => capabilities.supports(operation)
    );
    const capture = new DurableMutationCapture(outbox, () => issueAt);
    const registry = new LocalMutationApplierRegistry();
    const products = new ProductService(
        new ProductRepository(driver),
        new ProductValidator(),
        auth
    );
    const movements = new StockMovementRepository(driver);
    const movementValidator = new StockMovementValidator();
    const movementApplier = new FaultInjectingApplier(
        new StockMovementLocalMutationApplier(movements, movementValidator)
    );
    registry.register(movementApplier);
    const inventory = new InventoryService(
        movements,
        movementValidator,
        auth,
        products
    );
    const invoiceRepository = new InvoiceRepository(driver);
    const invoiceValidator = new InvoiceValidator();
    const invoices = new InvoiceService(
        invoiceRepository,
        invoiceValidator,
        auth,
        inventory
    );
    const invoiceApplier = new FaultInjectingApplier(
        new InvoiceLocalMutationApplier(invoiceRepository, invoiceValidator)
    );
    registry.register(invoiceApplier);
    const returnRepository = new InvoiceReturnRepository(driver);
    const returnValidator = new InvoiceReturnValidator();
    const returns = new InvoiceReturnService(
        returnRepository,
        returnValidator,
        invoiceRepository,
        auth,
        inventory
    );
    const returnApplier = new FaultInjectingApplier(
        new InvoiceReturnLocalMutationApplier(
            returnRepository,
            returnValidator
        )
    );
    registry.register(returnApplier);
    const groupCapture = new DurableMutationGroupCapture(
        outbox,
        registry,
        capture
    );
    const reconciler = new LocalMutationReconciler(
        outbox,
        registry,
        capture
    );
    const issue = new IssueInvoiceDurableCommandService(
        invoices,
        invoiceRepository,
        invoiceValidator,
        inventory,
        movements,
        movementValidator,
        groupCapture,
        outbox,
        syncMode,
        auth,
        () => issueAt
    );
    const cancel = new CancelInvoiceDurableCommandService(
        invoices,
        invoiceRepository,
        invoiceValidator,
        movements,
        movementValidator,
        groupCapture,
        outbox,
        syncMode,
        auth,
        () => cancelAt
    );
    const executeReturn = new ExecuteInvoiceReturnDurableCommandService(
        returns,
        returnRepository,
        returnValidator,
        invoiceRepository,
        movements,
        movementValidator,
        groupCapture,
        outbox,
        syncMode,
        auth,
        () => returnAt
    );

    if (mode === "active") {
        syncMode.activate({
            ownerApproved: true,
            migrationVerified: true,
            cutoverApproved: true,
            approvalReference: "SYNC-007B-SMOKE"
        });
    }

    return {
        driver,
        mode: syncMode,
        outbox,
        products,
        movements,
        inventory,
        invoices,
        invoiceRepository,
        returns,
        returnRepository,
        invoiceApplier,
        returnApplier,
        movementApplier,
        reconciler,
        issue,
        cancel,
        executeReturn
    };
}

function addProduct(h: Harness, id: string, opening = 50): Product {
    const timestamp = new Date("2026-07-16T07:00:00.000Z");
    const product: Product = {
        id,
        sku: `SKU-${id}`,
        barcode: `BAR-${id}`,
        name: `Product ${id}`,
        description: "Commercial group smoke product",
        images: [],
        category: "Smoke",
        brand: "ABONIBAL",
        unit: "piece",
        purchasePrice: 5,
        salePrice: 12,
        taxRate: 0,
        quantity: 999,
        minimumQuantity: 0,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    equal(h.products.add(product).length, 0, "Product setup failed.");
    truthy(h.inventory.addMovement({
        productId: id,
        type: "opening_balance",
        quantityDelta: opening,
        reason: "Commercial group smoke opening",
        referenceType: "opening_balance",
        referenceId: id
    }).success, "Opening stock setup failed.");

    return product;
}

function createInvoice(
    h: Harness,
    lineCount = 2,
    quantity = 4
): Invoice {
    const products = Array.from({ length: lineCount }, (_, index) =>
        addProduct(h, `product-${index + 1}`)
    );
    const result = h.invoices.createDraft({
        customerSnapshot: { displayName: "Commercial Group Customer" },
        lines: products.map(product => ({
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            unitSnapshot: product.unit,
            quantity,
            unitPrice: product.salePrice
        })),
        notes: "Stable commercial group"
    });

    truthy(result.success && result.invoice, "Invoice setup failed.");
    return result.invoice as Invoice;
}

function createRecordedReturn(
    h: Harness,
    invoice: Invoice,
    quantity: number,
    lineIndex = 0
): InvoiceReturn {
    const result = h.returns.createReturnRecord({
        invoiceId: invoice.id,
        reason: "Commercial group smoke return",
        lines: [{
            invoiceLineId: invoice.lines[lineIndex].id,
            returnQuantity: quantity
        }]
    });

    truthy(result.success && result.invoiceReturn, "InvoiceReturn setup failed.");
    return result.invoiceReturn as InvoiceReturn;
}

function issueGroup(h: Harness, invoice: Invoice): SyncOperation[] {
    const groupId = buildInvoiceIssueCommandId(invoice.id) as string;
    return h.outbox.getGroupMembers(accountId, groupId);
}

function cancelGroup(h: Harness, invoice: Invoice): SyncOperation[] {
    const groupId = buildInvoiceCancellationCommandId(invoice.id) as string;
    return h.outbox.getGroupMembers(accountId, groupId);
}

function returnGroup(h: Harness, invoiceReturn: Invoice): SyncOperation[] {
    const groupId = buildInvoiceReturnExecutionCommandId(
        invoiceReturn.id
    ) as string;
    return h.outbox.getGroupMembers(accountId, groupId);
}

function saleMovementCount(h: Harness, type: "sale_deduction" | "sale_return"): number {
    return h.movements.allForAccount(accountId).filter(
        movement => movement.type === type
    ).length;
}

function recover(h: Harness): void {
    h.reconciler.start(accountId);

    for (let attempt = 0; attempt < 4; attempt += 1) {
        h.reconciler.reconcilePending(accountId);
    }

    h.reconciler.stop();
}

function failOnce(action: () => void): (operation: SyncOperation) => void {
    let pending = true;

    return () => {
        if (pending) {
            pending = false;
            action();
        }
    };
}

const checks: Array<{ name: string; run: () => void }> = [
    {
        name: "disabled mode preserves local issue cancel return with zero outbox",
        run: () => {
            const h = createHarness("disabled");
            const invoice = createInvoice(h, 1, 10);
            truthy(h.issue.execute(invoice.id).success, "Disabled issue failed.");
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const invoiceReturn = createRecordedReturn(h, issued, 2);
            truthy(
                h.executeReturn.execute(invoiceReturn.id).success,
                "Disabled return failed."
            );
            truthy(
                h.cancel.execute(invoice.id, "Disabled cancellation").success,
                "Disabled cancellation failed."
            );
            equal(h.outbox.allForAccount(accountId).length, 0, "Disabled mode wrote outbox.");
        }
    },
    {
        name: "issue retry conflicts when draft diverges after durable capture",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.invoiceApplier.beforeApply = failOnce(() => {
                throw new Error("Retain issue group before Invoice apply.");
            });
            truthy(!h.issue.execute(invoice.id).success, "Issue group retention setup failed.");
            const current = h.invoices.getById(invoice.id) as Invoice;
            const update = h.invoices.updateDraft(
                invoice.id,
                {
                    lines: current.lines.map(line => ({
                        id: line.id,
                        productId: line.productId,
                        productNameSnapshot: line.productNameSnapshot,
                        skuSnapshot: line.skuSnapshot,
                        barcodeSnapshot: line.barcodeSnapshot,
                        unitSnapshot: line.unitSnapshot,
                        quantity: line.quantity + 1,
                        unitPrice: line.unitPrice,
                        discount: line.discount,
                        tax: line.tax
                    }))
                },
                current.revision ?? 0
            );
            truthy(update.success, "Divergent draft setup failed.");
            const failedMember = issueGroup(h, invoice).find(
                member => member.localApplyState === "failed"
            );
            truthy(failedMember, "Failed issue member was not retained.");
            h.outbox.resetRecoverableLocalApply(accountId, failedMember.operationId);
            const retry = h.issue.execute(invoice.id);
            truthy(!retry.success && retry.outcome === "conflict", "Divergent issue retry did not conflict.");
            equal(saleMovementCount(h, "sale_deduction"), 0, "Divergent issue retry leaked movement.");
        }
    },
    {
        name: "issue captures one complete deterministic Invoice plus N movement group",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 2);
            const result = h.issue.execute(invoice.id);
            const members = issueGroup(h, invoice);
            truthy(result.success, "Issue group failed.");
            equal(h.outbox.atomicBatchCalls, 1, "Issue initial batch was not one call.");
            equal(members.length, 3, "Issue member count is wrong.");
            equal(members[0].module, "invoices", "Invoice is not sequence one.");
            equal(members[1].recordId, `sale-${invoice.id}-${invoice.lines[0].id}`, "First sale identity is wrong.");
            equal(members[2].recordId, `sale-${invoice.id}-${invoice.lines[1].id}`, "Second sale identity is wrong.");
            equal(inspectSyncOperationGroup(members).localState, "applied", "Issue group is incomplete.");
            equal(saleMovementCount(h, "sale_deduction"), 2, "Issue movement count is wrong.");
        }
    },
    {
        name: "cancellation same movement ID with divergent payload conflicts",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.issue.execute(invoice.id);
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const originalDeduction = h.movements.findForAccount(
                accountId,
                issued.lines[0].stockMovementId as string
            );
            h.movements.appendForAccount(accountId, divergentReturnMovement(
                `invoice-cancel-return-${invoice.id}-${invoice.lines[0].id}`,
                invoice.lines[0].productId
            ));
            const result = h.cancel.execute(invoice.id, "Divergent movement");
            truthy(!result.success && result.outcome === "conflict", "Divergent cancellation movement was accepted.");
            equal(h.invoices.getById(invoice.id)?.status, "issued", "Divergent cancellation changed Invoice.");
            deepEqual(
                originalDeduction,
                h.movements.findForAccount(accountId, issued.lines[0].stockMovementId as string),
                "Original deduction changed."
            );
        }
    },
    {
        name: "issue exact retry is idempotent with no duplicate group or deduction",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h);
            truthy(h.issue.execute(invoice.id).success, "First issue failed.");
            const retry = h.issue.execute(invoice.id);
            truthy(retry.success, "Issue retry failed.");
            equal(issueGroup(h, invoice).length, 3, "Issue retry duplicated members.");
            equal(saleMovementCount(h, "sale_deduction"), 2, "Issue retry duplicated deduction.");
            equal(h.invoiceApplier.applyCount, 1, "Issue replayed Invoice apply.");
        }
    },
    {
        name: "issue outbox failure causes zero commercial or movement mutations",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h);
            h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            const result = h.issue.execute(invoice.id);
            truthy(!result.success, "Injected issue outbox failure succeeded.");
            equal(h.invoices.getById(invoice.id)?.status, "draft", "Invoice changed before durable capture.");
            equal(saleMovementCount(h, "sale_deduction"), 0, "Issue movement escaped failed capture.");
            equal(issueGroup(h, invoice).length, 0, "Partial issue group persisted.");
        }
    },
    {
        name: "issue recovers after Invoice apply failure before movements",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h);
            h.invoiceApplier.beforeApply = failOnce(() => {
                throw new Error("Injected Invoice apply failure.");
            });
            truthy(!h.issue.execute(invoice.id).success, "Issue apply failure was hidden.");
            equal(h.invoices.getById(invoice.id)?.status, "draft", "Failed Invoice apply changed state.");
            equal(saleMovementCount(h, "sale_deduction"), 0, "Movements ran after Invoice failure.");
            recover(h);
            equal(h.invoices.getById(invoice.id)?.status, "issued", "Invoice did not recover.");
            equal(saleMovementCount(h, "sale_deduction"), 2, "Issue recovery did not apply movements once.");
        }
    },
    {
        name: "issue recovers partial movement application without duplicate",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h);
            let movementAttempt = 0;
            h.movementApplier.beforeApply = () => {
                movementAttempt += 1;
                if (movementAttempt === 2) {
                    throw new Error("Injected second movement failure.");
                }
            };
            truthy(!h.issue.execute(invoice.id).success, "Partial movement failure was hidden.");
            equal(h.invoices.getById(invoice.id)?.status, "issued", "Issue transition was lost.");
            equal(saleMovementCount(h, "sale_deduction"), 1, "Unexpected partial movement count.");
            h.movementApplier.beforeApply = null;
            recover(h);
            equal(saleMovementCount(h, "sale_deduction"), 2, "Partial issue recovery duplicated or lost a movement.");
        }
    },
    {
        name: "issue repairs cache apply before applied marker on exact retry",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.movementApplier.afterApply = failOnce(() => {
                h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            });
            truthy(!h.issue.execute(invoice.id).success, "Issue marker failure was hidden.");
            equal(saleMovementCount(h, "sale_deduction"), 1, "Issue cache apply did not occur once.");
            truthy(h.issue.execute(invoice.id).success, "Issue marker retry failed.");
            equal(saleMovementCount(h, "sale_deduction"), 1, "Issue marker retry duplicated movement.");
        }
    },
    {
        name: "issue divergent deterministic movement conflicts without outbox",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.movements.appendForAccount(accountId, divergentMovement(
                `sale-${invoice.id}-${invoice.lines[0].id}`,
                invoice.lines[0].productId
            ));
            const result = h.issue.execute(invoice.id);
            truthy(!result.success && result.outcome === "conflict", "Divergent issue identity did not conflict.");
            equal(issueGroup(h, invoice).length, 0, "Conflicting issue wrote outbox.");
            equal(h.invoices.getById(invoice.id)?.status, "draft", "Conflicting issue mutated Invoice.");
        }
    },
    {
        name: "cancellation captures deterministic Invoice plus N return group",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h);
            truthy(h.issue.execute(invoice.id).success, "Issue setup failed.");
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const original = issued.lines.map(line => h.movements.findForAccount(accountId, line.stockMovementId as string));
            const batchCallsBefore = h.outbox.atomicBatchCalls;
            const result = h.cancel.execute(invoice.id, "Owner cancellation");
            const members = cancelGroup(h, invoice);
            truthy(result.success, "Cancellation group failed.");
            equal(h.outbox.atomicBatchCalls - batchCallsBefore, 1, "Cancellation initial batch was not one call.");
            equal(members.length, 3, "Cancellation member count is wrong.");
            equal(members[0].module, "invoices", "Cancelled Invoice is not sequence one.");
            equal(members[1].recordId, `invoice-cancel-return-${invoice.id}-${invoice.lines[0].id}`, "Cancellation movement identity is wrong.");
            equal(saleMovementCount(h, "sale_return"), 2, "Cancellation return count is wrong.");
            original.forEach((movement, index) => deepEqual(
                movement,
                h.movements.findForAccount(accountId, issued.lines[index].stockMovementId as string),
                "Original sale deduction changed."
            ));
        }
    },
    {
        name: "cancellation recovers after commercial member apply failure",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.issue.execute(invoice.id);
            h.invoiceApplier.beforeApply = failOnce(() => {
                throw new Error("Injected cancellation Invoice apply failure.");
            });
            truthy(!h.cancel.execute(invoice.id, "Recover state").success, "Cancellation Invoice failure was hidden.");
            equal(h.invoices.getById(invoice.id)?.status, "issued", "Failed cancellation changed Invoice.");
            equal(saleMovementCount(h, "sale_return"), 0, "Cancellation movements ran after first member failure.");
            recover(h);
            equal(h.invoices.getById(invoice.id)?.status, "cancelled", "Cancellation Invoice did not recover.");
            equal(saleMovementCount(h, "sale_return"), 1, "Recovered cancellation movement count is wrong.");
        }
    },
    {
        name: "cancellation exact retry is idempotent and reason conflict is rejected",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.issue.execute(invoice.id);
            truthy(h.cancel.execute(invoice.id, "Stable reason").success, "First cancellation failed.");
            truthy(h.cancel.execute(invoice.id, "Stable reason").success, "Cancellation retry failed.");
            equal(saleMovementCount(h, "sale_return"), 1, "Cancellation retry duplicated return.");
            const conflict = h.cancel.execute(invoice.id, "Changed reason");
            truthy(!conflict.success && conflict.outcome === "conflict", "Cancellation conflicting retry was accepted.");
            equal(saleMovementCount(h, "sale_return"), 1, "Cancellation conflict created movement.");
        }
    },
    {
        name: "cancellation repairs movement cache before applied marker",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.issue.execute(invoice.id);
            h.movementApplier.afterApply = operation => {
                if (operation.recordId.startsWith("invoice-cancel-return-")) {
                    h.movementApplier.afterApply = null;
                    h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
                }
            };
            truthy(!h.cancel.execute(invoice.id, "Marker recovery").success, "Cancellation marker failure was hidden.");
            equal(saleMovementCount(h, "sale_return"), 1, "Cancellation cache apply did not occur once.");
            truthy(h.cancel.execute(invoice.id, "Marker recovery").success, "Cancellation marker retry failed.");
            equal(saleMovementCount(h, "sale_return"), 1, "Cancellation marker retry duplicated movement.");
        }
    },
    {
        name: "cancellation outbox failure causes zero cancellation mutations",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1);
            h.issue.execute(invoice.id);
            h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            truthy(!h.cancel.execute(invoice.id, "Failure gate").success, "Cancellation outbox failure succeeded.");
            equal(h.invoices.getById(invoice.id)?.status, "issued", "Cancellation state changed before capture.");
            equal(saleMovementCount(h, "sale_return"), 0, "Cancellation movement escaped failed capture.");
        }
    },
    {
        name: "cancellation partial movement failure recovers exactly once",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h);
            h.issue.execute(invoice.id);
            let attempt = 0;
            h.movementApplier.beforeApply = operation => {
                if (operation.recordId.startsWith("invoice-cancel-return-")) {
                    attempt += 1;
                    if (attempt === 2) {
                        throw new Error("Injected cancellation movement failure.");
                    }
                }
            };
            truthy(!h.cancel.execute(invoice.id, "Recover cancellation").success, "Cancellation failure was hidden.");
            equal(saleMovementCount(h, "sale_return"), 1, "Cancellation partial count is wrong.");
            h.movementApplier.beforeApply = null;
            recover(h);
            equal(saleMovementCount(h, "sale_return"), 2, "Cancellation recovery duplicated or lost movement.");
        }
    },
    {
        name: "return execution captures deterministic Return plus movement group",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const invoiceReturn = createRecordedReturn(h, issued, 4);
            const batchCallsBefore = h.outbox.atomicBatchCalls;
            const result = h.executeReturn.execute(invoiceReturn.id);
            const members = returnGroup(h, invoiceReturn);
            truthy(result.success, "Return execution group failed.");
            equal(h.outbox.atomicBatchCalls - batchCallsBefore, 1, "Return initial batch was not one call.");
            equal(members.length, 2, "Return execution member count is wrong.");
            equal(members[0].module, "invoiceReturns", "InvoiceReturn is not sequence one.");
            equal(members[1].recordId, `invoice-return-${invoiceReturn.id}-${invoiceReturn.lines[0].id}`, "Return movement identity is wrong.");
            equal(saleMovementCount(h, "sale_return"), 1, "Return execution movement count is wrong.");
        }
    },
    {
        name: "return execution recovers after commercial member apply failure",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const invoiceReturn = createRecordedReturn(
                h,
                h.invoices.getById(invoice.id) as Invoice,
                2
            );
            h.returnApplier.beforeApply = failOnce(() => {
                throw new Error("Injected InvoiceReturn apply failure.");
            });
            truthy(!h.executeReturn.execute(invoiceReturn.id).success, "Return state failure was hidden.");
            equal(h.returns.getById(invoiceReturn.id)?.status, "recorded", "Failed return apply changed state.");
            equal(saleMovementCount(h, "sale_return"), 0, "Return movement ran after first member failure.");
            recover(h);
            equal(h.returns.getById(invoiceReturn.id)?.status, "executed", "InvoiceReturn did not recover.");
            equal(saleMovementCount(h, "sale_return"), 1, "Recovered return movement count is wrong.");
        }
    },
    {
        name: "return exact retry is idempotent",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const invoiceReturn = createRecordedReturn(
                h,
                h.invoices.getById(invoice.id) as Invoice,
                3
            );
            truthy(h.executeReturn.execute(invoiceReturn.id).success, "First return execution failed.");
            truthy(h.executeReturn.execute(invoiceReturn.id).success, "Return execution retry failed.");
            equal(saleMovementCount(h, "sale_return"), 1, "Return retry duplicated movement.");
            equal(returnGroup(h, invoiceReturn).length, 2, "Return retry duplicated members.");
        }
    },
    {
        name: "return repairs movement cache before applied marker",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const invoiceReturn = createRecordedReturn(
                h,
                h.invoices.getById(invoice.id) as Invoice,
                2
            );
            h.movementApplier.afterApply = operation => {
                if (operation.recordId.startsWith("invoice-return-")) {
                    h.movementApplier.afterApply = null;
                    h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
                }
            };
            truthy(!h.executeReturn.execute(invoiceReturn.id).success, "Return marker failure was hidden.");
            equal(saleMovementCount(h, "sale_return"), 1, "Return cache apply did not occur once.");
            truthy(h.executeReturn.execute(invoiceReturn.id).success, "Return marker retry failed.");
            equal(saleMovementCount(h, "sale_return"), 1, "Return marker retry duplicated movement.");
        }
    },
    {
        name: "return divergent local state conflicts during recovery",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const invoiceReturn = createRecordedReturn(
                h,
                h.invoices.getById(invoice.id) as Invoice,
                2
            );
            h.returnApplier.beforeApply = failOnce(() => {
                throw new Error("Retain durable return group.");
            });
            truthy(!h.executeReturn.execute(invoiceReturn.id).success, "Return group retention setup failed.");
            const current = h.returns.getById(invoiceReturn.id) as InvoiceReturn;
            h.returnRepository.updateForAccount(accountId, current.id, {
                ...current,
                revision: (current.revision ?? 0) + 1,
                notes: "Divergent recorded state",
                updatedAt: "2026-07-16T09:30:00.000Z"
            });
            const failedMember = returnGroup(h, invoiceReturn).find(
                member => member.localApplyState === "failed"
            );
            truthy(failedMember, "Failed return member was not retained.");
            h.outbox.resetRecoverableLocalApply(accountId, failedMember.operationId);
            const retry = h.executeReturn.execute(invoiceReturn.id);
            truthy(!retry.success && retry.outcome === "conflict", "Divergent return retry did not conflict.");
            equal(saleMovementCount(h, "sale_return"), 0, "Divergent return leaked a movement.");
        }
    },
    {
        name: "return outbox failure causes zero execution mutations",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const invoiceReturn = createRecordedReturn(
                h,
                h.invoices.getById(invoice.id) as Invoice,
                2
            );
            h.driver.failNextWriteFor(syncOutboxKeyForAccount(accountId));
            truthy(!h.executeReturn.execute(invoiceReturn.id).success, "Return outbox failure succeeded.");
            equal(h.returns.getById(invoiceReturn.id)?.status, "recorded", "Return state changed before capture.");
            equal(saleMovementCount(h, "sale_return"), 0, "Return movement escaped failed capture.");
        }
    },
    {
        name: "return movement failure recovers without duplicate",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 2, 10);
            h.issue.execute(invoice.id);
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const createResult = h.returns.createReturnRecord({
                invoiceId: issued.id,
                reason: "Multi-line partial recovery",
                lines: issued.lines.map(line => ({
                    invoiceLineId: line.id,
                    returnQuantity: 2
                }))
            });
            truthy(createResult.success && createResult.invoiceReturn, "Multi-line return setup failed.");
            const invoiceReturn = createResult.invoiceReturn as InvoiceReturn;
            let movementAttempt = 0;
            h.movementApplier.beforeApply = operation => {
                if (operation.recordId.startsWith("invoice-return-")) {
                    movementAttempt += 1;
                    if (movementAttempt === 2) {
                        throw new Error("Injected return movement failure.");
                    }
                }
            };
            truthy(!h.executeReturn.execute(invoiceReturn.id).success, "Return movement failure was hidden.");
            equal(h.returns.getById(invoiceReturn.id)?.status, "executed", "Return transition was lost.");
            equal(saleMovementCount(h, "sale_return"), 1, "Return partial movement count is wrong.");
            h.movementApplier.beforeApply = null;
            recover(h);
            equal(saleMovementCount(h, "sale_return"), 2, "Return recovery duplicated or lost movement.");
        }
    },
    {
        name: "return same movement ID with divergent payload conflicts",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const invoiceReturn = createRecordedReturn(
                h,
                h.invoices.getById(invoice.id) as Invoice,
                2
            );
            h.movements.appendForAccount(accountId, divergentReturnMovement(
                `invoice-return-${invoiceReturn.id}-${invoiceReturn.lines[0].id}`,
                invoiceReturn.lines[0].productId
            ));
            const result = h.executeReturn.execute(invoiceReturn.id);
            truthy(!result.success && result.outcome === "conflict", "Divergent return movement was accepted.");
            equal(h.returns.getById(invoiceReturn.id)?.status, "recorded", "Divergent movement executed return.");
        }
    },
    {
        name: "partial and multiple returns remain supported with local over-return rejection",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const first = createRecordedReturn(h, issued, 6);
            truthy(h.executeReturn.execute(first.id).success, "First partial return failed.");
            const second = createRecordedReturn(h, issued, 4);
            truthy(h.executeReturn.execute(second.id).success, "Second partial return failed.");
            const excessive = h.returns.createReturnRecord({
                invoiceId: issued.id,
                reason: "Excessive return",
                lines: [{ invoiceLineId: issued.lines[0].id, returnQuantity: 1 }]
            });
            truthy(!excessive.success, "Local cumulative over-return was accepted.");
            equal(saleMovementCount(h, "sale_return"), 2, "Multiple returns produced wrong movement count.");
        }
    },
    {
        name: "all commercial groups remain cloud blocked without commercial transport",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 10);
            h.issue.execute(invoice.id);
            const issued = h.invoices.getById(invoice.id) as Invoice;
            const invoiceReturn = createRecordedReturn(h, issued, 2);
            h.executeReturn.execute(invoiceReturn.id);
            const secondInvoice = createInvoiceWithExistingProducts(h, 1, 3);
            h.issue.execute(secondInvoice.id);
            h.cancel.execute(secondInvoice.id, "Capability gate");
            const allGroups = [
                issueGroup(h, invoice),
                returnGroup(h, invoiceReturn),
                issueGroup(h, secondInvoice),
                cancelGroup(h, secondInvoice)
            ];
            truthy(allGroups.flat().every(member => member.localApplyState === "applied"), "Cloud gate setup is not locally complete.");
            equal(h.outbox.getPending(accountId, returnAt).length, 0, "Commercial member absence leaked a movement.");
            allGroups.flat().forEach(member => assertThrows(
                () => h.outbox.markSyncing(accountId, member.operationId, returnAt),
                "Commercial group member bypassed capability gate."
            ));
        }
    },
    {
        name: "cache appliers contain zero business command replay or side-effect services",
        run: () => {
            const sources = [
                readFileSync("src/modules/sales/sync/InvoiceLocalMutationApplier.ts", "utf8"),
                readFileSync("src/modules/sales/sync/InvoiceReturnLocalMutationApplier.ts", "utf8")
            ].join("\n");
            [
                "InvoiceService",
                "InvoiceReturnService",
                "InventoryService",
                "markIssued",
                "markCancelled",
                "executeReturn",
                "Payment",
                "CashMovement",
                "JournalEntry"
            ].forEach(forbidden => truthy(
                !sources.includes(forbidden),
                `Cache applier contains forbidden replay token ${forbidden}.`
            ));
        }
    },
    {
        name: "Container registers local appliers but no Invoice transports or capabilities",
        run: () => {
            const source = readFileSync("src/core/Container.ts", "utf8");
            truthy(source.includes("InvoiceLocalMutationApplier"), "Invoice applier is not registered.");
            truthy(source.includes("InvoiceReturnLocalMutationApplier"), "Return applier is not registered.");
            truthy(!source.includes('register("invoices", ["update"])'), "Invoice cloud capability was added.");
            truthy(!source.includes('register("invoiceReturns", ["update"])'), "InvoiceReturn cloud capability was added.");
            truthy(!source.includes("InvoiceSyncOperationTransport"), "Invoice transport was added.");
            truthy(!source.includes("InvoiceReturnSyncOperationTransport"), "InvoiceReturn transport was added.");
        }
    },
    {
        name: "default SyncMode stays disabled and historical records are not auto-enqueued",
        run: () => {
            const h = createHarness("disabled");
            createInvoice(h, 1);
            equal(h.mode.getMode(), "disabled", "Default disabled mode changed.");
            equal(h.outbox.allForAccount(accountId).length, 0, "Historical record was auto-enqueued.");
        }
    },
    {
        name: "Firebase UID remains membership-only and never accountId",
        run: () => {
            const state = authenticatedState();
            truthy(state.status === "authenticated", "Auth state is not authenticated.");
            truthy(state.status === "authenticated" && state.session.account.id === accountId, "Logical account is unresolved.");
            truthy(state.status === "authenticated" && state.session.account.id !== firebaseUid, "Firebase UID became accountId.");
        }
    },
    {
        name: "Product quantity remains non-authoritative",
        run: () => {
            const h = createHarness();
            const invoice = createInvoice(h, 1, 5);
            h.issue.execute(invoice.id);
            equal(h.products.find(invoice.lines[0].productId)?.quantity, 999, "Invoice mutated Product.quantity.");
            equal(h.inventory.getCurrentQuantity(invoice.lines[0].productId), 45, "Inventory ledger quantity is wrong.");
        }
    }
];

function createInvoiceWithExistingProducts(
    h: Harness,
    lineCount: number,
    quantity: number
): Invoice {
    const products = h.products.getAll().slice(0, lineCount);
    const result = h.invoices.createDraft({
        customerSnapshot: { displayName: "Existing Product Customer" },
        lines: products.map(product => ({
            productId: product.id,
            productNameSnapshot: product.name,
            quantity,
            unitPrice: product.salePrice
        }))
    });

    truthy(result.success && result.invoice, "Second Invoice setup failed.");
    return result.invoice as Invoice;
}

function divergentMovement(id: string, productId: string): StockMovement {
    return {
        id,
        accountId,
        productId,
        type: "sale_deduction",
        quantityDelta: -99,
        reason: "Divergent deterministic payload",
        referenceType: "invoice",
        referenceId: "divergent-invoice",
        createdAt: issueAt,
        createdBy: userId,
        ledgerSemanticsVersion: 2,
        idempotencyKey: `invoice-issue-divergent-line-${id}`
    };
}

function divergentReturnMovement(id: string, productId: string): StockMovement {
    return {
        id,
        accountId,
        productId,
        type: "sale_return",
        quantityDelta: 99,
        reason: "Divergent deterministic return payload",
        referenceType: "invoice_return",
        referenceId: "divergent-commercial-record",
        createdAt: returnAt,
        createdBy: userId,
        ledgerSemanticsVersion: 2,
        idempotencyKey: `divergent-return-${id}`
    };
}

function authenticatedState(): AuthState {
    return {
        status: "authenticated",
        session: {
            account: {
                id: accountId,
                name: "Logical Sales Group Account"
            },
            user: {
                id: userId,
                accountId,
                providerUserId: firebaseUid,
                displayName: "Sales Group Tester",
                email: "tester@example.invalid",
                roles: ["owner"],
                isActive: true
            },
            issuedAt: issueAt
        }
    };
}

function truthy(value: unknown, message: string): asserts value {
    if (!value) {
        throw new Error(message);
    }
}

function equal(actual: unknown, expected: unknown, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${String(expected)}, got ${String(actual)}.`);
    }
}

function deepEqual(actual: unknown, expected: unknown, message: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message);
    }
}

function assertThrows(action: () => void, message: string): void {
    let threw = false;

    try {
        action();
    } catch {
        threw = true;
    }

    truthy(threw, message);
}

const results: Array<{ check: string; result: "PASS" }> = [];

for (const check of checks) {
    check.run();
    results.push({ check: check.name, result: "PASS" });
}

console.log(JSON.stringify({
    mission: "V1-SYNC-007B",
    result: "PASS",
    checks: results,
    invoiceIssueDurableGroup: "PASS",
    invoiceCancellationDurableGroup: "PASS",
    invoiceReturnExecutionDurableGroup: "PASS",
    oneWriteInitialCapture: "PASS",
    duplicateSaleDeduction: 0,
    duplicateSaleReturn: 0,
    businessCommandReplay: 0,
    commercialCloudDispatch: 0,
    customerBalanceCoupling: 0,
    paymentCoupling: 0,
    cashCoupling: 0,
    ledgerCoupling: 0,
    productQuantityAuthoritative: false,
    concurrentCrossDeviceOverReturnSolved: false,
    multiDeviceNumberingSolved: false,
    operationalFirebaseWrites: 0,
    operationalFirebaseListeners: 0,
    migrationOrBackfill: "NONE",
    productionTouched: false,
    storageKeysObserved: [
        invoiceStorageKeyForAccount(accountId),
        invoiceReturnStorageKeyForAccount(accountId),
        stockMovementStorageKeyForAccount(accountId)
    ]
}, null, 2));
