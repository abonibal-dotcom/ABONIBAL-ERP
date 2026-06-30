import type { AccountMappingSource } from "./AccountMappingSource";
import { AccountMappingNotFoundError } from "./AccountMappingSource";
import type { AuthAccountSessionResolution, AuthAccountSessionResolver, AuthProviderIdentity } from "./AuthSessionResolver";

export class AccountMappingSessionResolver implements AuthAccountSessionResolver {

    private readonly accountMappingSource: AccountMappingSource;

    public constructor(accountMappingSource: AccountMappingSource) {

        this.accountMappingSource = accountMappingSource;

    }

    public async resolve(providerIdentity: AuthProviderIdentity): Promise<AuthAccountSessionResolution | null> {

        try {

            const mapping = await this.accountMappingSource.resolveAccountMapping(providerIdentity);

            return {
                userId: mapping.userId,
                accountId: mapping.accountId,
                accountName: mapping.accountName,
                displayName: mapping.displayName,
                role: mapping.role,
                ...(mapping.email ? { email: mapping.email } : {}),
            };

        } catch (error) {

            if (error instanceof AccountMappingNotFoundError) {

                return null;

            }

            throw error;

        }

    }

}
