import { describe, expect, it } from "vitest";
import { TrustedCommercialCommandService } from "../../src/trusted/TrustedCommercialCommandService.js";
import { TrustedCommandHandlerRegistry } from "../../src/trusted/TrustedCommandHandlerRegistry.js";
import type { CommercialCommandReceiptStore } from "../../src/trusted/CommercialCommandReceiptStore.js";
import type {
    CommercialCommandRequest,
    TrustedCommandHandlerResult
} from "../../src/trusted/CommercialCommandTypes.js";
import { InMemoryCommercialCommandReceiptStore } from "../helpers/InMemoryCommercialCommandReceiptStore.js";

function request(payload: Record<string, string | number> = { value: 1 }): CommercialCommandRequest {
    return {
        schemaVersion: 1,
        accountId: "account-test",
        commandId: "command-001",
        commandType: "test.synthetic",
        targetId: "target-001",
        payload
    };
}

function serviceWith(
    store: CommercialCommandReceiptStore,
    handler: (command: CommercialCommandRequest) => Promise<TrustedCommandHandlerResult>,
    now: () => number = () => 1_000
) {
    const registry = new TrustedCommandHandlerRegistry();
    registry.register("test.synthetic", handler);

    let leaseSequence = 0;
    return new TrustedCommercialCommandService(store, registry, {
        now,
        createLeaseId: () => `lease-${++leaseSequence}`,
        leaseDurationMs: 100
    });
}

describe("Trusted commercial command service", () => {
    it("rejects unsupported operational commands before durable claim", async () => {
        const store = new InMemoryCommercialCommandReceiptStore();
        const registry = new TrustedCommandHandlerRegistry();
        const service = new TrustedCommercialCommandService(store, registry);

        await expect(service.submit({
            ...request(),
            commandType: "invoiceReturn.execute"
        })).rejects.toMatchObject({ code: "UNSUPPORTED_COMMAND" });
        expect(store.size).toBe(0);
    });

    it("claims once and blocks a concurrent exact retry from a second handler", async () => {
        const store = new InMemoryCommercialCommandReceiptStore();
        let handlerCalls = 0;
        let releaseHandler!: () => void;
        const waitForRelease = new Promise<void>(resolve => {
            releaseHandler = resolve;
        });
        const service = serviceWith(store, async () => {
            handlerCalls += 1;
            await waitForRelease;
            return { status: "accepted", safeResultSummary: { ok: true } };
        });

        const first = service.submit(request());
        await Promise.resolve();
        const secondReceipt = await service.submit(request());

        expect(secondReceipt.status).toBe("processing");
        expect(secondReceipt).not.toHaveProperty("processingLeaseId");
        expect(handlerCalls).toBe(1);

        releaseHandler();
        await expect(first).resolves.toMatchObject({ status: "accepted" });
        expect(handlerCalls).toBe(1);
    });

    it.each([
        [{ status: "accepted", safeResultSummary: { ok: true } } as const, "accepted"],
        [{ status: "rejected", errorCode: "TEST_REJECTED" } as const, "rejected"],
        [{ status: "conflict", errorCode: "TEST_CONFLICT" } as const, "conflict"]
    ])("returns terminal exact retries without executing the handler again", async (
        result,
        expectedStatus
    ) => {
        const store = new InMemoryCommercialCommandReceiptStore();
        let handlerCalls = 0;
        const service = serviceWith(store, async () => {
            handlerCalls += 1;
            return result;
        });

        const first = await service.submit(request());
        const retry = await service.submit(request());
        const stored = await store.find("account-test", "command-001");

        expect(first.status).toBe(expectedStatus);
        expect(retry).toEqual(first);
        expect(handlerCalls).toBe(1);
        expect(stored).not.toHaveProperty("payload");
        expect(stored).not.toHaveProperty("authToken");
        expect(stored).not.toHaveProperty("appCheckToken");
        expect(stored).not.toHaveProperty("firebaseUid");
    });

    it("rejects the same command identity with a different canonical request", async () => {
        const store = new InMemoryCommercialCommandReceiptStore();
        let handlerCalls = 0;
        const service = serviceWith(store, async () => {
            handlerCalls += 1;
            return { status: "accepted", safeResultSummary: { ok: true } };
        });

        await service.submit(request({ value: 1 }));
        await expect(service.submit(request({ value: 2 }))).rejects.toMatchObject({
            code: "COMMAND_ID_CONFLICT"
        });
        expect(handlerCalls).toBe(1);
        expect(store.size).toBe(1);
    });

    it("keeps a processing receipt after handler interruption and reclaims an expired lease", async () => {
        const store = new InMemoryCommercialCommandReceiptStore();
        let now = 1_000;
        let handlerCalls = 0;
        const service = serviceWith(store, async () => {
            handlerCalls += 1;
            if (handlerCalls === 1) {
                throw new Error("synthetic crash");
            }
            return { status: "accepted", safeResultSummary: { recovered: true } };
        }, () => now);

        await expect(service.submit(request())).rejects.toMatchObject({
            code: "INTERNAL_RETRYABLE"
        });
        expect((await store.find("account-test", "command-001"))?.status).toBe(
            "processing"
        );

        now = 1_101;
        const recovered = await service.submit(request());

        expect(recovered.status).toBe("accepted");
        expect(recovered.attemptCount).toBe(2);
        expect(handlerCalls).toBe(2);
    });

    it("recovers a failed final receipt write without a second logical effect", async () => {
        const innerStore = new InMemoryCommercialCommandReceiptStore();
        let failCompletion = true;
        const store: CommercialCommandReceiptStore = {
            claim: input => innerStore.claim(input),
            find: (accountId, commandId) => innerStore.find(accountId, commandId),
            complete: input => {
                if (failCompletion) {
                    failCompletion = false;
                    return Promise.reject(new Error("synthetic final write failure"));
                }
                return innerStore.complete(input);
            }
        };
        let now = 1_000;
        const appliedCommands = new Set<string>();
        let handlerCalls = 0;
        let logicalEffects = 0;
        const service = serviceWith(store, async command => {
            handlerCalls += 1;
            if (!appliedCommands.has(command.commandId)) {
                appliedCommands.add(command.commandId);
                logicalEffects += 1;
            }
            return { status: "accepted", safeResultSummary: { ok: true } };
        }, () => now);

        await expect(service.submit(request())).rejects.toThrow(
            "synthetic final write failure"
        );

        now = 1_101;
        await expect(service.submit(request())).resolves.toMatchObject({
            status: "accepted",
            attemptCount: 2
        });
        expect(handlerCalls).toBe(2);
        expect(logicalEffects).toBe(1);
    });

    it("returns safe receipt lookup data without the internal lease ID", async () => {
        const store = new InMemoryCommercialCommandReceiptStore();
        const service = serviceWith(store, async () => new Promise(() => undefined));

        void service.submit(request());
        await Promise.resolve();
        const lookup = await service.lookup("account-test", "command-001");

        expect(lookup.found).toBe(true);
        if (lookup.found) {
            expect(lookup.receipt.status).toBe("processing");
            expect(lookup.receipt).not.toHaveProperty("processingLeaseId");
        }
    });
});
