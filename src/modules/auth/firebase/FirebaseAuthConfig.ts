export interface FirebaseAuthEnvironment {

    VITE_FIREBASE_API_KEY?: string;

    VITE_FIREBASE_AUTH_DOMAIN?: string;

    VITE_FIREBASE_PROJECT_ID?: string;

    VITE_FIREBASE_APP_ID?: string;

    VITE_FIREBASE_MESSAGING_SENDER_ID?: string;

    VITE_FIREBASE_STORAGE_BUCKET?: string;

}

export interface FirebaseAuthConfig {

    apiKey: string;

    authDomain: string;

    projectId: string;

    appId: string;

    messagingSenderId?: string;

    storageBucket?: string;

}

const requiredEnvironmentKeys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
] as const;

function normalize(value: string | undefined): string | undefined {

    const normalized = value?.trim();

    return normalized ? normalized : undefined;

}

export function hasFirebaseAuthConfig(
    environment: FirebaseAuthEnvironment = import.meta.env as unknown as FirebaseAuthEnvironment
): boolean {

    return requiredEnvironmentKeys.every(key => Boolean(normalize(environment[key])));

}

export function readFirebaseAuthConfig(
    environment: FirebaseAuthEnvironment = import.meta.env as unknown as FirebaseAuthEnvironment
): FirebaseAuthConfig {

    const missingKeys = requiredEnvironmentKeys.filter(key => !normalize(environment[key]));

    if (missingKeys.length > 0) {

        throw new Error(`Firebase Auth configuration is missing: ${missingKeys.join(", ")}`);

    }

    const messagingSenderId = normalize(environment.VITE_FIREBASE_MESSAGING_SENDER_ID);
    const storageBucket = normalize(environment.VITE_FIREBASE_STORAGE_BUCKET);

    return {
        apiKey: normalize(environment.VITE_FIREBASE_API_KEY) as string,
        authDomain: normalize(environment.VITE_FIREBASE_AUTH_DOMAIN) as string,
        projectId: normalize(environment.VITE_FIREBASE_PROJECT_ID) as string,
        appId: normalize(environment.VITE_FIREBASE_APP_ID) as string,
        ...(messagingSenderId ? { messagingSenderId } : {}),
        ...(storageBucket ? { storageBucket } : {}),
    };

}
