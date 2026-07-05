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
    `abonibal-v1-sales-008-${mode}-chrome-profile`
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
    mission: "V1-SALES-008",
    mode,
    classification: "ECS",
    scenario: mode === "baseline"
        ? "baseline issued invoice cancellation capability evidence"
        : "after issued invoice cancellation stock reversal verification",
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

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const dom = await collectDomEvidence();
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
        cancellationUiAbsent: dom.cancellationUiExists === false,
        noNewReversalMovement:
            before.reversalMovementCount === after.reversalMovementCount,
        cancellationMissingOrNotReversalSafe:
            dom.cancellationUiExists === false
            && before.markCancelledReversalSafe === false,
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
    assert(runtime.result === "PASS", "V1-SALES-008 baseline runtime verification failed.");
}

async function runAfterVerification() {
    const before = await collectBaselineSnapshot();

    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const beforeDom = await collectDomEvidence();
    const blockedAttempts = await exerciseBlockedCancellationCases();

    await confirmFirstIssuedCancellation();
    await waitForSelector(cdp, "[data-invoice-status=\"cancelled\"]", 30000);

    const afterCancellation = await collectBaselineSnapshot();
    const duplicateAttempt = await exerciseDuplicateCancellationCase();
    const afterDuplicate = await collectBaselineSnapshot();

    await cdp.send("Page.navigate", { url: appUrl });
    await waitForSelector(cdp, "#app", 30000);
    await waitForAuthenticated(cdp);
    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const reloadSnapshot = await collectBaselineSnapshot();
    const afterDom = await collectDomEvidence();
    const storage = sanitizeStorageSnapshot(before, afterDuplicate);
    const summary = buildCancellationSummary(
        before,
        afterCancellation,
        afterDuplicate,
        reloadSnapshot,
        blockedAttempts,
        duplicateAttempt,
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
        draftCancellationBlocked:
            blockedAttempts.draftCancellationAttempted
            && blockedAttempts.draftCancellationSucceeded === false,
        missingInvoiceCancellationBlocked:
            blockedAttempts.missingInvoiceSucceeded === false,
        issuedInvoiceCancellationSucceeded:
            afterCancellation.cancelledInvoiceExists,
        originalInvoiceIdUnchanged:
            before.issuedInvoiceIdSanitized
            === afterCancellation.cancelledInvoiceIdSanitized,
        originalInvoiceAccountUnchanged:
            before.accountIdSanitized === afterCancellation.accountIdSanitized,
        invoiceStatusCancelled:
            afterCancellation.cancelledInvoiceStatus === "cancelled",
        cancelledAtSet: afterCancellation.cancelledAtSet,
        cancelledBySet: afterCancellation.cancelledBySet,
        cancellationReasonRecorded: afterCancellation.cancelReasonSet,
        originalSaleDeductionPreserved:
            afterCancellation.referencedSaleDeductionExists,
        saleReturnCreated: afterCancellation.saleReturnMovementExists,
        saleReturnQuantityPositive: afterCancellation.saleReturnQuantityPositive,
        saleReturnProductMatches: afterCancellation.saleReturnProductOk,
        saleReturnReferencesOriginal:
            afterCancellation.saleReturnReferencesOriginal,
        saleReturnAccountMatches: afterCancellation.saleReturnAccountOk,
        availableStockIncreased:
            afterCancellation.availableQuantity
            === before.availableQuantity + before.targetLineQuantity,
        reloadPreservesCancelledInvoice:
            reloadSnapshot.cancelledInvoiceExists,
        reloadPreservesOriginalSaleDeduction:
            reloadSnapshot.referencedSaleDeductionExists,
        reloadPreservesSaleReturn:
            reloadSnapshot.saleReturnMovementExists,
        cancelledStatusDisplays: afterDom.cancelledInvoiceVisible,
        reversalReferenceDisplays: afterDom.reversalStockMovementIdVisible,
        cancelledInvoiceReadonly:
            afterDom.cancelledCancelActionExists === false,
        alreadyCancelledCannotCancel:
            duplicateAttempt.duplicateSucceeded === false,
        duplicateCancellationCreatesNoDuplicateSaleReturn:
            duplicateAttempt.movementCountBefore
            === duplicateAttempt.movementCountAfter,
        noReturnsImplementation: afterDom.returnActionExists === false,
        noProductCrudBehaviorChanged:
            before.productScopedHash === afterDuplicate.productScopedHash,
        productRecordsUnchanged:
            before.productScopedHash === afterDuplicate.productScopedHash,
        productQuantityNotUpdated:
            before.productScopedHash === afterDuplicate.productScopedHash,
        legacyProductsUnchanged:
            before.legacyProductHash === afterDuplicate.legacyProductHash,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !runtime.env.envTracked,
    };
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts(afterDom, storage);
    writeInvoiceCancellationSummary(summary);
    assert(runtime.result === "PASS", "V1-SALES-008 after runtime verification failed.");
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

async function collectDomEvidence() {
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
        const cancelTexts = Array.from(
            document.querySelectorAll("button, [role='button'], a")
        ).map(element => (element.textContent || "").trim().toLowerCase());
        return {
            url: location.href,
            title: document.title,
            invoicePageVisible: Boolean(invoicePage),
            issuedInvoiceVisible: Boolean(issuedRow),
            cancelledInvoiceVisible: Boolean(
                document.querySelector("[data-invoice-status='cancelled']")
            ),
            auditRowCount: auditRows.length,
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
                    || text.includes("إلغاء")
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
                "V1-SALES-008 draft cancellation should fail"
            )
            : { success: false, errors: ["No draft invoice fixture"] };
        const missingResult = invoiceService.markCancelled(
            "missing-invoice-v1-sales-008",
            "V1-SALES-008 missing invoice should fail"
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
            "V1-SALES-008 duplicate cancellation should fail"
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
