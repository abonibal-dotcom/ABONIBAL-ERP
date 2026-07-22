import {
    get,
    onValue,
    ref,
    runTransaction,
    serverTimestamp,
    update,
    type Database
} from "firebase/database";

export type FirebaseDatabaseProvider = () => Database | null;

export type RealtimeUnsubscribe = () => void;

export interface CreateIfAbsentResult<T> {
    created: boolean;
    value: T | null;
}

export interface CompareAndSetResult<T> {
    updated: boolean;
    conflict: boolean;
    actualRevision?: number;
    actualChecksum?: string;
    value: T | null;
}

export interface RevisionedRealtimeRecord {
    revision: number;
}

export interface MetaRevisionedRealtimeRecord {
    meta: {
        revision: number;
        recordChecksum: string;
    };
}

export class FirebaseRealtimeClientError extends Error {
    public readonly code: string;

    public constructor(code: string, messageSafe: string) {
        super(messageSafe);
        this.name = "FirebaseRealtimeClientError";
        this.code = code;
    }
}

export class FirebaseRealtimeClient {
    private readonly databaseProvider: FirebaseDatabaseProvider;

    public constructor(databaseProvider: FirebaseDatabaseProvider) {
        this.databaseProvider = databaseProvider;
    }

    public async read<T>(path: string): Promise<T | null> {
        try {
            const snapshot = await get(ref(
                this.requireDatabase(),
                normalizePath(path)
            ));

            return snapshot.exists() ? snapshot.val() as T : null;
        } catch (error) {
            throw normalizeFirebaseError(error);
        }
    }

    public async readCollection<T>(
        path: string
    ): Promise<Record<string, T>> {
        const value = await this.read<unknown>(path);

        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }

        return value as Record<string, T>;
    }

    public async createIfAbsent<T>(
        path: string,
        value: T
    ): Promise<CreateIfAbsentResult<T>> {
        try {
            const result = await runTransaction(
                ref(this.requireDatabase(), normalizePath(path)),
                current => current === null ? value : undefined,
                { applyLocally: false }
            );

            return {
                created: result.committed,
                value: result.snapshot.exists()
                    ? result.snapshot.val() as T
                    : null
            };
        } catch (error) {
            throw normalizeFirebaseError(error);
        }
    }

    public async updateChildren(
        path: string,
        values: Record<string, unknown>
    ): Promise<void> {
        if (
            !values
            || typeof values !== "object"
            || Array.isArray(values)
            || Object.keys(values).length === 0
        ) {
            throw new FirebaseRealtimeClientError(
                "invalid_realtime_update",
                "Firebase Realtime Database update requires child values."
            );
        }

        try {
            await update(
                ref(this.requireDatabase(), normalizePath(path)),
                values
            );
        } catch (error) {
            throw normalizeFirebaseError(error);
        }
    }

    public serverTimestampValue(): object {
        return serverTimestamp();
    }

    public async compareAndSet<T extends RevisionedRealtimeRecord>(
        path: string,
        expectedRevision: number,
        nextValue: T
    ): Promise<CompareAndSetResult<T>> {
        validateRevision(expectedRevision, "expectedRevision");
        validateRevision(nextValue.revision, "nextValue.revision");

        if (nextValue.revision !== expectedRevision + 1) {
            throw new FirebaseRealtimeClientError(
                "invalid_revision_transition",
                "Compare-and-set requires the next sequential revision."
            );
        }

        try {
            const result = await runTransaction(
                ref(this.requireDatabase(), normalizePath(path)),
                current => {
                    const actualRevision = readRevision(current);

                    return actualRevision === expectedRevision
                        ? nextValue
                        : undefined;
                },
                { applyLocally: false }
            );
            const actualValue = result.snapshot.exists()
                ? result.snapshot.val() as T
                : null;

            return {
                updated: result.committed,
                conflict: !result.committed,
                ...(actualValue
                    ? { actualRevision: actualValue.revision }
                    : {}),
                value: actualValue
            };
        } catch (error) {
            throw normalizeFirebaseError(error);
        }
    }

    public async compareAndSetMetaRevision<
        T extends MetaRevisionedRealtimeRecord
    >(
        path: string,
        expectedRevision: number,
        expectedChecksum: string,
        nextValue: T
    ): Promise<CompareAndSetResult<T>> {
        validateRevision(expectedRevision, "expectedRevision");
        validateRevision(nextValue.meta.revision, "nextValue.meta.revision");
        const normalizedExpectedChecksum = expectedChecksum.trim();

        if (!normalizedExpectedChecksum) {
            throw new FirebaseRealtimeClientError(
                "expected_checksum_required",
                "Compare-and-set requires the expected record checksum."
            );
        }

        if (nextValue.meta.revision !== expectedRevision + 1) {
            throw new FirebaseRealtimeClientError(
                "invalid_revision_transition",
                "Compare-and-set requires the next sequential revision."
            );
        }

        try {
            const result = await runTransaction(
                ref(this.requireDatabase(), normalizePath(path)),
                current => {
                    const currentMeta = readMetaRevision(current);

                    return currentMeta?.revision === expectedRevision
                        && currentMeta.recordChecksum === normalizedExpectedChecksum
                        ? nextValue
                        : undefined;
                },
                { applyLocally: false }
            );
            const actualValue = result.snapshot.exists()
                ? result.snapshot.val() as T
                : null;
            const actualMeta = readMetaRevision(actualValue);

            return {
                updated: result.committed,
                conflict: !result.committed,
                ...(actualMeta
                    ? {
                        actualRevision: actualMeta.revision,
                        actualChecksum: actualMeta.recordChecksum
                    }
                    : {}),
                value: actualValue
            };
        } catch (error) {
            throw normalizeFirebaseError(error);
        }
    }

    public subscribe<T>(
        path: string,
        callback: (value: T | null) => void,
        onError?: (error: FirebaseRealtimeClientError) => void
    ): RealtimeUnsubscribe {
        const reference = ref(this.requireDatabase(), normalizePath(path));

        return onValue(
            reference,
            snapshot => {
                callback(snapshot.exists() ? snapshot.val() as T : null);
            },
            error => {
                onError?.(normalizeFirebaseError(error));
            }
        );
    }

    public subscribeConnectivity(
        callback: (connected: boolean) => void,
        onError?: (error: FirebaseRealtimeClientError) => void
    ): RealtimeUnsubscribe {
        return onValue(
            ref(this.requireDatabase(), ".info/connected"),
            snapshot => {
                callback(snapshot.val() === true);
            },
            error => {
                onError?.(normalizeFirebaseError(error));
            }
        );
    }

    private requireDatabase(): Database {
        const database = this.databaseProvider();

        if (!database) {
            throw new FirebaseRealtimeClientError(
                "firebase_realtime_unavailable",
                "Firebase Realtime Database is unavailable."
            );
        }

        return database;
    }
}

function normalizePath(path: string): string {
    const normalized = path.trim().replace(/^\/+|\/+$/g, "");

    if (!normalized) {
        throw new FirebaseRealtimeClientError(
            "invalid_realtime_path",
            "Firebase Realtime Database path is required."
        );
    }

    if (/[.#$\[\]]/.test(normalized)) {
        throw new FirebaseRealtimeClientError(
            "invalid_realtime_path",
            "Firebase Realtime Database path contains invalid characters."
        );
    }

    return normalized;
}

function validateRevision(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new FirebaseRealtimeClientError(
            "invalid_revision",
            `${field} must be a non-negative integer.`
        );
    }
}

function readRevision(value: unknown): number | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const revision = (value as Partial<RevisionedRealtimeRecord>).revision;

    return typeof revision === "number" && Number.isInteger(revision)
        ? revision
        : undefined;
}

function readMetaRevision(value: unknown): {
    revision: number;
    recordChecksum: string;
} | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const meta = (value as Partial<MetaRevisionedRealtimeRecord>).meta;

    if (
        !meta
        || !Number.isInteger(meta.revision)
        || meta.revision < 0
        || typeof meta.recordChecksum !== "string"
        || !meta.recordChecksum.trim()
    ) {
        return undefined;
    }

    return {
        revision: meta.revision,
        recordChecksum: meta.recordChecksum.trim()
    };
}

function normalizeFirebaseError(error: unknown): FirebaseRealtimeClientError {
    if (error instanceof FirebaseRealtimeClientError) {
        return error;
    }

    const code = readSafeErrorCode(error);

    if (code.includes("permission")) {
        return new FirebaseRealtimeClientError(
            "permission_denied",
            "Firebase Realtime Database permission was denied."
        );
    }

    if (
        code.includes("network")
        || code.includes("disconnected")
        || code.includes("unavailable")
    ) {
        return new FirebaseRealtimeClientError(
            "network_unavailable",
            "Firebase Realtime Database is temporarily unavailable."
        );
    }

    return new FirebaseRealtimeClientError(
        code || "firebase_realtime_error",
        "Firebase Realtime Database operation failed."
    );
}

function readSafeErrorCode(error: unknown): string {
    if (!error || typeof error !== "object") {
        return "";
    }

    const code = (error as { code?: unknown }).code;

    return typeof code === "string"
        ? code.trim().toLowerCase()
        : "";
}
