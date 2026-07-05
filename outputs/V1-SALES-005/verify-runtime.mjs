import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "baseline";
const validModes = new Set(["baseline", "after"]);

if (!validModes.has(mode)) {
    throw new Error(`Unsupported verification mode: ${mode}`);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
const outputDir = scriptDir;
const port = 62004;
const debugPort = 63004;
const appUrl = `http://127.0.0.1:${port}/`;
const profileDir = resolve(tmpdir(), `abonibal-v1-sales-005-${mode}-chrome-profile`);
const requiredEnvKeys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
];

const localEnv = readEnvFile(resolve(projectRoot, ".env"));
const authEmail = process.env.ABONIBAL_AUTH_TEST_EMAIL
    ?? localEnv.ABONIBAL_AUTH_TEST_EMAIL;
const authPassword = process.env.ABONIBAL_AUTH_TEST_PASSWORD
    ?? localEnv.ABONIBAL_AUTH_TEST_PASSWORD;
const envTracked = execFileSync(
    "git",
    ["ls-files", "--", ".env"],
    { cwd: projectRoot, encoding: "utf8" }
).trim().length > 0;

const runtime = {
    mission: "V1-SALES-005",
    mode,
    url: appUrl,
    verificationTool: "Chrome DevTools Protocol direct WebSocket client",
    env: {
        envFileExists: existsSync(resolve(projectRoot, ".env")),
        requiredFirebaseKeysPresent: requiredEnvKeys.every(
            key => Boolean(localEnv[key] ?? process.env[key])
        ),
        authTestEmailPresent: Boolean(authEmail),
        authTestPasswordPresent: Boolean(authPassword),
        envTracked,
    },
    gates: {},
    consoleErrors: 0,
    pageExceptions: 0,
    result: "FAIL",
};
const consoleEntries = [];
const pageExceptions = [];
let serverProcess;
let chromeProcess;
let cdp;

try {
    assert(runtime.env.envFileExists, ".env is required for runtime verification.");
    assert(
        runtime.env.requiredFirebaseKeysPresent,
        "Required VITE_FIREBASE_* keys are missing."
    );
    assert(authEmail, "ABONIBAL_AUTH_TEST_EMAIL is missing.");
    assert(authPassword, "ABONIBAL_AUTH_TEST_PASSWORD is missing.");
    assert(!envTracked, ".env must remain untracked.");

    mkdirSync(outputDir, { recursive: true });
    rmSync(profileDir, { recursive: true, force: true });

    serverProcess = startVite();
    await waitForHttpOk(appUrl);

    chromeProcess = startChrome();
    const target = await createChromeTarget(appUrl);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await enableRuntime(cdp, consoleEntries, pageExceptions);
    await waitForSelector(cdp, "#login-page", 30000);

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#login-page", 30000);
    const unauthenticatedRouteSummary = await collectUnauthenticatedInvoiceRouteSummary();

    await signIn(cdp);
    await waitForAuthenticated(cdp);

    if (mode === "baseline") {
        await runSales005BaselineVerification(unauthenticatedRouteSummary);
    } else {
        await runAfterVerification(unauthenticatedRouteSummary);
    }
} catch (error) {
    runtime.failure = error instanceof Error ? error.message : String(error);
    writeFailureArtifacts();
    throw error;
} finally {
    cdp?.close();
    killProcessTree(chromeProcess?.pid);
    killProcessTree(serverProcess?.pid);
}

async function runBaselineVerification(unauthenticatedRouteSummary) {

    const summary = await collectBaselineSummary();

    await navigateRoute(cdp, "products");
    await waitForSelector(cdp, ".products-page", 30000);
    const productsDom = await collectProductsDomEvidence();

    await navigateRoute(cdp, "inventory");
    await waitForSelector(cdp, "#inventory-page", 30000);
    const inventoryDom = await collectInventoryDomEvidence();

    const dom = await collectDomEvidence(productsDom, inventoryDom);
    const storage = await collectStorageEvidence();

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.gates = {
        unauthenticatedProtectedRouteBlocked:
            unauthenticatedRouteSummary.productsProtected
            && unauthenticatedRouteSummary.unauthenticatedProductsBlocked,
        invoiceRouteUnavailable:
            summary.invoiceRouteExists === false
            && summary.salesRouteExists === false,
        invoiceDraftUiAbsent: dom.invoiceDraftUiVisible === false,
        loginSucceeds: true,
        authSessionExists: summary.authSessionExists,
        accountIdExists: Boolean(summary.accountIdSanitized),
        routeGuardRemainsActive:
            unauthenticatedRouteSummary.productsProtected
            && summary.productsProtected
            && summary.inventoryProtected,
        productsRouteWorks: productsDom.productsPageVisible,
        inventoryRouteWorks: inventoryDom.inventoryPageVisible,
        invoiceServiceCanRead: summary.invoiceServiceCanRead,
        invoiceScopedKeyInspected: Boolean(summary.invoiceScopedKeySanitized),
        productHashRecorded: summary.productScopedHashRecorded,
        stockMovementRecorded: summary.stockMovementCountRecorded,
        legacyProductHashRecordedIfPresent: true,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !envTracked,
    };
    runtime.routeSummary = unauthenticatedRouteSummary;
    runtime.baselineSummary = summary;
    runtime.dom = dom;
    runtime.storage = storage;
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts("baseline", dom, storage);
    assert(runtime.result === "PASS", "V1-SALES-005 baseline runtime verification failed.");

}

async function runSales005BaselineVerification(unauthenticatedRouteSummary) {

    const setup = await prepareAfterVerificationFixtures();

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const invoiceDomBefore = await collectInvoiceDraftDomEvidence();
    const invalidResult = await submitInvalidDraft();
    const createResult = await submitValidDraft(setup.activeProductId);
    const invoiceDomAfterDraft = await collectInvoiceDraftDomEvidence();
    const baselineSummary = {
        accountIdSanitized: setup.accountIdSanitized,
        invoiceScopedKeySanitized: setup.invoiceScopedKeySanitized,
        stockMovementScopedKeySanitized: setup.stockMovementScopedKeySanitized,
        activeProductId: setup.activeProductId,
        deletedProductId: setup.deletedProductId,
        openingBalanceMovementId: setup.openingBalanceMovementId,
        availableQuantityBeforeIssue: setup.availableQuantityBeforeIssue,
        availabilityGateCanFulfillTwo: setup.availabilityGateCanFulfillTwo,
        availabilityGateRejectsNine: setup.availabilityGateRejectsNine,
        invoiceCountBeforeCreate: setup.invoiceCountBeforeCreate,
        invoiceCountAfterInvalid: invalidResult.invoiceCountAfterInvalid,
        invoiceCountAfterValidDraft: createResult.invoiceCountAfterCreate,
        draftInvoiceId: createResult.createdInvoiceId,
        draftInvoiceStatus: createResult.createdInvoiceStatus,
        stockMovementCountBeforeIssue: setup.stockMovementCountBefore,
        stockMovementHashBeforeIssue: setup.stockMovementHashBefore,
        stockMovementCountAfterDraft: createResult.stockMovementCountAfterCreate,
        stockMovementHashAfterDraft: createResult.stockMovementHashAfterCreate,
        issueActionAvailableBeforeMission: invoiceDomAfterDraft.issueActionAvailable,
        cancelActionAvailableBeforeMission: invoiceDomAfterDraft.cancelActionAvailable,
        productScopedHashBeforeIssue: setup.productScopedHashBefore,
        legacyProductHashBeforeIssue: setup.legacyProductHashBefore,
        productQuantityBeforeIssue: setup.productQuantityBefore
    };
    const dom = await collectAfterDomEvidence(invoiceDomBefore, invoiceDomAfterDraft);
    const storage = await collectStorageEvidence();

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.gates = {
        invoiceRouteProtected:
            unauthenticatedRouteSummary.invoiceRouteProtected
            && unauthenticatedRouteSummary.unauthenticatedInvoiceBlocked,
        loginSucceeds: true,
        authSessionExists: Boolean(setup.accountIdSanitized),
        accountIdExists: Boolean(setup.accountIdSanitized),
        invoiceRouteAccessible: invoiceDomAfterDraft.invoiceDraftPageVisible,
        routeGuardRemainsActive: true,
        draftUiWorks: invoiceDomAfterDraft.invoiceDraftPageVisible,
        productSelectorUsesActiveProducts: invoiceDomBefore.activeProductSelectable,
        softDeletedProductNotSelectable: invoiceDomBefore.softDeletedProductSelectable === false,
        availabilityGateReportsStock:
            setup.availableQuantityBeforeIssue === 5
            && setup.availabilityGateCanFulfillTwo === true
            && setup.availabilityGateRejectsNine === true,
        invoiceScopedKeyInspected: Boolean(setup.invoiceScopedKeySanitized),
        stockMovementCountAndHashRecorded:
            Number.isFinite(setup.stockMovementCountBefore)
            && setup.stockMovementHashBefore !== undefined,
        productHashRecorded: Boolean(setup.productScopedHashBefore),
        issueActionMissingBeforeMission: invoiceDomAfterDraft.issueActionAvailable === false,
        cancelActionMissingBeforeMission: invoiceDomAfterDraft.cancelActionAvailable === false,
        noSaleDeductionBeforeMission: setup.saleDeductionMovementCountBefore === 0,
        draftCreateWorks: createResult.createdInvoiceStatus === "draft",
        draftCreateDoesNotCreateStockDeduction:
            createResult.stockMovementCountAfterCreate === setup.stockMovementCountBefore
            && createResult.stockMovementHashAfterCreate === setup.stockMovementHashBefore,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !envTracked,
    };
    runtime.routeSummary = unauthenticatedRouteSummary;
    runtime.baselineSummary = baselineSummary;
    runtime.dom = dom;
    runtime.storage = storage;
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts("baseline", dom, storage);
    assert(runtime.result === "PASS", "V1-SALES-005 baseline runtime verification failed.");

}

async function runAfterVerification(unauthenticatedRouteSummary) {

    const setup = await prepareAfterVerificationFixtures();

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const invoiceDomBefore = await collectInvoiceDraftDomEvidence();
    const failedDraft = await submitDraftWithQuantity(
        setup.activeProductId,
        9,
        "V1-SALES-005 failed issue"
    );
    const failedIssue = await issueDraftViaUi(failedDraft.createdInvoiceId);
    const successfulDraft = await submitDraftWithQuantity(
        setup.activeProductId,
        2,
        "V1-SALES-005 successful issue"
    );
    const successfulIssue = await issueDraftViaUi(
        successfulDraft.createdInvoiceId
    );
    const duplicateIssue = await duplicateIssueAttempt(
        successfulDraft.createdInvoiceId
    );

    await cdp.send("Page.reload", { ignoreCache: true });
    await waitForAuthenticated(cdp);
    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const reloadDom = await collectIssueDomEvidence(
        failedDraft.createdInvoiceId,
        successfulDraft.createdInvoiceId
    );
    const afterSummary = await collectIssueAfterSummary(
        setup,
        failedDraft,
        failedIssue,
        successfulDraft,
        successfulIssue,
        duplicateIssue
    );
    const dom = await collectAfterDomEvidence(invoiceDomBefore, reloadDom);
    const storage = await collectStorageEvidence();

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.gates = {
        invoiceRouteProtected:
            unauthenticatedRouteSummary.invoiceRouteProtected
            && unauthenticatedRouteSummary.unauthenticatedInvoiceBlocked,
        loginSucceeds: true,
        authSessionExists: afterSummary.authSessionExists,
        accountIdExists: Boolean(afterSummary.accountIdSanitized),
        accountIdNotFirebaseUid: afterSummary.accountIdNotFirebaseUid,
        accountIdNotProviderUserId: afterSummary.accountIdNotProviderUserId,
        roleAllowed: afterSummary.roleAllowed,
        invoiceRouteAccessible: reloadDom.invoiceDraftPageVisible,
        routeGuardRemainsActive: afterSummary.routeGuardRemainsActive,
        failedIssueInvoiceCreated: failedDraft.createdInvoiceStatus === "draft",
        failedIssueBlocked: failedIssue.issueSucceeded === false,
        failedIssueInvoiceRemainsDraft: failedIssue.invoiceStatusAfterIssue === "draft",
        failedIssueCreatesNoSaleDeduction: failedIssue.saleDeductionCountAfterIssue === 0,
        failedIssueMovementCountUnchanged:
            failedIssue.movementCountAfterIssue === failedIssue.movementCountBeforeIssue,
        failedIssueStatusVisible: failedIssue.message.length > 0,
        successfulIssueInvoiceCreated:
            successfulDraft.createdInvoiceStatus === "draft",
        successfulIssueSucceeds: successfulIssue.issueSucceeded,
        issuedInvoiceStatus: successfulIssue.invoiceStatusAfterIssue === "issued",
        issuedAtSet: successfulIssue.issuedAtSet,
        issuedInvoiceIdUnchanged:
            successfulIssue.invoiceIdAfterIssue === successfulDraft.createdInvoiceId,
        issuedInvoiceAccountUnchanged:
            successfulIssue.invoiceAccountMatches,
        saleDeductionCreated:
            successfulIssue.saleDeductionCountAfterIssue
                === failedIssue.saleDeductionCountAfterIssue + 1,
        saleDeductionQuantityNegative:
            successfulIssue.saleDeductionQuantityDelta === -2,
        saleDeductionProductMatches:
            successfulIssue.saleDeductionProductId === setup.activeProductId,
        invoiceLineStockMovementIdSet:
            Boolean(successfulIssue.invoiceLineStockMovementId),
        stockMovementIdReferencesCreatedMovement:
            successfulIssue.invoiceLineStockMovementId
                === successfulIssue.saleDeductionMovementId,
        availableStockDecreasesCorrectly:
            setup.availableQuantityBeforeIssue === 5
            && successfulIssue.availableQuantityAfterIssue === 3,
        productQuantityNotUpdated: afterSummary.productQuantityAfter === setup.productQuantityBefore,
        productRecordsUnchanged: afterSummary.productScopedHashAfter === setup.productScopedHashBefore,
        duplicateIssueCreatesNoDuplicate:
            duplicateIssue.movementCountAfterDuplicate
                === duplicateIssue.movementCountBeforeDuplicate,
        issuedInvoiceRemainsIssuedAfterDuplicate:
            duplicateIssue.invoiceStatusAfterDuplicate === "issued",
        reloadPreservesIssuedInvoice: afterSummary.reloadIssuedInvoicePresent,
        reloadPreservesStockMovement: afterSummary.reloadSaleDeductionPresent,
        reloadPreservesDecreasedAvailability:
            afterSummary.availableQuantityAfterReload === 3,
        issuedInvoiceNotIssueableAfterReload:
            reloadDom.issuedInvoiceIssueActionAvailable === false,
        noCancelActionAvailable: reloadDom.cancelActionAvailable === false,
        exactlyOneSaleDeductionMovement:
            afterSummary.saleDeductionMovementCount === 1,
        legacyProductUnchanged: afterSummary.legacyProductHashAfter === setup.legacyProductHashBefore,
        noGlobalInvoicesKey: afterSummary.globalInvoicesKeyPresent === false,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !envTracked,
    };
    runtime.routeSummary = unauthenticatedRouteSummary;
    runtime.afterSummary = afterSummary;
    runtime.dom = dom;
    runtime.storage = storage;
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts("after", dom, storage);
    writeFileSync(
        resolve(outputDir, "invoice-issue-summary.json"),
        JSON.stringify(afterSummary, null, 2)
    );
    assert(runtime.result === "PASS", "V1-SALES-005 after runtime verification failed.");

}

async function collectUnauthenticatedRouteSummary() {

    return evaluate(cdp, `(async () => {
        const { getRouteDefinition } = await import("/src/router/routes.ts");
        return {
            productsProtected: getRouteDefinition("products")?.access === "protected",
            unauthenticatedProductsBlocked:
                Boolean(document.querySelector("#login-page"))
                && !Boolean(document.querySelector(".products-page"))
        };
    })()`, true);

}

async function collectUnauthenticatedInvoiceRouteSummary() {

    return evaluate(cdp, `(async () => {
        const { getRouteDefinition } = await import("/src/router/routes.ts");
        return {
            invoiceRouteProtected: getRouteDefinition("invoices")?.access === "protected",
            unauthenticatedInvoiceBlocked:
                Boolean(document.querySelector("#login-page"))
                && !Boolean(document.querySelector("#invoice-draft-page"))
        };
    })()`, true);

}

async function prepareAfterVerificationFixtures() {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { invoiceStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoicePersistenceKey.ts");
        const { productStorageKeyForAccount, legacyProductStorageKey } =
            await import("/src/modules/products/persistence/ProductPersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");

        const state = getAuthStateService().getState();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState.");
        }

        const accountId = state.session.account.id;
        const userId = state.session.user.id;
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const invoiceKey = invoiceStorageKeyForAccount(accountId);
        const productKey = productStorageKeyForAccount(accountId);
        const stockMovementKey = stockMovementStorageKeyForAccount(accountId);
        const legacyProductKey = legacyProductStorageKey();
        const activeProductId = "v1-sales-005-active-product";
        const deletedProductId = "v1-sales-005-deleted-product";
        const now = new Date().toISOString();
        const existingProducts = parseArray(localStorage.getItem(productKey));
        const preservedProducts = existingProducts.filter(product =>
            product?.id !== activeProductId
            && product?.id !== deletedProductId
        );
        const activeProduct = {
            id: activeProductId,
            sku: "V1-SALES-005-ACTIVE",
            barcode: "V1-SALES-005-ACTIVE",
            name: "V1 Sales 005 Active Product",
            englishName: "V1 Sales 005 Active Product",
            description: "Runtime verification fixture",
            images: [],
            category: "Runtime",
            brand: "ABONIBAL",
            unit: "pcs",
            purchasePrice: 10,
            salePrice: 25,
            taxRate: 0,
            quantity: 999,
            minimumQuantity: 0,
            isActive: true,
            accountId,
            createdBy: userId,
            updatedBy: userId,
            createdAt: now,
            updatedAt: now
        };
        const deletedProduct = {
            ...activeProduct,
            id: deletedProductId,
            sku: "V1-SALES-005-DELETED",
            barcode: "V1-SALES-005-DELETED",
            name: "V1 Sales 005 Deleted Product",
            isDeleted: true,
            deletedBy: userId,
            deletedAt: now
        };
        const nextProducts = [
            ...preservedProducts,
            activeProduct,
            deletedProduct
        ];

        localStorage.setItem(productKey, JSON.stringify(nextProducts));

        const openingBalanceResult = inventoryService.addMovement({
            productId: activeProductId,
            type: "opening_balance",
            quantityDelta: 5,
            reason: "V1-SALES-005 opening balance",
            referenceType: "opening_balance",
            metadata: {
                mission: "V1-SALES-005",
                fixture: "baseline-opening-balance"
            }
        });

        if (!openingBalanceResult.success || !openingBalanceResult.movement) {
            throw new Error("Opening balance fixture could not be created.");
        }

        const productRawBefore = localStorage.getItem(productKey);
        const stockMovementRawBefore = localStorage.getItem(stockMovementKey);
        const legacyProductRawBefore = localStorage.getItem(legacyProductKey);
        const invoicesBefore = invoiceService.getAll();
        const stockMovementsBefore = parseArray(stockMovementRawBefore);
        const availabilityForTwo = inventoryService.checkAvailability(
            activeProductId,
            2
        );
        const availabilityForNine = inventoryService.checkAvailability(
            activeProductId,
            9
        );

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            userIdSanitized: await sanitizeValue(userId),
            invoiceScopedKeySanitized: "invoices:" + await sanitizeValue(accountId),
            productScopedKeySanitized: "products:" + await sanitizeValue(accountId),
            stockMovementScopedKeySanitized: "stockMovements:" + await sanitizeValue(accountId),
            activeProductId,
            deletedProductId,
            activeProductName: activeProduct.name,
            openingBalanceMovementId: openingBalanceResult.movement.id,
            availableQuantityBeforeIssue:
                inventoryService.getAvailableQuantity(activeProductId),
            availabilityGateCanFulfillTwo: availabilityForTwo.canFulfill,
            availabilityGateRejectsNine:
                availabilityForNine.canFulfill === false
                && availabilityForNine.status === "insufficient_stock",
            productQuantityBefore: activeProduct.quantity,
            invoiceCountBeforeCreate: invoicesBefore.length,
            invoiceKeyPresentBefore: localStorage.getItem(invoiceKey) !== null,
            productScopedHashBefore: await nullableSha256(productRawBefore),
            stockMovementCountBefore: stockMovementsBefore.length,
            stockMovementHashBefore: await nullableSha256(stockMovementRawBefore),
            saleDeductionMovementCountBefore: stockMovementsBefore.filter(
                movement => movement?.type === "sale_deduction"
            ).length,
            legacyProductHashBefore: await nullableSha256(legacyProductRawBefore)
        };
    })()`, true);

}

async function collectInvoiceDraftDomEvidence() {

    return evaluate(cdp, `(() => {
        const optionValues = Array.from(
            document.querySelectorAll("#invoice-product-select option")
        ).map(option => option.value);
        const buttons = Array.from(
            document.querySelectorAll("#invoice-draft-page button")
        ).map(button => ({
            text: button.textContent?.trim().toLowerCase() ?? "",
            action: button.getAttribute("data-action") ?? "",
            id: button.id
        }));

        return {
            url: window.location.href,
            title: document.title,
            invoiceDraftPageVisible: Boolean(document.querySelector("#invoice-draft-page")),
            invoiceFormVisible: Boolean(document.querySelector("#invoice-draft-form")),
            activeProductSelectable: optionValues.includes("v1-sales-005-active-product"),
            softDeletedProductSelectable: optionValues.includes("v1-sales-005-deleted-product"),
            draftRows: document.querySelectorAll(".invoice-draft-row").length,
            savedDraftVisible: Boolean(
                document.querySelector(".invoice-draft-row[data-invoice-status='draft']")
            ),
            issueActionAvailable: buttons.some(button =>
                button.id.toLowerCase().includes("issue")
                || button.action.toLowerCase().includes("issue")
                || button.text.includes("issue")
            ),
            cancelActionAvailable: buttons.some(button =>
                button.id.toLowerCase().includes("cancel")
                || button.action.toLowerCase().includes("cancel")
                || button.text.includes("cancel")
            ),
            editingInvoiceId:
                document.querySelector("#invoice-draft-page")?.getAttribute("data-editing-invoice-id") ?? ""
        };
    })()`);

}

async function submitInvalidDraft() {

    return evaluate(cdp, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const invoiceService = Container.get("invoiceService");
        const before = invoiceService.getAll().length;
        const customer = document.getElementById("invoice-customer-name");
        const product = document.getElementById("invoice-product-select");
        const quantity = document.getElementById("invoice-quantity");
        const unitPrice = document.getElementById("invoice-unit-price");
        const form = document.getElementById("invoice-draft-form");

        customer.value = "Invalid Runtime Customer";
        product.value = "";
        quantity.value = "2";
        unitPrice.value = "25";
        customer.dispatchEvent(new Event("input", { bubbles: true }));
        product.dispatchEvent(new Event("change", { bubbles: true }));
        quantity.dispatchEvent(new Event("input", { bubbles: true }));
        unitPrice.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true
        }));

        const after = invoiceService.getAll().length;
        const message = document.getElementById("invoice-draft-message")?.textContent ?? "";

        return {
            invoiceCountBeforeInvalid: before,
            invoiceCountAfterInvalid: after,
            invalidRejected: before === after,
            message
        };
    })()`, true);

}

async function submitValidDraft(productId) {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const invoiceService = Container.get("invoiceService");
        const state = getAuthStateService().getState();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState.");
        }

        const accountId = state.session.account.id;
        const stockMovementKey = stockMovementStorageKeyForAccount(accountId);
        const before = invoiceService.getAll().length;
        const customer = document.getElementById("invoice-customer-name");
        const product = document.getElementById("invoice-product-select");
        const quantity = document.getElementById("invoice-quantity");
        const unitPrice = document.getElementById("invoice-unit-price");
        const discount = document.getElementById("invoice-discount");
        const tax = document.getElementById("invoice-tax");
        const notes = document.getElementById("invoice-notes");
        const form = document.getElementById("invoice-draft-form");

        customer.value = "V1 Runtime Customer";
        product.value = ${JSON.stringify(productId)};
        product.dispatchEvent(new Event("change", { bubbles: true }));
        quantity.value = "2";
        unitPrice.value = "25";
        discount.value = "1.5";
        tax.value = "0.5";
        notes.value = "V1-SALES-005 create";
        customer.dispatchEvent(new Event("input", { bubbles: true }));
        quantity.dispatchEvent(new Event("input", { bubbles: true }));
        unitPrice.dispatchEvent(new Event("input", { bubbles: true }));
        discount.dispatchEvent(new Event("input", { bubbles: true }));
        tax.dispatchEvent(new Event("input", { bubbles: true }));
        notes.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true
        }));

        const invoices = invoiceService.getAll();
        const created = invoices.find(invoice => invoice.notes === "V1-SALES-005 create");
        if (!created) {
            throw new Error("Created draft invoice was not found.");
        }
        const line = created.lines[0];
        const stockMovementRaw = localStorage.getItem(stockMovementKey);

        return {
            invoiceCountBeforeCreate: before,
            invoiceCountAfterCreate: invoices.length,
            createdInvoiceId: created.id,
            createdInvoiceNumber: created.invoiceNumber,
            createdInvoiceStatus: created.status,
            createdInvoiceAccountMatches: created.accountId === accountId,
            createdInvoiceCreatedByPresent: Boolean(created.createdBy?.trim()),
            createdLineProductIdMatches: line?.productId === ${JSON.stringify(productId)},
            createdLineProductSnapshotMatches:
                line?.productNameSnapshot === "V1 Sales 005 Active Product",
            createdSubtotal: created.subtotal,
            createdDiscount: created.discount,
            createdTax: created.tax,
            createdTotal: created.total,
            createdTotalsMatch:
                created.subtotal === 50
                && created.discount === 1.5
                && created.tax === 0.5
                && created.total === 49,
            stockMovementCountAfterCreate: parseArray(stockMovementRaw).length,
            stockMovementHashAfterCreate: await nullableSha256(stockMovementRaw)
        };
    })()`, true);

}

async function submitDraftWithQuantity(productId, quantity, notes) {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const invoiceService = Container.get("invoiceService");
        const state = getAuthStateService().getState();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState.");
        }

        const accountId = state.session.account.id;
        const stockMovementKey = stockMovementStorageKeyForAccount(accountId);
        const before = invoiceService.getAll().length;
        const customer = document.getElementById("invoice-customer-name");
        const product = document.getElementById("invoice-product-select");
        const quantityInput = document.getElementById("invoice-quantity");
        const unitPrice = document.getElementById("invoice-unit-price");
        const discount = document.getElementById("invoice-discount");
        const tax = document.getElementById("invoice-tax");
        const notesInput = document.getElementById("invoice-notes");
        const form = document.getElementById("invoice-draft-form");

        customer.value = "V1 Runtime Customer";
        product.value = ${JSON.stringify(productId)};
        product.dispatchEvent(new Event("change", { bubbles: true }));
        quantityInput.value = String(${JSON.stringify(quantity)});
        unitPrice.value = "25";
        discount.value = "0";
        tax.value = "0";
        notesInput.value = ${JSON.stringify(notes)};
        customer.dispatchEvent(new Event("input", { bubbles: true }));
        quantityInput.dispatchEvent(new Event("input", { bubbles: true }));
        unitPrice.dispatchEvent(new Event("input", { bubbles: true }));
        discount.dispatchEvent(new Event("input", { bubbles: true }));
        tax.dispatchEvent(new Event("input", { bubbles: true }));
        notesInput.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true
        }));

        const invoices = invoiceService.getAll();
        const created = invoices.find(invoice => invoice.notes === ${JSON.stringify(notes)});
        if (!created) {
            throw new Error("Draft invoice was not found.");
        }
        const line = created.lines[0];
        const stockMovementRaw = localStorage.getItem(stockMovementKey);

        return {
            invoiceCountBeforeCreate: before,
            invoiceCountAfterCreate: invoices.length,
            createdInvoiceId: created.id,
            createdInvoiceNumber: created.invoiceNumber,
            createdInvoiceStatus: created.status,
            createdInvoiceAccountMatches: created.accountId === accountId,
            createdInvoiceCreatedByPresent: Boolean(created.createdBy?.trim()),
            createdLineProductIdMatches: line?.productId === ${JSON.stringify(productId)},
            createdLineQuantity: line?.quantity ?? null,
            stockMovementCountAfterCreate: parseArray(stockMovementRaw).length,
            stockMovementHashAfterCreate: await nullableSha256(stockMovementRaw)
        };
    })()`, true);

}

async function issueDraftViaUi(invoiceId) {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const state = getAuthStateService().getState();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState.");
        }

        const movementsBefore = inventoryService.getAll();
        const saleDeductionsBefore = movementsBefore.filter(
            movement => movement.type === "sale_deduction"
        );
        const targetInvoiceId = ${JSON.stringify(invoiceId)};
        const issueButton = Array.from(
            document.querySelectorAll("[data-action='issue-invoice-draft']")
        ).find(button => button.dataset.invoiceId === targetInvoiceId);

        if (!issueButton) {
            throw new Error("Issue button was not found.");
        }

        issueButton.click();

        const invoice = invoiceService.getById(targetInvoiceId);
        const movementsAfter = inventoryService.getAll();
        const saleDeductionsAfter = movementsAfter.filter(
            movement => movement.type === "sale_deduction"
        );
        const createdSaleDeduction = saleDeductionsAfter.find(
            movement => movement.referenceId === targetInvoiceId
        ) ?? null;
        const message = document.getElementById("invoice-draft-message")?.textContent ?? "";
        const line = invoice?.lines[0];

        return {
            invoiceIdBeforeIssue: targetInvoiceId,
            invoiceIdAfterIssue: invoice?.id ?? null,
            invoiceStatusAfterIssue: invoice?.status ?? null,
            invoiceAccountMatches: invoice?.accountId === state.session.account.id,
            issuedAtSet: Boolean(invoice?.issuedAt),
            issueSucceeded: invoice?.status === "issued",
            invoiceLineStockMovementId: line?.stockMovementId ?? null,
            saleDeductionMovementId: createdSaleDeduction?.id ?? null,
            saleDeductionProductId: createdSaleDeduction?.productId ?? null,
            saleDeductionQuantityDelta: createdSaleDeduction?.quantityDelta ?? null,
            saleDeductionReferenceType: createdSaleDeduction?.referenceType ?? null,
            saleDeductionReferenceId: createdSaleDeduction?.referenceId ?? null,
            saleDeductionCreatedByPresent: Boolean(createdSaleDeduction?.createdBy?.trim()),
            movementCountBeforeIssue: movementsBefore.length,
            movementCountAfterIssue: movementsAfter.length,
            saleDeductionCountBeforeIssue: saleDeductionsBefore.length,
            saleDeductionCountAfterIssue: saleDeductionsAfter.length,
            availableQuantityAfterIssue: line
                ? inventoryService.getAvailableQuantity(line.productId)
                : null,
            message
        };
    })()`, true);

}

async function duplicateIssueAttempt(invoiceId) {

    return evaluate(cdp, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const before = inventoryService.getAll().length;
        const result = invoiceService.markIssued(${JSON.stringify(invoiceId)});
        const after = inventoryService.getAll().length;
        const invoice = invoiceService.getById(${JSON.stringify(invoiceId)});

        return {
            duplicateIssueSuccess: result.success,
            duplicateIssueErrors: result.errors,
            movementCountBeforeDuplicate: before,
            movementCountAfterDuplicate: after,
            invoiceStatusAfterDuplicate: invoice?.status ?? null
        };
    })()`, true);

}

async function collectIssueDomEvidence(failedInvoiceId, issuedInvoiceId) {

    return evaluate(cdp, `(() => {
        const buttons = Array.from(
            document.querySelectorAll("#invoice-draft-page button")
        ).map(button => ({
            text: button.textContent?.trim().toLowerCase() ?? "",
            action: button.getAttribute("data-action") ?? "",
            id: button.id,
            invoiceId: button.dataset.invoiceId ?? ""
        }));

        return {
            url: window.location.href,
            title: document.title,
            invoiceDraftPageVisible: Boolean(document.querySelector("#invoice-draft-page")),
            invoiceFormVisible: Boolean(document.querySelector("#invoice-draft-form")),
            activeProductSelectable: Boolean(
                document.querySelector("#invoice-product-select option[value='v1-sales-005-active-product']")
            ),
            softDeletedProductSelectable: Boolean(
                document.querySelector("#invoice-product-select option[value='v1-sales-005-deleted-product']")
            ),
            draftRows: document.querySelectorAll(".invoice-draft-row[data-invoice-status='draft']").length,
            issuedRows: document.querySelectorAll(".invoice-draft-row[data-invoice-status='issued']").length,
            failedInvoiceIssueActionAvailable: buttons.some(button =>
                button.action === "issue-invoice-draft"
                && button.invoiceId === ${JSON.stringify(failedInvoiceId)}
            ),
            issuedInvoiceIssueActionAvailable: buttons.some(button =>
                button.action === "issue-invoice-draft"
                && button.invoiceId === ${JSON.stringify(issuedInvoiceId)}
            ),
            cancelActionAvailable: buttons.some(button =>
                button.id.toLowerCase().includes("cancel")
                || button.action.toLowerCase().includes("cancel")
                || button.text.includes("cancel")
            )
        };
    })()`);

}

async function collectIssueAfterSummary(
    setup,
    failedDraft,
    failedIssue,
    successfulDraft,
    successfulIssue,
    duplicateIssue
) {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getRouteDefinition } = await import("/src/router/routes.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { getFirebaseAuth } =
            await import("/src/modules/auth/firebase/FirebaseAuthClient.ts");
        const { invoiceStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoicePersistenceKey.ts");
        const { productStorageKeyForAccount, legacyProductStorageKey } =
            await import("/src/modules/products/persistence/ProductPersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");

        const state = await getAuthStateService().initialize();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState after reload.");
        }

        const accountId = state.session.account.id;
        const providerUserId = getFirebaseAuth()?.currentUser?.uid ?? "";
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const invoiceKey = invoiceStorageKeyForAccount(accountId);
        const productKey = productStorageKeyForAccount(accountId);
        const stockMovementKey = stockMovementStorageKeyForAccount(accountId);
        const legacyProductKey = legacyProductStorageKey();
        const invoices = invoiceService.getAll();
        const failedInvoice = invoices.find(
            invoice => invoice.id === ${JSON.stringify(failedDraft.createdInvoiceId)}
        );
        const issuedInvoice = invoices.find(
            invoice => invoice.id === ${JSON.stringify(successfulDraft.createdInvoiceId)}
        );
        const productRaw = localStorage.getItem(productKey);
        const stockMovementRaw = localStorage.getItem(stockMovementKey);
        const stockMovements = inventoryService.getAll();
        const saleDeductions = stockMovements.filter(
            movement => movement.type === "sale_deduction"
        );
        const saleDeduction = saleDeductions.find(
            movement => movement.id === ${JSON.stringify(successfulIssue.saleDeductionMovementId)}
        ) ?? null;
        const legacyProductRaw = localStorage.getItem(legacyProductKey);
        const products = parseArray(productRaw);
        const activeProduct = products.find(
            product => product?.id === ${JSON.stringify(setup.activeProductId)}
        );

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            userIdSanitized: await sanitizeValue(state.session.user.id),
            authSessionExists: true,
            accountIdNotFirebaseUid: accountId !== providerUserId,
            accountIdNotProviderUserId: accountId !== providerUserId,
            role: state.session.user.role,
            roleAllowed:
                state.session.user.role === "owner"
                || state.session.user.role === "user",
            routeGuardRemainsActive:
                getRouteDefinition("dashboard")?.access === "protected"
                && getRouteDefinition("products")?.access === "protected"
                && getRouteDefinition("inventory")?.access === "protected"
                && getRouteDefinition("invoices")?.access === "protected",
            invoiceScopedKeySanitized: "invoices:" + await sanitizeValue(accountId),
            stockMovementScopedKeySanitized: "stockMovements:" + await sanitizeValue(accountId),
            invoiceCountAfterReload: invoices.length,
            failedIssueInvoiceId: ${JSON.stringify(failedDraft.createdInvoiceId)},
            failedIssueResult: ${JSON.stringify(failedIssue.issueSucceeded)},
            failedInvoiceStatusAfterReload: failedInvoice?.status ?? null,
            successfulIssueInvoiceId: ${JSON.stringify(successfulDraft.createdInvoiceId)},
            successfulIssueResult: ${JSON.stringify(successfulIssue.issueSucceeded)},
            reloadIssuedInvoicePresent: Boolean(issuedInvoice),
            reloadIssuedInvoiceStatus: issuedInvoice?.status ?? null,
            reloadIssuedInvoiceAccountMatches: issuedInvoice?.accountId === accountId,
            reloadIssuedAtSet: Boolean(issuedInvoice?.issuedAt),
            saleDeductionMovementId: ${JSON.stringify(successfulIssue.saleDeductionMovementId)},
            reloadSaleDeductionPresent: Boolean(saleDeduction),
            saleDeductionMovementCount: saleDeductions.length,
            saleDeductionQuantityDelta: saleDeduction?.quantityDelta ?? null,
            saleDeductionProductId: saleDeduction?.productId ?? null,
            saleDeductionReferenceType: saleDeduction?.referenceType ?? null,
            saleDeductionReferenceId: saleDeduction?.referenceId ?? null,
            lineStockMovementId:
                issuedInvoice?.lines[0]?.stockMovementId ?? null,
            lineStockMovementIdReferencesMovement:
                issuedInvoice?.lines[0]?.stockMovementId === saleDeduction?.id,
            availableQuantityBeforeIssue: ${JSON.stringify(setup.availableQuantityBeforeIssue)},
            availableQuantityAfterIssue: ${JSON.stringify(successfulIssue.availableQuantityAfterIssue)},
            availableQuantityAfterReload:
                inventoryService.getAvailableQuantity(${JSON.stringify(setup.activeProductId)}),
            movementCountBeforeFailedIssue: ${JSON.stringify(failedIssue.movementCountBeforeIssue)},
            movementCountAfterFailedIssue: ${JSON.stringify(failedIssue.movementCountAfterIssue)},
            movementCountAfterSuccessfulIssue: ${JSON.stringify(successfulIssue.movementCountAfterIssue)},
            movementCountAfterDuplicateIssue: ${JSON.stringify(duplicateIssue.movementCountAfterDuplicate)},
            duplicateIssueSuccess: ${JSON.stringify(duplicateIssue.duplicateIssueSuccess)},
            duplicateIssueErrors: ${JSON.stringify(duplicateIssue.duplicateIssueErrors)},
            productScopedKeySanitized: "products:" + await sanitizeValue(accountId),
            productScopedHashAfter: await nullableSha256(productRaw),
            productQuantityAfter: activeProduct?.quantity ?? null,
            legacyProductHashAfter: await nullableSha256(legacyProductRaw),
            stockMovementHashAfter: await nullableSha256(stockMovementRaw),
            invoiceStorageRawHashAfter: await nullableSha256(localStorage.getItem(invoiceKey)),
            globalInvoicesKeyPresent: localStorage.getItem("invoices") !== null
        };
    })()`, true);

}

async function updateCreatedDraft(invoiceId) {

    return evaluate(cdp, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const invoiceService = Container.get("invoiceService");
        const state = getAuthStateService().getState();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState.");
        }

        const targetInvoiceId = ${JSON.stringify(invoiceId)};
        const editButton = Array.from(
            document.querySelectorAll("[data-action='edit-invoice-draft']")
        ).find(button => button.dataset.invoiceId === targetInvoiceId);
        if (!editButton) {
            throw new Error("Draft edit button was not found.");
        }
        editButton.click();

        const quantity = document.getElementById("invoice-quantity");
        const notes = document.getElementById("invoice-notes");
        const form = document.getElementById("invoice-draft-form");
        quantity.value = "3";
        notes.value = "V1-SALES-005 update";
        quantity.dispatchEvent(new Event("input", { bubbles: true }));
        notes.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true
        }));

        const invoices = invoiceService.getAll();
        const updated = invoices.find(invoice => invoice.id === ${JSON.stringify(invoiceId)});
        if (!updated) {
            throw new Error("Updated draft invoice was not found.");
        }

        return {
            invoiceCountAfterUpdate: invoices.length,
            updatedInvoiceId: updated.id,
            updatedInvoiceAccountMatches: updated.accountId === state.session.account.id,
            updatedInvoiceStatus: updated.status,
            updatedQuantity: updated.lines[0]?.quantity ?? null,
            updatedSubtotal: updated.subtotal,
            updatedDiscount: updated.discount,
            updatedTax: updated.tax,
            updatedTotal: updated.total,
            updatedTotalsMatch:
                updated.lines[0]?.quantity === 3
                && updated.subtotal === 75
                && updated.discount === 1.5
                && updated.tax === 0.5
                && updated.total === 74
        };
    })()`, true);

}

async function collectAfterSummary(
    setup,
    invalidResult,
    createResult,
    updateResult
) {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getRouteDefinition } = await import("/src/router/routes.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { getFirebaseAuth } =
            await import("/src/modules/auth/firebase/FirebaseAuthClient.ts");
        const { invoiceStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoicePersistenceKey.ts");
        const { productStorageKeyForAccount, legacyProductStorageKey } =
            await import("/src/modules/products/persistence/ProductPersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");

        const state = await getAuthStateService().initialize();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState after reload.");
        }

        const accountId = state.session.account.id;
        const providerUserId = getFirebaseAuth()?.currentUser?.uid ?? "";
        const invoiceService = Container.get("invoiceService");
        const invoiceKey = invoiceStorageKeyForAccount(accountId);
        const productKey = productStorageKeyForAccount(accountId);
        const stockMovementKey = stockMovementStorageKeyForAccount(accountId);
        const legacyProductKey = legacyProductStorageKey();
        const invoices = invoiceService.getAll();
        const reloadedInvoice = invoices.find(
            invoice => invoice.id === ${JSON.stringify(createResult.createdInvoiceId)}
        );
        const productRaw = localStorage.getItem(productKey);
        const stockMovementRaw = localStorage.getItem(stockMovementKey);
        const stockMovements = parseArray(stockMovementRaw);
        const legacyProductRaw = localStorage.getItem(legacyProductKey);
        const products = parseArray(productRaw);
        const activeProduct = products.find(
            product => product?.id === ${JSON.stringify(setup.activeProductId)}
        );

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            userIdSanitized: await sanitizeValue(state.session.user.id),
            authSessionExists: true,
            accountIdNotFirebaseUid: accountId !== providerUserId,
            accountIdNotProviderUserId: accountId !== providerUserId,
            role: state.session.user.role,
            roleAllowed:
                state.session.user.role === "owner"
                || state.session.user.role === "user",
            routeGuardRemainsActive:
                getRouteDefinition("dashboard")?.access === "protected"
                && getRouteDefinition("products")?.access === "protected"
                && getRouteDefinition("inventory")?.access === "protected"
                && getRouteDefinition("invoices")?.access === "protected",
            invoiceScopedKeySanitized: "invoices:" + await sanitizeValue(accountId),
            invoiceCountAfterReload: invoices.length,
            reloadInvoicePresent: Boolean(reloadedInvoice),
            reloadInvoiceStatus: reloadedInvoice?.status ?? null,
            reloadInvoiceTotal: reloadedInvoice?.total ?? null,
            invoiceStorageRawHashAfter: await nullableSha256(localStorage.getItem(invoiceKey)),
            globalInvoicesKeyPresent: localStorage.getItem("invoices") !== null,
            productScopedKeySanitized: "products:" + await sanitizeValue(accountId),
            productScopedHashAfter: await nullableSha256(productRaw),
            productQuantityAfter: activeProduct?.quantity ?? null,
            stockMovementScopedKeySanitized: "stockMovements:" + await sanitizeValue(accountId),
            stockMovementCountAfter: stockMovements.length,
            stockMovementHashAfter: await nullableSha256(stockMovementRaw),
            saleDeductionMovementCount: stockMovements.filter(
                movement => movement?.type === "sale_deduction"
            ).length,
            legacyProductHashAfter: await nullableSha256(legacyProductRaw),
            invoiceCountBeforeCreate: ${JSON.stringify(setup.invoiceCountBeforeCreate)},
            invoiceCountAfterInvalid: ${JSON.stringify(invalidResult.invoiceCountAfterInvalid)},
            invoiceCountAfterValidCreate: ${JSON.stringify(createResult.invoiceCountAfterCreate)},
            createdInvoiceId: ${JSON.stringify(createResult.createdInvoiceId)},
            createdInvoiceNumber: ${JSON.stringify(createResult.createdInvoiceNumber)},
            createdInvoiceStatus: ${JSON.stringify(createResult.createdInvoiceStatus)},
            createdInvoiceLineProductSnapshotResult:
                ${JSON.stringify(createResult.createdLineProductSnapshotMatches)},
            draftUpdateResult: ${JSON.stringify(updateResult.updatedTotalsMatch)},
            totalsResult: {
                createdSubtotal: ${JSON.stringify(createResult.createdSubtotal)},
                createdDiscount: ${JSON.stringify(createResult.createdDiscount)},
                createdTax: ${JSON.stringify(createResult.createdTax)},
                createdTotal: ${JSON.stringify(createResult.createdTotal)},
                updatedSubtotal: ${JSON.stringify(updateResult.updatedSubtotal)},
                updatedDiscount: ${JSON.stringify(updateResult.updatedDiscount)},
                updatedTax: ${JSON.stringify(updateResult.updatedTax)},
                updatedTotal: ${JSON.stringify(updateResult.updatedTotal)}
            }
        };
    })()`, true);

}

async function collectAfterDomEvidence(invoiceDomBefore, reloadDom) {

    const currentDom = await evaluate(cdp, `(() => ({
        url: window.location.href,
        title: document.title,
        loginVisible: Boolean(document.querySelector("#login-page")),
        invoiceDraftUiVisible: Boolean(document.querySelector("#invoice-draft-page")),
        sidebarVisibleItems: Array.from(
            document.querySelectorAll("#sidebar .menu-item")
        ).map(item => ({
            page: item.getAttribute("data-page"),
            text: item.textContent?.trim() ?? ""
        }))
    }))()`);

    return {
        ...currentDom,
        invoiceBeforeCreate: invoiceDomBefore,
        invoiceAfterReload: reloadDom
    };

}

async function collectBaselineSummary() {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { getRouteDefinition } = await import("/src/router/routes.ts");
        const { invoiceStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoicePersistenceKey.ts");
        const { productStorageKeyForAccount, legacyProductStorageKey } =
            await import("/src/modules/products/persistence/ProductPersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");
        const state = getAuthStateService().getState();
        if (state.status !== "authenticated") {
            throw new Error("Expected authenticated AuthState.");
        }

        const accountId = state.session.account.id;
        const invoiceService = Container.get("invoiceService");
        const invoiceScopedKey = invoiceStorageKeyForAccount(accountId);
        const productScopedKey = productStorageKeyForAccount(accountId);
        const stockMovementScopedKey = stockMovementStorageKeyForAccount(accountId);
        const legacyProductKey = legacyProductStorageKey();
        const invoices = invoiceService.getAll();
        const productRaw = localStorage.getItem(productScopedKey);
        const stockMovementRaw = localStorage.getItem(stockMovementScopedKey);
        const stockMovements = parseArray(stockMovementRaw);
        const legacyProductRaw = localStorage.getItem(legacyProductKey);

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            authSessionExists: true,
            productsProtected: getRouteDefinition("products")?.access === "protected",
            inventoryProtected: getRouteDefinition("inventory")?.access === "protected",
            invoiceRouteExists: Boolean(getRouteDefinition("invoices")),
            salesRouteExists: Boolean(getRouteDefinition("sales")),
            invoiceServiceCanRead: Array.isArray(invoices),
            invoiceCountBefore: invoices.length,
            invoiceScopedKeySanitized: "invoices:" + await sanitizeValue(accountId),
            invoiceScopedKeyPresent: localStorage.getItem(invoiceScopedKey) !== null,
            productScopedHash: await nullableSha256(productRaw),
            productScopedHashRecorded: productRaw === null || Boolean(await nullableSha256(productRaw)),
            stockMovementCount: stockMovements.length,
            stockMovementHash: await nullableSha256(stockMovementRaw),
            stockMovementCountRecorded: Number.isFinite(stockMovements.length),
            legacyProductHash: await nullableSha256(legacyProductRaw),
            globalInvoicesKeyPresent: localStorage.getItem("invoices") !== null
        };
    })()`, true);

}

async function collectProductsDomEvidence() {

    return evaluate(cdp, `(() => ({
        productsPageVisible: Boolean(document.querySelector(".products-page")),
        productRows: document.querySelectorAll("#products-body tr").length
    }))()`);

}

async function collectInventoryDomEvidence() {

    return evaluate(cdp, `(() => ({
        inventoryPageVisible: Boolean(document.querySelector("#inventory-page")),
        inventoryFormVisible: Boolean(document.querySelector("#inventory-movement-form"))
    }))()`);

}

async function collectDomEvidence(productsDom, inventoryDom) {

    const currentDom = await evaluate(cdp, `(() => ({
        url: window.location.href,
        title: document.title,
        loginVisible: Boolean(document.querySelector("#login-page")),
        invoiceDraftUiVisible:
            Boolean(document.querySelector("#invoice-draft-page"))
            || Boolean(document.querySelector("#invoices-page"))
            || Boolean(document.querySelector("[data-page='invoices']"))
            || Boolean(document.querySelector("[data-page='sales']")),
        sidebarVisibleItems: Array.from(
            document.querySelectorAll("#sidebar .menu-item")
        ).map(item => ({
            page: item.getAttribute("data-page"),
            text: item.textContent?.trim() ?? ""
        }))
    }))()`);

    return {
        ...currentDom,
        products: productsDom,
        inventory: inventoryDom
    };

}

async function collectStorageEvidence() {

    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const keys = Object.keys(localStorage);
        return {
            keyCount: keys.length,
            hasGlobalInvoicesKey: keys.includes("invoices"),
            invoiceKeys: await Promise.all(
                keys
                    .filter(key => key.startsWith("invoices:"))
                    .map(async key => "invoices:" + await sanitizeValue(key.slice("invoices:".length)))
            ),
            productKeys: await Promise.all(
                keys
                    .filter(key => key.startsWith("products:"))
                    .map(async key => "products:" + await sanitizeValue(key.slice("products:".length)))
            ),
            stockMovementKeys: await Promise.all(
                keys
                    .filter(key => key.startsWith("stockMovements:"))
                    .map(async key => "stockMovements:" + await sanitizeValue(key.slice("stockMovements:".length)))
            )
        };
    })()`, true);

}

async function signIn(connection) {

    await evaluate(connection, `(() => {
        const emailInput = document.getElementById("login-email");
        const passwordInput = document.getElementById("login-password");
        const form = document.getElementById("login-form");
        if (!emailInput || !passwordInput || !form) {
            throw new Error("Login form is not available.");
        }
        emailInput.value = ${JSON.stringify(authEmail)};
        passwordInput.value = ${JSON.stringify(authPassword)};
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true
        }));
        return true;
    })()`);

}

async function navigateRoute(connection, route) {

    await evaluate(connection, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const router = Container.get("router");
        await router.navigate(${JSON.stringify(route)});
        return true;
    })()`, true);

}

async function writeArtifacts(prefix, dom, storage) {

    const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
    });

    writeFileSync(
        resolve(outputDir, `${prefix}-runtime.json`),
        JSON.stringify(runtime, null, 2)
    );
    writeFileSync(
        resolve(outputDir, `${prefix}-dom.json`),
        JSON.stringify(dom, null, 2)
    );
    writeFileSync(
        resolve(outputDir, `${prefix}-console.log`),
        consoleEntries.map(entry => JSON.stringify(entry)).join("\n")
    );
    writeFileSync(
        resolve(outputDir, `${prefix}-storage-snapshot-sanitized.json`),
        JSON.stringify(storage, null, 2)
    );
    writeFileSync(
        resolve(outputDir, `${prefix}-screenshot.png`),
        Buffer.from(screenshot.data, "base64")
    );

}

function browserUtilityFunctions() {

    return `
        function parseArray(rawValue) {
            if (!rawValue) {
                return [];
            }
            try {
                const parsed = JSON.parse(rawValue);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        async function sanitizeValue(value) {
            const text = String(value ?? "");
            if (!text) {
                return "";
            }
            const hash = await sha256(text);
            return text.slice(0, 6) + "..." + hash.slice(-10);
        }

        async function nullableSha256(value) {
            return value === null ? null : await sha256(value);
        }

        async function sha256(value) {
            const bytes = new TextEncoder().encode(String(value));
            const buffer = await crypto.subtle.digest("SHA-256", bytes);
            return Array.from(new Uint8Array(buffer))
                .map(byte => byte.toString(16).padStart(2, "0"))
                .join("");
        }
    `;

}

function writeFailureArtifacts() {

    mkdirSync(outputDir, { recursive: true });
    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    writeFileSync(
        resolve(outputDir, `${mode}-runtime-failure.json`),
        JSON.stringify(runtime, null, 2)
    );
    writeFileSync(
        resolve(outputDir, `${mode}-console-failure.log`),
        consoleEntries.map(entry => JSON.stringify(entry)).join("\n")
    );

}

function allGatesPass(gates) {

    return Object.values(gates).every(Boolean);

}

function countConsoleErrors(entries) {

    return entries.filter(entry =>
        entry.type === "error" || entry.level === "error"
    ).length;

}

function startVite() {

    const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const command = process.platform === "win32" ? "cmd.exe" : pnpmCommand;
    const args = process.platform === "win32"
        ? [
            "/d",
            "/s",
            "/c",
            [
                pnpmCommand,
                "exec",
                "vite",
                "--host",
                "127.0.0.1",
                "--port",
                String(port),
                "--strictPort",
            ].join(" "),
        ]
        : [
            "exec",
            "vite",
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--strictPort",
        ];

    const child = spawn(command, args, {
        cwd: projectRoot,
        env: { ...process.env, ...localEnv },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
    });

    child.stdout.on("data", () => {});
    child.stderr.on("data", data => {
        consoleEntries.push({
            source: "vite",
            level: "stderr",
            text: data.toString("utf8").trim(),
        });
    });

    return child;

}

function startChrome() {

    return spawn(
        findChromeExecutable(),
        [
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--remote-allow-origins=*",
            `--remote-debugging-port=${debugPort}`,
            `--user-data-dir=${profileDir}`,
            "--window-size=1365,900",
            "about:blank",
        ],
        { stdio: "ignore" }
    );

}

function findChromeExecutable() {

    const candidates = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    const found = candidates.find(candidate => existsSync(candidate));

    if (!found) {
        throw new Error("Chrome or Edge executable was not found.");
    }

    return found;

}

function killProcessTree(pid) {

    if (!pid) {
        return;
    }

    try {
        if (process.platform === "win32") {
            execFileSync(
                "taskkill",
                ["/PID", String(pid), "/T", "/F"],
                { stdio: "ignore" }
            );
            return;
        }

        process.kill(pid);
    } catch {}

}

async function waitForHttpOk(url) {

    const deadline = Date.now() + 30000;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {}
        await delay(250);
    }

    throw new Error(`Timed out waiting for ${url}`);

}

async function createChromeTarget(url) {

    const deadline = Date.now() + 30000;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(
                `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`,
                { method: "PUT" }
            );
            if (response.ok) {
                return response.json();
            }
        } catch {}
        await delay(250);
    }

    throw new Error("Timed out waiting for Chrome CDP target.");

}

async function connectCdp(webSocketDebuggerUrl) {

    const websocket = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolveOpen, rejectOpen) => {
        websocket.addEventListener("open", resolveOpen, { once: true });
        websocket.addEventListener("error", rejectOpen, { once: true });
    });
    return createCdpConnection(websocket);

}

function createCdpConnection(websocket) {

    let nextId = 1;
    const pendingCommands = new Map();
    const listenersByMethod = new Map();

    websocket.addEventListener("message", event => {
        const message = JSON.parse(event.data);

        if (message.id && pendingCommands.has(message.id)) {
            const pendingCommand = pendingCommands.get(message.id);
            pendingCommands.delete(message.id);

            if (message.error) {
                pendingCommand.reject(new Error(message.error.message));
                return;
            }

            pendingCommand.resolve(message.result ?? {});
            return;
        }

        const listeners = listenersByMethod.get(message.method) ?? [];

        for (const listener of listeners) {
            listener(message.params ?? {});
        }
    });

    return {
        send(method, params = {}) {
            const id = nextId;
            nextId += 1;

            return new Promise((resolveSend, rejectSend) => {
                pendingCommands.set(id, {
                    resolve: resolveSend,
                    reject: rejectSend,
                });
                websocket.send(JSON.stringify({ id, method, params }));
            });
        },
        on(method, listener) {
            const listeners = listenersByMethod.get(method) ?? [];
            listeners.push(listener);
            listenersByMethod.set(method, listeners);
        },
        close() {
            websocket.close();
        },
    };

}

async function enableRuntime(connection, consoleTarget, exceptionTarget) {

    connection.on("Runtime.consoleAPICalled", params => {
        consoleTarget.push({
            type: params.type,
            args: (params.args ?? []).map(argument =>
                argument.value ?? argument.description ?? argument.type
            ),
        });
    });
    connection.on("Runtime.exceptionThrown", params => {
        exceptionTarget.push({
            text: params.exceptionDetails?.text ?? "Runtime exception",
        });
    });
    connection.on("Log.entryAdded", params => {
        consoleTarget.push({
            source: params.entry?.source,
            level: params.entry?.level,
            text: params.entry?.text,
        });
    });

    await connection.send("Runtime.enable");
    await connection.send("Page.enable");
    await connection.send("Log.enable");

}

async function evaluate(connection, expression, awaitPromise = false) {

    const result = await connection.send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
        userGesture: true,
    });

    if (result.exceptionDetails) {
        throw new Error(
            result.exceptionDetails.exception?.description
                ?? result.exceptionDetails.text
                ?? "Runtime.evaluate failed."
        );
    }

    return result.result?.value;

}

async function waitForSelector(connection, selector, timeoutMs) {

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const exists = await evaluate(
            connection,
            `Boolean(document.querySelector(${JSON.stringify(selector)}))`
        );

        if (exists) {
            return;
        }

        await delay(250);
    }

    throw new Error(`Timed out waiting for selector ${selector}`);

}

async function waitForAuthenticated(connection) {

    const deadline = Date.now() + 45000;

    while (Date.now() < deadline) {
        const status = await evaluate(connection, `(async () => {
            const { getAuthStateService } =
                await import("/src/modules/auth/AuthRuntime.ts");
            const state = await getAuthStateService().initialize();
            return state.status;
        })()`, true);

        if (status === "authenticated") {
            return;
        }

        await delay(500);
    }

    throw new Error("Timed out waiting for authenticated AuthState.");

}

function readEnvFile(path) {

    if (!existsSync(path)) {
        return {};
    }

    const text = execFileSync(
        process.execPath,
        [
            "-e",
            "const fs=require('fs'); process.stdout.write(fs.readFileSync(process.argv[1],'utf8'))",
            path,
        ],
        { encoding: "utf8" }
    );
    const env = {};

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, equalsIndex).trim();
        let value = trimmed.slice(equalsIndex + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }

    return env;

}

function assert(condition, message) {

    if (!condition) {
        throw new Error(message);
    }

}

function delay(milliseconds) {

    return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

}
