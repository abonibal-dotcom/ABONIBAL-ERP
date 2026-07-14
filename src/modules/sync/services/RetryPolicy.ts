import type { SyncOperation } from "../SyncOperation";

export const retryClassifications = [
    "retryable",
    "non_retryable",
    "conflict",
    "blocked"
] as const;

export type RetryClassification = typeof retryClassifications[number];

export interface RetryPolicyOptions {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterRatio: number;
}

export interface RetryDecision {
    classification: RetryClassification;
    shouldRetry: boolean;
    nextAttemptAt?: string;
}

const defaultOptions: RetryPolicyOptions = {
    maxAttempts: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 60_000,
    jitterRatio: 0.2
};

export class RetryPolicy {
    private readonly options: RetryPolicyOptions;

    private readonly random: () => number;

    public constructor(
        options: RetryPolicyOptions = defaultOptions,
        random: () => number = Math.random
    ) {
        validateOptions(options);
        this.options = { ...options };
        this.random = random;
    }

    public getOptions(): RetryPolicyOptions {
        return { ...this.options };
    }

    public classify(errorCode: string): RetryClassification {
        const normalized = errorCode.trim().toLowerCase();

        if (normalized.includes("revision_conflict")) {
            return "conflict";
        }

        if (
            normalized.includes("permission_denied")
            || normalized.includes("permission-denied")
            || normalized.includes("auth")
            || normalized.includes("membership")
        ) {
            return "blocked";
        }

        if (
            normalized.includes("network")
            || normalized.includes("disconnected")
            || normalized.includes("unavailable")
            || normalized.includes("timeout")
        ) {
            return "retryable";
        }

        return "non_retryable";
    }

    public decide(
        operation: SyncOperation,
        errorCode: string,
        now: string
    ): RetryDecision {
        const classification = this.classify(errorCode);

        if (
            classification !== "retryable"
            || operation.attemptCount >= this.options.maxAttempts
        ) {
            return {
                classification,
                shouldRetry: false
            };
        }

        const nowMs = Date.parse(now);

        if (!Number.isFinite(nowMs)) {
            throw new Error("Retry decision requires a valid current timestamp.");
        }

        const delayMs = this.calculateDelayMs(operation.attemptCount);

        return {
            classification,
            shouldRetry: true,
            nextAttemptAt: new Date(nowMs + delayMs).toISOString()
        };
    }

    public calculateDelayMs(attemptCount: number): number {
        const exponent = Math.max(0, attemptCount - 1);
        const baseDelay = Math.min(
            this.options.maxDelayMs,
            this.options.baseDelayMs * (2 ** exponent)
        );
        const jitterRange = baseDelay * this.options.jitterRatio;
        const jitter = ((this.random() * 2) - 1) * jitterRange;

        return Math.max(0, Math.round(baseDelay + jitter));
    }
}

function validateOptions(options: RetryPolicyOptions): void {
    if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
        throw new Error("Retry maxAttempts must be a positive integer.");
    }

    if (!Number.isFinite(options.baseDelayMs) || options.baseDelayMs < 1) {
        throw new Error("Retry baseDelayMs must be positive.");
    }

    if (
        !Number.isFinite(options.maxDelayMs)
        || options.maxDelayMs < options.baseDelayMs
    ) {
        throw new Error("Retry maxDelayMs must be at least baseDelayMs.");
    }

    if (
        !Number.isFinite(options.jitterRatio)
        || options.jitterRatio < 0
        || options.jitterRatio > 1
    ) {
        throw new Error("Retry jitterRatio must be between 0 and 1.");
    }
}
