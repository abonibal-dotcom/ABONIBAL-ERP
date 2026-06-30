import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import type { Auth, User } from "firebase/auth";

import type { AuthProvider, SignInCredentials } from "../AuthProvider";
import type { AuthSession } from "../AuthSession";
import type { AuthProviderIdentity, AuthSessionResolver } from "../AuthSessionResolver";

export type FirebaseAuthSessionResolver = AuthSessionResolver;

export class FirebaseAuthProvider implements AuthProvider {

    private readonly auth: Auth;

    private readonly sessionResolver: FirebaseAuthSessionResolver;

    public constructor(auth: Auth, sessionResolver: FirebaseAuthSessionResolver) {

        this.auth = auth;

        this.sessionResolver = sessionResolver;

    }

    public async getCurrentSession(): Promise<AuthSession | null> {

        const currentUser = this.auth.currentUser;

        if (!currentUser) {

            return null;

        }

        return this.resolveSession(currentUser);

    }

    public async signIn(credentials: SignInCredentials): Promise<AuthSession> {

        const credential = await signInWithEmailAndPassword(
            this.auth,
            credentials.email,
            credentials.password
        );

        const session = await this.resolveSession(credential.user);

        if (!session) {

            await firebaseSignOut(this.auth);

            throw new Error("Firebase user authenticated, but AuthSession could not be resolved.");

        }

        return session;

    }

    public async signOut(): Promise<void> {

        await firebaseSignOut(this.auth);

    }

    private async resolveSession(firebaseUser: User): Promise<AuthSession | null> {

        return this.sessionResolver.resolve(this.toProviderIdentity(firebaseUser));

    }

    private toProviderIdentity(firebaseUser: User): AuthProviderIdentity {

        const displayName = normalizeOptionalText(firebaseUser.displayName ?? undefined);
        const email = normalizeOptionalText(firebaseUser.email ?? undefined);

        return {
            provider: "firebase",
            providerUserId: firebaseUser.uid,
            ...(displayName ? { displayName } : {}),
            ...(email ? { email } : {}),
        };

    }

}

function normalizeOptionalText(value: string | undefined): string | undefined {

    const normalized = value?.trim();

    return normalized ? normalized : undefined;

}
