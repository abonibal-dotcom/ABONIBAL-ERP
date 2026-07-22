import { createHash } from "node:crypto";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
    | JsonPrimitive
    | JsonValue[]
    | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export function normalizeJsonObject(value: unknown): JsonObject {
    const normalized = normalizeJsonValue(value, 0);

    if (!isJsonObject(normalized)) {
        throw new Error("Value must be a JSON object.");
    }

    return normalized;
}

export function canonicalJson(value: JsonValue): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(item => canonicalJson(item)).join(",")}]`;
    }

    const entries = Object.keys(value)
        .sort()
        .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`);

    return `{${entries.join(",")}}`;
}

export function canonicalChecksum(value: JsonValue): string {
    return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function normalizeJsonValue(value: unknown, depth: number): JsonValue {
    if (depth > 32) {
        throw new Error("JSON nesting exceeds the supported depth.");
    }

    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error("JSON numbers must be finite.");
        }

        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => {
            if (item === undefined) {
                throw new Error("JSON arrays cannot contain undefined.");
            }

            return normalizeJsonValue(item, depth + 1);
        });
    }

    if (value && typeof value === "object") {
        const normalized: JsonObject = {};

        for (const [key, item] of Object.entries(value)) {
            if (item === undefined) {
                throw new Error("JSON objects cannot contain undefined.");
            }

            normalized[key] = normalizeJsonValue(item, depth + 1);
        }

        return normalized;
    }

    throw new Error("Value is not JSON-compatible.");
}

function isJsonObject(value: JsonValue): value is JsonObject {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
