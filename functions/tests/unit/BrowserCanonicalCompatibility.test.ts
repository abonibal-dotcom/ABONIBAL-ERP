import { describe, expect, it } from "vitest";
import {
    canonicalChecksum as browserCanonicalChecksum,
    canonicalJson as browserCanonicalJson,
    toJsonObject as browserToJsonObject
} from "../../../src/modules/sync/master-data/CanonicalJson.ts";
import {
    canonicalChecksum as serverCanonicalChecksum,
    canonicalJson as serverCanonicalJson,
    normalizeJsonObject
} from "../../src/trusted/CanonicalJson.js";

describe("browser/server canonical compatibility", () => {
    it("produces identical canonical text and checksum for golden values", () => {
        const fixture = {
            z: [{ b: 2, a: 1 }, null, true],
            a: "text",
            nested: { omega: 0, alpha: -12.5 }
        };
        const browserValue = browserToJsonObject(fixture);
        const serverValue = normalizeJsonObject(fixture);

        expect(serverCanonicalJson(serverValue)).toBe(
            browserCanonicalJson(browserValue)
        );
        expect(serverCanonicalChecksum(serverValue)).toBe(
            browserCanonicalChecksum(browserValue)
        );
    });
});
