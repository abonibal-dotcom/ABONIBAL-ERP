import { CommercialCommandError } from "./CommercialCommandErrors.js";
import type { AccountMembershipRepository } from "./AccountMembershipRepository.js";

export type TrustedCallableContext = {
    firebaseUid?: string;
    appCheckVerified: boolean;
};

export class CallableSecurityGuard {
    constructor(
        private readonly membershipRepository: AccountMembershipRepository
    ) {}

    async authorize(
        context: TrustedCallableContext,
        accountId: string
    ): Promise<{ firebaseUid: string }> {
        if (!context.firebaseUid) {
            throw new CommercialCommandError(
                "AUTH_REQUIRED",
                "Authentication is required."
            );
        }

        if (!context.appCheckVerified) {
            throw new CommercialCommandError(
                "APP_CHECK_REQUIRED",
                "A verified App Check assertion is required."
            );
        }

        const isMember = await this.membershipRepository.isMember(
            accountId,
            context.firebaseUid
        );

        if (!isMember) {
            throw new CommercialCommandError(
                "MEMBERSHIP_REQUIRED",
                "The authenticated principal is not a member of the requested account."
            );
        }

        return { firebaseUid: context.firebaseUid };
    }
}
