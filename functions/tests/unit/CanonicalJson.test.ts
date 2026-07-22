import { describe, expect, it } from "vitest";
import {
    canonicalChecksum,
    canonicalJson,
    normalizeJsonObject
} from "../../src/trusted/CanonicalJson.js";
import {
    calculateCommandRequestChecksum,
    validateCommercialCommandRequest
} from "../../src/trusted/CommercialCommandValidation.js";

const EXPECTED_CANONICAL = "{\"accountId\":\"account-test\",\"commandId\":\"cmd-001\",\"commandType\":\"test.synthetic\",\"payload\":{\"a\":\"first\",\"nested\":{\"a\":true,\"z\":null},\"numbers\":[3,1.5,0]},\"schemaVersion\":1,\"targetId\":\"target-001\"}";
const EXPECTED_CHECKSUM = "002ede21ab0ec3d48928f506f81f32a3907616e40442ced5a7053ba7627a8493";

describe("Canonical JSON compatibility", () => {
    it("matches the browser canonical contract golden vector", () => {
        const request = validateCommercialCommandRequest({
            targetId: "target-001",
            payload: {
                numbers: [3, 1.5, 0],
                nested: { z: null, a: true },
                a: "first"
            },
            commandType: "test.synthetic",
            schemaVersion: 1,
            commandId: "cmd-001",
            accountId: "account-test"
        });
        const checksumInput = normalizeJsonObject({
            schemaVersion: request.schemaVersion,
            accountId: request.accountId,
            commandId: request.commandId,
            commandType: request.commandType,
            targetId: request.targetId,
            payload: request.payload
        });

        expect(canonicalJson(checksumInput)).toBe(EXPECTED_CANONICAL);
        expect(canonicalChecksum(checksumInput)).toBe(EXPECTED_CHECKSUM);
        expect(calculateCommandRequestChecksum(request)).toBe(EXPECTED_CHECKSUM);
    });

    it("is stable across field ordering and changes for semantic payload changes", () => {
        const left = normalizeJsonObject({ b: 2, a: { y: 2, x: 1 } });
        const reordered = normalizeJsonObject({ a: { x: 1, y: 2 }, b: 2 });
        const changed = normalizeJsonObject({ a: { x: 1, y: 3 }, b: 2 });

        expect(canonicalChecksum(left)).toBe(canonicalChecksum(reordered));
        expect(canonicalChecksum(left)).not.toBe(canonicalChecksum(changed));
    });
});
