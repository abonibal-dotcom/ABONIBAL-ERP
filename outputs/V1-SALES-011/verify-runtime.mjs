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
const port = 62006;
const debugPort = 63011;
const appUrl = `http://127.0.0.1:${port}/`;
const acceptedProfileDir = resolve(
    tmpdir(),
    "abonibal-v1-sales-009-after-chrome-profile"
);
const profileDir = resolve(
    tmpdir(),
    "abonibal-v1-sales-011-runtime-chrome-profile"
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
    mission: "V1-SALES-011",
    classification: "ECS",
    scenario: "account-scoped invoice returns persistence baseline",
    url: appUrl,
    verificationTool: "Chrome DevTools Protocol direct WebSocket client",
    profileSource: "accepted V1-SALES-009 after-runtime profile copy",
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
    assert(
        existsSync(acceptedProfileDir),
        "Accepted V1-SALES-009 after-runtime Chrome profile is missing."
    );

    mkdirSync(outputDir, { recursive: true });
    rmSync(profileDir, { recursive: true, force: true });
    cpSync(acceptedProfileDir, profileDir, { recursive: true });

    serverProcess = startVite();
    runtime.server.started = true;
    await waitForHttpOk(appUrl);

    chromeProcess = startChrome();
    const target = await createChromeTarget(appUrl);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await enableRuntime(cdp, consoleEntries, pageExceptions);
    await cdp.send("Page.navigate", { url: appUrl });
    await waitForSelector(cdp, "#app", 30000);
    await waitForAuthenticated(cdp);
    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const verification = await runReturnPersistenceVerification();

    await cdp.send("Page.reload", { ignoreCache: true });
    await waitForSelector(cdp, "#app", 30000);
    await waitForAuthenticated(cdp);
    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const reloadEvidence = await collectReloadEvidence(
        verification.createdReturnIds
    );
    const dom = await collectDomEvidence();
    const storage = sanitizeStorageSnapshot(verification);

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.summary = buildSummary(verification, reloadEvidence);
    runtime.gates = buildGates(verification, reloadEvidence, dom);
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts(dom, storage, runtime.summary);
    assert(runtime.result === "PASS", "V1-SALES-011 runtime verification failed.");
} catch (error) {
    runtime.failure = error instanceof Error ? error.message : String(error);
    writeFailureArtifacts();
    throw error;
} finally {
    cdp?.close();
    killProcessTree(chromeProcess?.pid);
    killProcessTree(serverProcess?.pid);
}

async function runReturnPersistenceVerification() {
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
        const { invoiceReturnStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoiceReturnPersistenceKey.ts");
        const { InvoiceReturnService } =
            await import("/src/modules/sales/services/InvoiceReturnService.ts");
        const { InvoiceReturnValidator } =
            await import("/src/modules/sales/validators/InvoiceReturnValidator.ts");
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
        const invoiceReturnService = Container.get("invoiceReturnService");
        const invoiceScopedKey = invoiceStorageKeyForAccount(accountId);
        const invoiceReturnScopedKey =
            invoiceReturnStorageKeyForAccount(accountId);
        const stockMovementScopedKey =
            stockMovementStorageKeyForAccount(accountId);
        const productScopedKey = productStorageKeyForAccount(accountId);
        const beforeInvoiceRaw = localStorage.getItem(invoiceScopedKey);
        const beforeReturnRaw = localStorage.getItem(invoiceReturnScopedKey);
        const beforeGlobalReturnRaw = localStorage.getItem("invoiceReturns");
        const beforeMovementRaw = localStorage.getItem(stockMovementScopedKey);
        const beforeProductRaw = localStorage.getItem(productScopedKey);
        const beforeLegacyProductRaw = localStorage.getItem("products");
        const beforeInvoices = parseArray(beforeInvoiceRaw);
        const beforeReturns = parseArray(beforeReturnRaw);
        const beforeMovements = parseArray(beforeMovementRaw);
        const beforeProducts = parseArray(beforeProductRaw);
        const issuedInvoice = beforeInvoices.find(invoice =>
            invoice?.status === "issued"
            && Array.isArray(invoice?.lines)
            && invoice.lines.some(line =>
                typeof line?.stockMovementId === "string"
                && line.stockMovementId.trim()
                && typeof line?.quantity === "number"
                && line.quantity > 0
            )
        );
        const issuedLine = issuedInvoice?.lines?.find(line =>
            typeof line?.stockMovementId === "string"
            && line.stockMovementId.trim()
            && typeof line?.quantity === "number"
            && line.quantity > 0
        );
        const draftInvoice = beforeInvoices.find(invoice =>
            invoice?.status === "draft"
            && Array.isArray(invoice?.lines)
            && invoice.lines.length > 0
        );
        const cancelledInvoice = beforeInvoices.find(invoice =>
            invoice?.status === "cancelled"
            && Array.isArray(invoice?.lines)
            && invoice.lines.length > 0
        );

        if (!issuedInvoice || !issuedLine) {
            throw new Error("Issued invoice with a stockMovementId line is required.");
        }
        if (!draftInvoice) {
            throw new Error("Draft invoice evidence is required.");
        }

        const productBefore = beforeProducts.find(product =>
            product?.id === issuedLine.productId
        );
        const saleReturnCountBefore = beforeMovements.filter(
            movement => movement?.type === "sale_return"
        ).length;
        const remainingBefore =
            invoiceReturnService.getRemainingReturnableQuantity(
                issuedInvoice.id,
                issuedLine.id
            );
        const firstReturnQuantity = issuedLine.quantity > 1
            ? 1
            : issuedLine.quantity / 2;
        const firstReturnResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 persistence baseline return",
            notes: "No stock restoration in this mission.",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: firstReturnQuantity,
            }],
        });
        const remainingAfterFirst =
            invoiceReturnService.getRemainingReturnableQuantity(
                issuedInvoice.id,
                issuedLine.id
            );
        const returnCountAfterFirst = invoiceReturnService.getAll().length;
        const overReturnResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 over-return rejection",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: remainingAfterFirst + 1,
            }],
        });
        const returnCountAfterOverReturn = invoiceReturnService.getAll().length;
        const partialReturnResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 partial remaining return",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: remainingAfterFirst,
            }],
        });
        const remainingAfterPartial =
            invoiceReturnService.getRemainingReturnableQuantity(
                issuedInvoice.id,
                issuedLine.id
            );
        const returnCountAfterPartial = invoiceReturnService.getAll().length;
        const duplicateExcessiveResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 duplicate excessive return",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: 1,
            }],
        });
        const returnCountAfterDuplicate = invoiceReturnService.getAll().length;
        const draftRejectResult = invoiceReturnService.createReturnRecord({
            invoiceId: draftInvoice.id,
            reason: "V1-SALES-011 draft rejection",
            lines: [{
                invoiceLineId: draftInvoice.lines[0]?.id ?? "",
                returnQuantity: 1,
            }],
        });
        const cancelledInvoiceForValidation = cancelledInvoice ?? {
            ...issuedInvoice,
            id: issuedInvoice.id + "-cancelled-validation",
            status: "cancelled",
        };
        const cancelledValidationService = new InvoiceReturnService(
            {
                allForAccount: () => [],
                appendForAccount: () => {
                    throw new Error("Cancelled invoice validation must not write.");
                },
                findForAccount: () => undefined,
                allForInvoice: () => [],
            },
            new InvoiceReturnValidator(),
            {
                findForAccount: () => cancelledInvoiceForValidation,
            },
            getAuthStateService()
        );
        const cancelledRejectResult =
            cancelledValidationService.createReturnRecord({
            invoiceId: cancelledInvoiceForValidation.id,
            reason: "V1-SALES-011 cancelled rejection",
            lines: [{
                invoiceLineId: cancelledInvoiceForValidation.lines[0]?.id ?? "",
                returnQuantity: 1,
            }],
        });
        const missingInvoiceRejectResult = invoiceReturnService.createReturnRecord({
            invoiceId: "missing-invoice-id",
            reason: "V1-SALES-011 missing invoice rejection",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: 1,
            }],
        });
        const missingLineRejectResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 missing line rejection",
            lines: [{
                invoiceLineId: "missing-line-id",
                returnQuantity: 1,
            }],
        });
        const zeroQuantityRejectResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 zero quantity rejection",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: 0,
            }],
        });
        const negativeQuantityRejectResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 negative quantity rejection",
            lines: [{
                invoiceLineId: issuedLine.id,
                returnQuantity: -1,
            }],
        });
        const duplicateLineRejectResult = invoiceReturnService.createReturnRecord({
            invoiceId: issuedInvoice.id,
            reason: "V1-SALES-011 duplicate line rejection",
            lines: [
                {
                    invoiceLineId: issuedLine.id,
                    returnQuantity: 1,
                },
                {
                    invoiceLineId: issuedLine.id,
                    returnQuantity: 1,
                },
            ],
        });
        const afterInvoiceRaw = localStorage.getItem(invoiceScopedKey);
        const afterReturnRaw = localStorage.getItem(invoiceReturnScopedKey);
        const afterGlobalReturnRaw = localStorage.getItem("invoiceReturns");
        const afterMovementRaw = localStorage.getItem(stockMovementScopedKey);
        const afterProductRaw = localStorage.getItem(productScopedKey);
        const afterLegacyProductRaw = localStorage.getItem("products");
        const afterReturns = parseArray(afterReturnRaw);
        const afterInvoices = parseArray(afterInvoiceRaw);
        const afterMovements = parseArray(afterMovementRaw);
        const afterProducts = parseArray(afterProductRaw);
        const productAfter = afterProducts.find(product =>
            product?.id === issuedLine.productId
        );
        const persistedFirstReturn = afterReturns.find(invoiceReturn =>
            invoiceReturn?.id === firstReturnResult.invoiceReturn?.id
        );
        const persistedPartialReturn = afterReturns.find(invoiceReturn =>
            invoiceReturn?.id === partialReturnResult.invoiceReturn?.id
        );
        const firstReturnLine = persistedFirstReturn?.lines?.[0] ?? null;
        const returnsForInvoice = invoiceReturnService.getByInvoiceId(
            issuedInvoice.id
        );
        const saleReturnCountAfter = afterMovements.filter(
            movement => movement?.type === "sale_return"
        ).length;
        const issuedInvoiceAfter = afterInvoices.find(invoice =>
            invoice?.id === issuedInvoice.id
        );

        return {
            authSessionExists: true,
            accountIdPresent: Boolean(accountId),
            providerUserIdPresent: Boolean(providerUserId),
            accountIdEqualsProviderUserId:
                Boolean(accountId) && accountId === providerUserId,
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            routeGuardActive: routeRegistry.invoices?.access === "protected",
            returnRouteExists: Boolean(routeRegistry.returns),
            invoiceScopedKeySanitized:
                "invoices:{" + await sanitizeValue(accountId) + "}",
            invoiceReturnScopedKeySanitized:
                "invoiceReturns:{" + await sanitizeValue(accountId) + "}",
            stockMovementScopedKeySanitized:
                "stockMovements:{" + await sanitizeValue(accountId) + "}",
            productScopedKeySanitized:
                "products:{" + await sanitizeValue(accountId) + "}",
            invoiceReturnScopedKeyCorrect:
                invoiceReturnScopedKey === "invoiceReturns:" + accountId,
            globalReturnKeyBeforeExists: beforeGlobalReturnRaw !== null,
            globalReturnKeyAfterExists: afterGlobalReturnRaw !== null,
            beforeInvoiceHash: await nullableSha256(beforeInvoiceRaw),
            afterInvoiceHash: await nullableSha256(afterInvoiceRaw),
            beforeReturnHash: await nullableSha256(beforeReturnRaw),
            afterReturnHash: await nullableSha256(afterReturnRaw),
            beforeMovementHash: await nullableSha256(beforeMovementRaw),
            afterMovementHash: await nullableSha256(afterMovementRaw),
            beforeProductHash: await nullableSha256(beforeProductRaw),
            afterProductHash: await nullableSha256(afterProductRaw),
            beforeLegacyProductHash: await nullableSha256(beforeLegacyProductRaw),
            afterLegacyProductHash: await nullableSha256(afterLegacyProductRaw),
            returnCountBefore: beforeReturns.length,
            returnCountAfterFirst,
            returnCountAfterOverReturn,
            returnCountAfterPartial,
            returnCountAfterDuplicate,
            returnCountAfter: afterReturns.length,
            invoiceCountBefore: beforeInvoices.length,
            invoiceCountAfter: afterInvoices.length,
            movementCountBefore: beforeMovements.length,
            movementCountAfter: afterMovements.length,
            saleReturnCountBefore,
            saleReturnCountAfter,
            productQuantityBefore: productBefore?.quantity ?? null,
            productQuantityAfter: productAfter?.quantity ?? null,
            issuedInvoiceIdSanitized: await sanitizeValue(issuedInvoice.id),
            createdReturnIds: [
                firstReturnResult.invoiceReturn?.id,
                partialReturnResult.invoiceReturn?.id,
            ].filter(Boolean),
            createdReturnIdSanitized:
                await sanitizeValue(firstReturnResult.invoiceReturn?.id),
            returnNumber: firstReturnResult.invoiceReturn?.returnNumber ?? null,
            returnLineInvoiceLineIdSanitized:
                await sanitizeValue(firstReturnLine?.invoiceLineId),
            returnLineProductSnapshotResult:
                firstReturnLine?.productId === issuedLine.productId
                && firstReturnLine?.productNameSnapshot
                    === issuedLine.productNameSnapshot
                && firstReturnLine?.unitPriceSnapshot === issuedLine.unitPrice
                && firstReturnLine?.lineTotalSnapshot === issuedLine.lineTotal,
            returnStockMovementIdEmpty:
                firstReturnLine?.returnStockMovementId === null,
            originalSaleDeductionLinked:
                firstReturnLine?.originalSaleDeductionMovementId
                    === issuedLine.stockMovementId,
            returnQuantity: firstReturnQuantity,
            remainingBefore,
            remainingAfterFirst,
            remainingAfterPartial,
            firstReturnSucceeded: firstReturnResult.success === true,
            partialReturnSucceeded: partialReturnResult.success === true,
            overReturnRejected: overReturnResult.success === false,
            duplicateExcessiveRejected:
                duplicateExcessiveResult.success === false,
            draftRejected: draftRejectResult.success === false,
            cancelledRejected: cancelledRejectResult.success === false,
            cancelledInvoiceEvidenceSource:
                cancelledInvoice ? "storage" : "in-memory service boundary",
            missingInvoiceRejected: missingInvoiceRejectResult.success === false,
            missingLineRejected: missingLineRejectResult.success === false,
            zeroQuantityRejected: zeroQuantityRejectResult.success === false,
            negativeQuantityRejected: negativeQuantityRejectResult.success === false,
            duplicateLineRejected: duplicateLineRejectResult.success === false,
            firstReturnIncludesAccountId:
                firstReturnResult.invoiceReturn?.accountId === accountId,
            firstReturnIncludesCreatedBy:
                Boolean(firstReturnResult.invoiceReturn?.createdBy),
            firstReturnReferencesIssuedInvoice:
                firstReturnResult.invoiceReturn?.invoiceId === issuedInvoice.id,
            firstReturnLineReferencesInvoiceLine:
                firstReturnLine?.invoiceLineId === issuedLine.id,
            getAllReturnsCreated:
                invoiceReturnService.getAll().some(invoiceReturn =>
                    invoiceReturn.id === firstReturnResult.invoiceReturn?.id
                ),
            getByInvoiceReturnsCreated:
                returnsForInvoice.some(invoiceReturn =>
                    invoiceReturn.id === firstReturnResult.invoiceReturn?.id
                ),
            issuedInvoiceStillIssued:
                issuedInvoiceAfter?.status === "issued",
            persistedFirstReturnExists: Boolean(persistedFirstReturn),
            persistedPartialReturnExists: Boolean(persistedPartialReturn),
        };
    })()`, true);
}

async function collectReloadEvidence(createdReturnIds) {
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { invoiceReturnStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoiceReturnPersistenceKey.ts");

        const state = await getAuthStateService().initialize();
        if (state.status !== "authenticated") {
            throw new Error("Authenticated session is required after reload.");
        }

        const accountId = state.session.account.id;
        const invoiceReturnService = Container.get("invoiceReturnService");
        const invoiceReturnScopedKey =
            invoiceReturnStorageKeyForAccount(accountId);
        const createdReturnIds = ${JSON.stringify(createdReturnIds)};
        const rawReturns = localStorage.getItem(invoiceReturnScopedKey);
        const persistedReturns = parseArray(rawReturns);

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            persistedReturnIdsPresent: createdReturnIds.every(id =>
                persistedReturns.some(invoiceReturn => invoiceReturn?.id === id)
            ),
            serviceReturnsPresent: createdReturnIds.every(id =>
                invoiceReturnService.getById(id)
            ),
            returnCountAfterReload: persistedReturns.length,
            returnHashAfterReload: await nullableSha256(rawReturns),
        };
    })()`, true);
}

async function collectDomEvidence() {
    return evaluate(cdp, `(() => {
        const actionText = Array.from(
            document.querySelectorAll("button, a, [role='button']")
        )
            .map(element => element.textContent?.trim().toLowerCase() ?? "")
            .join(" ");

        return {
            url: location.href,
            title: document.title,
            activeRoute: location.hash || location.pathname,
            invoicePageVisible: Boolean(document.querySelector("#invoice-draft-page")),
            returnUiExists:
                actionText.includes("return")
                || actionText.includes("مرتجع")
                || actionText.includes("استرجاع"),
            visibleActions: actionText,
        };
    })()`);
}

function buildGates(verification, reloadEvidence, dom) {
    return {
        authSessionExists: verification.authSessionExists,
        accountIdExists: verification.accountIdPresent,
        accountIdNotProviderUserId:
            verification.providerUserIdPresent
            && !verification.accountIdEqualsProviderUserId,
        routeGuardActive: verification.routeGuardActive,
        invoiceReturnScopedKeyUsed:
            verification.invoiceReturnScopedKeyCorrect,
        noGlobalInvoiceReturnsKey:
            !verification.globalReturnKeyBeforeExists
            && !verification.globalReturnKeyAfterExists,
        firstReturnCreated: verification.firstReturnSucceeded,
        partialReturnAccepted: verification.partialReturnSucceeded,
        returnRecordIncludesAccountId:
            verification.firstReturnIncludesAccountId,
        returnRecordIncludesCreatedBy:
            verification.firstReturnIncludesCreatedBy,
        returnReferencesIssuedInvoice:
            verification.firstReturnReferencesIssuedInvoice,
        returnLineReferencesInvoiceLine:
            verification.firstReturnLineReferencesInvoiceLine,
        returnLineStoresProductSnapshot:
            verification.returnLineProductSnapshotResult,
        returnStockMovementIdEmpty:
            verification.returnStockMovementIdEmpty,
        originalDeductionLinked:
            verification.originalSaleDeductionLinked,
        getAllReturnsCreated: verification.getAllReturnsCreated,
        getByInvoiceReturnsCreated: verification.getByInvoiceReturnsCreated,
        reloadPreservesReturnRecord:
            reloadEvidence.persistedReturnIdsPresent
            && reloadEvidence.serviceReturnsPresent,
        draftInvoiceReturnRejected: verification.draftRejected,
        cancelledInvoiceReturnRejected: verification.cancelledRejected,
        missingInvoiceRejected: verification.missingInvoiceRejected,
        missingLineRejected: verification.missingLineRejected,
        zeroQuantityRejected: verification.zeroQuantityRejected,
        negativeQuantityRejected: verification.negativeQuantityRejected,
        overReturnRejected:
            verification.overReturnRejected
            && verification.returnCountAfterOverReturn
                === verification.returnCountAfterFirst,
        duplicateExcessiveReturnRejected:
            verification.duplicateExcessiveRejected
            && verification.returnCountAfterDuplicate
                === verification.returnCountAfterPartial,
        duplicateLineRejected: verification.duplicateLineRejected,
        remainingQuantityComputed:
            verification.remainingBefore > verification.remainingAfterFirst
            && verification.remainingAfterPartial === 0,
        invoicesUnchanged:
            verification.beforeInvoiceHash === verification.afterInvoiceHash
            && verification.invoiceCountBefore === verification.invoiceCountAfter
            && verification.issuedInvoiceStillIssued,
        stockMovementsUnchanged:
            verification.beforeMovementHash === verification.afterMovementHash
            && verification.movementCountBefore
                === verification.movementCountAfter,
        noSaleReturnCreated:
            verification.saleReturnCountBefore
                === verification.saleReturnCountAfter,
        productsUnchanged:
            verification.beforeProductHash === verification.afterProductHash
            && verification.productQuantityBefore
                === verification.productQuantityAfter,
        legacyProductsUnchanged:
            verification.beforeLegacyProductHash
                === verification.afterLegacyProductHash,
        noReturnUi: !dom.returnUiExists,
        noReturnRoute: !verification.returnRouteExists,
        invoicePageVisible: dom.invoicePageVisible,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !runtime.env.envTracked,
    };
}

function buildSummary(verification, reloadEvidence) {
    return {
        accountIdSanitized: verification.accountIdSanitized,
        invoiceReturnsScopedKey: verification.invoiceReturnScopedKeySanitized,
        invoiceScopedKey: verification.invoiceScopedKeySanitized,
        stockMovementScopedKey: verification.stockMovementScopedKeySanitized,
        productScopedKey: verification.productScopedKeySanitized,
        issuedInvoiceId: verification.issuedInvoiceIdSanitized,
        returnRecordId: verification.createdReturnIdSanitized,
        returnNumber: verification.returnNumber,
        returnLineInvoiceLineId:
            verification.returnLineInvoiceLineIdSanitized,
        returnLineProductSnapshotResult:
            verification.returnLineProductSnapshotResult,
        returnQuantity: verification.returnQuantity,
        remainingReturnableQuantityBefore: verification.remainingBefore,
        remainingReturnableQuantityAfter: verification.remainingAfterPartial,
        overReturnRejectionResult: verification.overReturnRejected,
        duplicateExcessiveReturnRejectionResult:
            verification.duplicateExcessiveRejected,
        invoiceHashBefore: verification.beforeInvoiceHash,
        invoiceHashAfter: verification.afterInvoiceHash,
        stockMovementCountBefore: verification.movementCountBefore,
        stockMovementCountAfter: verification.movementCountAfter,
        stockMovementHashBefore: verification.beforeMovementHash,
        stockMovementHashAfter: verification.afterMovementHash,
        productScopedKeyHashBefore: verification.beforeProductHash,
        productScopedKeyHashAfter: verification.afterProductHash,
        legacyProductKeyHashBefore: verification.beforeLegacyProductHash,
        legacyProductKeyHashAfter: verification.afterLegacyProductHash,
        returnCountBefore: verification.returnCountBefore,
        returnCountAfter: verification.returnCountAfter,
        returnCountAfterReload: reloadEvidence.returnCountAfterReload,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

function sanitizeStorageSnapshot(verification) {
    return {
        accountId: verification.accountIdSanitized,
        invoiceReturnsScopedKey: verification.invoiceReturnScopedKeySanitized,
        invoiceScopedKey: verification.invoiceScopedKeySanitized,
        stockMovementScopedKey: verification.stockMovementScopedKeySanitized,
        productScopedKey: verification.productScopedKeySanitized,
        invoiceHashBefore: verification.beforeInvoiceHash,
        invoiceHashAfter: verification.afterInvoiceHash,
        invoiceReturnHashBefore: verification.beforeReturnHash,
        invoiceReturnHashAfter: verification.afterReturnHash,
        stockMovementHashBefore: verification.beforeMovementHash,
        stockMovementHashAfter: verification.afterMovementHash,
        productScopedHashBefore: verification.beforeProductHash,
        productScopedHashAfter: verification.afterProductHash,
        legacyProductHashBefore: verification.beforeLegacyProductHash,
        legacyProductHashAfter: verification.afterLegacyProductHash,
        invoiceCountBefore: verification.invoiceCountBefore,
        invoiceCountAfter: verification.invoiceCountAfter,
        returnCountBefore: verification.returnCountBefore,
        returnCountAfter: verification.returnCountAfter,
        stockMovementCountBefore: verification.movementCountBefore,
        stockMovementCountAfter: verification.movementCountAfter,
        saleReturnCountBefore: verification.saleReturnCountBefore,
        saleReturnCountAfter: verification.saleReturnCountAfter,
        envUntracked: !runtime.env.envTracked,
    };
}

async function writeArtifacts(dom, storage, summary) {
    const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
    });

    writeFileSync(
        resolve(outputDir, "runtime.json"),
        JSON.stringify(runtime, null, 2)
    );
    writeFileSync(
        resolve(outputDir, "dom.json"),
        JSON.stringify(dom, null, 2)
    );
    writeFileSync(
        resolve(outputDir, "console.log"),
        consoleEntries.map(entry => JSON.stringify(entry)).join("\n")
    );
    writeFileSync(
        resolve(outputDir, "storage-snapshot-sanitized.json"),
        JSON.stringify(storage, null, 2)
    );
    writeFileSync(
        resolve(outputDir, "screenshot.png"),
        Buffer.from(screenshot.data, "base64")
    );
    writeFileSync(
        resolve(outputDir, "invoice-returns-persistence-summary.json"),
        JSON.stringify(summary, null, 2)
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

    child.stdout.on("data", data => {
        consoleEntries.push({
            source: "vite",
            level: "stdout",
            text: data.toString("utf8").trim(),
        });
    });
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

function allGatesPass(gates) {
    return Object.values(gates).every(Boolean);
}

function countConsoleErrors(entries) {
    return entries.filter(entry =>
        entry.type === "error"
        || entry.level === "error"
        || entry.level === "severe"
    ).length;
}

function delay(ms) {
    return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
