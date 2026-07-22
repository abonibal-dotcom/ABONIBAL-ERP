import { describe, expect, it } from "vitest";
import { CommercialCommandError } from "../../src/trusted/CommercialCommandErrors.js";
import {
    assertClientChecksumMatches,
    calculateCommandRequestChecksum,
    validateCommercialCommandRequest
} from "../../src/trusted/CommercialCommandValidation.js";

function validInput() {
    return {
        schemaVersion: 1,
        accountId: "account-test",
        commandId: "command-001",
        commandType: "test.synthetic",
        targetId: "target-001",
        payload: { value: 1 }
    };
}

describe("Commercial command validation", () => {
    it("accepts the stable request envelope", () => {
        expect(validateCommercialCommandRequest(validInput())).toMatchObject(validInput());
    });

    it.each([
        [{ ...validInput(), schemaVersion: 2 }],
        [{ ...validInput(), accountId: "bad/account" }],
        [{ ...validInput(), commandType: "invalid" }],
        [{ ...validInput(), unexpected: true }],
        [{ ...validInput(), payload: [] }]
    ])("rejects malformed envelopes", input => {
        expect(() => validateCommercialCommandRequest(input)).toThrow(
            CommercialCommandError
        );
    });

    it("rejects an excessive payload", () => {
        expect(() => validateCommercialCommandRequest({
            ...validInput(),
            payload: { value: "x".repeat(70 * 1024) }
        })).toThrowError(/payload exceeds/i);
    });

    it("checks an optional client checksum against the canonical server checksum", () => {
        const request = validateCommercialCommandRequest(validInput());
        const checksum = calculateCommandRequestChecksum(request);

        expect(() => assertClientChecksumMatches(
            { ...request, clientRequestChecksum: checksum },
            checksum
        )).not.toThrow();
        expect(() => assertClientChecksumMatches(
            { ...request, clientRequestChecksum: "0".repeat(64) },
            checksum
        )).toThrowError(/does not match/i);
    });
});
