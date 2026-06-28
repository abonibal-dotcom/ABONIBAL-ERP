import type { AuthRole } from "./AuthRole";
import type { AuthSession } from "./AuthSession";

export interface AuthProviderIdentity {

    provider: string;

    providerUserId: string;

    displayName?: string;

    email?: string;

}

export interface AuthAccountSessionResolution {

    userId: string;

    accountId: string;

    accountName: string;

    displayName: string;

    role: AuthRole;

    email?: string;

}

export interface AuthAccountSessionResolver {

    resolve(providerIdentity: AuthProviderIdentity): Promise<AuthAccountSessionResolution | null>;

}

export interface AuthSessionResolver {

    resolve(providerIdentity: AuthProviderIdentity): Promise<AuthSession | null>;

}

export type AuthSessionTimestampProvider = () => string;

const defaultTimestampProvider: AuthSessionTimestampProvider = () => new Date().toISOString();

export class DefaultAuthSessionResolver implements AuthSessionResolver {

    private readonly accountSessionResolver: AuthAccountSessionResolver;

    private readonly timestampProvider: AuthSessionTimestampProvider;

    public constructor(
        accountSessionResolver: AuthAccountSessionResolver,
        timestampProvider: AuthSessionTimestampProvider = defaultTimestampProvider
    ) {

        this.accountSessionResolver = accountSessionResolver;

        this.timestampProvider = timestampProvider;

    }

    public async resolve(providerIdentity: AuthProviderIdentity): Promise<AuthSession | null> {

        const resolution = await this.accountSessionResolver.resolve(providerIdentity);

        if (!resolution) {

            return null;

        }

        const userId = requireText(resolution.userId, "userId");
        const accountId = requireText(resolution.accountId, "accountId");
        const accountName = requireText(resolution.accountName, "accountName");
        const displayName = requireText(resolution.displayName, "displayName");
        const email = normalizeOptionalText(resolution.email);
        const role = requireRole(resolution.role);

        return {
            user: {
                id: userId,
                accountId,
                displayName,
                ...(email ? { email } : {}),
                role,
            },
            account: {
                id: accountId,
                name: accountName,
            },
            authenticatedAt: requireText(this.timestampProvider(), "authenticatedAt"),
        };

    }

}

function requireText(value: string, fieldName: string): string {

    const normalized = value.trim();

    if (!normalized) {

        throw new Error(`Auth session resolution returned an empty ${fieldName}.`);

    }

    return normalized;

}

function normalizeOptionalText(value: string | undefined): string | undefined {

    const normalized = value?.trim();

    return normalized ? normalized : undefined;

}

function requireRole(value: AuthRole): AuthRole {

    if (value !== "owner" && value !== "user") {

        throw new Error("Auth session resolution returned an unsupported role.");

    }

    return value;

}
