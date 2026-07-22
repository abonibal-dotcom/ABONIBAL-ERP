import type {
    CommitReturnAllocationResult,
    ReturnAllocationCommit,
    ReturnAllocationCommitTransactionInput,
    ReturnAllocationState
} from "./ReturnAllocationTypes.js";
import {
    calculateReturnAllocationCommitChecksum,
    calculateReturnAllocationReservationChecksum,
    parseReturnAllocationState,
    withRecomputedAggregates
} from "./ReturnAllocationTransaction.js";

export type ReturnAllocationCommitEvaluation = {
    nextState: ReturnAllocationState | null;
    result: CommitReturnAllocationResult;
};

export function evaluateReturnAllocationCommitTransaction(
    currentValue: unknown,
    input: ReturnAllocationCommitTransactionInput
): ReturnAllocationCommitEvaluation {
    const request = input.request;
    if (!isRequestValid(request, input.now)) {
        return rejected("INVALID_COMMIT_REQUEST");
    }

    const state = parseReturnAllocationState(currentValue);
    if (
        !state
        || state.accountId !== request.accountId
        || state.invoiceId !== request.invoiceId
        || !hasConsistentAggregates(state)
    ) {
        return conflict("ALLOCATION_STATE_CONFLICT");
    }

    const reservation = state.reservations[request.commandId];
    if (!reservation) {
        return rejected("MISSING_RESERVATION");
    }
    if (
        reservation.accountId !== request.accountId
        || reservation.invoiceId !== request.invoiceId
        || reservation.returnId !== request.returnId
        || reservation.commandType !== request.commandType
        || reservation.requestChecksum !== request.requestChecksum
    ) {
        return conflict("ALLOCATION_COMMIT_CONFLICT");
    }

    const reservationChecksum =
        calculateReturnAllocationReservationChecksum(reservation);
    if (reservationChecksum !== request.reservationChecksum) {
        return conflict("RESERVATION_CHECKSUM_CONFLICT");
    }

    const desiredWithoutChecksum = {
        schemaVersion: 1 as const,
        accountId: request.accountId,
        invoiceId: request.invoiceId,
        returnId: request.returnId,
        commandId: request.commandId,
        commandType: request.commandType,
        requestChecksum: request.requestChecksum,
        reservationChecksum,
        publicationId: request.publicationId,
        allocations: reservation.allocations,
        committedAt: input.now
    };
    const desired: ReturnAllocationCommit = {
        ...desiredWithoutChecksum,
        commitChecksum:
            calculateReturnAllocationCommitChecksum(desiredWithoutChecksum)
    };

    const existing = state.commits[request.commandId];
    if (existing) {
        if (
            existing.accountId === desired.accountId
            && existing.invoiceId === desired.invoiceId
            && existing.returnId === desired.returnId
            && existing.commandId === desired.commandId
            && existing.requestChecksum === desired.requestChecksum
            && existing.reservationChecksum === desired.reservationChecksum
            && existing.publicationId === desired.publicationId
        ) {
            return {
                nextState: null,
                result: {
                    kind: "exactMatch",
                    allocationRevision: state.revision,
                    commit: existing
                }
            };
        }
        return conflict("ALLOCATION_COMMIT_CONFLICT");
    }

    const commits = { ...state.commits, [request.commandId]: desired };
    const lines = withRecomputedAggregates(
        state.lines,
        state.reservations,
        commits
    );
    if (Object.values(lines).some(line =>
        line.reservedReturnedQuantity + line.committedReturnedQuantity
        > line.soldQuantity
    )) {
        return conflict("ALLOCATION_STATE_CONFLICT");
    }

    const nextState: ReturnAllocationState = {
        ...state,
        revision: state.revision + 1,
        lines,
        commits
    };
    return {
        nextState,
        result: {
            kind: "committed",
            allocationRevision: nextState.revision,
            commit: desired
        }
    };
}

function hasConsistentAggregates(state: ReturnAllocationState): boolean {
    const recomputed = withRecomputedAggregates(
        state.lines,
        state.reservations,
        state.commits
    );
    return Object.keys(state.lines).every(lineId =>
        recomputed[lineId]?.reservedReturnedQuantity
            === state.lines[lineId]?.reservedReturnedQuantity
        && recomputed[lineId]?.committedReturnedQuantity
            === state.lines[lineId]?.committedReturnedQuantity
    );
}

function isRequestValid(
    request: ReturnAllocationCommitTransactionInput["request"],
    now: number
): boolean {
    return request.schemaVersion === 1
        && request.commandType === "invoiceReturn.execute"
        && isKey(request.accountId)
        && isKey(request.invoiceId)
        && isKey(request.returnId)
        && isKey(request.commandId)
        && isKey(request.publicationId)
        && isChecksum(request.requestChecksum)
        && isChecksum(request.reservationChecksum)
        && Number.isFinite(now)
        && now >= 0;
}

function isKey(value: unknown): value is string {
    return typeof value === "string"
        && value.length > 0
        && !/[.#$\[\]\/]/.test(value);
}

function isChecksum(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function rejected(
    code: Extract<CommitReturnAllocationResult, { kind: "rejected" }>["code"]
): ReturnAllocationCommitEvaluation {
    return { nextState: null, result: { kind: "rejected", code } };
}

function conflict(
    code: Extract<CommitReturnAllocationResult, { kind: "conflict" }>["code"]
): ReturnAllocationCommitEvaluation {
    return { nextState: null, result: { kind: "conflict", code } };
}
