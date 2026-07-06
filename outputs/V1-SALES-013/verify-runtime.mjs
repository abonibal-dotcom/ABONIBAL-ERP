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
const debugPort = mode === "baseline" ? 63016 : 63017;
const appUrl = `http://127.0.0.1:${port}/`;
const acceptedProfileDir = resolve(
    tmpdir(),
    "abonibal-v1-sales-009-after-chrome-profile"
);
const profileDir = resolve(
    tmpdir(),
    `abonibal-v1-sales-013-${mode}-chrome-profile`
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
    mission: "V1-SALES-013",
    mode,
    classification: "ECS",
    scenario: mode === "baseline"
        ? "baseline invoice returns UI absence before UI flow"
        : "after invoice returns UI flow verification",
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
    const storage = buildStorageEvidence(verification, reloadEvidence);

    runtime.consoleErrors = countConsoleErrors(consoleEntries);
    runtime.pageExceptions = pageExceptions.length;
    runtime.summary = buildSummary(verification, reloadEvidence);
    runtime.gates = mode === "baseline"
        ? buildBaselineGates(verification, dom)
        : buildAfterGates(verification, reloadEvidence, dom);
    runtime.result = allGatesPass(runtime.gates) ? "PASS" : "FAIL";

    await writeArtifacts(dom, storage, runtime.summary);
    if (mode === "after") {
        writeReturnUiSummary(runtime.summary);
    }
    assert(runtime.result === "PASS", `V1-SALES-013 ${mode} runtime verification failed.`);
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
        const context = await collectSharedContext();
        const candidate = findReturnableInvoiceLine(
            context.invoiceReturnService,
            context.before.invoices
        );
        const dom = collectReturnDomEvidence();

        return {
            mode: "baseline",
            ...await buildCommonVerification(context, candidate),
            returnUiExists: dom.returnUiExists,
            returnQuantityInputExists: dom.returnQuantityInputExists,
            returnButtonExists: dom.returnButtonExists,
            returnAuditExists: dom.returnAuditExists,
            invalidUiRejected: true,
            excessiveUiRejected: true,
            validUiExecuted: false,
            auditVisibleAfterExecution: false,
            returnRecordCreated: false,
            returnExecuted: false,
            returnStockMovementIdSet: false,
            saleReturnCreated: false,
            saleReturnPositive: false,
            saleReturnReferenceTypeInvoiceReturn: false,
            saleReturnTracesOriginalDeduction: false,
            availableBeforeReturn: candidate.availableBefore,
            availableAfterReturn: candidate.availableBefore,
            availableAfterReload: candidate.availableBefore,
            movementCountBeforeReturn: context.before.movements.length,
            movementCountAfterReturn: context.before.movements.length,
            movementCountAfterInvalidAttempts: context.before.movements.length,
            invoiceReturnCountBefore: context.before.returns.length,
            invoiceReturnCountAfter: context.before.returns.length,
            createdReturnIdSanitized: "",
            createdReturnLineIdSanitized: "",
            createdSaleReturnMovementIdSanitized: "",
            returnQuantity: 0,
            beforeReturnHash: await nullableSha256(context.before.returnRaw),
            afterReturnHash: await nullableSha256(context.before.returnRaw),
            beforeMovementHash: await nullableSha256(context.before.movementRaw),
            afterMovementHash: await nullableSha256(context.before.movementRaw),
            beforeInvoiceHash: await nullableSha256(context.before.invoiceRaw),
            afterInvoiceHash: await nullableSha256(context.before.invoiceRaw),
            beforeProductHash: await nullableSha256(context.before.productRaw),
            afterProductHash: await nullableSha256(context.before.productRaw),
            beforeLegacyProductHash: await nullableSha256(context.before.legacyProductRaw),
            afterLegacyProductHash: await nullableSha256(context.before.legacyProductRaw),
        };
    })()`, true);
}

async function runAfterVerification() {
    return evaluate(cdp, `(async () => {
        ${browserUtilityFunctions()}
        const context = await collectSharedContext();
        const candidate = findReturnableInvoiceLine(
            context.invoiceReturnService,
            context.before.invoices
        );
        const beforeReturnIds = new Set(
            context.before.returns.map(invoiceReturn => invoiceReturn.id)
        );
        const beforeMovementIds = new Set(
            context.before.movements.map(movement => movement.id)
        );
        const uiBefore = collectReturnDomEvidence();

        const invalidAttempt = submitReturnViaUi(candidate.invoiceLineId, 0);
        const afterInvalid = collectStorage(context.keys);
        const excessiveAttempt = submitReturnViaUi(
            candidate.invoiceLineId,
            candidate.remainingReturnable + 1
        );
        const afterExcessive = collectStorage(context.keys);
        const validReturnQuantity = Math.min(1, candidate.remainingReturnable);
        const validAttempt = submitReturnViaUi(
            candidate.invoiceLineId,
            validReturnQuantity
        );
        const afterReturn = collectStorage(context.keys);
        const createdReturn = afterReturn.returns.find(invoiceReturn =>
            !beforeReturnIds.has(invoiceReturn.id)
        );
        const createdReturnLine = createdReturn?.lines?.[0] ?? null;
        const createdSaleReturn = afterReturn.movements.find(movement =>
            !beforeMovementIds.has(movement.id)
            && movement?.id === createdReturnLine?.returnStockMovementId
        );
        const uiAfter = collectReturnDomEvidence();

        return {
            mode: "after",
            ...await buildCommonVerification(context, candidate),
            returnUiExists: uiBefore.returnUiExists,
            returnQuantityInputExists: uiBefore.returnQuantityInputExists,
            returnButtonExists: uiBefore.returnButtonExists,
            returnAuditExists: uiAfter.returnAuditExists,
            invalidUiRejected:
                invalidAttempt.message.includes("Return quantity")
                && afterInvalid.returnRaw === context.before.returnRaw
                && afterInvalid.movementRaw === context.before.movementRaw,
            excessiveUiRejected:
                excessiveAttempt.message.includes("exceeds remaining")
                && afterExcessive.returnRaw === context.before.returnRaw
                && afterExcessive.movementRaw === context.before.movementRaw,
            validUiExecuted:
                validAttempt.message.includes("Invoice return executed"),
            auditVisibleAfterExecution:
                uiAfter.auditText.includes(createdReturn?.returnNumber ?? "")
                && uiAfter.auditText.includes(createdReturnLine?.returnStockMovementId ?? ""),
            returnRecordCreated: Boolean(createdReturn),
            returnExecuted: createdReturn?.status === "executed",
            returnStockMovementIdSet:
                Boolean(createdReturnLine?.returnStockMovementId)
                && createdReturnLine?.returnStockMovementId === createdSaleReturn?.id,
            saleReturnCreated: Boolean(createdSaleReturn),
            saleReturnPositive:
                typeof createdSaleReturn?.quantityDelta === "number"
                && createdSaleReturn.quantityDelta > 0,
            saleReturnReferenceTypeInvoiceReturn:
                createdSaleReturn?.referenceType === "invoice_return",
            saleReturnTracesOriginalDeduction:
                createdSaleReturn?.metadata?.originalSaleDeductionMovementId
                    === candidate.originalSaleDeductionMovementId
                || createdSaleReturn?.metadata?.originalStockMovementId
                    === candidate.originalSaleDeductionMovementId
                || createdSaleReturn?.metadata?.reversesMovementId
                    === candidate.originalSaleDeductionMovementId,
            availableBeforeReturn: candidate.availableBefore,
            availableAfterReturn:
                context.inventoryService.getAvailableQuantity(candidate.productId),
            movementCountBeforeReturn: context.before.movements.length,
            movementCountAfterInvalidAttempts: afterExcessive.movements.length,
            movementCountAfterReturn: afterReturn.movements.length,
            invoiceReturnCountBefore: context.before.returns.length,
            invoiceReturnCountAfter: afterReturn.returns.length,
            createdReturnIdSanitized: await sanitizeValue(createdReturn?.id),
            createdReturnLineIdSanitized: await sanitizeValue(createdReturnLine?.id),
            createdSaleReturnMovementIdSanitized:
                await sanitizeValue(createdSaleReturn?.id),
            createdReturnIdRaw: createdReturn?.id ?? "",
            createdSaleReturnMovementIdRaw: createdSaleReturn?.id ?? "",
            returnQuantity: createdReturnLine?.returnQuantity ?? 0,
            beforeReturnHash: await nullableSha256(context.before.returnRaw),
            afterReturnHash: await nullableSha256(afterReturn.returnRaw),
            beforeMovementHash: await nullableSha256(context.before.movementRaw),
            afterMovementHash: await nullableSha256(afterReturn.movementRaw),
            beforeInvoiceHash: await nullableSha256(context.before.invoiceRaw),
            afterInvoiceHash: await nullableSha256(afterReturn.invoiceRaw),
            beforeProductHash: await nullableSha256(context.before.productRaw),
            afterProductHash: await nullableSha256(afterReturn.productRaw),
            beforeLegacyProductHash: await nullableSha256(context.before.legacyProductRaw),
            afterLegacyProductHash: await nullableSha256(afterReturn.legacyProductRaw),
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
        const invoiceReturnService = Container.get("invoiceReturnService");
        const invoiceReturnScopedKey =
            invoiceReturnStorageKeyForAccount(accountId);
        const stockMovementScopedKey =
            stockMovementStorageKeyForAccount(accountId);
        const returns = parseArray(localStorage.getItem(invoiceReturnScopedKey));
        const movements = parseArray(localStorage.getItem(stockMovementScopedKey));
        const inventoryService = Container.get("inventoryService");
        const createdReturnId =
            ${JSON.stringify(verification.createdReturnIdRaw ?? "")};
        const createdMovementId =
            ${JSON.stringify(verification.createdSaleReturnMovementIdRaw ?? "")};
        const baselineAvailability =
            ${JSON.stringify(verification.availableAfterReturn)};
        const createdReturn = returns.find(invoiceReturn =>
            String(invoiceReturn?.id ?? "") === createdReturnId
        );
        const createdLine = createdReturn?.lines?.[0] ?? null;

        return {
            returnRecordCountAfterReload: returns.length,
            movementCountAfterReload: movements.length,
            reloadPreservesExecutedReturn:
                ${JSON.stringify(mode === "baseline")}
                    ? true
                    : createdReturn?.status === "executed"
                        && Boolean(createdLine?.returnStockMovementId),
            reloadPreservesSaleReturn:
                ${JSON.stringify(mode === "baseline")}
                    ? true
                    : movements.some(movement =>
                        String(movement?.id ?? "") === createdMovementId
                        && movement?.type === "sale_return"
                    ),
            reloadAvailability:
                ${JSON.stringify(mode === "baseline")}
                    ? baselineAvailability
                    : inventoryService.getAvailableQuantity(
                        createdLine?.productId ?? ""
                    ),
        };
    })()`,
        true
    );
}

async function collectDomEvidence() {
    return evaluate(cdp, `(() => {
        const actions = Array.from(
            document.querySelectorAll("button, a, [role='button']")
        ).map(element => element.textContent?.trim() ?? "");
        const returnRows = Array.from(
            document.querySelectorAll(".invoice-return-line-row")
        );
        const audits = Array.from(
            document.querySelectorAll(".invoice-return-audit")
        ).map(element => element.textContent?.trim() ?? "");

        return {
            url: location.href,
            title: document.title,
            activeRoute: location.hash || location.pathname,
            invoicePageVisible: Boolean(document.querySelector("#invoice-draft-page")),
            returnUiExists:
                Boolean(document.querySelector("[data-action='create-invoice-return']"))
                || Boolean(document.querySelector(".invoice-return-quantity-input")),
            returnRowCount: returnRows.length,
            returnAuditText: audits.join(" "),
            visibleActions: actions,
        };
    })()`);
}

function buildBaselineGates(verification, dom) {
    return {
        authSessionExists: verification.authSessionExists,
        accountIdExists: verification.accountIdPresent,
        accountIdNotProviderUserId:
            verification.providerUserIdPresent
            && !verification.accountIdEqualsProviderUserId,
        routeGuardActive: verification.routeGuardActive,
        invoiceRouteWorks: dom.invoicePageVisible,
        issuedReturnableLineExists: verification.issuedReturnableLineExists,
        returnServiceAvailable: verification.returnServiceAvailable,
        noReturnUiBeforeFix:
            !verification.returnUiExists
            && !verification.returnQuantityInputExists
            && !verification.returnButtonExists,
        noReturnRoute: !verification.returnRouteExists,
        invoiceReturnsScopedKeyUsed: verification.invoiceReturnScopedKeyCorrect,
        stockMovementsScopedKeyUsed: verification.stockMovementScopedKeyCorrect,
        noGlobalInvoiceReturnsKey: !verification.globalReturnKeyExists,
        noStorageMutation:
            verification.beforeReturnHash === verification.afterReturnHash
            && verification.beforeMovementHash === verification.afterMovementHash
            && verification.beforeInvoiceHash === verification.afterInvoiceHash
            && verification.beforeProductHash === verification.afterProductHash,
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
        returnUiExists: verification.returnUiExists,
        returnQuantityInputExists: verification.returnQuantityInputExists,
        returnButtonExists: verification.returnButtonExists,
        remainingReturnableDisplayed: dom.returnRowCount > 0,
        invalidUiRejected: verification.invalidUiRejected,
        excessiveUiRejected: verification.excessiveUiRejected,
        validUiExecuted: verification.validUiExecuted,
        returnRecordCreated: verification.returnRecordCreated,
        returnExecuted: verification.returnExecuted,
        saleReturnCreated: verification.saleReturnCreated,
        saleReturnPositive: verification.saleReturnPositive,
        saleReturnReferenceTypeInvoiceReturn:
            verification.saleReturnReferenceTypeInvoiceReturn,
        saleReturnTracesOriginalDeduction:
            verification.saleReturnTracesOriginalDeduction,
        returnStockMovementIdSet: verification.returnStockMovementIdSet,
        auditVisibleAfterExecution: verification.auditVisibleAfterExecution,
        availableStockIncreases:
            verification.availableAfterReturn
            === verification.availableBeforeReturn + verification.returnQuantity,
        reloadPreservesExecutedReturn:
            reloadEvidence.reloadPreservesExecutedReturn,
        reloadPreservesSaleReturn:
            reloadEvidence.reloadPreservesSaleReturn,
        reloadPreservesAvailability:
            reloadEvidence.reloadAvailability === verification.availableAfterReturn,
        duplicateSafety:
            verification.movementCountAfterReturn
            === verification.movementCountAfterInvalidAttempts + 1,
        invoiceReturnsScopedKeyUsed: verification.invoiceReturnScopedKeyCorrect,
        stockMovementsScopedKeyUsed: verification.stockMovementScopedKeyCorrect,
        noGlobalInvoiceReturnsKey: !verification.globalReturnKeyExists,
        invoicesUnchanged:
            verification.beforeInvoiceHash === verification.afterInvoiceHash,
        productsUnchanged:
            verification.beforeProductHash === verification.afterProductHash,
        legacyProductsUnchanged:
            verification.beforeLegacyProductHash
                === verification.afterLegacyProductHash,
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
        productScopedKey: verification.productScopedKeySanitized,
        issuedInvoiceId: verification.issuedInvoiceIdSanitized,
        invoiceLineId: verification.invoiceLineIdSanitized,
        originalSaleDeductionMovementId:
            verification.originalSaleDeductionMovementIdSanitized,
        createdReturnId: verification.createdReturnIdSanitized,
        createdReturnLineId: verification.createdReturnLineIdSanitized,
        createdSaleReturnMovementId:
            verification.createdSaleReturnMovementIdSanitized,
        returnQuantity: verification.returnQuantity,
        availableQuantityBeforeReturn: verification.availableBeforeReturn,
        availableQuantityAfterReturn: verification.availableAfterReturn,
        availableQuantityAfterReload: reloadEvidence.reloadAvailability,
        movementCountBeforeReturn: verification.movementCountBeforeReturn,
        movementCountAfterReturn: verification.movementCountAfterReturn,
        movementCountAfterInvalidAttempts:
            verification.movementCountAfterInvalidAttempts,
        invoiceReturnCountBefore: verification.invoiceReturnCountBefore,
        invoiceReturnCountAfter: verification.invoiceReturnCountAfter,
        invoiceReturnHashBefore: verification.beforeReturnHash,
        invoiceReturnHashAfter: verification.afterReturnHash,
        invoiceHashBefore: verification.beforeInvoiceHash,
        invoiceHashAfter: verification.afterInvoiceHash,
        movementHashBefore: verification.beforeMovementHash,
        movementHashAfter: verification.afterMovementHash,
        productHashBefore: verification.beforeProductHash,
        productHashAfter: verification.afterProductHash,
        legacyProductHashBefore: verification.beforeLegacyProductHash,
        legacyProductHashAfter: verification.afterLegacyProductHash,
        invalidUiRejected: verification.invalidUiRejected,
        excessiveUiRejected: verification.excessiveUiRejected,
        validUiExecuted: verification.validUiExecuted,
        auditVisibleAfterExecution: verification.auditVisibleAfterExecution,
        consoleErrorsCount: runtime.consoleErrors,
        pageExceptionsCount: runtime.pageExceptions,
        envUntracked: !runtime.env.envTracked,
    };
}

function buildStorageEvidence(verification, reloadEvidence) {
    return {
        accountId: verification.accountIdSanitized,
        invoiceReturnsScopedKey: verification.invoiceReturnScopedKeySanitized,
        stockMovementScopedKey: verification.stockMovementScopedKeySanitized,
        invoiceScopedKey: verification.invoiceScopedKeySanitized,
        productScopedKey: verification.productScopedKeySanitized,
        issuedInvoiceId: verification.issuedInvoiceIdSanitized,
        invoiceLineId: verification.invoiceLineIdSanitized,
        originalSaleDeductionMovementId:
            verification.originalSaleDeductionMovementIdSanitized,
        createdReturnId: verification.createdReturnIdSanitized,
        createdReturnLineId: verification.createdReturnLineIdSanitized,
        createdSaleReturnMovementId:
            verification.createdSaleReturnMovementIdSanitized,
        invoiceReturnHashBefore: verification.beforeReturnHash,
        invoiceReturnHashAfter: verification.afterReturnHash,
        invoiceHashBefore: verification.beforeInvoiceHash,
        invoiceHashAfter: verification.afterInvoiceHash,
        movementHashBefore: verification.beforeMovementHash,
        movementHashAfter: verification.afterMovementHash,
        productHashBefore: verification.beforeProductHash,
        productHashAfter: verification.afterProductHash,
        legacyProductHashBefore: verification.beforeLegacyProductHash,
        legacyProductHashAfter: verification.afterLegacyProductHash,
        movementCountBefore: verification.movementCountBeforeReturn,
        movementCountAfter: verification.movementCountAfterReturn,
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
}

function writeReturnUiSummary(summary) {
    writeFileSync(
        resolve(outputDir, "invoice-return-ui-summary.json"),
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
            const inventoryService = Container.get("inventoryService");

            window.__containerInventoryServiceForVerification = inventoryService;

            return {
                state,
                accountId,
                providerUserId: getFirebaseAuth()?.currentUser?.uid ?? "",
                invoiceService: Container.get("invoiceService"),
                invoiceReturnService: Container.get("invoiceReturnService"),
                inventoryService,
                routeRegistry,
                keys,
                before: collectStorage(keys),
            };
        }

        async function buildCommonVerification(context, candidate) {
            return {
                authSessionExists: context.state.status === "authenticated",
                accountIdPresent: Boolean(context.accountId),
                providerUserIdPresent: Boolean(context.providerUserId),
                accountIdEqualsProviderUserId:
                    Boolean(context.accountId)
                    && context.accountId === context.providerUserId,
                accountIdSanitized: await sanitizeValue(context.accountId),
                providerUserIdSanitized: await sanitizeValue(context.providerUserId),
                routeGuardActive:
                    context.routeRegistry.invoices?.access === "protected",
                returnRouteExists: Boolean(context.routeRegistry.returns),
                returnServiceAvailable:
                    typeof context.invoiceReturnService.createReturnRecord === "function"
                    && typeof context.invoiceReturnService.executeReturn === "function",
                issuedReturnableLineExists: Boolean(candidate.invoiceId),
                issuedInvoiceIdSanitized: await sanitizeValue(candidate.invoiceId),
                invoiceLineIdSanitized: await sanitizeValue(candidate.invoiceLineId),
                originalSaleDeductionMovementIdSanitized:
                    await sanitizeValue(candidate.originalSaleDeductionMovementId),
                invoiceReturnScopedKeyCorrect:
                    context.keys.invoiceReturnScopedKey
                    === "invoiceReturns:" + context.accountId,
                stockMovementScopedKeyCorrect:
                    context.keys.stockMovementScopedKey
                    === "stockMovements:" + context.accountId,
                invoiceReturnScopedKeySanitized:
                    "invoiceReturns:{" + await sanitizeValue(context.accountId) + "}",
                stockMovementScopedKeySanitized:
                    "stockMovements:{" + await sanitizeValue(context.accountId) + "}",
                invoiceScopedKeySanitized:
                    "invoices:{" + await sanitizeValue(context.accountId) + "}",
                productScopedKeySanitized:
                    "products:{" + await sanitizeValue(context.accountId) + "}",
                globalReturnKeyExists: localStorage.getItem("invoiceReturns") !== null,
            };
        }

        function collectStorage(keys) {
            const invoiceRaw = localStorage.getItem(keys.invoiceScopedKey);
            const returnRaw = localStorage.getItem(keys.invoiceReturnScopedKey);
            const movementRaw = localStorage.getItem(keys.stockMovementScopedKey);
            const productRaw = localStorage.getItem(keys.productScopedKey);
            const legacyProductRaw = localStorage.getItem("products");

            return {
                invoiceRaw,
                returnRaw,
                movementRaw,
                productRaw,
                legacyProductRaw,
                invoices: parseArray(invoiceRaw),
                returns: parseArray(returnRaw),
                movements: parseArray(movementRaw),
                products: parseArray(productRaw),
            };
        }

        function findReturnableInvoiceLine(invoiceReturnService, invoices) {
            for (const invoice of invoices) {
                if (invoice?.status !== "issued" || !Array.isArray(invoice?.lines)) {
                    continue;
                }

                for (const line of invoice.lines) {
                    if (
                        typeof line?.stockMovementId !== "string"
                        || !line.stockMovementId.trim()
                        || typeof line?.quantity !== "number"
                        || line.quantity <= 0
                    ) {
                        continue;
                    }

                    const remainingReturnable =
                        invoiceReturnService.getRemainingReturnableQuantity(
                            invoice.id,
                            line.id
                        );

                    if (remainingReturnable <= 0) {
                        continue;
                    }

                    const inventoryService =
                        (window.__containerInventoryServiceForVerification)
                        ?? null;

                    return {
                        invoiceId: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        invoiceLineId: line.id,
                        productId: line.productId,
                        productNameSnapshot: line.productNameSnapshot,
                        originalSaleDeductionMovementId: line.stockMovementId,
                        invoiceQuantity: line.quantity,
                        remainingReturnable,
                        availableBefore: inventoryService
                            ? inventoryService.getAvailableQuantity(line.productId)
                            : 0,
                    };
                }
            }

            throw new Error("Issued invoice line with remaining returnable quantity is required.");
        }

        function collectReturnDomEvidence() {
            const returnUiExists =
                Boolean(document.querySelector("[data-action='create-invoice-return']"))
                || Boolean(document.querySelector(".invoice-return-quantity-input"));
            const inputs = Array.from(
                document.querySelectorAll(".invoice-return-quantity-input")
            );
            const buttons = Array.from(
                document.querySelectorAll("[data-action='create-invoice-return']")
            );
            const audits = Array.from(
                document.querySelectorAll(".invoice-return-audit")
            );

            return {
                returnUiExists,
                returnQuantityInputExists: inputs.length > 0,
                returnButtonExists: buttons.length > 0,
                returnAuditExists: audits.length > 0,
                auditText: audits
                    .map(element => element.textContent?.trim() ?? "")
                    .join(" "),
            };
        }

        function submitReturnViaUi(invoiceLineId, quantity) {
            const input = Array.from(
                document.querySelectorAll(".invoice-return-quantity-input")
            ).find(element => element.dataset.invoiceLineId === invoiceLineId);
            const button = Array.from(
                document.querySelectorAll("[data-action='create-invoice-return']")
            ).find(element => element.dataset.invoiceLineId === invoiceLineId);
            const message = document.getElementById("invoice-draft-message");

            if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
                throw new Error("Invoice return UI controls were not found.");
            }

            input.value = String(quantity);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            button.click();

            return {
                message: message?.textContent ?? "",
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
