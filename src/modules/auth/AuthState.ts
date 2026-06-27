import type { AuthSession } from "./AuthSession";

export type AuthState =
    | { status: "loading" }
    | { status: "authenticated"; session: AuthSession }
    | { status: "unauthenticated" };
