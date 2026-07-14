import type { Driver } from "../src/core/persistence/Driver.ts";
import type { AuthState } from "../src/modules/auth/AuthState.ts";
import type { AuthStateService } from "../src/modules/auth/AuthStateService.ts";
import type { Product } from "../src/modules/products/Product.ts";
import { ProductRepository } from "../src/modules/products/repositories/ProductRepository.ts";
import { ProductService } from "../src/modules/products/services/ProductService.ts";
import { ProductValidator } from "../src/modules/products/validators/ProductValidator.ts";
import {
    buildStockMovementReversalIdentity,
    type StockMovement
} from "../src/modules/inventory/StockMovement.ts";
import { stockMovementStorageKeyForAccount } from "../src/modules/inventory/persistence/StockMovementPersistenceKey.ts";
import { StockMovementRepository } from "../src/modules/inventory/repositories/StockMovementRepository.ts";
import { InventoryService } from "../src/modules/inventory/services/InventoryService.ts";
import { StockMovementValidator } from "../src/modules/inventory/validators/StockMovementValidator.ts";
import { InvoiceRepository } from "../src/modules/sales/repositories/InvoiceRepository.ts";
import { InvoiceService } from "../src/modules/sales/services/InvoiceService.ts";
import { InvoiceValidator } from "../src/modules/sales/validators/InvoiceValidator.ts";
import { InvoiceReturnRepository } from "../src/modules/sales/repositories/InvoiceReturnRepository.ts";
import { InvoiceReturnService } from "../src/modules/sales/services/InvoiceReturnService.ts";
import { InvoiceReturnValidator } from "../src/modules/sales/validators/InvoiceReturnValidator.ts";
import { SyncModeService } from "../src/modules/sync/services/SyncModeService.ts";

const accountA = "logical-account-a";
const accountB = "logical-account-b";
const userA = "logical-user-a";
const productId = "product-a";

class MemoryDriver implements Driver {
    private readonly values = new Map<string, unknown>();
    public writeCount = 0;

    public read<T>(key: string): T | null {
        return this.values.has(key)
            ? structuredClone(this.values.get(key)) as T
            : null;
    }

    public write<T>(key: string, value: T): void {
        this.writeCount += 1;
        this.values.set(key, structuredClone(value));
    }

    public remove(key: string): void {
        this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }

    public resetWriteCount(): void {
        this.writeCount = 0;
    }

    public keyCount(): number {
        return this.values.size;
    }
}

class FakeAuthStateService {
    private state: AuthState;

    public constructor(accountId = accountA, userId = userA) {
        this.state = authenticatedState(accountId, userId);
    }

    public getState(): AuthState {
        return this.state;
    }

}

interface InventoryHarness {
    driver: MemoryDriver;
    auth: FakeAuthStateService;
    products: ProductService;
    repository: StockMovementRepository;
    inventory: InventoryService;
}

function createInventoryHarness(
    driver = new MemoryDriver(),
    accountId = accountA,
    userId = userA
): InventoryHarness {
    const auth = new FakeAuthStateService(accountId, userId);
    const authStateService = auth as unknown as AuthStateService;
    const products = new ProductService(
        new ProductRepository(driver),
        new ProductValidator(),
        authStateService
    );
    const repository = new StockMovementRepository(driver);
    const inventory = new InventoryService(
        repository,
        new StockMovementValidator(),
        authStateService,
        products
    );

    return { driver, auth, products, repository, inventory };
}

function addProduct(
    products: ProductService,
    id = productId,
    legacyQuantity = 777
): Product {
    const product: Product = {
        id,
        sku: `SKU-${id}`,
        barcode: `BAR-${id}`,
        name: `Product ${id}`,
        description: "Synthetic domain smoke product",
        images: [],
        category: "Smoke",
        brand: "ABONIBAL",
        unit: "piece",
        purchasePrice: 4,
        salePrice: 6,
        taxRate: 0,
        quantity: legacyQuantity,
        minimumQuantity: 0,
        isActive: true,
        createdAt: new Date("2026-07-15T10:00:00.000Z"),
        updatedAt: new Date("2026-07-15T10:00:00.000Z")
    };

    deepEqual(products.add(product), []);
    return product;
}

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
    return {
        id: "legacy-normal",
        accountId: accountA,
        productId,
        type: "manual_adjustment",
        quantityDelta: 10,
        reason: "Synthetic movement",
        referenceType: "manual",
        createdAt: "2026-07-15T10:00:00.000Z",
        createdBy: userA,
        ...overrides
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

check("legacy normal and voided records remain byte-stable on read", () => {
    const h = createInventoryHarness();
    const records = [
        movement(),
        movement({
            id: "legacy-voided",
            quantityDelta: 5,
            voidedAt: "2026-07-15T11:00:00.000Z",
            voidedBy: userA,
            voidReason: "Legacy void"
        })
    ];
    const key = stockMovementStorageKeyForAccount(accountA);
    h.driver.write(key, records);
    const before = JSON.stringify(h.driver.read(key));
    h.driver.resetWriteCount();

    equal(h.inventory.getCurrentQuantity(productId), 10);
    equal(h.inventory.getAll().length, 2);
    equal(h.driver.writeCount, 0);
    equal(JSON.stringify(h.driver.read(key)), before);
    equal(h.repository.reversalsForAccount(accountA, "legacy-voided").length, 0);
});

check("legacy voided movement cannot create a synthetic reversal", () => {
    const h = createInventoryHarness();
    const key = stockMovementStorageKeyForAccount(accountA);
    h.driver.write(key, [movement({
        id: "legacy-voided",
        voidedAt: "2026-07-15T11:00:00.000Z",
        voidedBy: userA,
        voidReason: "Legacy void"
    })]);
    const before = JSON.stringify(h.driver.read(key));
    h.driver.resetWriteCount();

    const result = h.inventory.reverseMovement(
        "legacy-voided",
        "Must remain legacy"
    );

    equal(result.success, false);
    equal(h.driver.writeCount, 0);
    equal(JSON.stringify(h.driver.read(key)), before);
    equal(h.inventory.getAll().length, 1);
});

check("positive movement reversal is immutable, opposite, and deterministic", () => {
    const h = createInventoryHarness();
    const created = h.inventory.addMovement({
        productId,
        type: "manual_adjustment",
        quantityDelta: 10,
        reason: "Add ten",
        referenceType: "manual"
    });
    truthy(created.success && created.movement);
    const original = created.movement as StockMovement;
    const originalSnapshot = JSON.stringify(original);
    const identity = buildStockMovementReversalIdentity(original.id);
    truthy(identity);

    const reversed = h.inventory.voidMovement(original.id, "Undo ten");
    truthy(reversed.success && reversed.movement);
    const reversal = reversed.movement as StockMovement;

    equal(reversal.id, identity?.movementId);
    equal(reversal.idempotencyKey, identity?.idempotencyKey);
    equal(reversal.type, "reversal");
    equal(reversal.reversalOfMovementId, original.id);
    equal(reversal.reversalReason, "Undo ten");
    equal(reversal.quantityDelta, -10);
    equal(reversal.accountId, original.accountId);
    equal(reversal.productId, original.productId);
    equal(h.inventory.getCurrentQuantity(productId), 0);
    equal(JSON.stringify(h.repository.findForAccount(accountA, original.id)), originalSnapshot);
});

check("exact retry returns one reversal and changed retry conflicts", () => {
    const h = createInventoryHarness();
    const original = h.inventory.addMovement({
        productId,
        type: "manual_adjustment",
        quantityDelta: 4,
        reason: "Add four",
        referenceType: "manual"
    }).movement as StockMovement;
    const first = h.inventory.reverseMovement(original.id, "Undo four");
    const retry = h.inventory.reverseMovement(original.id, "Undo four");
    const changedRetry = h.inventory.reverseMovement(original.id, "Different reason");

    equal(first.success, true);
    equal(retry.success, true);
    equal(retry.movement?.id, first.movement?.id);
    equal(changedRetry.success, false);
    equal(h.repository.reversalsForAccount(accountA, original.id).length, 1);
    equal(h.inventory.getAll().length, 2);
    equal(h.inventory.getCurrentQuantity(productId), 0);
});

check("concurrent-like same-account services create one reversal effect", () => {
    const driver = new MemoryDriver();
    const firstClient = createInventoryHarness(driver);
    const secondClient = createInventoryHarness(driver);
    const original = firstClient.inventory.addMovement({
        productId,
        type: "manual_adjustment",
        quantityDelta: 6,
        reason: "Add six",
        referenceType: "manual"
    }).movement as StockMovement;

    const first = firstClient.inventory.reverseMovement(
        original.id,
        "Concurrent undo"
    );
    const second = secondClient.inventory.reverseMovement(
        original.id,
        "Concurrent undo"
    );

    equal(first.success, true);
    equal(second.success, true);
    equal(first.movement?.id, second.movement?.id);
    equal(firstClient.repository.reversalsForAccount(
        accountA,
        original.id
    ).length, 1);
    equal(firstClient.inventory.getCurrentQuantity(productId), 0);
});

check("negative movement reverses to a positive exact effect", () => {
    const h = createInventoryHarness();
    const original = h.inventory.addMovement({
        productId,
        type: "correction",
        quantityDelta: -3,
        reason: "Remove three",
        referenceType: "correction"
    }).movement as StockMovement;
    const reversed = h.inventory.reverseMovement(original.id, "Undo removal");

    equal(reversed.success, true);
    equal(reversed.movement?.quantityDelta, 3);
    equal(h.inventory.getCurrentQuantity(productId), 0);
    equal(h.inventory.reverseMovement(
        reversed.movement?.id ?? "",
        "Reverse reversal"
    ).success, false);
});

check("repository exposes no mutable void or hard-delete API", () => {
    const h = createInventoryHarness();
    equal("voidForAccount" in h.repository, false);
    equal("clear" in h.repository, false);

    const original = movement({
        id: "immutable-id",
        ledgerSemanticsVersion: 2
    });
    h.repository.appendForAccount(accountA, original);
    equal(h.repository.appendForAccount(accountA, structuredClone(original)).id, original.id);
    throws(() => h.repository.appendForAccount(accountA, {
        ...original,
        quantityDelta: 999
    }));
    equal(h.repository.findForAccount(accountA, original.id)?.quantityDelta, 10);
});

check("opening stock creates once and reverses once", () => {
    const h = createInventoryHarness();
    addProduct(h.products, "opening-product");
    const first = h.inventory.addOpeningBalanceForNewProduct(
        "opening-product",
        10
    );
    const retry = h.inventory.addOpeningBalanceForNewProduct(
        "opening-product",
        10
    );

    equal(first.success, true);
    equal(retry.movement?.id, first.movement?.id);
    equal(h.inventory.getByProductId("opening-product").length, 1);
    equal(h.inventory.getCurrentQuantity("opening-product"), 10);

    const reversed = h.inventory.reverseMovement(
        first.movement?.id ?? "",
        "Opening stock correction"
    );
    equal(reversed.success, true);
    equal(h.inventory.getByProductId("opening-product").length, 2);
    equal(h.inventory.getCurrentQuantity("opening-product"), 0);
});

check("mixed legacy and V2 ledger preserves historical quantity", () => {
    const h = createInventoryHarness();
    const records: StockMovement[] = [
        movement({ id: "legacy-plus-ten", quantityDelta: 10 }),
        movement({
            id: "legacy-voided-plus-five",
            quantityDelta: 5,
            voidedAt: "2026-07-15T11:00:00.000Z",
            voidedBy: userA,
            voidReason: "Legacy void"
        }),
        movement({
            id: "new-minus-three",
            type: "correction",
            referenceType: "correction",
            quantityDelta: -3,
            ledgerSemanticsVersion: 2
        }),
        movement({
            id: "reversal-new-minus-three",
            type: "reversal",
            referenceType: "movement_reversal",
            referenceId: "new-minus-three",
            quantityDelta: 3,
            reason: "Undo minus three",
            ledgerSemanticsVersion: 2,
            reversalOfMovementId: "new-minus-three",
            reversalReason: "Undo minus three",
            idempotencyKey: "stockMovement:reverse:new-minus-three"
        })
    ];
    const key = stockMovementStorageKeyForAccount(accountA);
    h.driver.write(key, records);
    const before = JSON.stringify(h.driver.read(key));
    h.driver.resetWriteCount();

    equal(h.inventory.getCurrentQuantity(productId), 10);
    equal(h.inventory.getCurrentQuantities()[productId], 10);
    equal(h.driver.writeCount, 0);
    equal(JSON.stringify(h.driver.read(key)), before);
});

check("commercial sale movements remain domain-owned", () => {
    const h = createInventoryHarness();
    const original = h.inventory.addMovement({
        productId,
        type: "sale_deduction",
        quantityDelta: -2,
        reason: "Invoice movement",
        referenceType: "invoice",
        referenceId: "invoice-a"
    }).movement as StockMovement;

    equal(h.inventory.reverseMovement(
        original.id,
        "Generic reversal forbidden"
    ).success, false);
    equal(h.inventory.getAll().length, 1);
});

check("cross-account reversal cannot see another account movement", () => {
    const driver = new MemoryDriver();
    const accountAHarness = createInventoryHarness(driver, accountA, userA);
    const original = accountAHarness.inventory.addMovement({
        productId,
        type: "manual_adjustment",
        quantityDelta: 2,
        reason: "Account A movement",
        referenceType: "manual"
    }).movement as StockMovement;
    const accountBHarness = createInventoryHarness(driver, accountB, "logical-user-b");

    equal(accountBHarness.inventory.reverseMovement(
        original.id,
        "Cross-account attempt"
    ).success, false);
    equal(accountAHarness.inventory.getAll().length, 1);
});

check("invoice issue and return preserve their domain movement flow", () => {
    const h = createInventoryHarness();
    const product = addProduct(h.products, "sales-product", 777);
    const opening = h.inventory.addOpeningBalanceForNewProduct(product.id, 10);
    equal(opening.success, true);

    const authStateService = h.auth as unknown as AuthStateService;
    const invoiceRepository = new InvoiceRepository(h.driver);
    const invoices = new InvoiceService(
        invoiceRepository,
        new InvoiceValidator(),
        authStateService,
        h.inventory
    );
    const draft = invoices.createDraft({
        customerSnapshot: { displayName: "Smoke customer" },
        lines: [{
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            unitSnapshot: product.unit,
            quantity: 2,
            unitPrice: product.salePrice
        }]
    });
    truthy(draft.success && draft.invoice);
    const issued = invoices.markIssued(draft.invoice?.id ?? "");
    truthy(issued.success && issued.invoice);
    equal(issued.invoice?.status, "issued");

    const invoiceLine = issued.invoice?.lines[0];
    const deduction = h.repository.findForAccount(
        accountA,
        invoiceLine?.stockMovementId ?? ""
    );
    equal(deduction?.type, "sale_deduction");
    equal(deduction?.ledgerSemanticsVersion, 2);
    equal(h.inventory.getCurrentQuantity(product.id), 8);
    equal(h.inventory.reverseMovement(
        deduction?.id ?? "",
        "Generic Sales reversal forbidden"
    ).success, false);

    const returnRepository = new InvoiceReturnRepository(h.driver);
    const returns = new InvoiceReturnService(
        returnRepository,
        new InvoiceReturnValidator(),
        invoiceRepository,
        authStateService,
        h.inventory
    );
    const recorded = returns.createReturnRecord({
        invoiceId: issued.invoice?.id ?? "",
        reason: "Smoke return",
        lines: [{
            invoiceLineId: invoiceLine?.id ?? "",
            returnQuantity: 1
        }]
    });
    truthy(recorded.success && recorded.invoiceReturn);
    const executed = returns.executeReturn(recorded.invoiceReturn?.id ?? "");
    truthy(executed.success && executed.invoiceReturn);
    const returnMovementId = executed.invoiceReturn?.lines[0]
        ?.returnStockMovementId ?? "";
    const returnMovement = h.repository.findForAccount(
        accountA,
        returnMovementId
    );

    equal(returnMovement?.type, "sale_return");
    equal(returnMovement?.ledgerSemanticsVersion, 2);
    equal(h.inventory.getCurrentQuantity(product.id), 9);
    equal(h.products.find(product.id)?.quantity, 777);
    equal(h.repository.reversalsForAccount(accountA, deduction?.id ?? "").length, 0);
});

check("manual creation cannot bypass the reversal service", () => {
    const h = createInventoryHarness();
    const result = h.inventory.addMovement({
        productId,
        type: "reversal",
        quantityDelta: -1,
        reason: "Bypass attempt",
        referenceType: "movement_reversal",
        referenceId: "original"
    });

    equal(result.success, false);
    equal(h.inventory.getAll().length, 0);
});

check("sync remains disabled with no Firebase integration", () => {
    equal(new SyncModeService().getMode(), "disabled");
    const h = createInventoryHarness();
    equal(h.inventory.getAll().length, 0);
    equal(h.driver.keyCount(), 0);
});

function authenticatedState(accountId: string, userId: string): AuthState {
    return {
        status: "authenticated",
        session: {
            account: {
                id: accountId,
                name: "Synthetic account"
            },
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
    `V1-SYNC-006B StockMovement reversal smoke: PASS (${passed}/${checks.length})`
);
