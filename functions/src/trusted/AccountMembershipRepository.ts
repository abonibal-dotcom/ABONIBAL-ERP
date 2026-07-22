import type { Database } from "firebase-admin/database";

export interface AccountMembershipRepository {
    isMember(accountId: string, firebaseUid: string): Promise<boolean>;
}

export class FirebaseAccountMembershipRepository
implements AccountMembershipRepository {
    constructor(private readonly database: Database) {}

    async isMember(accountId: string, firebaseUid: string): Promise<boolean> {
        if (!isSafePathSegment(firebaseUid)) {
            return false;
        }

        const snapshot = await this.database
            .ref(`accountMembers/${accountId}/${firebaseUid}`)
            .get();

        return snapshot.val() === true;
    }
}

function isSafePathSegment(value: string): boolean {
    return value.length > 0 && !/[.#$\[\]/]/.test(value);
}
