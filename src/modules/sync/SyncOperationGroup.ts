import {
    createPendingSyncOperation,
    type SyncOperation,
    type SyncOperationGroupMembership,
    type SyncOperationInput
} from "./SyncOperation";
import {
    canonicalChecksum,
    toJsonObject,
    type JsonObject
} from "./master-data/CanonicalJson";

export const syncOperationGroupLocalStates = [
    "pending",
    "applied",
    "conflict",
    "failed"
] as const;

export type SyncOperationGroupLocalState =
    typeof syncOperationGroupLocalStates[number];

export interface SyncOperationGroupMemberInput {
    operation: SyncOperationInput;
    groupSequence: number;
    requiredForLocalCompletion: boolean;
}

export interface SyncOperationGroupBatchInput {
    groupId: string;
    groupType: string;
    groupSize?: number;
    members: SyncOperationGroupMemberInput[];
}

export interface SyncOperationGroupInspection {
    valid: boolean;
    groupId: string | null;
    groupType: string | null;
    groupChecksum: string | null;
    members: SyncOperation[];
    localState: SyncOperationGroupLocalState;
    cloudState: SyncOperationGroupCloudState;
    errors: string[];
}

export const syncOperationGroupCloudStates = [
    "blocked_local",
    "pending",
    "partial",
    "acknowledged",
    "conflict",
    "failed"
] as const;

export type SyncOperationGroupCloudState =
    typeof syncOperationGroupCloudStates[number];

export class SyncOperationGroupConflictError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "SyncOperationGroupConflictError";
    }
}

interface NormalizedGroupMemberInput {
    operation: SyncOperation;
    groupSequence: number;
    requiredForLocalCompletion: boolean;
}

export function buildGroupedSyncOperationInputs(
    input: SyncOperationGroupBatchInput
): SyncOperationInput[] {
    const groupId = requireGroupText(input.groupId, "groupId");
    const groupType = requireGroupText(input.groupType, "groupType");

    if (!Array.isArray(input.members) || input.members.length === 0) {
        throw new Error("Sync operation group requires at least one member.");
    }

    if (
        input.groupSize !== undefined
        && (
            !Number.isInteger(input.groupSize)
            || input.groupSize !== input.members.length
        )
    ) {
        throw new Error("Sync operation group size does not match its members.");
    }

    const normalizedMembers = input.members.map(normalizeMemberInput);
    validateNormalizedMembers(normalizedMembers);

    const orderedMembers = normalizedMembers
        .slice()
        .sort((left, right) => left.groupSequence - right.groupSequence);
    const accountId = orderedMembers[0].operation.accountId;
    const groupSize = orderedMembers.length;
    const groupChecksum = calculateGroupChecksum(
        groupId,
        groupType,
        accountId,
        orderedMembers
    );

    return orderedMembers.map(member => ({
        ...toOperationInput(member.operation),
        group: {
            groupId,
            groupType,
            groupSequence: member.groupSequence,
            groupSize,
            requiredForLocalCompletion:
                member.requiredForLocalCompletion,
            groupChecksum
        }
    }));
}

export function inspectSyncOperationGroup(
    operations: SyncOperation[]
): SyncOperationGroupInspection {
    if (operations.length === 0) {
        return invalidInspection("Sync operation group is empty.");
    }

    const ordered = operations
        .slice()
        .sort(compareGroupedMembers);
    const firstGroup = ordered[0].group;

    if (!firstGroup) {
        return invalidInspection(
            "Sync operation group contains an ungrouped member.",
            ordered
        );
    }

    const errors = validateStoredMembers(ordered, firstGroup);

    if (errors.length > 0) {
        return {
            valid: false,
            groupId: firstGroup.groupId,
            groupType: firstGroup.groupType,
            groupChecksum: firstGroup.groupChecksum,
            members: ordered,
            localState: "conflict",
            cloudState: "conflict",
            errors
        };
    }

    return {
        valid: true,
        groupId: firstGroup.groupId,
        groupType: firstGroup.groupType,
        groupChecksum: firstGroup.groupChecksum,
        members: ordered,
        localState: deriveLocalState(ordered),
        cloudState: deriveCloudState(ordered),
        errors: []
    };
}

export function isGroupedSyncOperation(
    operation: SyncOperation
): boolean {
    return operation.group !== undefined;
}

export function isGroupedOperationCloudEligible(
    operation: SyncOperation,
    accountOperations: SyncOperation[]
): boolean {
    if (!operation.group) {
        return operation.localApplyState === "applied"
            && operation.status === "pending";
    }

    const inspection = inspectSyncOperationGroup(
        accountOperations.filter(candidate =>
            candidate.group?.groupId === operation.group?.groupId
        )
    );

    if (
        !inspection.valid
        || inspection.localState !== "applied"
        || operation.localApplyState !== "applied"
        || operation.status !== "pending"
        || inspection.members.some(member =>
            member.status === "conflict" || member.status === "failed"
        )
    ) {
        return false;
    }

    return inspection.members
        .filter(member =>
            (member.group?.groupSequence ?? 0)
            < operation.group!.groupSequence
        )
        .every(member => member.status === "acknowledged");
}

export function compareGroupedMembers(
    left: SyncOperation,
    right: SyncOperation
): number {
    return (left.group?.groupSequence ?? 0)
        - (right.group?.groupSequence ?? 0);
}

export function groupMembershipMatches(
    left: SyncOperationGroupMembership | undefined,
    right: SyncOperationGroupMembership | undefined
): boolean {
    if (!left || !right) {
        return left === right;
    }

    return left.groupId === right.groupId
        && left.groupType === right.groupType
        && left.groupSequence === right.groupSequence
        && left.groupSize === right.groupSize
        && left.requiredForLocalCompletion
            === right.requiredForLocalCompletion
        && left.groupChecksum === right.groupChecksum;
}

function normalizeMemberInput(
    member: SyncOperationGroupMemberInput
): NormalizedGroupMemberInput {
    if (!Number.isInteger(member.groupSequence) || member.groupSequence < 1) {
        throw new Error("Sync group sequence must be a positive integer.");
    }

    if (typeof member.requiredForLocalCompletion !== "boolean") {
        throw new Error("Sync group required-member flag must be boolean.");
    }

    if (member.operation.group) {
        throw new Error(
            "Sync group membership must be assigned by the atomic batch builder."
        );
    }

    const operation = createPendingSyncOperation(member.operation);

    if (!operation.writeSetChecksum) {
        throw new Error("Grouped sync operation requires a write-set checksum.");
    }

    return {
        operation,
        groupSequence: member.groupSequence,
        requiredForLocalCompletion: member.requiredForLocalCompletion
    };
}

function validateNormalizedMembers(
    members: NormalizedGroupMemberInput[]
): void {
    const accountIds = new Set(
        members.map(member => member.operation.accountId)
    );
    const operationIds = new Set(
        members.map(member => member.operation.operationId)
    );
    const idempotencyKeys = new Set(
        members.map(member => member.operation.idempotencyKey)
    );
    const sequences = new Set(
        members.map(member => member.groupSequence)
    );
    const recordIdentities = new Set(
        members.map(member =>
            `${member.operation.module}:${member.operation.recordId}`
        )
    );

    if (accountIds.size !== 1) {
        throw new Error("Sync operation group cannot mix account IDs.");
    }

    if (operationIds.size !== members.length) {
        throw new Error("Sync operation group contains duplicate operation IDs.");
    }

    if (idempotencyKeys.size !== members.length) {
        throw new Error("Sync operation group contains duplicate idempotency keys.");
    }

    if (sequences.size !== members.length) {
        throw new Error("Sync operation group contains duplicate sequences.");
    }

    if (recordIdentities.size !== members.length) {
        throw new Error("Sync operation group contains duplicate record identities.");
    }

    if (!members.some(member => member.requiredForLocalCompletion)) {
        throw new Error("Sync operation group requires one local-completion member.");
    }

    const orderedSequences = Array.from(sequences).sort((a, b) => a - b);

    if (orderedSequences.some((sequence, index) => sequence !== index + 1)) {
        throw new Error("Sync operation group sequences must be contiguous.");
    }
}

function validateStoredMembers(
    members: SyncOperation[],
    firstGroup: SyncOperationGroupMembership
): string[] {
    const errors: string[] = [];

    if (members.length !== firstGroup.groupSize) {
        errors.push("Sync operation group size does not match its members.");
    }

    const accountIds = new Set(members.map(member => member.accountId));
    const operationIds = new Set(members.map(member => member.operationId));
    const idempotencyKeys = new Set(members.map(member => member.idempotencyKey));
    const sequences = new Set(
        members.map(member => member.group?.groupSequence)
    );
    const recordIdentities = new Set(
        members.map(member => `${member.module}:${member.recordId}`)
    );

    if (accountIds.size !== 1) errors.push("Sync operation group mixes accounts.");
    if (operationIds.size !== members.length) errors.push("Sync operation group operation IDs are not unique.");
    if (idempotencyKeys.size !== members.length) errors.push("Sync operation group idempotency keys are not unique.");
    if (sequences.size !== members.length) errors.push("Sync operation group sequences are not unique.");
    if (recordIdentities.size !== members.length) errors.push("Sync operation group record identities are not unique.");

    for (const member of members) {
        const group = member.group;

        if (
            !group
            || group.groupId !== firstGroup.groupId
            || group.groupType !== firstGroup.groupType
            || group.groupSize !== firstGroup.groupSize
            || group.groupChecksum !== firstGroup.groupChecksum
        ) {
            errors.push("Sync operation group membership is inconsistent.");
            break;
        }

        if (!member.writeSetChecksum) {
            errors.push("Sync operation group member checksum is missing.");
            break;
        }
    }

    const orderedSequences = Array.from(sequences)
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);

    if (
        orderedSequences.length !== members.length
        || orderedSequences.some((sequence, index) => sequence !== index + 1)
    ) {
        errors.push("Sync operation group sequences are not contiguous.");
    }

    if (!members.some(member => member.group?.requiredForLocalCompletion)) {
        errors.push("Sync operation group has no required local member.");
    }

    if (errors.length === 0) {
        const normalizedMembers = members.map(member => ({
            operation: member,
            groupSequence: member.group!.groupSequence,
            requiredForLocalCompletion:
                member.group!.requiredForLocalCompletion
        }));
        const checksum = calculateGroupChecksum(
            firstGroup.groupId,
            firstGroup.groupType,
            members[0].accountId,
            normalizedMembers
        );

        if (checksum !== firstGroup.groupChecksum) {
            errors.push("Sync operation group checksum does not match its members.");
        }
    }

    return Array.from(new Set(errors));
}

function calculateGroupChecksum(
    groupId: string,
    groupType: string,
    accountId: string,
    members: NormalizedGroupMemberInput[]
): string {
    const descriptor: JsonObject = {
        schemaVersion: 1,
        groupId,
        groupType,
        accountId,
        groupSize: members.length,
        members: members
            .slice()
            .sort((left, right) =>
                left.groupSequence - right.groupSequence
            )
            .map(member => ({
                operationId: member.operation.operationId,
                idempotencyKey: member.operation.idempotencyKey,
                module: member.operation.module,
                recordId: member.operation.recordId,
                operationType: member.operation.operationType,
                expectedRevision: member.operation.expectedRevision ?? null,
                writeSetChecksum: member.operation.writeSetChecksum ?? null,
                payloadFingerprint: operationPayloadFingerprint(
                    member.operation
                ),
                groupSequence: member.groupSequence,
                requiredForLocalCompletion:
                    member.requiredForLocalCompletion
            }))
    };

    return canonicalChecksum(descriptor);
}

function deriveLocalState(
    members: SyncOperation[]
): SyncOperationGroupLocalState {
    if (members.some(member => member.localApplyState === "conflict")) {
        return "conflict";
    }

    if (members.some(member => member.localApplyState === "failed")) {
        return "failed";
    }

    const requiredMembers = members.filter(
        member => member.group?.requiredForLocalCompletion
    );

    return requiredMembers.every(
        member => member.localApplyState === "applied"
    )
        ? "applied"
        : "pending";
}

function deriveCloudState(
    members: SyncOperation[]
): SyncOperationGroupCloudState {
    if (members.some(member => member.status === "conflict")) {
        return "conflict";
    }

    if (members.some(member => member.status === "failed")) {
        return "failed";
    }

    if (deriveLocalState(members) !== "applied") {
        return "blocked_local";
    }

    if (members.every(member => member.status === "acknowledged")) {
        return "acknowledged";
    }

    if (members.some(member => member.status === "acknowledged")) {
        return "partial";
    }

    return "pending";
}

function operationPayloadFingerprint(operation: SyncOperation): string {
    return canonicalChecksum(toJsonObject({
        safePayload: operation.safePayload ?? null,
        payloadReference: operation.payloadReference ?? null
    }));
}

function toOperationInput(operation: SyncOperation): SyncOperationInput {
    return {
        operationId: operation.operationId,
        accountId: operation.accountId,
        module: operation.module,
        recordId: operation.recordId,
        operationType: operation.operationType,
        ...(operation.expectedRevision !== undefined
            ? { expectedRevision: operation.expectedRevision }
            : {}),
        idempotencyKey: operation.idempotencyKey,
        ...(operation.writeSetChecksum
            ? { writeSetChecksum: operation.writeSetChecksum }
            : {}),
        ...(operation.safePayload !== undefined
            ? { safePayload: operation.safePayload }
            : {}),
        ...(operation.payloadReference
            ? { payloadReference: operation.payloadReference }
            : {}),
        createdAt: operation.createdAt
    };
}

function invalidInspection(
    error: string,
    members: SyncOperation[] = []
): SyncOperationGroupInspection {
    return {
        valid: false,
        groupId: members[0]?.group?.groupId ?? null,
        groupType: members[0]?.group?.groupType ?? null,
        groupChecksum: members[0]?.group?.groupChecksum ?? null,
        members,
        localState: "conflict",
        cloudState: "conflict",
        errors: [error]
    };
}

function requireGroupText(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
        throw new Error(`Sync operation group ${field} is required.`);
    }

    if (/[.#$\[\]\/]/.test(normalized)) {
        throw new Error(`Sync operation group ${field} is not key-safe.`);
    }

    return normalized;
}
