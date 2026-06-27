import type { AuthRole } from "./AuthRole";

export interface UserIdentity {

    id: string;

    accountId: string;

    displayName: string;

    email?: string;

    role: AuthRole;

}
