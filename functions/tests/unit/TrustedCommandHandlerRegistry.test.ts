import { describe, expect, it } from "vitest";
import {
    createRuntimeTrustedCommandHandlerRegistry,
    TrustedCommandHandlerRegistry
} from "../../src/trusted/TrustedCommandHandlerRegistry.js";

describe("Trusted command handler registry", () => {
    it("keeps the runtime registry empty for operational commands", () => {
        const registry = createRuntimeTrustedCommandHandlerRegistry();

        expect(registry.size).toBe(0);
        expect(registry.resolve("invoiceReturn.execute")).toBeNull();
        expect(registry.resolve("invoice.issue")).toBeNull();
        expect(registry.resolve("invoice.cancel")).toBeNull();
    });

    it("uses exact matching and rejects duplicate test registration", () => {
        const registry = new TrustedCommandHandlerRegistry();
        const handler = async () => ({
            status: "accepted" as const,
            safeResultSummary: { ok: true }
        });

        registry.register("test.synthetic", handler);

        expect(registry.resolve("test.synthetic")).toBe(handler);
        expect(registry.resolve("test")).toBeNull();
        expect(registry.resolve("test.*")).toBeNull();
        expect(() => registry.register("test.synthetic", handler)).toThrow(
            /already registered/i
        );
    });
});
