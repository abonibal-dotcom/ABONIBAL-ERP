import { describe, expect, it } from "vitest";
import type { AccountMembershipRepository } from "../../src/trusted/AccountMembershipRepository.js";
import { CallableSecurityGuard } from "../../src/trusted/CallableSecurityGuard.js";

class FakeMembershipRepository implements AccountMembershipRepository {
    readonly requests: Array<{ accountId: string; firebaseUid: string }> = [];

    constructor(private readonly members: ReadonlySet<string>) {}

    isMember(accountId: string, firebaseUid: string): Promise<boolean> {
        this.requests.push({ accountId, firebaseUid });
        return Promise.resolve(this.members.has(`${accountId}/${firebaseUid}`));
    }
}

describe("Callable security guard", () => {
    it("accepts verified Auth and App Check for an explicit account membership", async () => {
        const memberships = new FakeMembershipRepository(
            new Set(["account-own/auth-principal"])
        );
        const guard = new CallableSecurityGuard(memberships);

        await expect(guard.authorize({
            firebaseUid: "auth-principal",
            appCheckVerified: true
        }, "account-own")).resolves.toEqual({ firebaseUid: "auth-principal" });
        expect(memberships.requests).toEqual([{
            accountId: "account-own",
            firebaseUid: "auth-principal"
        }]);
    });

    it("rejects missing authentication before membership lookup", async () => {
        const memberships = new FakeMembershipRepository(new Set());
        const guard = new CallableSecurityGuard(memberships);

        await expect(guard.authorize({
            appCheckVerified: true
        }, "account-own")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
        expect(memberships.requests).toHaveLength(0);
    });

    it("rejects a missing or invalid App Check assertion", async () => {
        const memberships = new FakeMembershipRepository(new Set());
        const guard = new CallableSecurityGuard(memberships);

        await expect(guard.authorize({
            firebaseUid: "auth-principal",
            appCheckVerified: false
        }, "account-own")).rejects.toMatchObject({ code: "APP_CHECK_REQUIRED" });
        expect(memberships.requests).toHaveLength(0);
    });

    it("denies missing and cross-account memberships without a UID fallback", async () => {
        const memberships = new FakeMembershipRepository(
            new Set(["account-own/auth-principal"])
        );
        const guard = new CallableSecurityGuard(memberships);

        await expect(guard.authorize({
            firebaseUid: "auth-principal",
            appCheckVerified: true
        }, "account-foreign")).rejects.toMatchObject({
            code: "MEMBERSHIP_REQUIRED"
        });

        expect(memberships.requests[0]).toEqual({
            accountId: "account-foreign",
            firebaseUid: "auth-principal"
        });
        expect(memberships.requests[0]?.accountId).not.toBe(
            memberships.requests[0]?.firebaseUid
        );
    });
});
