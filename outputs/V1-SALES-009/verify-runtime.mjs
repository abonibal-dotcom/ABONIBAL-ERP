import { execFileSync, spawn } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    rmSync,
    writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
const outputDir = scriptDir;
const mode = process.argv[2] ?? "baseline";
const validModes = new Set(["baseline", "after"]);
const port = 62006;
const debugPort = 63007;
const appUrl = `http://127.0.0.1:${port}/`;

if (!validModes.has(mode)) {
    throw new Error(`Unsupported verification mode: ${mode}`);
}
const acceptedProfileDir = resolve(
    tmpdir(),
    "abonibal-v1-sales-006-after-chrome-profile"
);
const profileDir = resolve(
    tmpdir(),
    `abonibal-v1-sales-009-${mode}-chrome-profile`
);
const requiredEnvKeys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
];

const localEnv = readEnvFile(resolve(projectRoot, ".env"));
const envTracked = execFileSync(
    "git",
    ["ls-files", "--", ".env"],
    { cwd: projectRoot, encoding: "utf8" }
).trim().length > 0;
const trackedSourceChanges = execFileSync(
    "git",
    ["status", "--short", "--untracked-files=no", "--", "src"],
    { cwd: projectRoot, encoding: "utf8" }
).trim();

const runtime = {
    mission: "V1-SALES-009",
    mode,
    classification: "ECS",
    scenario: mode === "baseline"
        ? "baseline invoice lifecycle regression evidence"
        : "after invoice lifecycle regression verification",
    url: appUrl,
    verificationTool: "Chrome DevTools Protocol direct WebSocket client",
    profileSource: "accepted V1-SALES-006 after-runtime profile copy",
    env: {
        envFileExists: existsSync(resolve(projectRoot, ".env")),
        requiredFirebaseKeysPresent: requiredEnvKeys.every(
            key => Boolean(localEnv[key] ?? process.env[key])
        ),
        envTracked,
        trackedSourceChanges: trackedSourceChanges.length > 0,
    },
    server: {
        port,
        started: false,
        reusedExisting: false,
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
    assert(runtime.env.envFileExists, ".env is required.");
    assert(
        runtime.env.requiredFirebaseKeysPresent,
        "Required VITE_FIREBASE_* keys are missing."
    );
    assert(!runtime.env.envTracked, ".env must remain untracked.");
    if (mode === "baseline") {
        assert(
            !runtime.env.trackedSourceChanges,
            "Source files must not be modified before baseline."
        );
    }
    assert(
        existsSync(acceptedProfileDir),
        "Accepted V1-SALES-006 after-runtime Chrome profile is missing."
    );

    mkdirSync(outputDir, { recursive: true });
    rmSync(profileDir, { recursive: true, force: true });
    cpSync(acceptedProfileDir, profileDir, { recursive: true });

    serverProcess = await startOrReuseVite();
    chromeProcess = startChrome();

    const target = await createChromeTarget(appUrl);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await enableRuntime(cdp, consoleEntries, pageExceptions);
    await cdp.send("Page.navigate", { url: appUrl });
    await waitForSelector(cdp, "#app", 30000);

    await waitForAuthenticated(cdp);

    if (mode === "baseline") {
        await runBaselineVerification();
    } else {
        await runAfterVerification();
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

async function runBaselineVerification() {
    const before = await collectBaselineSnapshot();

    await navigateRoute(cdp, "products");
    await waitForSelector(cdp, ".products-page", 30000);
    const productsRouteDom = await collectRouteDomEvidence();

    await navigateRoute(cdp, "inventory");
    await waitForSelector(cdp, "#inventory-page", 30000);
    const inventoryRouteDom = await collectRouteDomEvidence();

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const dom = await collectDomEvidence({
        productsRouteWorks: productsRouteDom.productsPageVisible,
        inventoryRouteWorks: inventoryRouteDom.inventoryPageVisible,
    });
    const after = await collectBaselineSnapshot();
    const storage = sanitizeStorageSnapshot(before, after);

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.route = {
        invoiceRouteAccess: before.invoiceRouteAccess,
        routeGuardActive: before.invoiceRouteAccess === "protected",
    };
    runtime.summary = buildSnapshotSummary(before, after);
    runtime.gates = {
        routeGuardRemainsActive: before.invoiceRouteAccess === "protected",
        authSessionExists: before.authSessionExists,
        accountIdExists: Boolean(before.accountIdSanitized),
        accountIdNotProviderUserId:
            before.accountIdPresent
            && before.providerUserIdPresent
            && !before.accountIdEqualsProviderUserId,
        productsRouteWorks: dom.productsRouteWorks,
        inventoryRouteWorks: dom.inventoryRouteWorks,
        invoiceRouteWorks: dom.invoicePageVisible,
        issuedInvoiceAuditViewWorks: dom.issuedInvoiceVisible,
        saleDeductionTraceVisible: dom.stockMovementIdVisible,
        invoicesInspectedReadOnly: before.invoiceCount === after.invoiceCount,
        stockMovementsInspectedReadOnly:
            before.stockMovementCount === after.stockMovementCount,
        productsUnchanged:
            before.productScopedHash === after.productScopedHash,
        legacyProductsUnchanged:
            before.legacyProductHash === after.legacyProductHash,
        cancellationFlowAccepted:
            dom.issuedCancelActionExists === true
            && before.markCancelledReversalSafe === true,
        referencedSaleDeductionExists: before.referencedSaleDeductionExists,
        referencedSaleDeductionType: before.referencedMovementTypeOk,
        referencedSaleDeductionNegative: before.referencedMovementNegative,
        referencedSaleDeductionAccountScoped:
            before.referencedMovementAccountOk,
        referencedSaleDeductionProductScoped:
            before.referencedMovementProductOk,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !runtime.env.envTracked,
        sourceUnchanged: !runtime.env.trackedSourceChanges,
    };
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts(dom, storage);
    assert(runtime.result === "PASS", "V1-SALES-009 baseline runtime verification failed.");
}

async function runAfterVerification() {
    const before = await collectBaselineSnapshot();

    await navigateRoute(cdp, "products");
    await waitForSelector(cdp, ".products-page", 30000);
    const productsRouteDom = await collectRouteDomEvidence();

    await navigateRoute(cdp, "inventory");
    await waitForSelector(cdp, "#inventory-page", 30000);
    const inventoryRouteDom = await collectRouteDomEvidence();

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const beforeDom = await collectDomEvidence({
        productsRouteWorks: productsRouteDom.productsPageVisible,
        inventoryRouteWorks: inventoryRouteDom.inventoryPageVisible,
    });
    const lifecycle = await runLifecycleScenario();

    await cdp.send("Page.navigate", { url: appUrl });
    await waitForSelector(cdp, "#app", 30000);
    await waitForAuthenticated(cdp);
    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const reloadSnapshot = await collectBaselineSnapshot();
    const reloadEvidence = await collectLifecycleReloadEvidence(lifecycle);
    Object.assign(lifecycle, {
        reloadPreservesDraftInvoices:
            reloadEvidence.reloadPreservesDraftInvoices,
        reloadPreservesIssuedInvoices:
            reloadEvidence.reloadPreservesIssuedInvoices,
        reloadPreservesCancelledInvoices:
            reloadEvidence.reloadPreservesCancelledInvoices,
        reloadPreservesSaleDeduction:
            reloadEvidence.reloadPreservesSaleDeduction,
        reloadPreservesSaleReturn:
            reloadEvidence.reloadPreservesSaleReturn,
        reloadPreservesAuditTraceability:
            reloadEvidence.reloadPreservesAuditTraceability,
        availabilityAfterReload: reloadEvidence.availabilityAfterReload,
        availabilityAfterReloadMatchesLedger:
            reloadEvidence.availabilityAfterReload
            === lifecycle.availabilityAfterCancellation,
    });
    const afterDom = await collectDomEvidence({
        productsRouteWorks: productsRouteDom.productsPageVisible,
        inventoryRouteWorks: inventoryRouteDom.inventoryPageVisible,
    });
    const storage = sanitizeLifecycleStorageSnapshot(before, lifecycle);
    const summary = buildLifecycleSummary(
        before,
        lifecycle,
        reloadSnapshot,
        beforeDom,
        afterDom
    );

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.route = {
        invoiceRouteAccess: before.invoiceRouteAccess,
        routeGuardActive: before.invoiceRouteAccess === "protected",
    };
    runtime.summary = summary;
    runtime.gates = {
        unauthenticatedInvoiceRouteBlocked:
            before.invoiceRouteAccess === "protected",
        loginSucceeds: before.authSessionExists,
        authSessionExists: before.authSessionExists,
        accountIdExists: Boolean(before.accountIdSanitized),
        invoiceRouteAccessibleAfterLogin: beforeDom.invoicePageVisible,
        routeGuardRemainsActive: before.invoiceRouteAccess === "protected",
        accountIdNotFirebaseUid:
            before.accountIdPresent
            && before.providerUserIdPresent
            && !before.accountIdEqualsProviderUserId,
        accountIdNotProviderUserId:
            before.accountIdPresent
            && before.providerUserIdPresent
            && !before.accountIdEqualsProviderUserId,
        invoiceDraftUiRenders: beforeDom.invoicePageVisible,
        activeProductSelectorWorks: beforeDom.productOptionCount > 0,
        softDeletedProductsNotSelectable:
            lifecycle.softDeletedProductsNotSelectable,
        invalidDraftSubmissionDoesNotWriteInvoice:
            lifecycle.invalidDraftWriteRejected,
        validDraftCreateWritesInvoice: lifecycle.validDraftCreateWritesInvoice,
        draftInvoiceStatusDraft: lifecycle.draftStatusDraft,
        draftHasAccountAndCreatedBy: lifecycle.draftHasAccountAndCreatedBy,
        invoiceLineIncludesProductSnapshot:
            lifecycle.invoiceLineIncludesProductSnapshot,
        draftTotalsCorrect: lifecycle.draftTotalsCorrect,
        draftUpdatePreservesIdAndAccount:
            lifecycle.draftUpdatePreservesIdAndAccount,
        draftUpdatePersistsTotals: lifecycle.draftUpdatePersistsTotals,
        draftUpdateCreatesNoStockMovement:
            lifecycle.draftUpdateCreatesNoStockMovement,
        failedIssueBlocked: lifecycle.failedIssueBlocked,
        failedIssueLeavesDraft: lifecycle.failedIssueLeavesDraft,
        failedIssueCreatesNoSaleDeduction:
            lifecycle.failedIssueCreatesNoSaleDeduction,
        failedIssueDoesNotChangeMovementCount:
            lifecycle.failedIssueDoesNotChangeMovementCount,
        failedIssueRecordsSafeError: lifecycle.failedIssueRecordsSafeError,
        successfulIssue: lifecycle.successfulIssue,
        invoiceStatusIssued: lifecycle.invoiceStatusIssued,
        issuedAtSet: lifecycle.issuedAtSet,
        issuedIdAccountUnchanged: lifecycle.issuedIdAccountUnchanged,
        saleDeductionCreated: lifecycle.saleDeductionCreated,
        saleDeductionNegative: lifecycle.saleDeductionNegative,
        saleDeductionProductMatches: lifecycle.saleDeductionProductMatches,
        invoiceLineStockMovementIdSet:
            lifecycle.invoiceLineStockMovementIdSet,
        stockMovementIdReferencesSaleDeduction:
            lifecycle.stockMovementIdReferencesSaleDeduction,
        availableStockDecreasesCorrectly:
            lifecycle.availableStockDecreasesCorrectly,
        productQuantityNotUpdatedAfterIssue:
            lifecycle.productHashBefore === lifecycle.productHashAfter,
        duplicateIssueCreatesNoDuplicateSaleDeduction:
            lifecycle.duplicateIssueCreatesNoDuplicateSaleDeduction,
        duplicateIssueLeavesIssued: lifecycle.duplicateIssueLeavesIssued,
        issuedInvoiceAppearsAfterReload: afterDom.issuedInvoiceVisible,
        issuedStatusDisplayed: afterDom.issuedInvoiceVisible,
        invoiceNumberTotalIssuedAtDisplayed:
            afterDom.invoiceNumberVisible
            && afterDom.invoiceTotalVisible
            && afterDom.issuedAtVisible,
        invoiceLineProductSnapshotDisplayed:
            afterDom.productSnapshotVisible,
        stockMovementReferenceVisibleOrTraceable:
            afterDom.stockMovementIdVisible
            || lifecycle.stockMovementIdReferencesSaleDeduction,
        referencedSaleDeductionRemainsStored:
            lifecycle.referencedSaleDeductionRemainsStored,
        draftCancellationBlocked: lifecycle.draftCancellationBlocked,
        issuedCancellationSucceeded: lifecycle.issuedCancellationSucceeded,
        cancelledStatusSet: lifecycle.cancelledStatusSet,
        cancelledAtSet: lifecycle.cancelledAtSet,
        cancelledBySet: lifecycle.cancelledBySet,
        originalSaleDeductionPreserved:
            lifecycle.originalSaleDeductionPreserved,
        saleReturnCreated: lifecycle.saleReturnCreated,
        saleReturnPositive: lifecycle.saleReturnPositive,
        saleReturnProductMatches: lifecycle.saleReturnProductMatches,
        saleReturnReferencesOriginal: lifecycle.saleReturnReferencesOriginal,
        saleReturnAccountMatches: lifecycle.saleReturnAccountMatches,
        availableStockRestored: lifecycle.availableStockRestored,
        duplicateCancellationCreatesNoDuplicateSaleReturn:
            lifecycle.duplicateCancellationCreatesNoDuplicateSaleReturn,
        duplicateCancellationLeavesCancelled:
            lifecycle.duplicateCancellationLeavesCancelled,
        reloadPreservesDraftInvoices: lifecycle.reloadPreservesDraftInvoices,
        reloadPreservesIssuedInvoices:
            lifecycle.reloadPreservesIssuedInvoices
            && (afterDom.issuedInvoiceVisible || reloadSnapshot.issuedInvoiceExists),
        reloadPreservesCancelledInvoices:
            afterDom.cancelledInvoiceVisible || reloadSnapshot.cancelledInvoiceExists,
        reloadPreservesSaleDeduction:
            lifecycle.reloadPreservesSaleDeduction,
        reloadPreservesSaleReturn:
            lifecycle.reloadPreservesSaleReturn,
        reloadPreservesAuditTraceability:
            lifecycle.reloadPreservesAuditTraceability,
        availabilityAfterReloadMatchesLedger:
            lifecycle.availabilityAfterReloadMatchesLedger,
        noReturnsImplementation: afterDom.returnActionExists === false,
        noProductCrudBehaviorChanged:
            lifecycle.productHashBefore === lifecycle.productHashAfter,
        productRecordsUnchanged:
            lifecycle.productHashBefore === lifecycle.productHashAfter,
        productQuantityNotUpdated:
            lifecycle.productHashBefore === lifecycle.productHashAfter,
        legacyProductsUnchanged:
            lifecycle.legacyProductHashBefore === lifecycle.legacyProductHashAfter,
        stockMovementsOnlyExpectedChanges:
            lifecycle.stockMovementsOnlyExpectedChanges,
        invoicesOnlyExpectedLifecycleWrites:
            lifecycle.invoicesOnlyExpectedLifecycleWrites,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !runtime.env.envTracked,
    };
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts(afterDom, storage);
    writeInvoiceLifecycleRegressionSummary(summary);
    assert(runtime.result === "PASS", "V1-SALES-009 after runtime verification failed.");
}

async function collectBaselineSnapshot() {
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { getFirebaseAuth } =
            await import("/src/modules/auth/firebase/FirebaseAuthClient.ts");
        const { routeRegistry } = await import("/src/router/routes.ts");
        const { invoiceStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoicePersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");
        const { productStorageKeyForAccount } =
            await import("/src/modules/products/persistence/ProductPersistenceKey.ts");

        const state = await getAuthStateService().initialize();
        if (state.status !== "authenticated") {
            throw new Error("Authenticated session is required.");
        }

        const accountId = state.session.account.id;
        const providerUserId = getFirebaseAuth()?.currentUser?.uid ?? "";
        const invoiceScopedKey = invoiceStorageKeyForAccount(accountId);
        const stockMovementScopedKey =
            stockMovementStorageKeyForAccount(accountId);
        const productScopedKey = productStorageKeyForAccount(accountId);
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const markCancelledSource =
            String(invoiceService.markCancelled ?? "");
        const invoiceRaw = localStorage.getItem(invoiceScopedKey);
        const movementRaw = localStorage.getItem(stockMovementScopedKey);
        const productRaw = localStorage.getItem(productScopedKey);
        const legacyProductRaw = localStorage.getItem("products");
        const invoices = parseArray(invoiceRaw);
        const movements = parseArray(movementRaw);
        const products = parseArray(productRaw);
        const issuedInvoice = invoices.find(invoice =>
            invoice?.status === "issued"
            && Array.isArray(invoice?.lines)
            && invoice.lines.some(line => typeof line?.stockMovementId === "string")
        );
        const issuedLine = issuedInvoice?.lines?.find(line =>
            typeof line?.stockMovementId === "string"
            && line.stockMovementId.trim()
        );
        const cancelledInvoice = invoices.find(invoice =>
            invoice?.status === "cancelled"
            && Array.isArray(invoice?.lines)
            && invoice.lines.some(line => typeof line?.stockMovementId === "string")
        );
        const cancelledLine = cancelledInvoice?.lines?.find(line =>
            typeof line?.stockMovementId === "string"
            && line.stockMovementId.trim()
        );
        const targetInvoice = issuedInvoice ?? cancelledInvoice;
        const targetLine = issuedLine ?? cancelledLine;
        const referencedMovement = movements.find(movement =>
            movement?.id === targetLine?.stockMovementId
        );
        const reversalMovements = movements.filter(movement =>
            movement?.type === "sale_return"
            || movement?.referenceType === "invoice_return"
            || typeof movement?.metadata?.reversesMovementId === "string"
        );
        const saleReturnMovement = movements.find(movement => {
            const metadata = movement?.metadata ?? {};

            return movement?.type === "sale_return"
                && movement?.referenceType === "invoice_return"
                && movement?.referenceId === targetInvoice?.id
                && movement?.id === targetLine?.reversalStockMovementId
                && (
                    metadata.reversesMovementId === targetLine?.stockMovementId
                    || metadata.originalStockMovementId === targetLine?.stockMovementId
                );
        });
        const availableQuantity = targetLine
            ? inventoryService.getAvailableQuantity(targetLine.productId)
            : 0;

        return {
            authSessionExists: true,
            accountIdPresent: Boolean(accountId),
            providerUserIdPresent: Boolean(providerUserId),
            accountIdEqualsProviderUserId:
                Boolean(accountId) && accountId === providerUserId,
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            invoiceRouteAccess: routeRegistry.invoices?.access ?? null,
            markCancelledReversalSafe:
                markCancelledSource.includes("sale_return")
                && markCancelledSource.includes("invoice_return")
                && markCancelledSource.includes("addMovement"),
            invoiceScopedKeySanitized:
                "invoices:{" + await sanitizeValue(accountId) + "}",
            stockMovementScopedKeySanitized:
                "stockMovements:{" + await sanitizeValue(accountId) + "}",
            productScopedKeySanitized:
                "products:{" + await sanitizeValue(accountId) + "}",
            invoiceRawHash: await nullableSha256(invoiceRaw),
            stockMovementRawHash: await nullableSha256(movementRaw),
            productScopedHash: await nullableSha256(productRaw),
            legacyProductHash: await nullableSha256(legacyProductRaw),
            invoiceCount: invoices.length,
            stockMovementCount: movements.length,
            productCount: products.length,
            issuedInvoiceExists: Boolean(issuedInvoice),
            issuedInvoiceIdSanitized: await sanitizeValue(issuedInvoice?.id),
            cancelledInvoiceExists: Boolean(cancelledInvoice),
            cancelledInvoiceIdSanitized: await sanitizeValue(cancelledInvoice?.id),
            cancelledInvoiceStatus: cancelledInvoice?.status ?? "",
            cancelledAtSet: Boolean(cancelledInvoice?.cancelledAt),
            cancelledBySet: Boolean(cancelledInvoice?.cancelledBy),
            cancelReasonSet: Boolean(cancelledInvoice?.cancelReason),
            targetLineQuantity: Number(targetLine?.quantity ?? 0),
            availableQuantity,
            stockMovementIdPresent: Boolean(issuedLine?.stockMovementId),
            saleDeductionMovementIdSanitized:
                await sanitizeValue(referencedMovement?.id),
            referencedSaleDeductionExists: Boolean(referencedMovement),
            referencedMovementTypeOk:
                referencedMovement?.type === "sale_deduction",
            referencedMovementNegative:
                typeof referencedMovement?.quantityDelta === "number"
                && referencedMovement.quantityDelta < 0,
            referencedMovementAccountOk:
                referencedMovement?.accountId === targetInvoice?.accountId,
            referencedMovementProductOk:
                referencedMovement?.productId === targetLine?.productId,
            referencedMovementInvoiceOk:
                referencedMovement?.referenceId === targetInvoice?.id,
            reversalMovementCount: reversalMovements.length,
            saleReturnMovementExists: Boolean(saleReturnMovement),
            saleReturnMovementIdSanitized:
                await sanitizeValue(saleReturnMovement?.id),
            saleReturnQuantityPositive:
                typeof saleReturnMovement?.quantityDelta === "number"
                && saleReturnMovement.quantityDelta > 0,
            saleReturnProductOk:
                saleReturnMovement?.productId === targetLine?.productId,
            saleReturnAccountOk:
                saleReturnMovement?.accountId === targetInvoice?.accountId,
            saleReturnReferencesOriginal:
                saleReturnMovement?.metadata?.reversesMovementId
                    === targetLine?.stockMovementId
                || saleReturnMovement?.metadata?.originalStockMovementId
                    === targetLine?.stockMovementId,
        };
    })()`, true);
}

async function collectRouteDomEvidence() {
    return evaluate(cdp, `(() => ({
        url: location.href,
        title: document.title,
        productsPageVisible: Boolean(document.querySelector(".products-page")),
        inventoryPageVisible: Boolean(document.querySelector("#inventory-page")),
        invoicePageVisible: Boolean(document.querySelector("#invoice-draft-page")),
    }))()`);
}

async function collectDomEvidence(extra = {}) {
    return evaluate(cdp, `(() => {
        const invoicePage = document.querySelector("#invoice-draft-page");
        const issuedRow = Array.from(
            document.querySelectorAll("[data-invoice-status]")
        ).find(row => row.getAttribute("data-invoice-status") === "issued");
        const auditRows = Array.from(
            document.querySelectorAll(".invoice-line-audit-row")
        );
        const stockMovementCells = Array.from(
            document.querySelectorAll("[data-stock-movement-id]")
        );
        const reversalCells = Array.from(
            document.querySelectorAll("[data-reversal-stock-movement-id]")
        );
        const actionButtons = Array.from(
            document.querySelectorAll("button[data-action]")
        );
        const invoiceRows = Array.from(
            document.querySelectorAll(".invoice-draft-row")
        );
        const firstIssuedRow = issuedRow || null;
        const cancelTexts = Array.from(
            document.querySelectorAll("button, [role='button'], a")
        ).map(element => (element.textContent || "").trim().toLowerCase());
        return {
            url: location.href,
            title: document.title,
            productsRouteWorks: ${JSON.stringify(Boolean(extra.productsRouteWorks))},
            inventoryRouteWorks: ${JSON.stringify(Boolean(extra.inventoryRouteWorks))},
            invoicePageVisible: Boolean(invoicePage),
            issuedInvoiceVisible: Boolean(issuedRow),
            cancelledInvoiceVisible: Boolean(
                document.querySelector("[data-invoice-status='cancelled']")
            ),
            auditRowCount: auditRows.length,
            productOptionCount:
                document.querySelectorAll("#invoice-product-select option[value]").length,
            invoiceNumberVisible:
                invoiceRows.some(row =>
                    (row.querySelector("td")?.textContent || "").trim()
                ),
            invoiceTotalVisible:
                invoiceRows.some(row =>
                    (row.getAttribute("data-invoice-total") || "").trim()
                ),
            issuedAtVisible:
                Boolean(
                    firstIssuedRow
                    && (firstIssuedRow.getAttribute("data-issued-at") || "").trim()
                ),
            productSnapshotVisible:
                Array.from(
                    document.querySelectorAll(".invoice-line-product-snapshot")
                ).some(cell => (cell.textContent || "").trim()),
            lineQuantityVisible:
                Array.from(
                    document.querySelectorAll(".invoice-line-quantity")
                ).some(cell => (cell.textContent || "").trim()),
            lineUnitPriceVisible:
                Array.from(
                    document.querySelectorAll(".invoice-line-unit-price")
                ).some(cell => (cell.textContent || "").trim()),
            lineTotalVisible:
                Array.from(
                    document.querySelectorAll(".invoice-line-total")
                ).some(cell => (cell.textContent || "").trim()),
            stockMovementIdVisible:
                stockMovementCells.some(cell =>
                    (cell.getAttribute("data-stock-movement-id") || "").trim()
                ),
            reversalStockMovementIdVisible:
                reversalCells.some(cell =>
                    (cell.getAttribute("data-reversal-stock-movement-id") || "").trim()
                ),
            cancellationUiExists:
                cancelTexts.some(text =>
                    text === "cancel"
                    || text.includes("cancel invoice")
                    || text.includes("cancelled")
                    || text.includes("ط¥ظ„ط؛ط§ط،")
                ),
            draftCancelActionExists:
                actionButtons.some(button =>
                    button.getAttribute("data-action") === "cancel-invoice"
                    && button.closest("[data-invoice-status='draft']")
                ),
            issuedCancelActionExists:
                actionButtons.some(button =>
                    button.getAttribute("data-action") === "cancel-invoice"
                    && button.closest("[data-invoice-status='issued']")
                ),
            cancelledCancelActionExists:
                actionButtons.some(button =>
                    button.getAttribute("data-action") === "cancel-invoice"
                    && button.closest("[data-invoice-status='cancelled']")
                ),
            returnActionExists:
                actionButtons.some(button =>
                    (button.getAttribute("data-action") || "").includes("return")
                    || (button.textContent || "").toLowerCase().includes("return")
                ),
            visibleInvoiceStatuses: Array.from(
                document.querySelectorAll("[data-invoice-status]")
            ).map(row => row.getAttribute("data-invoice-status")),
        };
    })()`);
}

async function runLifecycleScenario() {
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { getFirebaseAuth } =
            await import("/src/modules/auth/firebase/FirebaseAuthClient.ts");
        const { invoiceStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoicePersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");
        const { productStorageKeyForAccount } =
            await import("/src/modules/products/persistence/ProductPersistenceKey.ts");

        const state = await getAuthStateService().initialize();
        if (state.status !== "authenticated") {
            throw new Error("Authenticated session is required.");
        }

        const accountId = state.session.account.id;
        const providerUserId = getFirebaseAuth()?.currentUser?.uid ?? "";
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const productService = Container.get("productService");
        const invoiceScopedKey = invoiceStorageKeyForAccount(accountId);
        const stockMovementScopedKey =
            stockMovementStorageKeyForAccount(accountId);
        const productScopedKey = productStorageKeyForAccount(accountId);
        const beforeInvoiceRaw = localStorage.getItem(invoiceScopedKey);
        const beforeMovementRaw = localStorage.getItem(stockMovementScopedKey);
        const beforeProductRaw = localStorage.getItem(productScopedKey);
        const beforeLegacyProductRaw = localStorage.getItem("products");
        const invoicesBefore = invoiceService.getAll();
        const movementsBefore = inventoryService.getAll();
        const products = productService.getAll();
        const activeProducts = products.filter(product =>
            !product.isDeleted && !product.deletedAt
        );
        const targetProduct = activeProducts.find(product =>
            inventoryService.getAvailableQuantity(product.id) >= 3
        );

        if (!targetProduct) {
            throw new Error("No active product with enough available stock for lifecycle regression.");
        }

        const existingIssuedInvoice = invoicesBefore.find(invoice =>
            invoice.status === "issued"
        );
        const existingIssuedInvoiceRawId = existingIssuedInvoice?.id ?? "";
        const unitPrice = Number.isFinite(Number(targetProduct.salePrice))
            ? Number(targetProduct.salePrice)
            : 10;
        const availabilityBeforeIssue =
            inventoryService.getAvailableQuantity(targetProduct.id);
        const productQuantityBefore = Number(targetProduct.quantity ?? 0);
        const saleDeductionCountBefore = movementsBefore
            .filter(movement => movement.type === "sale_deduction")
            .length;
        const saleReturnCountBefore = movementsBefore
            .filter(movement => movement.type === "sale_return")
            .length;
        const invoiceCountBefore = invoicesBefore.length;
        const movementCountBefore = movementsBefore.length;
        const softDeletedProductsNotSelectable = products.every(product =>
            !product.isDeleted && !product.deletedAt
        );
        const lineInput = quantity => ({
            productId: targetProduct.id,
            productNameSnapshot: targetProduct.name,
            skuSnapshot: targetProduct.sku,
            barcodeSnapshot: targetProduct.barcode,
            unitSnapshot: targetProduct.unit,
            quantity,
            unitPrice,
        });
        const numberClose = (left, right) =>
            Math.abs(Number(left) - Number(right)) < 0.0001;

        const invalidDraftCountBefore = invoiceService.getAll().length;
        const invalidDraftResult = invoiceService.createDraft({
            customerSnapshot: { displayName: "" },
            lines: [],
        });
        const invalidDraftWriteRejected =
            invalidDraftResult.success === false
            && invoiceService.getAll().length === invalidDraftCountBefore;

        const createResult = invoiceService.createDraft({
            customerSnapshot: { displayName: "V1 SALES 009 Customer" },
            lines: [lineInput(1)],
            notes: "V1-SALES-009 lifecycle draft",
        });

        if (!createResult.success || !createResult.invoice) {
            throw new Error("Valid draft create failed: " + createResult.errors.join("; "));
        }

        const draft = createResult.invoice;
        const movementCountAfterCreate = inventoryService.getAll().length;
        const draftStatusDraft = draft.status === "draft";
        const draftHasAccountAndCreatedBy =
            draft.accountId === accountId && Boolean(draft.createdBy);
        const invoiceLineIncludesProductSnapshot =
            draft.lines.length === 1
            && draft.lines[0].productId === targetProduct.id
            && draft.lines[0].productNameSnapshot === targetProduct.name
            && draft.lines[0].stockMovementId == null;
        const draftTotalsCorrect =
            draft.lines.length === 1
            && numberClose(draft.lines[0].lineTotal, unitPrice)
            && numberClose(draft.total, unitPrice);
        const validDraftCreateWritesInvoice =
            invoiceService.getAll().length === invoiceCountBefore + 1;

        const updateResult = invoiceService.updateDraft(draft.id, {
            lines: [lineInput(2)],
            notes: "V1-SALES-009 lifecycle draft updated",
        });

        if (!updateResult.success || !updateResult.invoice) {
            throw new Error("Draft update failed: " + updateResult.errors.join("; "));
        }

        const updatedDraft = updateResult.invoice;
        const movementCountAfterUpdate = inventoryService.getAll().length;
        const draftUpdatePreservesIdAndAccount =
            updatedDraft.id === draft.id
            && updatedDraft.accountId === accountId;
        const draftUpdatePersistsTotals =
            updatedDraft.lines.length === 1
            && updatedDraft.lines[0].quantity === 2
            && numberClose(updatedDraft.total, unitPrice * 2);
        const draftUpdateCreatesNoStockMovement =
            movementCountAfterUpdate === movementCountAfterCreate;

        const failedIssueMovementCountBefore = inventoryService.getAll().length;
        const failedDraftResult = invoiceService.createDraft({
            customerSnapshot: { displayName: "V1 SALES 009 Insufficient Stock" },
            lines: [lineInput(availabilityBeforeIssue + 100)],
            notes: "V1-SALES-009 insufficient quantity fixture",
        });

        if (!failedDraftResult.success || !failedDraftResult.invoice) {
            throw new Error("Insufficient-stock draft fixture create failed.");
        }

        const failedIssueResult = invoiceService.markIssued(
            failedDraftResult.invoice.id
        );
        const failedIssueDraftAfter = invoiceService.getById(
            failedDraftResult.invoice.id
        );
        const failedIssueMovementCountAfter = inventoryService.getAll().length;
        const saleDeductionCountAfterFailedIssue = inventoryService.getAll()
            .filter(movement => movement.type === "sale_deduction")
            .length;
        const failedIssueBlocked = failedIssueResult.success === false;
        const failedIssueLeavesDraft =
            failedIssueDraftAfter?.status === "draft";
        const failedIssueCreatesNoSaleDeduction =
            saleDeductionCountAfterFailedIssue === saleDeductionCountBefore;
        const failedIssueDoesNotChangeMovementCount =
            failedIssueMovementCountAfter === failedIssueMovementCountBefore;
        const failedIssueRecordsSafeError =
            Array.isArray(failedIssueResult.errors)
            && failedIssueResult.errors.length > 0;

        const issueMovementCountBefore = inventoryService.getAll().length;
        const issueResult = invoiceService.markIssued(updatedDraft.id);

        if (!issueResult.success || !issueResult.invoice) {
            throw new Error("Valid invoice issue failed: " + issueResult.errors.join("; "));
        }

        const issuedInvoice = issueResult.invoice;
        const issuedLine = issuedInvoice.lines[0];
        const movementsAfterIssue = inventoryService.getAll();
        const saleDeduction = movementsAfterIssue.find(movement =>
            movement.id === issuedLine.stockMovementId
        );
        const availabilityAfterIssue =
            inventoryService.getAvailableQuantity(targetProduct.id);
        const productAfterIssue = productService.find(targetProduct.id);
        const successfulIssue = issueResult.success === true;
        const invoiceStatusIssued = issuedInvoice.status === "issued";
        const issuedAtSet = Boolean(issuedInvoice.issuedAt);
        const issuedIdAccountUnchanged =
            issuedInvoice.id === updatedDraft.id
            && issuedInvoice.accountId === accountId;
        const saleDeductionCreated =
            movementsAfterIssue.length === issueMovementCountBefore + 1
            && Boolean(saleDeduction);
        const saleDeductionNegative =
            typeof saleDeduction?.quantityDelta === "number"
            && saleDeduction.quantityDelta < 0;
        const saleDeductionProductMatches =
            saleDeduction?.productId === targetProduct.id;
        const invoiceLineStockMovementIdSet =
            typeof issuedLine.stockMovementId === "string"
            && issuedLine.stockMovementId.trim().length > 0;
        const stockMovementIdReferencesSaleDeduction =
            saleDeduction?.id === issuedLine.stockMovementId;
        const availableStockDecreasesCorrectly =
            availabilityAfterIssue === availabilityBeforeIssue - 2;
        const referencedSaleDeductionRemainsStored = Boolean(
            inventoryService.getAll().find(movement =>
                movement.id === issuedLine.stockMovementId
                && movement.type === "sale_deduction"
            )
        );
        const productQuantityAfterIssue = Number(productAfterIssue?.quantity ?? 0);

        const duplicateIssueMovementCountBefore =
            inventoryService.getAll().length;
        const duplicateIssueResult = invoiceService.markIssued(issuedInvoice.id);
        const duplicateIssueMovementCountAfter =
            inventoryService.getAll().length;
        const duplicateIssueCreatesNoDuplicateSaleDeduction =
            duplicateIssueResult.success === false
            && duplicateIssueMovementCountAfter
                === duplicateIssueMovementCountBefore;
        const duplicateIssueLeavesIssued =
            invoiceService.getById(issuedInvoice.id)?.status === "issued";

        const draftCancellationMovementCountBefore =
            inventoryService.getAll().length;
        const draftCancelResult = invoiceService.markCancelled(
            failedDraftResult.invoice.id,
            "V1-SALES-009 draft cancellation should remain blocked"
        );
        const draftCancellationMovementCountAfter =
            inventoryService.getAll().length;
        const draftCancellationBlocked =
            draftCancelResult.success === false
            && invoiceService.getById(failedDraftResult.invoice.id)?.status
                === "draft"
            && draftCancellationMovementCountAfter
                === draftCancellationMovementCountBefore;

        const cancellationMovementCountBefore =
            inventoryService.getAll().length;
        const cancelResult = invoiceService.markCancelled(
            issuedInvoice.id,
            "V1-SALES-009 lifecycle cancellation"
        );

        if (!cancelResult.success || !cancelResult.invoice) {
            throw new Error("Issued invoice cancellation failed: " + cancelResult.errors.join("; "));
        }

        const cancelledInvoice = cancelResult.invoice;
        const cancelledLine = cancelledInvoice.lines[0];
        const movementsAfterCancel = inventoryService.getAll();
        const saleReturn = movementsAfterCancel.find(movement => {
            const metadata = movement.metadata ?? {};

            return movement.type === "sale_return"
                && movement.referenceType === "invoice_return"
                && movement.referenceId === cancelledInvoice.id
                && (
                    metadata.reversesMovementId === issuedLine.stockMovementId
                    || metadata.originalStockMovementId === issuedLine.stockMovementId
                );
        });
        const availabilityAfterCancellation =
            inventoryService.getAvailableQuantity(targetProduct.id);
        const productAfterCancellation = productService.find(targetProduct.id);
        const originalSaleDeductionPreserved = Boolean(
            inventoryService.getAll().find(movement =>
                movement.id === issuedLine.stockMovementId
                && movement.type === "sale_deduction"
            )
        );
        const issuedCancellationSucceeded = cancelResult.success === true;
        const cancelledStatusSet = cancelledInvoice.status === "cancelled";
        const cancelledAtSet = Boolean(cancelledInvoice.cancelledAt);
        const cancelledBySet = Boolean(cancelledInvoice.cancelledBy);
        const saleReturnCreated =
            movementsAfterCancel.length === cancellationMovementCountBefore + 1
            && Boolean(saleReturn);
        const saleReturnPositive =
            typeof saleReturn?.quantityDelta === "number"
            && saleReturn.quantityDelta > 0;
        const saleReturnProductMatches =
            saleReturn?.productId === targetProduct.id;
        const saleReturnReferencesOriginal =
            saleReturn?.metadata?.reversesMovementId === issuedLine.stockMovementId
            || saleReturn?.metadata?.originalStockMovementId
                === issuedLine.stockMovementId;
        const saleReturnAccountMatches =
            saleReturn?.accountId === accountId;
        const availableStockRestored =
            availabilityAfterCancellation === availabilityBeforeIssue;
        const productQuantityAfterCancellation =
            Number(productAfterCancellation?.quantity ?? 0);

        const duplicateCancelMovementCountBefore =
            inventoryService.getAll().length;
        const duplicateCancelResult = invoiceService.markCancelled(
            cancelledInvoice.id,
            "V1-SALES-009 duplicate cancellation should remain blocked"
        );
        const duplicateCancelMovementCountAfter =
            inventoryService.getAll().length;
        const duplicateCancellationCreatesNoDuplicateSaleReturn =
            duplicateCancelResult.success === false
            && duplicateCancelMovementCountAfter
                === duplicateCancelMovementCountBefore;
        const duplicateCancellationLeavesCancelled =
            invoiceService.getById(cancelledInvoice.id)?.status === "cancelled";

        const finalInvoices = invoiceService.getAll();
        const finalMovements = inventoryService.getAll();
        const finalInvoiceRaw = localStorage.getItem(invoiceScopedKey);
        const finalMovementRaw = localStorage.getItem(stockMovementScopedKey);
        const finalProductRaw = localStorage.getItem(productScopedKey);
        const finalLegacyProductRaw = localStorage.getItem("products");
        const finalSaleDeductionCount = finalMovements
            .filter(movement => movement.type === "sale_deduction")
            .length;
        const finalSaleReturnCount = finalMovements
            .filter(movement => movement.type === "sale_return")
            .length;
        const stockMovementsOnlyExpectedChanges =
            finalMovements.length === movementCountBefore + 2
            && finalSaleDeductionCount === saleDeductionCountBefore + 1
            && finalSaleReturnCount === saleReturnCountBefore + 1;
        const invoicesOnlyExpectedLifecycleWrites =
            finalInvoices.length === invoiceCountBefore + 2;

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            accountIdEqualsProviderUserId:
                Boolean(accountId) && accountId === providerUserId,
            invoiceScopedKey: "invoices:{" + await sanitizeValue(accountId) + "}",
            stockMovementScopedKey:
                "stockMovements:{" + await sanitizeValue(accountId) + "}",
            productScopedKey: "products:{" + await sanitizeValue(accountId) + "}",
            productIdSanitized: await sanitizeValue(targetProduct.id),
            draftInvoiceIdSanitized: await sanitizeValue(failedDraftResult.invoice.id),
            issuedInvoiceIdSanitized: await sanitizeValue(issuedInvoice.id),
            cancelledInvoiceIdSanitized:
                await sanitizeValue(cancelledInvoice.id),
            saleDeductionMovementIdSanitized:
                await sanitizeValue(saleDeduction?.id),
            saleReturnMovementIdSanitized:
                await sanitizeValue(saleReturn?.id),
            existingIssuedInvoiceIdSanitized:
                await sanitizeValue(existingIssuedInvoiceRawId),
            _rawProductId: targetProduct.id,
            _rawDraftInvoiceId: failedDraftResult.invoice.id,
            _rawCancelledInvoiceId: cancelledInvoice.id,
            _rawExistingIssuedInvoiceId: existingIssuedInvoiceRawId,
            _rawSaleDeductionMovementId: saleDeduction?.id ?? "",
            _rawSaleReturnMovementId: saleReturn?.id ?? "",
            invoiceCountBefore,
            invoiceCountAfter: finalInvoices.length,
            movementCountBefore,
            movementCountAfter: finalMovements.length,
            saleDeductionCountBefore,
            saleReturnCountBefore,
            productHashBefore: await nullableSha256(beforeProductRaw),
            productHashAfter: await nullableSha256(finalProductRaw),
            legacyProductHashBefore: await nullableSha256(beforeLegacyProductRaw),
            legacyProductHashAfter: await nullableSha256(finalLegacyProductRaw),
            invoiceRawHashBefore: await nullableSha256(beforeInvoiceRaw),
            invoiceRawHashAfter: await nullableSha256(finalInvoiceRaw),
            stockMovementRawHashBefore: await nullableSha256(beforeMovementRaw),
            stockMovementRawHashAfter: await nullableSha256(finalMovementRaw),
            availabilityBeforeIssue,
            availabilityAfterIssue,
            availabilityAfterCancellation,
            productQuantityBefore,
            productQuantityAfterIssue,
            productQuantityAfterCancellation,
            invalidDraftWriteRejected,
            validDraftCreateWritesInvoice,
            draftStatusDraft,
            draftHasAccountAndCreatedBy,
            invoiceLineIncludesProductSnapshot,
            draftTotalsCorrect,
            draftUpdatePreservesIdAndAccount,
            draftUpdatePersistsTotals,
            draftUpdateCreatesNoStockMovement,
            failedIssueBlocked,
            failedIssueLeavesDraft,
            failedIssueCreatesNoSaleDeduction,
            failedIssueDoesNotChangeMovementCount,
            failedIssueRecordsSafeError,
            successfulIssue,
            invoiceStatusIssued,
            issuedAtSet,
            issuedIdAccountUnchanged,
            saleDeductionCreated,
            saleDeductionNegative,
            saleDeductionProductMatches,
            invoiceLineStockMovementIdSet,
            stockMovementIdReferencesSaleDeduction,
            availableStockDecreasesCorrectly,
            referencedSaleDeductionRemainsStored,
            duplicateIssueCreatesNoDuplicateSaleDeduction,
            duplicateIssueLeavesIssued,
            draftCancellationBlocked,
            issuedCancellationSucceeded,
            cancelledStatusSet,
            cancelledAtSet,
            cancelledBySet,
            originalSaleDeductionPreserved,
            saleReturnCreated,
            saleReturnPositive,
            saleReturnProductMatches,
            saleReturnReferencesOriginal,
            saleReturnAccountMatches,
            availableStockRestored,
            duplicateCancellationCreatesNoDuplicateSaleReturn,
            duplicateCancellationLeavesCancelled,
            stockMovementsOnlyExpectedChanges,
            invoicesOnlyExpectedLifecycleWrites,
            softDeletedProductsNotSelectable,
        };
    })()`, true);
}

async function collectLifecycleReloadEvidence(lifecycle) {
    return evaluate(cdp, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const productId = ${JSON.stringify(lifecycle._rawProductId)};
        const draftInvoiceId = ${JSON.stringify(lifecycle._rawDraftInvoiceId)};
        const cancelledInvoiceId = ${JSON.stringify(lifecycle._rawCancelledInvoiceId)};
        const existingIssuedInvoiceId =
            ${JSON.stringify(lifecycle._rawExistingIssuedInvoiceId)};
        const saleDeductionMovementId =
            ${JSON.stringify(lifecycle._rawSaleDeductionMovementId)};
        const saleReturnMovementId =
            ${JSON.stringify(lifecycle._rawSaleReturnMovementId)};
        const draftInvoice = invoiceService.getById(draftInvoiceId);
        const cancelledInvoice = invoiceService.getById(cancelledInvoiceId);
        const existingIssuedInvoice = existingIssuedInvoiceId
            ? invoiceService.getById(existingIssuedInvoiceId)
            : null;
        const movements = inventoryService.getAll();
        const saleDeduction = movements.find(movement =>
            movement.id === saleDeductionMovementId
        );
        const saleReturn = movements.find(movement =>
            movement.id === saleReturnMovementId
        );
        const availableQuantity = inventoryService.getAvailableQuantity(productId);

        return {
            reloadPreservesDraftInvoices: draftInvoice?.status === "draft",
            reloadPreservesIssuedInvoices:
                !existingIssuedInvoiceId
                || existingIssuedInvoice?.status === "issued",
            reloadPreservesCancelledInvoices:
                cancelledInvoice?.status === "cancelled",
            reloadPreservesSaleDeduction:
                saleDeduction?.type === "sale_deduction",
            reloadPreservesSaleReturn:
                saleReturn?.type === "sale_return",
            reloadPreservesAuditTraceability:
                cancelledInvoice?.lines?.some(line =>
                    line.stockMovementId === saleDeductionMovementId
                    && line.reversalStockMovementId === saleReturnMovementId
                ) === true,
            availabilityAfterReload: availableQuantity,
        };
    })()`, true);
}

async function exerciseBlockedCancellationCases() {
    return evaluate(cdp, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const invoices = invoiceService.getAll();
        const draftInvoice = invoices.find(invoice => invoice.status === "draft");
        const movementCountBefore = inventoryService.getAll().length;
        const draftResult = draftInvoice
            ? invoiceService.markCancelled(
                draftInvoice.id,
                "V1-SALES-009 draft cancellation should fail"
            )
            : { success: false, errors: ["No draft invoice fixture"] };
        const missingResult = invoiceService.markCancelled(
            "missing-invoice-v1-sales-009",
            "V1-SALES-009 missing invoice should fail"
        );
        const movementCountAfter = inventoryService.getAll().length;
        const draftAfter = draftInvoice
            ? invoiceService.getById(draftInvoice.id)
            : null;

        return {
            draftCancellationAttempted: Boolean(draftInvoice),
            draftCancellationSucceeded: draftResult.success,
            draftStatusAfter: draftAfter?.status ?? null,
            missingInvoiceSucceeded: missingResult.success,
            movementCountBefore,
            movementCountAfter,
        };
    })()`, true);
}

async function confirmFirstIssuedCancellation() {
    await evaluate(cdp, `(() => {
        window.confirm = () => true;
        const cancelButton = document.querySelector(
            "button[data-action='cancel-invoice']"
        );
        if (!cancelButton) {
            throw new Error("Issued invoice cancel button was not found.");
        }
        cancelButton.click();
        return true;
    })()`);
}

async function exerciseDuplicateCancellationCase() {
    return evaluate(cdp, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const invoiceService = Container.get("invoiceService");
        const inventoryService = Container.get("inventoryService");
        const cancelledInvoice = invoiceService.getAll()
            .find(invoice => invoice.status === "cancelled");

        if (!cancelledInvoice) {
            throw new Error("Cancelled invoice was not found.");
        }

        const movementCountBefore = inventoryService.getAll().length;
        const duplicateResult = invoiceService.markCancelled(
            cancelledInvoice.id,
            "V1-SALES-009 duplicate cancellation should fail"
        );
        const movementCountAfter = inventoryService.getAll().length;

        return {
            duplicateSucceeded: duplicateResult.success,
            movementCountBefore,
            movementCountAfter,
            errors: duplicateResult.errors,
        };
    })()`, true);
}

function buildSnapshotSummary(before, after) {
    return {
        accountIdSanitized: before.accountIdSanitized,
        invoiceScopedKey: before.invoiceScopedKeySanitized,
        stockMovementScopedKey: before.stockMovementScopedKeySanitized,
        productScopedKey: before.productScopedKeySanitized,
        issuedInvoiceIdSanitized: before.issuedInvoiceIdSanitized,
        saleDeductionMovementIdSanitized:
            before.saleDeductionMovementIdSanitized,
        invoiceCountBefore: before.invoiceCount,
        invoiceCountAfter: after.invoiceCount,
        stockMovementCountBefore: before.stockMovementCount,
        stockMovementCountAfter: after.stockMovementCount,
        productHashBefore: before.productScopedHash,
        productHashAfter: after.productScopedHash,
        legacyProductHashBefore: before.legacyProductHash,
        legacyProductHashAfter: after.legacyProductHash,
        reversalMovementCountBefore: before.reversalMovementCount,
        reversalMovementCountAfter: after.reversalMovementCount,
    };
}

function buildLifecycleSummary(
    before,
    lifecycle,
    reloadSnapshot,
    beforeDom,
    afterDom
) {
    return {
        accountIdSanitized: before.accountIdSanitized,
        invoiceScopedKey: before.invoiceScopedKeySanitized,
        stockMovementScopedKey: before.stockMovementScopedKeySanitized,
        productScopedKey: before.productScopedKeySanitized,
        draftInvoiceId: lifecycle.draftInvoiceIdSanitized,
        issuedInvoiceId: lifecycle.issuedInvoiceIdSanitized,
        cancelledInvoiceId: lifecycle.cancelledInvoiceIdSanitized,
        saleDeductionMovementId:
            lifecycle.saleDeductionMovementIdSanitized,
        saleReturnMovementId: lifecycle.saleReturnMovementIdSanitized,
        duplicateIssueResult: {
            blocked: lifecycle.duplicateIssueCreatesNoDuplicateSaleDeduction,
            invoiceStillIssued: lifecycle.duplicateIssueLeavesIssued,
        },
        duplicateCancellationResult: {
            blocked:
                lifecycle.duplicateCancellationCreatesNoDuplicateSaleReturn,
            invoiceStillCancelled:
                lifecycle.duplicateCancellationLeavesCancelled,
        },
        availabilityBeforeIssue: lifecycle.availabilityBeforeIssue,
        availabilityAfterIssue: lifecycle.availabilityAfterIssue,
        availabilityAfterCancellation: lifecycle.availabilityAfterCancellation,
        availabilityAfterReload: lifecycle.availabilityAfterReload,
        invoiceCountBefore: lifecycle.invoiceCountBefore,
        invoiceCountAfter: lifecycle.invoiceCountAfter,
        movementCountBefore: lifecycle.movementCountBefore,
        movementCountAfter: lifecycle.movementCountAfter,
        productScopedKeyHashBefore: lifecycle.productHashBefore,
        productScopedKeyHashAfter: lifecycle.productHashAfter,
        legacyProductKeyHashBefore: lifecycle.legacyProductHashBefore,
        legacyProductKeyHashAfter: lifecycle.legacyProductHashAfter,
        routeEvidence: {
            productsRouteWorks: beforeDom.productsRouteWorks,
            inventoryRouteWorks: beforeDom.inventoryRouteWorks,
            invoiceRouteWorks: beforeDom.invoicePageVisible,
            invoiceRouteAccess: before.invoiceRouteAccess,
            routeGuardActive: before.invoiceRouteAccess === "protected",
        },
        draftCreateUpdateResult: {
            invalidDraftRejected: lifecycle.invalidDraftWriteRejected,
            validDraftCreated: lifecycle.validDraftCreateWritesInvoice,
            draftUpdated: lifecycle.draftUpdatePersistsTotals,
            draftUpdateNoMovement:
                lifecycle.draftUpdateCreatesNoStockMovement,
        },
        failedIssueResult: {
            blocked: lifecycle.failedIssueBlocked,
            remainsDraft: lifecycle.failedIssueLeavesDraft,
            noSaleDeduction: lifecycle.failedIssueCreatesNoSaleDeduction,
        },
        successfulIssueResult: {
            issued: lifecycle.successfulIssue,
            saleDeductionCreated: lifecycle.saleDeductionCreated,
            stockMovementLinked:
                lifecycle.stockMovementIdReferencesSaleDeduction,
            availableStockDecreased:
                lifecycle.availableStockDecreasesCorrectly,
        },
        auditViewResult: {
            issuedVisibleAfterReload: afterDom.issuedInvoiceVisible,
            cancelledVisibleAfterReload: afterDom.cancelledInvoiceVisible,
            invoiceNumberVisible: afterDom.invoiceNumberVisible,
            invoiceTotalVisible: afterDom.invoiceTotalVisible,
            issuedAtVisible: afterDom.issuedAtVisible,
            productSnapshotVisible: afterDom.productSnapshotVisible,
            stockMovementIdVisible: afterDom.stockMovementIdVisible,
            reversalReferenceVisible:
                afterDom.reversalStockMovementIdVisible,
            reloadIssuedExists: reloadSnapshot.issuedInvoiceExists,
            reloadCancelledExists: reloadSnapshot.cancelledInvoiceExists,
        },
        cancellationResult: {
            draftCancellationBlocked: lifecycle.draftCancellationBlocked,
            issuedCancellationSucceeded:
                lifecycle.issuedCancellationSucceeded,
            cancelledStatusSet: lifecycle.cancelledStatusSet,
            cancelledAtSet: lifecycle.cancelledAtSet,
            cancelledBySet: lifecycle.cancelledBySet,
            saleReturnCreated: lifecycle.saleReturnCreated,
            saleReturnPositive: lifecycle.saleReturnPositive,
            saleReturnReferencesOriginal:
                lifecycle.saleReturnReferencesOriginal,
            availableStockRestored: lifecycle.availableStockRestored,
        },
        reloadPersistenceResult: {
            draftInvoices: lifecycle.reloadPreservesDraftInvoices,
            issuedInvoices: lifecycle.reloadPreservesIssuedInvoices,
            cancelledInvoices: lifecycle.reloadPreservesCancelledInvoices,
            saleDeduction: lifecycle.reloadPreservesSaleDeduction,
            saleReturn: lifecycle.reloadPreservesSaleReturn,
            auditTraceability: lifecycle.reloadPreservesAuditTraceability,
            availabilityMatchesLedger:
                lifecycle.availabilityAfterReloadMatchesLedger,
        },
        productSafetyResult: {
            productRecordsUnchanged:
                lifecycle.productHashBefore === lifecycle.productHashAfter,
            productQuantityBefore: lifecycle.productQuantityBefore,
            productQuantityAfterIssue: lifecycle.productQuantityAfterIssue,
            productQuantityAfterCancellation:
                lifecycle.productQuantityAfterCancellation,
            legacyProductsUnchanged:
                lifecycle.legacyProductHashBefore
                === lifecycle.legacyProductHashAfter,
        },
        inventorySafetyResult: {
            stockMovementsOnlyExpectedChanges:
                lifecycle.stockMovementsOnlyExpectedChanges,
            invoicesOnlyExpectedLifecycleWrites:
                lifecycle.invoicesOnlyExpectedLifecycleWrites,
        },
        noReturnsImplementation: afterDom.returnActionExists === false,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

function sanitizeLifecycleStorageSnapshot(before, lifecycle) {
    return {
        accountId: before.accountIdSanitized,
        invoiceScopedKey: before.invoiceScopedKeySanitized,
        stockMovementScopedKey: before.stockMovementScopedKeySanitized,
        productScopedKey: before.productScopedKeySanitized,
        draftInvoiceId: lifecycle.draftInvoiceIdSanitized,
        issuedInvoiceId: lifecycle.issuedInvoiceIdSanitized,
        cancelledInvoiceId: lifecycle.cancelledInvoiceIdSanitized,
        saleDeductionMovementId:
            lifecycle.saleDeductionMovementIdSanitized,
        saleReturnMovementId: lifecycle.saleReturnMovementIdSanitized,
        invoiceCountBefore: lifecycle.invoiceCountBefore,
        invoiceCountAfter: lifecycle.invoiceCountAfter,
        stockMovementCountBefore: lifecycle.movementCountBefore,
        stockMovementCountAfter: lifecycle.movementCountAfter,
        productScopedHashBefore: lifecycle.productHashBefore,
        productScopedHashAfter: lifecycle.productHashAfter,
        legacyProductHashBefore: lifecycle.legacyProductHashBefore,
        legacyProductHashAfter: lifecycle.legacyProductHashAfter,
        invoiceRawHashBefore: lifecycle.invoiceRawHashBefore,
        invoiceRawHashAfter: lifecycle.invoiceRawHashAfter,
        stockMovementRawHashBefore: lifecycle.stockMovementRawHashBefore,
        stockMovementRawHashAfter: lifecycle.stockMovementRawHashAfter,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

function buildCancellationSummary(
    before,
    afterCancellation,
    afterDuplicate,
    reloadSnapshot,
    blockedAttempts,
    duplicateAttempt,
    beforeDom,
    afterDom
) {
    return {
        accountIdSanitized: before.accountIdSanitized,
        invoiceScopedKey: before.invoiceScopedKeySanitized,
        stockMovementScopedKey: before.stockMovementScopedKeySanitized,
        cancelledInvoiceId: afterCancellation.cancelledInvoiceIdSanitized,
        originalSaleDeductionMovementId:
            before.saleDeductionMovementIdSanitized,
        saleReturnReversalMovementId:
            afterCancellation.saleReturnMovementIdSanitized,
        reversalReferenceResult: {
            saleReturnExists: afterCancellation.saleReturnMovementExists,
            referencesOriginal:
                afterCancellation.saleReturnReferencesOriginal,
            productMatches: afterCancellation.saleReturnProductOk,
            accountMatches: afterCancellation.saleReturnAccountOk,
        },
        availableQuantityBeforeCancellation: before.availableQuantity,
        availableQuantityAfterCancellation:
            afterCancellation.availableQuantity,
        movementCountBeforeCancellation: before.stockMovementCount,
        movementCountAfterCancellation: afterCancellation.stockMovementCount,
        movementCountAfterDuplicateCancellationAttempt:
            afterDuplicate.stockMovementCount,
        invoiceStatusBefore: "issued",
        invoiceStatusAfter: afterCancellation.cancelledInvoiceStatus,
        cancelledAtSet: afterCancellation.cancelledAtSet,
        cancelledBySet: afterCancellation.cancelledBySet,
        cancellationReasonRecorded: afterCancellation.cancelReasonSet,
        productScopedKeyHashBefore: before.productScopedHash,
        productScopedKeyHashAfter: afterDuplicate.productScopedHash,
        legacyProductKeyHashBefore: before.legacyProductHash,
        legacyProductKeyHashAfter: afterDuplicate.legacyProductHash,
        draftCancellationBlocked:
            blockedAttempts.draftCancellationSucceeded === false,
        missingInvoiceCancellationBlocked:
            blockedAttempts.missingInvoiceSucceeded === false,
        duplicateCancellationBlocked:
            duplicateAttempt.duplicateSucceeded === false,
        duplicateMovementCountStable:
            duplicateAttempt.movementCountBefore
            === duplicateAttempt.movementCountAfter,
        cancelButtonVisibleBeforeCancellation:
            beforeDom.issuedCancelActionExists,
        cancelledInvoiceReadonly:
            afterDom.cancelledCancelActionExists === false,
        cancelledStatusDisplayed:
            afterDom.cancelledInvoiceVisible,
        reversalReferenceDisplayed:
            afterDom.reversalStockMovementIdVisible,
        reloadCancelledInvoiceExists:
            reloadSnapshot.cancelledInvoiceExists,
        reloadSaleReturnExists:
            reloadSnapshot.saleReturnMovementExists,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

function writeInvoiceCancellationSummary(summary) {
    writeFileSync(
        resolve(outputDir, "invoice-cancellation-summary.json"),
        JSON.stringify(summary, null, 2)
    );
}

function writeInvoiceLifecycleRegressionSummary(summary) {
    writeFileSync(
        resolve(outputDir, "invoice-lifecycle-regression-summary.json"),
        JSON.stringify(summary, null, 2)
    );
}

function sanitizeStorageSnapshot(before, after) {
    return {
        accountId: before.accountIdSanitized,
        invoiceScopedKey: before.invoiceScopedKeySanitized,
        stockMovementScopedKey: before.stockMovementScopedKeySanitized,
        productScopedKey: before.productScopedKeySanitized,
        issuedInvoiceExists: before.issuedInvoiceExists,
        saleDeductionTraceResult: {
            exists: before.referencedSaleDeductionExists,
            typeOk: before.referencedMovementTypeOk,
            negativeQuantityDelta: before.referencedMovementNegative,
            accountOk: before.referencedMovementAccountOk,
            productOk: before.referencedMovementProductOk,
            invoiceReferenceOk: before.referencedMovementInvoiceOk,
        },
        invoiceCountBefore: before.invoiceCount,
        invoiceCountAfter: after.invoiceCount,
        stockMovementCountBefore: before.stockMovementCount,
        stockMovementCountAfter: after.stockMovementCount,
        reversalMovementCountBefore: before.reversalMovementCount,
        reversalMovementCountAfter: after.reversalMovementCount,
        productScopedHashBefore: before.productScopedHash,
        productScopedHashAfter: after.productScopedHash,
        legacyProductHashBefore: before.legacyProductHash,
        legacyProductHashAfter: after.legacyProductHash,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

async function navigateRoute(connection, route) {
    await evaluate(connection, `(async () => {
        const { Container } = await import("/src/core/Container.ts");
        const router = Container.get("router");
        await router.navigate(${JSON.stringify(route)});
        return true;
    })()`, true);
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

async function writeArtifacts(dom, storage) {
    const prefix = mode === "baseline" ? "baseline" : "after";
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

function writeFailureArtifacts() {
    mkdirSync(outputDir, { recursive: true });
    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    writeFileSync(
        resolve(outputDir, "runtime-failure.json"),
        JSON.stringify(runtime, null, 2)
    );
    writeFileSync(
        resolve(outputDir, "console-failure.log"),
        consoleEntries.map(entry => JSON.stringify(entry)).join("\n")
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

async function startOrReuseVite() {
    try {
        const response = await fetch(appUrl);
        if (response.ok) {
            runtime.server.reusedExisting = true;
            return undefined;
        }
    } catch {}

    const process = startVite();
    runtime.server.started = true;
    await waitForHttpOk(appUrl);
    return process;
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

function allGatesPass(gates) {
    return Object.values(gates).every(Boolean);
}

function countConsoleErrors(entries) {
    return entries.filter(entry =>
        entry.type === "error" || entry.level === "error"
    ).length;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function delay(milliseconds) {
    return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

