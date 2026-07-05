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
const debugPort = mode === "baseline" ? 63012 : 63013;
const appUrl = `http://127.0.0.1:${port}/`;
const acceptedProfileDir = resolve(
    tmpdir(),
    "abonibal-v1-sales-009-after-chrome-profile"
);
const profileDir = resolve(
    tmpdir(),
    `abonibal-v1-sales-012-${mode}-chrome-profile`
);
const requiredEnvKeys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
];

if (!validModes.has(mode)) {
    throw new Error(`Unsupported verification mode: ${mode}`);
}

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
    mission: "V1-SALES-012",
    mode,
    classification: "ECS",
    scenario: mode === "baseline"
        ? "baseline return persistence before stock restoration execution"
        : "after return stock restoration execution verification",
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
    if (mode === "baseline") {
        assert(
            !runtime.env.trackedSourceChanges,
            "Source files must not be modified before baseline."
        );
    }
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

    const verification = mode === "baseline"
        ? await runBaselineVerification()
        : await runAfterVerification();

    await cdp.send("Page.reload", { ignoreCache: true });
    await waitForSelector(cdp, "#app", 30000);
    await waitForAuthenticated(cdp);
    await navigateRoute(cdp, "invoices");
    await waitForSelector(cdp, "#invoice-draft-page", 30000);

    const reloadEvidence = await collectReloadEvidence(verification);
    const dom = await collectDomEvidence();
    const storage = sanitizeStorageSnapshot(verification, reloadEvidence);

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.summary = buildSummary(verification, reloadEvidence);
    runtime.gates = mode === "baseline"
        ? buildBaselineGates(verification, reloadEvidence, dom)
        : buildAfterGates(verification, reloadEvidence, dom);
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts(dom, storage, runtime.summary);
    if (mode === "after") {
        writeExecutionSummary(runtime.summary);
    }
    assert(runtime.result === "PASS", `V1-SALES-012 ${mode} runtime verification failed.`);
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
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const {
            state,
            accountId,
            providerUserId,
            invoiceReturnService,
            inventoryService,
            routeRegistry,
            keys,
            before
        } = await collectSharedContext();
        const setup = createPersistedReturnForIssuedInvoice(
            invoiceReturnService,
            inventoryService,
            before.invoices,
            before.products
        );
        const after = collectStorage(keys);
        const persistedReturn = after.returns.find(invoiceReturn =>
            invoiceReturn?.id === setup.returnId
        );
        const persistedLine = persistedReturn?.lines?.[0] ?? null;

        return {
            mode: "baseline",
            authSessionExists: state.status === "authenticated",
            accountIdPresent: Boolean(accountId),
            providerUserIdPresent: Boolean(providerUserId),
            accountIdEqualsProviderUserId:
                Boolean(accountId) && accountId === providerUserId,
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            routeGuardActive: routeRegistry.invoices?.access === "protected",
            returnRouteExists: Boolean(routeRegistry.returns),
            executionMethodExists:
                typeof invoiceReturnService.executeReturn === "function",
            invoiceReturnScopedKeyCorrect:
                keys.invoiceReturnScopedKey === "invoiceReturns:" + accountId,
            stockMovementScopedKeyCorrect:
                keys.stockMovementScopedKey === "stockMovements:" + accountId,
            globalReturnKeyBeforeExists: before.globalReturnRaw !== null,
            globalReturnKeyAfterExists:
                localStorage.getItem("invoiceReturns") !== null,
            invoiceReturnScopedKeySanitized:
                "invoiceReturns:{" + await sanitizeValue(accountId) + "}",
            stockMovementScopedKeySanitized:
                "stockMovements:{" + await sanitizeValue(accountId) + "}",
            invoiceScopedKeySanitized:
                "invoices:{" + await sanitizeValue(accountId) + "}",
            productScopedKeySanitized:
                "products:{" + await sanitizeValue(accountId) + "}",
            returnRecordIdSanitized: await sanitizeValue(setup.returnId),
            returnLineIdSanitized: await sanitizeValue(persistedLine?.id),
            originalSaleDeductionMovementIdSanitized:
                await sanitizeValue(setup.originalSaleDeductionMovementId),
            createdSaleReturnMovementIdSanitized: "",
            returnStockMovementIdSet: Boolean(persistedLine?.returnStockMovementId),
            returnStockMovementIdEmpty:
                persistedLine?.returnStockMovementId === null,
            returnQuantity: setup.returnQuantity,
            availableBeforeExecution: setup.availableBefore,
            availableAfterExecution: inventoryService.getAvailableQuantity(
                setup.productId
            ),
            movementCountBeforeExecution: before.movements.length,
            movementCountAfterExecution: after.movements.length,
            movementCountAfterDuplicateExecution: after.movements.length,
            invoiceReturnCountBefore: before.returns.length,
            invoiceReturnCountAfter: after.returns.length,
            beforeInvoiceReturnHash: await nullableSha256(before.returnRaw),
            afterInvoiceReturnHash: await nullableSha256(after.returnRaw),
            beforeInvoiceHash: await nullableSha256(before.invoiceRaw),
            afterInvoiceHash: await nullableSha256(after.invoiceRaw),
            beforeMovementHash: await nullableSha256(before.movementRaw),
            afterMovementHash: await nullableSha256(after.movementRaw),
            beforeProductHash: await nullableSha256(before.productRaw),
            afterProductHash: await nullableSha256(after.productRaw),
            beforeLegacyProductHash: await nullableSha256(before.legacyProductRaw),
            afterLegacyProductHash: await nullableSha256(after.legacyProductRaw),
            saleReturnCountBefore: before.saleReturnCount,
            saleReturnCountAfter: countSaleReturns(after.movements),
            productQuantityBefore: setup.productQuantityBefore,
            productQuantityAfter: findProductQuantity(
                after.products,
                setup.productId
            ),
            issuedInvoiceIdSanitized:
                await sanitizeValue(setup.issuedInvoiceId),
            returnLineProductIdSanitized:
                await sanitizeValue(setup.productId),
            baselineReturnRecordCreated: Boolean(persistedReturn),
            noReturnUiExpected: true,
            draftRejected: true,
            cancelledRejected: true,
            missingReturnRejected: true,
            missingInvoiceRejected: true,
            missingLineRejected: true,
            invalidQuantityRejected: true,
            overReturnRejected: true,
            duplicateExecutionRejected: true,
            partialReturnAccepted: setup.success === true,
            originalSaleDeductionPreserved:
                after.movements.some(movement =>
                    movement?.id === setup.originalSaleDeductionMovementId
                    && movement?.type === "sale_deduction"
                ),
        };
    })()`, true);
}

async function runAfterVerification() {
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const {
            state,
            accountId,
            providerUserId,
            invoiceReturnService,
            inventoryService,
            routeRegistry,
            keys,
            before
        } = await collectSharedContext();
        const setup = createPersistedReturnForIssuedInvoice(
            invoiceReturnService,
            inventoryService,
            before.invoices,
            before.products
        );
        const afterCreate = collectStorage(keys);
        const executeResult = invoiceReturnService.executeReturn(setup.returnId);
        const afterExecute = collectStorage(keys);
        const executedReturn = afterExecute.returns.find(invoiceReturn =>
            invoiceReturn?.id === setup.returnId
        );
        const executedLine = executedReturn?.lines?.[0] ?? null;
        const createdMovement = afterExecute.movements.find(movement =>
            movement?.id === executedLine?.returnStockMovementId
        );
        const duplicateResult = invoiceReturnService.executeReturn(setup.returnId);
        const afterDuplicate = collectStorage(keys);
        const validation = await runExecutionValidationScenarios({
            accountId,
            invoiceReturnService,
            inventoryService,
            invoices: afterDuplicate.invoices,
            returns: afterDuplicate.returns,
            keys,
            setup
        });
        const afterValidation = collectStorage(keys);

        return {
            mode: "after",
            authSessionExists: state.status === "authenticated",
            accountIdPresent: Boolean(accountId),
            providerUserIdPresent: Boolean(providerUserId),
            accountIdEqualsProviderUserId:
                Boolean(accountId) && accountId === providerUserId,
            accountIdSanitized: await sanitizeValue(accountId),
            providerUserIdSanitized: await sanitizeValue(providerUserId),
            routeGuardActive: routeRegistry.invoices?.access === "protected",
            returnRouteExists: Boolean(routeRegistry.returns),
            executionMethodExists:
                typeof invoiceReturnService.executeReturn === "function",
            invoiceReturnScopedKeyCorrect:
                keys.invoiceReturnScopedKey === "invoiceReturns:" + accountId,
            stockMovementScopedKeyCorrect:
                keys.stockMovementScopedKey === "stockMovements:" + accountId,
            globalReturnKeyBeforeExists: before.globalReturnRaw !== null,
            globalReturnKeyAfterExists:
                localStorage.getItem("invoiceReturns") !== null,
            invoiceReturnScopedKeySanitized:
                "invoiceReturns:{" + await sanitizeValue(accountId) + "}",
            stockMovementScopedKeySanitized:
                "stockMovements:{" + await sanitizeValue(accountId) + "}",
            invoiceScopedKeySanitized:
                "invoices:{" + await sanitizeValue(accountId) + "}",
            productScopedKeySanitized:
                "products:{" + await sanitizeValue(accountId) + "}",
            returnRecordIdSanitized: await sanitizeValue(setup.returnId),
            returnLineIdSanitized: await sanitizeValue(executedLine?.id),
            originalSaleDeductionMovementIdSanitized:
                await sanitizeValue(setup.originalSaleDeductionMovementId),
            createdSaleReturnMovementIdSanitized:
                await sanitizeValue(createdMovement?.id),
            returnStockMovementIdSet:
                executedLine?.returnStockMovementId === createdMovement?.id,
            returnStockMovementIdReferencesCreatedMovement:
                executedLine?.returnStockMovementId === createdMovement?.id,
            returnQuantity: setup.returnQuantity,
            availableBeforeExecution: setup.availableBefore,
            availableAfterExecution: inventoryService.getAvailableQuantity(
                setup.productId
            ),
            movementCountBeforeExecution: afterCreate.movements.length,
            movementCountAfterExecution: afterExecute.movements.length,
            movementCountAfterDuplicateExecution:
                afterDuplicate.movements.length,
            invoiceReturnCountBefore: before.returns.length,
            invoiceReturnCountAfter: afterValidation.returns.length,
            beforeInvoiceReturnHash: await nullableSha256(before.returnRaw),
            afterInvoiceReturnHash: await nullableSha256(afterValidation.returnRaw),
            beforeInvoiceHash: await nullableSha256(before.invoiceRaw),
            afterInvoiceHash: await nullableSha256(afterValidation.invoiceRaw),
            beforeMovementHash: await nullableSha256(before.movementRaw),
            afterMovementHash: await nullableSha256(afterValidation.movementRaw),
            beforeProductHash: await nullableSha256(before.productRaw),
            afterProductHash: await nullableSha256(afterValidation.productRaw),
            beforeLegacyProductHash: await nullableSha256(before.legacyProductRaw),
            afterLegacyProductHash:
                await nullableSha256(afterValidation.legacyProductRaw),
            saleReturnCountBefore: countSaleReturns(afterCreate.movements),
            saleReturnCountAfter: countSaleReturns(afterExecute.movements),
            saleReturnCountAfterDuplicate: countSaleReturns(
                afterDuplicate.movements
            ),
            productQuantityBefore: setup.productQuantityBefore,
            productQuantityAfter: findProductQuantity(
                afterValidation.products,
                setup.productId
            ),
            issuedInvoiceIdSanitized:
                await sanitizeValue(setup.issuedInvoiceId),
            returnLineProductIdSanitized:
                await sanitizeValue(setup.productId),
            executeSucceeded: executeResult.success === true,
            saleReturnCreated: Boolean(createdMovement),
            saleReturnPositive:
                typeof createdMovement?.quantityDelta === "number"
                && createdMovement.quantityDelta > 0,
            saleReturnProductMatches:
                createdMovement?.productId === setup.productId,
            saleReturnAccountMatches:
                createdMovement?.accountId === accountId,
            saleReturnReferenceType:
                createdMovement?.referenceType === "invoice_return",
            saleReturnReferencesReturn:
                createdMovement?.referenceId === setup.returnId,
            saleReturnTracesOriginalDeduction:
                createdMovement?.metadata?.originalSaleDeductionMovementId
                    === setup.originalSaleDeductionMovementId
                || createdMovement?.metadata?.originalStockMovementId
                    === setup.originalSaleDeductionMovementId
                || createdMovement?.metadata?.reversesMovementId
                    === setup.originalSaleDeductionMovementId,
            duplicateExecutionRejected:
                duplicateResult.success === false,
            movementCountStableOnDuplicate:
                afterDuplicate.movements.length === afterExecute.movements.length,
            draftRejected: validation.draftRejected,
            cancelledRejected: validation.cancelledRejected,
            missingReturnRejected: validation.missingReturnRejected,
            missingInvoiceRejected: validation.missingInvoiceRejected,
            missingLineRejected: validation.missingLineRejected,
            invalidQuantityRejected: validation.invalidQuantityRejected,
            overReturnRejected: validation.overReturnRejected,
            partialReturnAccepted: setup.success === true,
            originalSaleDeductionPreserved:
                afterValidation.movements.some(movement =>
                    movement?.id === setup.originalSaleDeductionMovementId
                    && movement?.type === "sale_deduction"
                ),
        };
    })()`, true);
}

async function collectReloadEvidence(verification) {
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const { Container } = await import("/src/core/Container.ts");
        const { getAuthStateService } =
            await import("/src/modules/auth/AuthRuntime.ts");
        const { invoiceReturnStorageKeyForAccount } =
            await import("/src/modules/sales/persistence/InvoiceReturnPersistenceKey.ts");
        const { stockMovementStorageKeyForAccount } =
            await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");

        const state = await getAuthStateService().initialize();
        if (state.status !== "authenticated") {
            throw new Error("Authenticated session is required after reload.");
        }

        const accountId = state.session.account.id;
        const inventoryService = Container.get("inventoryService");
        const invoiceReturnScopedKey =
            invoiceReturnStorageKeyForAccount(accountId);
        const stockMovementScopedKey =
            stockMovementStorageKeyForAccount(accountId);
        const returns = parseArray(localStorage.getItem(invoiceReturnScopedKey));
        const movements = parseArray(localStorage.getItem(stockMovementScopedKey));
        const isBaseline = ${JSON.stringify(mode === "baseline")};
        const baselineAvailability =
            ${JSON.stringify(verification.availableAfterExecution)};
        const actualReturnId = ${JSON.stringify(verification.returnRecordIdSanitized)};
        const targetReturn = returns.find(invoiceReturn =>
            sanitizeComparable(invoiceReturn?.id, actualReturnId) === actualReturnId
        );
        const targetLine = targetReturn?.lines?.[0] ?? null;

        return {
            accountIdSanitized: await sanitizeValue(accountId),
            returnRecordCountAfterReload: returns.length,
            movementCountAfterReload: movements.length,
            reloadPreservesReturnRecord:
                Boolean(targetReturn)
                && (
                    isBaseline
                        ? targetLine?.returnStockMovementId === null
                        : Boolean(targetLine?.returnStockMovementId)
                ),
            reloadPreservesSaleReturnMovement:
                isBaseline
                    ? true
                    : movements.some(movement =>
                        movement?.type === "sale_return"
                        && movement?.referenceType === "invoice_return"
                        && movement?.id === targetLine?.returnStockMovementId
                    ),
            reloadAvailability:
                isBaseline
                    ? baselineAvailability
                    : inventoryService.getAvailableQuantity(targetLine?.productId ?? ""),
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

function buildBaselineGates(verification, _reloadEvidence, dom) {
    return {
        authSessionExists: verification.authSessionExists,
        accountIdExists: verification.accountIdPresent,
        accountIdNotProviderUserId:
            verification.providerUserIdPresent
            && !verification.accountIdEqualsProviderUserId,
        routeGuardActive: verification.routeGuardActive,
        invoiceRouteWorks: dom.invoicePageVisible,
        executionMethodNotPresentBeforeFix:
            verification.executionMethodExists === false,
        returnRecordCreated: verification.baselineReturnRecordCreated,
        returnStockMovementIdEmpty:
            verification.returnStockMovementIdEmpty,
        invoiceReturnScopedKeyUsed:
            verification.invoiceReturnScopedKeyCorrect,
        stockMovementScopedKeyUsed:
            verification.stockMovementScopedKeyCorrect,
        noGlobalInvoiceReturnsKey:
            !verification.globalReturnKeyBeforeExists
            && !verification.globalReturnKeyAfterExists,
        stockMovementsUnchanged:
            verification.beforeMovementHash === verification.afterMovementHash
            && verification.movementCountBeforeExecution
                === verification.movementCountAfterExecution,
        invoicesUnchanged:
            verification.beforeInvoiceHash === verification.afterInvoiceHash,
        productsUnchanged:
            verification.beforeProductHash === verification.afterProductHash
            && verification.productQuantityBefore
                === verification.productQuantityAfter,
        legacyProductsUnchanged:
            verification.beforeLegacyProductHash
                === verification.afterLegacyProductHash,
        noSaleReturnCreated:
            verification.saleReturnCountBefore === verification.saleReturnCountAfter,
        noReturnUi: !dom.returnUiExists,
        noReturnRoute: !verification.returnRouteExists,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !runtime.env.envTracked,
    };
}

function buildAfterGates(verification, reloadEvidence, dom) {
    return {
        authSessionExists: verification.authSessionExists,
        accountIdExists: verification.accountIdPresent,
        accountIdNotProviderUserId:
            verification.providerUserIdPresent
            && !verification.accountIdEqualsProviderUserId,
        routeGuardActive: verification.routeGuardActive,
        invoiceRouteWorks: dom.invoicePageVisible,
        invoiceReturnScopedKeyUsed:
            verification.invoiceReturnScopedKeyCorrect,
        stockMovementScopedKeyUsed:
            verification.stockMovementScopedKeyCorrect,
        noGlobalInvoiceReturnsKey:
            !verification.globalReturnKeyBeforeExists
            && !verification.globalReturnKeyAfterExists,
        validReturnExecutes: verification.executeSucceeded,
        saleReturnCreated: verification.saleReturnCreated,
        saleReturnPositive: verification.saleReturnPositive,
        saleReturnProductMatches: verification.saleReturnProductMatches,
        saleReturnAccountMatches: verification.saleReturnAccountMatches,
        saleReturnReferenceTypeInvoiceReturn:
            verification.saleReturnReferenceType,
        saleReturnTracesOriginalDeduction:
            verification.saleReturnTracesOriginalDeduction,
        returnStockMovementIdSet: verification.returnStockMovementIdSet,
        returnStockMovementIdReferencesCreatedMovement:
            verification.returnStockMovementIdReferencesCreatedMovement,
        availableStockIncreases:
            verification.availableAfterExecution
            === verification.availableBeforeExecution
                + verification.returnQuantity,
        reloadPreservesReturnStockMovementId:
            reloadEvidence.reloadPreservesReturnRecord,
        reloadPreservesSaleReturnMovement:
            reloadEvidence.reloadPreservesSaleReturnMovement,
        draftRejected: verification.draftRejected,
        cancelledRejected: verification.cancelledRejected,
        missingReturnRejected: verification.missingReturnRejected,
        missingInvoiceRejected: verification.missingInvoiceRejected,
        missingLineRejected: verification.missingLineRejected,
        invalidQuantityRejected: verification.invalidQuantityRejected,
        overReturnRejected: verification.overReturnRejected,
        duplicateExecutionRejected: verification.duplicateExecutionRejected,
        duplicateDoesNotCreateMovement:
            verification.movementCountStableOnDuplicate
            && verification.saleReturnCountAfterDuplicate
                === verification.saleReturnCountAfter,
        originalSaleDeductionPreserved:
            verification.originalSaleDeductionPreserved,
        invoicesUnchanged:
            verification.beforeInvoiceHash === verification.afterInvoiceHash,
        productsUnchanged:
            verification.beforeProductHash === verification.afterProductHash
            && verification.productQuantityBefore
                === verification.productQuantityAfter,
        legacyProductsUnchanged:
            verification.beforeLegacyProductHash
                === verification.afterLegacyProductHash,
        noReturnUi: !dom.returnUiExists,
        noReturnRoute: !verification.returnRouteExists,
        consoleErrorsZero: runtime.consoleErrors === 0,
        pageExceptionsZero: runtime.pageExceptions === 0,
        envUntracked: !runtime.env.envTracked,
    };
}

function buildSummary(verification, reloadEvidence) {
    return {
        accountIdSanitized: verification.accountIdSanitized,
        invoiceReturnsScopedKey: verification.invoiceReturnScopedKeySanitized,
        stockMovementScopedKey: verification.stockMovementScopedKeySanitized,
        invoiceScopedKey: verification.invoiceScopedKeySanitized,
        returnRecordId: verification.returnRecordIdSanitized,
        returnLineId: verification.returnLineIdSanitized,
        originalSaleDeductionMovementId:
            verification.originalSaleDeductionMovementIdSanitized,
        createdSaleReturnMovementId:
            verification.createdSaleReturnMovementIdSanitized,
        returnStockMovementIdResult: verification.returnStockMovementIdSet,
        returnQuantity: verification.returnQuantity,
        availableQuantityBeforeExecution:
            verification.availableBeforeExecution,
        availableQuantityAfterExecution:
            verification.availableAfterExecution,
        availableQuantityAfterReload:
            reloadEvidence.reloadAvailability,
        movementCountBeforeExecution:
            verification.movementCountBeforeExecution,
        movementCountAfterExecution:
            verification.movementCountAfterExecution,
        movementCountAfterDuplicateExecution:
            verification.movementCountAfterDuplicateExecution,
        invoiceReturnsHashBefore: verification.beforeInvoiceReturnHash,
        invoiceReturnsHashAfter: verification.afterInvoiceReturnHash,
        invoiceReturnCountBefore: verification.invoiceReturnCountBefore,
        invoiceReturnCountAfter: verification.invoiceReturnCountAfter,
        invoicesHashBefore: verification.beforeInvoiceHash,
        invoicesHashAfter: verification.afterInvoiceHash,
        productsHashBefore: verification.beforeProductHash,
        productsHashAfter: verification.afterProductHash,
        legacyProductHashBefore: verification.beforeLegacyProductHash,
        legacyProductHashAfter: verification.afterLegacyProductHash,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

function sanitizeStorageSnapshot(verification, reloadEvidence) {
    return {
        accountId: verification.accountIdSanitized,
        invoiceReturnsScopedKey: verification.invoiceReturnScopedKeySanitized,
        stockMovementScopedKey: verification.stockMovementScopedKeySanitized,
        invoiceScopedKey: verification.invoiceScopedKeySanitized,
        productScopedKey: verification.productScopedKeySanitized,
        returnRecordId: verification.returnRecordIdSanitized,
        returnLineId: verification.returnLineIdSanitized,
        originalSaleDeductionMovementId:
            verification.originalSaleDeductionMovementIdSanitized,
        createdSaleReturnMovementId:
            verification.createdSaleReturnMovementIdSanitized,
        invoiceReturnHashBefore: verification.beforeInvoiceReturnHash,
        invoiceReturnHashAfter: verification.afterInvoiceReturnHash,
        invoiceHashBefore: verification.beforeInvoiceHash,
        invoiceHashAfter: verification.afterInvoiceHash,
        movementHashBefore: verification.beforeMovementHash,
        movementHashAfter: verification.afterMovementHash,
        productHashBefore: verification.beforeProductHash,
        productHashAfter: verification.afterProductHash,
        legacyProductHashBefore: verification.beforeLegacyProductHash,
        legacyProductHashAfter: verification.afterLegacyProductHash,
        movementCountBefore: verification.movementCountBeforeExecution,
        movementCountAfter: verification.movementCountAfterExecution,
        movementCountAfterDuplicate:
            verification.movementCountAfterDuplicateExecution,
        returnCountBefore: verification.invoiceReturnCountBefore,
        returnCountAfter: verification.invoiceReturnCountAfter,
        returnCountAfterReload: reloadEvidence.returnRecordCountAfterReload,
        envUntracked: !runtime.env.envTracked,
    };
}

async function writeArtifacts(dom, storage, summary) {
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
    if (mode === "baseline") {
        writeFileSync(
            resolve(outputDir, "baseline-return-execution-summary.json"),
            JSON.stringify(summary, null, 2)
        );
    }
}

function writeExecutionSummary(summary) {
    writeFileSync(
        resolve(outputDir, "invoice-return-execution-summary.json"),
        JSON.stringify(summary, null, 2)
    );
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
        async function collectSharedContext() {
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
            const { stockMovementStorageKeyForAccount } =
                await import("/src/modules/inventory/persistence/StockMovementPersistenceKey.ts");
            const { productStorageKeyForAccount } =
                await import("/src/modules/products/persistence/ProductPersistenceKey.ts");

            const state = await getAuthStateService().initialize();
            if (state.status !== "authenticated") {
                throw new Error("Authenticated session is required.");
            }

            const accountId = state.session.account.id;
            const keys = {
                invoiceScopedKey: invoiceStorageKeyForAccount(accountId),
                invoiceReturnScopedKey:
                    invoiceReturnStorageKeyForAccount(accountId),
                stockMovementScopedKey:
                    stockMovementStorageKeyForAccount(accountId),
                productScopedKey: productStorageKeyForAccount(accountId),
            };

            return {
                state,
                accountId,
                providerUserId: getFirebaseAuth()?.currentUser?.uid ?? "",
                invoiceReturnService: Container.get("invoiceReturnService"),
                inventoryService: Container.get("inventoryService"),
                routeRegistry,
                keys,
                before: collectStorage(keys),
            };
        }

        function collectStorage(keys) {
            const invoiceRaw = localStorage.getItem(keys.invoiceScopedKey);
            const returnRaw = localStorage.getItem(keys.invoiceReturnScopedKey);
            const movementRaw = localStorage.getItem(keys.stockMovementScopedKey);
            const productRaw = localStorage.getItem(keys.productScopedKey);
            const legacyProductRaw = localStorage.getItem("products");
            const movements = parseArray(movementRaw);

            return {
                invoiceRaw,
                returnRaw,
                movementRaw,
                productRaw,
                legacyProductRaw,
                globalReturnRaw: localStorage.getItem("invoiceReturns"),
                invoices: parseArray(invoiceRaw),
                returns: parseArray(returnRaw),
                movements,
                products: parseArray(productRaw),
                saleReturnCount: countSaleReturns(movements),
            };
        }

        function createPersistedReturnForIssuedInvoice(
            invoiceReturnService,
            inventoryService,
            invoices,
            products
        ) {
            for (const issuedInvoice of invoices) {
                if (issuedInvoice?.status !== "issued" || !Array.isArray(issuedInvoice?.lines)) {
                    continue;
                }

                for (const issuedLine of issuedInvoice.lines) {
                    if (
                        typeof issuedLine?.stockMovementId !== "string"
                        || !issuedLine.stockMovementId.trim()
                        || typeof issuedLine?.quantity !== "number"
                        || issuedLine.quantity <= 0
                    ) {
                        continue;
                    }

                    const remaining = invoiceReturnService
                        .getRemainingReturnableQuantity(issuedInvoice.id, issuedLine.id);

                    if (remaining < 1) {
                        continue;
                    }

                    const result = invoiceReturnService.createReturnRecord({
                        invoiceId: issuedInvoice.id,
                        reason: "V1-SALES-012 return execution runtime verification",
                        notes: "Service-level stock restoration verification.",
                        lines: [{
                            invoiceLineId: issuedLine.id,
                            returnQuantity: 1,
                        }],
                    });

                    if (!result.success || !result.invoiceReturn) {
                        continue;
                    }

                    const productId = issuedLine.productId;

                    return {
                        success: true,
                        returnId: result.invoiceReturn.id,
                        returnQuantity: result.invoiceReturn.lines[0].returnQuantity,
                        productId,
                        issuedInvoiceId: issuedInvoice.id,
                        invoiceLineId: issuedLine.id,
                        originalSaleDeductionMovementId:
                            issuedLine.stockMovementId,
                        availableBefore:
                            inventoryService.getAvailableQuantity(productId),
                        productQuantityBefore:
                            findProductQuantity(products, productId),
                    };
                }
            }

            throw new Error("Issued invoice line with remaining returnable quantity is required.");
        }

        async function runExecutionValidationScenarios(context) {
            const {
                accountId,
                invoiceReturnService,
                inventoryService,
                invoices,
                returns,
                keys,
                setup
            } = context;
            const draftInvoice = invoices.find(invoice =>
                invoice?.status === "draft"
                && Array.isArray(invoice?.lines)
                && invoice.lines.length > 0
            );
            const issuedInvoice = invoices.find(invoice =>
                invoice?.id === setup.issuedInvoiceId
            );
            const issuedLine = issuedInvoice?.lines?.find(line =>
                line?.id === setup.invoiceLineId
            );
            const validationReturns = [...returns];

            function pushReturn(invoice, line, overrides = {}) {
                const record = buildReturnRecord(accountId, invoice, line, overrides);
                validationReturns.push(record);
                localStorage.setItem(
                    keys.invoiceReturnScopedKey,
                    JSON.stringify(validationReturns)
                );
                return record;
            }

            const draftRecord = pushReturn(
                draftInvoice,
                draftInvoice?.lines?.[0],
                { id: "draft-return-execution-test" }
            );
            const draftResult = invoiceReturnService.executeReturn(draftRecord.id);
            const cancelledResult = await runCancelledInvoiceExecutionScenario(
                accountId,
                issuedInvoice,
                issuedLine,
                inventoryService
            );
            const missingReturnResult =
                invoiceReturnService.executeReturn("missing-return-id");
            const missingInvoiceRecord = pushReturn(
                {
                    ...issuedInvoice,
                    id: "missing-invoice-for-return-execution",
                },
                issuedLine,
                { id: "missing-invoice-return-execution-test" }
            );
            const missingInvoiceResult =
                invoiceReturnService.executeReturn(missingInvoiceRecord.id);
            const missingLineRecord = pushReturn(
                issuedInvoice,
                {
                    ...issuedLine,
                    id: "missing-invoice-line-for-return-execution",
                },
                { id: "missing-line-return-execution-test" }
            );
            const missingLineResult =
                invoiceReturnService.executeReturn(missingLineRecord.id);
            const overReturnRecord = pushReturn(
                issuedInvoice,
                issuedLine,
                {
                    id: "over-return-execution-test",
                    returnQuantity: issuedLine.quantity + 1,
                }
            );
            const overReturnResult =
                invoiceReturnService.executeReturn(overReturnRecord.id);
            const invalidQuantityResult =
                await runInvalidQuantityExecutionScenario(
                    accountId,
                    issuedInvoice,
                    issuedLine,
                    inventoryService
                );

            return {
                draftRejected: draftResult.success === false,
                cancelledRejected: cancelledResult.success === false,
                missingReturnRejected: missingReturnResult.success === false,
                missingInvoiceRejected: missingInvoiceResult.success === false,
                missingLineRejected: missingLineResult.success === false,
                invalidQuantityRejected:
                    invalidQuantityResult.success === false,
                overReturnRejected: overReturnResult.success === false,
            };
        }

        async function runCancelledInvoiceExecutionScenario(
            accountId,
            issuedInvoice,
            issuedLine,
            inventoryService
        ) {
            const { InvoiceReturnService } =
                await import("/src/modules/sales/services/InvoiceReturnService.ts");
            const { InvoiceReturnValidator } =
                await import("/src/modules/sales/validators/InvoiceReturnValidator.ts");
            const cancelledInvoice = {
                ...issuedInvoice,
                id: "cancelled-invoice-return-execution-test",
                status: "cancelled",
            };
            const returnRecord = buildReturnRecord(
                accountId,
                cancelledInvoice,
                issuedLine,
                { id: "cancelled-return-execution-test" }
            );
            const fakeReturns = [returnRecord];
            const fakeRepo = buildFakeReturnRepository(fakeReturns);
            const fakeInvoiceRepo = {
                findForAccount: () => cancelledInvoice,
            };
            const service = new InvoiceReturnService(
                fakeRepo,
                new InvoiceReturnValidator(),
                fakeInvoiceRepo,
                (await import("/src/modules/auth/AuthRuntime.ts")).getAuthStateService(),
                inventoryService
            );

            return service.executeReturn(returnRecord.id);
        }

        async function runInvalidQuantityExecutionScenario(
            accountId,
            issuedInvoice,
            issuedLine,
            inventoryService
        ) {
            const { InvoiceReturnService } =
                await import("/src/modules/sales/services/InvoiceReturnService.ts");
            const { InvoiceReturnValidator } =
                await import("/src/modules/sales/validators/InvoiceReturnValidator.ts");
            const returnRecord = buildReturnRecord(
                accountId,
                issuedInvoice,
                issuedLine,
                {
                    id: "invalid-quantity-return-execution-test",
                    returnQuantity: 0,
                }
            );
            const fakeReturns = [returnRecord];
            const service = new InvoiceReturnService(
                buildFakeReturnRepository(fakeReturns),
                new InvoiceReturnValidator(),
                {
                    findForAccount: () => issuedInvoice,
                },
                (await import("/src/modules/auth/AuthRuntime.ts")).getAuthStateService(),
                inventoryService
            );

            return service.executeReturn(returnRecord.id);
        }

        function buildFakeReturnRepository(fakeReturns) {
            return {
                allForAccount: () => fakeReturns,
                appendForAccount: () => {},
                findForAccount: (_accountId, id) =>
                    fakeReturns.find(invoiceReturn => invoiceReturn.id === id),
                allForInvoice: (_accountId, invoiceId) =>
                    fakeReturns.filter(invoiceReturn =>
                        invoiceReturn.invoiceId === invoiceId
                    ),
                updateForAccount: (_accountId, id, updatedReturn) => {
                    const index = fakeReturns.findIndex(invoiceReturn =>
                        invoiceReturn.id === id
                    );
                    if (index === -1) {
                        return null;
                    }
                    fakeReturns[index] = updatedReturn;
                    return updatedReturn;
                },
            };
        }

        function buildReturnRecord(accountId, invoice, line, overrides = {}) {
            const now = new Date().toISOString();
            const returnQuantity = overrides.returnQuantity ?? 1;

            return {
                id: overrides.id ?? crypto.randomUUID(),
                accountId,
                returnNumber: "RET-VERIFY-" + Math.random().toString(16).slice(2),
                invoiceId: invoice?.id ?? "",
                invoiceNumberSnapshot: invoice?.invoiceNumber ?? "missing",
                status: "recorded",
                reason: "V1-SALES-012 validation scenario",
                lines: [{
                    id: crypto.randomUUID(),
                    invoiceLineId: line?.id ?? "",
                    productId: line?.productId ?? "missing-product",
                    productNameSnapshot: line?.productNameSnapshot ?? "Missing",
                    quantity: line?.quantity ?? 1,
                    unitPriceSnapshot: line?.unitPrice ?? 1,
                    lineTotalSnapshot: line?.lineTotal ?? 1,
                    returnQuantity,
                    originalSaleDeductionMovementId:
                        line?.stockMovementId ?? null,
                    returnStockMovementId: null,
                }],
                total: returnQuantity * (line?.unitPrice ?? 1),
                createdAt: now,
                createdBy: "runtime-verification",
                updatedAt: now,
                updatedBy: "runtime-verification",
            };
        }

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

        function countSaleReturns(movements) {
            return movements.filter(movement =>
                movement?.type === "sale_return"
            ).length;
        }

        function findProductQuantity(products, productId) {
            return products.find(product => product?.id === productId)
                ?.quantity ?? null;
        }

        function sanitizeComparable(value, expectedSanitized) {
            const text = String(value ?? "");
            if (!expectedSanitized) {
                return text;
            }
            return text.slice(0, 6) === expectedSanitized.slice(0, 6)
                ? expectedSanitized
                : text;
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
