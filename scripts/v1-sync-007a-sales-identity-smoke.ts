import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import type { Product } from "../src/modules/products/Product.ts";
import { ProductRepository } from "../src/modules/products/repositories/ProductRepository.ts";
import { ProductService } from "../src/modules/products/services/ProductService.ts";
import { ProductValidator } from "../src/modules/products/validators/ProductValidator.ts";
import { InventoryService } from "../src/modules/inventory/services/InventoryService.ts";
import { stockMovementStorageKeyForAccount } from "../src/modules/inventory/persistence/StockMovementPersistenceKey.ts";
import { StockMovementRepository } from "../src/modules/inventory/repositories/StockMovementRepository.ts";
import { StockMovementValidator } from "../src/modules/inventory/validators/StockMovementValidator.ts";
import type { Invoice, InvoiceDraftLineInput } from "../src/modules/sales/Invoice.ts";
import type { InvoiceReturn } from "../src/modules/sales/InvoiceReturn.ts";
import { invoiceStorageKeyForAccount } from "../src/modules/sales/persistence/InvoicePersistenceKey.ts";
import { invoiceReturnStorageKeyForAccount } from "../src/modules/sales/persistence/InvoiceReturnPersistenceKey.ts";
import { InvoiceRepository } from "../src/modules/sales/repositories/InvoiceRepository.ts";
import { InvoiceReturnRepository } from "../src/modules/sales/repositories/InvoiceReturnRepository.ts";
import {
    buildInvoiceCancellationCommandId,
    buildInvoiceCancellationMovementIdentity,
    buildInvoiceIssueCommandId,
    buildInvoiceReturnExecutionCommandId,
    buildInvoiceReturnLineId,
    buildInvoiceReturnMovementIdentity,
    buildInvoiceSaleMovementIdentity
} from "../src/modules/sales/SalesIdentity.ts";
import { InvoiceService } from "../src/modules/sales/services/InvoiceService.ts";
import { InvoiceReturnService } from "../src/modules/sales/services/InvoiceReturnService.ts";
import { InvoiceValidator } from "../src/modules/sales/validators/InvoiceValidator.ts";
import { InvoiceReturnValidator } from "../src/modules/sales/validators/InvoiceReturnValidator.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";

const accountId = "logical-account-a";
const userId = "logical-user-a";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    private failNextKey: string | null = null;
    public writeCount = 0;

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

        this.writeCount += 1;
        this.values.set(key, structuredClone(value));
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

    public resetWriteCount(): void {
        this.writeCount = 0;
    }
}

class FakeAuthStateService {
    public getState(): AuthState {
        return authenticatedState();
    }
}

interface Harness {
    driver: MemoryDriver;
    products: ProductService;
    movements: StockMovementRepository;
    inventory: InventoryService;
    invoiceRepository: InvoiceRepository;
    invoices: InvoiceService;
    returnRepository: InvoiceReturnRepository;
    returns: InvoiceReturnService;
}

function createHarness(driver = new MemoryDriver()): Harness {
    const auth = new FakeAuthStateService() as unknown as AuthStateService;
    const products = new ProductService(
        new ProductRepository(driver),
        new ProductValidator(),
        auth
    );
    const movements = new StockMovementRepository(driver);
    const inventory = new InventoryService(
        movements,
        new StockMovementValidator(),
        auth,
        products
    );
    const invoiceRepository = new InvoiceRepository(driver);
    const invoices = new InvoiceService(
        invoiceRepository,
        new InvoiceValidator(),
        auth,
        inventory
    );
    const returnRepository = new InvoiceReturnRepository(driver);
    const returns = new InvoiceReturnService(
        returnRepository,
        new InvoiceReturnValidator(),
        invoiceRepository,
        auth,
        inventory
    );

    return {
        driver,
        products,
        movements,
        inventory,
        invoiceRepository,
        invoices,
        returnRepository,
        returns
    };
}

function addProduct(h: Harness, id: string, quantity = 30): Product {
    const product: Product = {
        id,
        sku: `SKU-${id}`,
        barcode: `BAR-${id}`,
        name: `Product ${id}`,
        description: "Sales identity smoke product",
        images: [],
        category: "Smoke",
        brand: "ABONIBAL",
        unit: "piece",
        purchasePrice: 4,
        salePrice: 10,
        taxRate: 0,
        quantity: 777,
        minimumQuantity: 0,
        isActive: true,
        createdAt: new Date("2026-07-15T10:00:00.000Z"),
        updatedAt: new Date("2026-07-15T10:00:00.000Z")
    };

    deepEqual(h.products.add(product), []);
    truthy(h.inventory.addMovement({
        productId: id,
        type: "opening_balance",
        quantityDelta: quantity,
        reason: "Sales smoke opening stock",
        referenceType: "opening_balance",
        referenceId: id
    }).success);

    return product;
}

function lineInput(line: Invoice["lines"][number]): InvoiceDraftLineInput {
    return {
        id: line.id,
        productId: line.productId,
        productNameSnapshot: line.productNameSnapshot,
        skuSnapshot: line.skuSnapshot,
        barcodeSnapshot: line.barcodeSnapshot,
        unitSnapshot: line.unitSnapshot,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        tax: line.tax
    };
}

interface Check {
    name: string;
    run: () => void | Promise<void>;
}

const checks: Check[] = [];

function check(name: string, run: Check["run"]): void {
    checks.push({ name, run });
}

check("Invoice lines survive edit and reorder under revision CAS", () => {
    const h = createHarness();
    const first = addProduct(h, "product-one");
    const second = addProduct(h, "product-two");
    const created = h.invoices.createDraft({
        customerSnapshot: { displayName: "Snapshot Customer" },
        lines: [
            {
                productId: first.id,
                productNameSnapshot: first.name,
                quantity: 2,
                unitPrice: 10
            },
            {
                productId: second.id,
                productNameSnapshot: second.name,
                quantity: 3,
                unitPrice: 12
            }
        ]
    });
    truthy(created.success && created.invoice);
    const draft = created.invoice as Invoice;
    equal(draft.revision, 0);
    equal(new Set(draft.lines.map(line => line.id)).size, 2);

    const updated = h.invoices.updateDraft(
        draft.id,
        { lines: [...draft.lines].reverse().map(lineInput) },
        0
    );
    truthy(updated.success && updated.invoice);
    equal(updated.invoice.revision, 1);
    deepEqual(
        updated.invoice.lines.map(line => line.id),
        [...draft.lines].reverse().map(line => line.id)
    );
    equal(h.invoices.updateDraft(draft.id, {}, 0).success, false);
});

check("partial issue resumes with deterministic movements and no duplicates", () => {
    const h = createHarness();
    const first = addProduct(h, "issue-one");
    const second = addProduct(h, "issue-two");
    const created = h.invoices.createDraft({
        customerSnapshot: { displayName: "Issue Customer" },
        lines: [
            {
                productId: first.id,
                productNameSnapshot: first.name,
                quantity: 2,
                unitPrice: 10
            },
            {
                productId: second.id,
                productNameSnapshot: second.name,
                quantity: 3,
                unitPrice: 12
            }
        ]
    });
    const draft = requiredInvoice(created.invoice);
    h.driver.failNextWriteFor(invoiceStorageKeyForAccount(accountId));

    equal(h.invoices.markIssued(draft.id).success, false);
    equal(h.invoices.getById(draft.id)?.status, "draft");
    const countAfterFailure = saleMovementCount(h, "sale_deduction");
    equal(countAfterFailure, 2);

    const issued = h.invoices.markIssued(draft.id);
    truthy(issued.success && issued.invoice);
    const issuedInvoice = issued.invoice;
    equal(issuedInvoice.issueCommandId, buildInvoiceIssueCommandId(draft.id));
    equal(saleMovementCount(h, "sale_deduction"), countAfterFailure);

    for (const line of issuedInvoice.lines) {
        const identity = buildInvoiceSaleMovementIdentity(
            issuedInvoice.id,
            line.id
        );
        truthy(identity);
        equal(line.stockMovementId, identity.movementId);
        equal(h.movements.findForAccount(accountId, identity.movementId)
            ?.idempotencyKey, identity.idempotencyKey);
    }

    const retry = h.invoices.markIssued(draft.id);
    truthy(retry.success && retry.invoice);
    equal(saleMovementCount(h, "sale_deduction"), countAfterFailure);
    equal(h.invoices.markIssued(draft.id, "conflicting-command").success, false);
    equal(h.invoices.deleteDraft(draft.id).success, false);
    equal(h.invoiceRepository.removeForAccount(accountId, draft.id), false);

    throws(() => h.invoiceRepository.updateForAccount(
        accountId,
        issuedInvoice.id,
        { ...issuedInvoice, total: issuedInvoice.total + 1, revision: 2 }
    ));

    deepEqual(h.products.update(first.id, {
        name: "Renamed Product",
        salePrice: 99
    }), []);
    equal(h.invoices.getById(draft.id)?.lines
        .find(line => line.productId === first.id)?.productNameSnapshot,
    first.name);
    equal(h.products.find(first.id)?.quantity, 777);
});

check("partial cancellation resumes and exact retry is idempotent", () => {
    const h = createHarness();
    const product = addProduct(h, "cancel-product");
    const draft = requiredInvoice(h.invoices.createDraft({
        lines: [{
            productId: product.id,
            productNameSnapshot: product.name,
            quantity: 4,
            unitPrice: 10
        }]
    }).invoice);
    const issued = requiredInvoice(h.invoices.markIssued(draft.id).invoice);
    const originalMovement = h.movements.findForAccount(
        accountId,
        issued.lines[0].stockMovementId ?? ""
    );
    const originalSnapshot = JSON.stringify(originalMovement);
    h.driver.failNextWriteFor(invoiceStorageKeyForAccount(accountId));

    equal(h.invoices.markCancelled(issued.id, "Customer cancellation").success, false);
    equal(h.invoices.getById(issued.id)?.status, "issued");
    const countAfterFailure = saleMovementCount(h, "sale_return");
    equal(countAfterFailure, 1);

    const cancelled = h.invoices.markCancelled(
        issued.id,
        "Customer cancellation"
    );
    truthy(cancelled.success && cancelled.invoice);
    const cancelledInvoice = cancelled.invoice;
    equal(
        cancelledInvoice.cancellationCommandId,
        buildInvoiceCancellationCommandId(issued.id)
    );
    const identity = buildInvoiceCancellationMovementIdentity(
        issued.id,
        issued.lines[0].id
    );
    truthy(identity);
    equal(cancelledInvoice.lines[0].reversalStockMovementId, identity.movementId);
    equal(saleMovementCount(h, "sale_return"), countAfterFailure);
    equal(JSON.stringify(h.movements.findForAccount(
        accountId,
        originalMovement?.id ?? ""
    )), originalSnapshot);

    truthy(h.invoices.markCancelled(
        issued.id,
        "Customer cancellation"
    ).success);
    equal(saleMovementCount(h, "sale_return"), countAfterFailure);
    equal(h.invoices.markCancelled(issued.id, "Different reason").success, false);
    equal(h.invoices.deleteDraft(issued.id).success, false);
});

check("InvoiceReturn execution recovers, retries exactly, and preserves limits", () => {
    const h = createHarness();
    const product = addProduct(h, "return-product", 20);
    const draft = requiredInvoice(h.invoices.createDraft({
        lines: [{
            productId: product.id,
            productNameSnapshot: product.name,
            quantity: 10,
            unitPrice: 10
        }]
    }).invoice);
    const issued = requiredInvoice(h.invoices.markIssued(draft.id).invoice);
    const invoiceLine = issued.lines[0];
    const recorded = requiredReturn(h.returns.createReturnRecord({
        invoiceId: issued.id,
        reason: "Partial return",
        lines: [{ invoiceLineId: invoiceLine.id, returnQuantity: 6 }]
    }).invoiceReturn);
    equal(recorded.revision, 0);
    equal(
        recorded.lines[0].id,
        buildInvoiceReturnLineId(recorded.id, invoiceLine.id)
    );
    h.driver.failNextWriteFor(invoiceReturnStorageKeyForAccount(accountId));

    equal(h.returns.executeReturn(recorded.id).success, false);
    equal(h.returns.getById(recorded.id)?.status, "recorded");
    const countAfterFailure = returnExecutionMovementCount(h, recorded.id);
    equal(countAfterFailure, 1);

    const executed = h.returns.executeReturn(recorded.id);
    truthy(executed.success && executed.invoiceReturn);
    const executedReturn = executed.invoiceReturn;
    equal(
        executedReturn.executionCommandId,
        buildInvoiceReturnExecutionCommandId(recorded.id)
    );
    const identity = buildInvoiceReturnMovementIdentity(
        recorded.id,
        recorded.lines[0].id
    );
    truthy(identity);
    equal(executedReturn.lines[0].returnStockMovementId, identity.movementId);
    equal(returnExecutionMovementCount(h, recorded.id), countAfterFailure);
    truthy(h.returns.executeReturn(recorded.id).success);
    equal(returnExecutionMovementCount(h, recorded.id), countAfterFailure);
    equal(h.returns.executeReturn(recorded.id, "conflicting-command").success, false);

    const excessive = h.returns.createReturnRecord({
        invoiceId: issued.id,
        reason: "Too much",
        lines: [{ invoiceLineId: invoiceLine.id, returnQuantity: 5 }]
    });
    equal(excessive.success, false);

    const remaining = requiredReturn(h.returns.createReturnRecord({
        invoiceId: issued.id,
        reason: "Remaining quantity",
        lines: [{ invoiceLineId: invoiceLine.id, returnQuantity: 4 }]
    }).invoiceReturn);
    truthy(h.returns.executeReturn(remaining.id).success);
    equal(h.returns.getReturnedQuantity(issued.id, invoiceLine.id), 10);

    throws(() => h.returnRepository.updateForAccount(
        accountId,
        executedReturn.id,
        { ...executedReturn, reason: "Destructive change", revision: 2 }
    ));
});

check("legacy commercial reads are non-destructive", () => {
    const driver = new MemoryDriver();
    const invoiceKey = invoiceStorageKeyForAccount(accountId);
    const returnKey = invoiceReturnStorageKeyForAccount(accountId);
    const legacyInvoice = legacyInvoiceRecord();
    const legacyDraft = legacyDraftInvoiceRecord();
    const legacyReturn = legacyReturnRecord();
    driver.write(invoiceKey, [legacyInvoice, legacyDraft]);
    driver.write(returnKey, [legacyReturn]);
    const beforeInvoices = JSON.stringify(driver.read(invoiceKey));
    const beforeReturns = JSON.stringify(driver.read(returnKey));
    driver.resetWriteCount();

    const invoiceRepository = new InvoiceRepository(driver);
    const returnRepository = new InvoiceReturnRepository(driver);
    equal(invoiceRepository.allForAccount(accountId).length, 2);
    equal(invoiceRepository.allForAccount(accountId)[0].lines[0].id, "");
    equal(returnRepository.allForAccount(accountId).length, 1);
    equal(returnRepository.allForAccount(accountId)[0].lines[0].id, "");
    equal(driver.writeCount, 0);
    equal(JSON.stringify(driver.read(invoiceKey)), beforeInvoices);
    equal(JSON.stringify(driver.read(returnKey)), beforeReturns);
    equal(invoiceRepository.allForAccount(accountId)[0].invoiceNumber, "INV-LEGACY-1");
    equal(returnRepository.allForAccount(accountId)[0].returnNumber, "RET-LEGACY-1");

    const h = createHarness(driver);
    const explicitlySaved = h.invoices.updateDraft(
        "legacy-draft",
        {
            lines: [{
                productId: "legacy-product",
                productNameSnapshot: "Legacy Product",
                quantity: 1,
                unitPrice: 5
            }]
        },
        0
    );
    truthy(explicitlySaved.success && explicitlySaved.invoice);
    truthy(explicitlySaved.invoice.lines[0].id);
    equal(explicitlySaved.invoice.revision, 1);
});

check("sync stays disabled", () => {
    equal(new SyncModeService().getMode(), "disabled");
});

function saleMovementCount(
    h: Harness,
    type: "sale_deduction" | "sale_return"
): number {
    return h.inventory.getAll().filter(movement => movement.type === type).length;
}

function returnExecutionMovementCount(h: Harness, returnId: string): number {
    return h.inventory.getAll().filter(movement =>
        movement.type === "sale_return"
        && movement.referenceId === returnId
    ).length;
}

function requiredInvoice(invoice: Invoice | null): Invoice {
    truthy(invoice);
    return invoice;
}

function requiredReturn(invoiceReturn: InvoiceReturn | null): InvoiceReturn {
    truthy(invoiceReturn);
    return invoiceReturn;
}

function legacyInvoiceRecord(): unknown {
    return {
        id: "legacy-invoice",
        accountId,
        invoiceNumber: "INV-LEGACY-1",
        status: "issued",
        customerSnapshot: { displayName: "Legacy Customer" },
        lines: [{
            productId: "legacy-product",
            productNameSnapshot: "Legacy Product",
            quantity: 1,
            unitPrice: 5,
            discount: 0,
            tax: 0,
            lineSubtotal: 5,
            lineTotal: 5,
            stockMovementId: "legacy-sale"
        }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        createdAt: "2026-01-01T00:00:00.000Z",
        createdBy: userId,
        updatedAt: "2026-01-01T00:00:00.000Z",
        updatedBy: userId,
        issuedAt: "2026-01-01T00:00:00.000Z",
        issuedBy: userId
    };
}

function legacyReturnRecord(): unknown {
    return {
        id: "legacy-return",
        accountId,
        returnNumber: "RET-LEGACY-1",
        invoiceId: "legacy-invoice",
        invoiceNumberSnapshot: "INV-LEGACY-1",
        status: "recorded",
        reason: "Legacy reason",
        lines: [{
            invoiceLineId: "legacy-line",
            productId: "legacy-product",
            productNameSnapshot: "Legacy Product",
            quantity: 1,
            unitPriceSnapshot: 5,
            lineTotalSnapshot: 5,
            returnQuantity: 1
        }],
        total: 5,
        createdAt: "2026-01-02T00:00:00.000Z",
        createdBy: userId,
        updatedAt: "2026-01-02T00:00:00.000Z",
        updatedBy: userId
    };
}

function legacyDraftInvoiceRecord(): unknown {
    return {
        id: "legacy-draft",
        accountId,
        invoiceNumber: "INV-LEGACY-DRAFT",
        status: "draft",
        customerSnapshot: null,
        lines: [{
            productId: "legacy-product",
            productNameSnapshot: "Legacy Product",
            quantity: 1,
            unitPrice: 5,
            discount: 0,
            tax: 0,
            lineSubtotal: 5,
            lineTotal: 5
        }],
        subtotal: 5,
        discount: 0,
        tax: 0,
        total: 5,
        createdAt: "2026-01-03T00:00:00.000Z",
        createdBy: userId,
        updatedAt: "2026-01-03T00:00:00.000Z",
        updatedBy: userId
    };
}

function authenticatedState(): AuthState {
    return {
        status: "authenticated",
        session: {
            account: { id: accountId, name: "Synthetic account" },
            user: {
                id: userId,
                accountId,
                displayName: "Synthetic user",
                role: "owner"
            },
            authenticatedAt: "2026-07-15T10:00:00.000Z"
        }
    };
}

function equal(actual: unknown, expected: unknown): void {
    if (!Object.is(actual, expected)) {
        throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
    }
}

function deepEqual(actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
            `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
        );
    }
}

function truthy(value: unknown): asserts value {
    if (!value) {
        throw new Error("Expected a truthy value.");
    }
}

function throws(action: () => unknown): void {
    let didThrow = false;

    try {
        action();
    } catch {
        didThrow = true;
    }

    if (!didThrow) {
        throw new Error("Expected action to throw.");
    }
}

let passed = 0;

for (const item of checks) {
    try {
        await item.run();
        passed += 1;
        console.log(`PASS ${passed}: ${item.name}`);
    } catch (error) {
        console.error(`FAIL: ${item.name}`);
        throw error;
    }
}

console.log(
    `V1-SYNC-007A Sales identity smoke: PASS (${passed}/${checks.length})`
);
