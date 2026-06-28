import type { AuthRole } from "./AuthRole";
import type { AuthProviderIdentity } from "./AuthSessionResolver";

export type ProviderUserReference = AuthProviderIdentity;

export interface AccountMapping {

    provider: string;

    providerUserId: string;

    accountId: string;

    accountName: string;

    userId: string;

    displayName: string;

    role: AuthRole;

    email?: string;

}

export interface AccountMappingSource {

    resolveAccountMapping(providerUser: ProviderUserReference): Promise<AccountMapping>;

}

export class AccountMappingNotFoundError extends Error {

    public constructor(providerUser: ProviderUserReference) {

        super(`Account mapping was not found for provider "${providerUser.provider}" user "${providerUser.providerUserId}".`);

        this.name = "AccountMappingNotFoundError";

    }

}
