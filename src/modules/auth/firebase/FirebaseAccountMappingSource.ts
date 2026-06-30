import { doc, getDoc, type Firestore } from "firebase/firestore";

import type { AccountMapping, AccountMappingSource, ProviderUserReference } from "../AccountMappingSource";
import { AccountMappingNotFoundError } from "../AccountMappingSource";
import type { AuthRole } from "../AuthRole";

const firebaseProvider = "firebase";

export const firebaseAccountMappingPath = "accountMappings/firebase/providerUsers/{providerUserId}";

type MappingRecord = Record<string, unknown>;

export class FirebaseAccountMappingSource implements AccountMappingSource {

    private readonly firestore: Firestore;

    public constructor(firestore: Firestore) {

        this.firestore = firestore;

    }

    public async resolveAccountMapping(providerUser: ProviderUserReference): Promise<AccountMapping> {

        const provider = normalizeProvider(providerUser.provider);
        const providerUserId = normalizeRequiredText(providerUser.providerUserId, "providerUserId");

        if (provider !== firebaseProvider) {

            throw new AccountMappingNotFoundError(providerUser);

        }

        const snapshot = await getDoc(doc(
            this.firestore,
            "accountMappings",
            firebaseProvider,
            "providerUsers",
            providerUserId
        ));

        if (!snapshot.exists()) {

            throw new AccountMappingNotFoundError(providerUser);

        }

        return toAccountMapping(provider, providerUserId, snapshot.data());

    }

}

function toAccountMapping(provider: string, providerUserId: string, value: unknown): AccountMapping {

    const record = requireRecord(value);
    const recordProvider = normalizeRequiredText(record.provider, "provider");
    const recordProviderUserId = normalizeRequiredText(record.providerUserId, "providerUserId");
    const accountId = normalizeRequiredText(record.accountId, "accountId");
    const accountName = normalizeRequiredText(record.accountName, "accountName");
    const userId = normalizeRequiredText(record.userId, "userId");
    const displayName = normalizeRequiredText(record.displayName, "displayName");
    const role = normalizeRole(record.role);
    const email = normalizeOptionalText(record.email);

    if (recordProvider !== provider) {

        throw invalidMapping("provider does not match the authenticated provider");

    }

    if (recordProviderUserId !== providerUserId) {

        throw invalidMapping("providerUserId does not match the authenticated provider user");

    }

    if (accountId === providerUserId) {

        throw invalidMapping("accountId must be explicit and distinct from providerUserId");

    }

    return {
        provider,
        providerUserId,
        accountId,
        accountName,
        userId,
        displayName,
        role,
        ...(email ? { email } : {}),
    };

}

function requireRecord(value: unknown): MappingRecord {

    if (!value || typeof value !== "object" || Array.isArray(value)) {

        throw invalidMapping("record must be an object");

    }

    return value as MappingRecord;

}

function normalizeProvider(value: string): string {

    return normalizeRequiredText(value, "provider");

}

function normalizeRequiredText(value: unknown, fieldName: string): string {

    if (typeof value !== "string") {

        throw invalidMapping(`${fieldName} must be a string`);

    }

    const normalized = value.trim();

    if (!normalized) {

        throw invalidMapping(`${fieldName} is required`);

    }

    return normalized;

}

function normalizeOptionalText(value: unknown): string | undefined {

    if (value === undefined || value === null) {

        return undefined;

    }

    if (typeof value !== "string") {

        throw invalidMapping("email must be a string when provided");

    }

    const normalized = value.trim();

    return normalized ? normalized : undefined;

}

function normalizeRole(value: unknown): AuthRole {

    if (value === "owner" || value === "user") {

        return value;

    }

    throw invalidMapping("role must be owner or user");

}

function invalidMapping(reason: string): Error {

    return new Error(`Invalid Firebase account mapping: ${reason}.`);

}
