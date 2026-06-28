import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

import type { FirebaseAuthConfig } from "./FirebaseAuthConfig";

let firebaseApp: FirebaseApp | null = null;

let firebaseAuth: Auth | null = null;

export function initializeFirebaseAuth(config: FirebaseAuthConfig): Auth {

    if (!firebaseApp) {

        firebaseApp = initializeApp(config as FirebaseOptions);

    }

    if (!firebaseAuth) {

        firebaseAuth = getAuth(firebaseApp);

    }

    return firebaseAuth;

}

export function getFirebaseAuth(): Auth | null {

    return firebaseAuth;

}

export function getFirebaseApp(): FirebaseApp | null {

    return firebaseApp;

}
