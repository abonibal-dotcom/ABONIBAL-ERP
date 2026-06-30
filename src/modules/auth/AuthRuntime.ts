import type { AuthProvider, SignInCredentials } from "./AuthProvider";
import type { AuthSession } from "./AuthSession";
import { AuthStateService } from "./AuthStateService";
import { AccountMappingSessionResolver } from "./AccountMappingSessionResolver";
import { DefaultAuthSessionResolver } from "./AuthSessionResolver";
import { getFirestore } from "firebase/firestore";

import { getFirebaseApp, initializeFirebaseAuth } from "./firebase/FirebaseAuthClient";
import { hasFirebaseAuthConfig, readFirebaseAuthConfig } from "./firebase/FirebaseAuthConfig";
import { FirebaseAccountMappingSource } from "./firebase/FirebaseAccountMappingSource";
import { FirebaseAuthProvider } from "./firebase/FirebaseAuthProvider";

let authStateService: AuthStateService | null = null;

export class AuthConfigurationUnavailableError extends Error {

    public constructor() {

        super("Auth sign-in is not configured for this environment.");

        this.name = "AuthConfigurationUnavailableError";

    }

}

export function getAuthStateService(): AuthStateService {

    if (!authStateService) {

        authStateService = new AuthStateService(createAuthProvider());

    }

    return authStateService;

}

function createAuthProvider(): AuthProvider {

    if (!hasFirebaseAuthConfig()) {

        return new MissingFirebaseAuthConfigProvider();

    }

    const auth = initializeFirebaseAuth(readFirebaseAuthConfig());
    const firebaseApp = getFirebaseApp();

    if (!firebaseApp) {

        throw new Error("Firebase app was not initialized for Auth.");

    }

    const accountResolver = new AccountMappingSessionResolver(
        new FirebaseAccountMappingSource(getFirestore(firebaseApp))
    );
    const sessionResolver = new DefaultAuthSessionResolver(accountResolver);

    return new FirebaseAuthProvider(auth, sessionResolver);

}

class MissingFirebaseAuthConfigProvider implements AuthProvider {

    public async getCurrentSession(): Promise<AuthSession | null> {

        return null;

    }

    public signIn(_credentials: SignInCredentials): Promise<AuthSession> {

        return Promise.reject(new AuthConfigurationUnavailableError());

    }

    public async signOut(): Promise<void> {}

}
