import type { AccountIdentity } from "./AccountIdentity";
import type { UserIdentity } from "./UserIdentity";

export interface AuthSession {

    user: UserIdentity;

    account: AccountIdentity;

    authenticatedAt: string;

}
