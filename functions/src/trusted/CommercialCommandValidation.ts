import {
    canonicalChecksum,
    canonicalJson,
    normalizeJsonObject,
    type JsonObject
} from "./CanonicalJson.js";
import { CommercialCommandError } from "./CommercialCommandErrors.js";
import {
    COMMERCIAL_COMMAND_SCHEMA_VERSION,
    type CommercialCommandRequest,
    type ReceiptLookupRequest
} from "./CommercialCommandTypes.js";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?$/;
const COMMAND_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const MAX_PAYLOAD_BYTES = 64 * 1024;

export function validateCommercialCommandRequest(
    value: unknown
): CommercialCommandRequest {
    const input = requirePlainObject(value, "command request");
    assertExactKeys(input, [
        "schemaVersion",
        "accountId",
        "commandId",
        "commandType",
        "targetId",
        "payload",
        "clientRequestChecksum"
    ]);

    if (input.schemaVersion !== COMMERCIAL_COMMAND_SCHEMA_VERSION) {
        invalid("Unsupported command schema version.");
    }

    const accountId = validateIdentifier(input.accountId, "accountId");
    const commandId = validateIdentifier(input.commandId, "commandId");
    const targetId = validateIdentifier(input.targetId, "targetId");
    const commandType = requireString(input.commandType, "commandType");

    if (!COMMAND_TYPE_PATTERN.test(commandType)) {
        invalid("commandType is malformed.");
    }

    let payload: JsonObject;
    try {
        payload = normalizeJsonObject(input.payload);
    } catch {
        invalid("payload must be a valid JSON object.");
    }

    if (Buffer.byteLength(canonicalJson(payload), "utf8") > MAX_PAYLOAD_BYTES) {
        invalid("payload exceeds the supported size.");
    }

    let clientRequestChecksum: string | undefined;
    if (input.clientRequestChecksum !== undefined) {
        clientRequestChecksum = requireString(
            input.clientRequestChecksum,
            "clientRequestChecksum"
        );
        if (!CHECKSUM_PATTERN.test(clientRequestChecksum)) {
            invalid("clientRequestChecksum is malformed.");
        }
    }

    return {
        schemaVersion: COMMERCIAL_COMMAND_SCHEMA_VERSION,
        accountId,
        commandId,
        commandType,
        targetId,
        payload,
        ...(clientRequestChecksum ? { clientRequestChecksum } : {})
    };
}

export function validateReceiptLookupRequest(value: unknown): ReceiptLookupRequest {
    const input = requirePlainObject(value, "receipt lookup");
    assertExactKeys(input, ["accountId", "commandId"]);

    return {
        accountId: validateIdentifier(input.accountId, "accountId"),
        commandId: validateIdentifier(input.commandId, "commandId")
    };
}

export function calculateCommandRequestChecksum(
    request: CommercialCommandRequest
): string {
    return canonicalChecksum({
        schemaVersion: request.schemaVersion,
        accountId: request.accountId,
        commandId: request.commandId,
        commandType: request.commandType,
        targetId: request.targetId,
        payload: request.payload
    });
}

export function assertClientChecksumMatches(
    request: CommercialCommandRequest,
    serverChecksum: string
): void {
    if (
        request.clientRequestChecksum !== undefined
        && request.clientRequestChecksum !== serverChecksum
    ) {
        throw new CommercialCommandError(
            "CHECKSUM_MISMATCH",
            "Client request checksum does not match the canonical server checksum."
        );
    }
}

export function validateIdentifier(value: unknown, fieldName: string): string {
    const identifier = requireString(value, fieldName);

    if (!IDENTIFIER_PATTERN.test(identifier)) {
        invalid(`${fieldName} is malformed.`);
    }

    return identifier;
}

function requirePlainObject(
    value: unknown,
    fieldName: string
): Record<string, unknown> {
    if (
        value === null
        || typeof value !== "object"
        || Array.isArray(value)
        || Object.getPrototypeOf(value) !== Object.prototype
    ) {
        invalid(`${fieldName} must be an object.`);
    }

    return value as Record<string, unknown>;
}

function assertExactKeys(
    value: Record<string, unknown>,
    allowedKeys: readonly string[]
): void {
    const allowed = new Set(allowedKeys);
    const unknownKey = Object.keys(value).find(key => !allowed.has(key));

    if (unknownKey) {
        invalid(`Unknown field: ${unknownKey}.`);
    }
}

function requireString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.length === 0) {
        invalid(`${fieldName} must be a non-empty string.`);
    }

    return value;
}

function invalid(message: string): never {
    throw new CommercialCommandError("INVALID_REQUEST", message);
}
