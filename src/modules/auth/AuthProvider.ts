import type { AuthSession } from "./AuthSession";

export interface SignInCredentials {

    email: string;

    password: string;

}

export interface AuthProvider {

    getCurrentSession(): Promise<AuthSession | null>;

    signIn(credentials: SignInCredentials): Promise<AuthSession>;

    signOut(): Promise<void>;

}
