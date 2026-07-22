import {
    canonicalChecksum,
    normalizeJsonObject
} from "../trusted/CanonicalJson.js";
import type {
    CanonicalInvoiceLine,
    ReserveReturnAllocationResult,
    ReturnAllocationLineAggregate,
    ReturnAllocationCommit,
    ReturnAllocationReservation,
    ReturnAllocationReservationLine,
    ReturnAllocationState,
    ReturnAllocationTransactionInput
} from "./ReturnAllocationTypes.js";

export type ReturnAllocationEvaluation = {
    nextState: ReturnAllocationState | null;
    result: ReserveReturnAllocationResult;
};

export function evaluateReturnAllocationTransaction(
    currentValue: unknown,
    input: ReturnAllocationTransactionInput
): ReturnAllocationEvaluation {
    const invoiceLines = normalizeInvoiceLines(input.invoiceLines);
    if (!invoiceLines) {
        return conflict("ALLOCATION_STATE_CONFLICT");
    }

    const desiredReservation = buildReservation(input);
    if (currentValue === null || currentValue === undefined) {
        const lines = buildInitialAggregates(invoiceLines);
        if (!hasCapacity(lines, desiredReservation)) {
            return rejected("RETURN_ALLOCATION_EXCEEDED");
        }
        const reservations = { [desiredReservation.commandId]: desiredReservation };
        const nextState: ReturnAllocationState = {
            schemaVersion: 1,
            accountId: input.request.accountId,
            invoiceId: input.request.invoiceId,
            revision: 1,
            lines: withRecomputedReserved(lines, reservations),
            reservations,
            commits: {}
        };
        return {
            nextState,
            result: {
                kind: "reserved",
                allocationRevision: nextState.revision,
                reservation: desiredReservation
            }
        };
    }

    const current = parseAndValidateState(currentValue, input, invoiceLines);
    if (!current) {
        return conflict("ALLOCATION_STATE_CONFLICT");
    }

    const existing = current.reservations[desiredReservation.commandId];
    if (existing) {
        if (!sameReservationIdentity(existing, desiredReservation)) {
            return conflict("ALLOCATION_REQUEST_CONFLICT");
        }
        return {
            nextState: null,
            result: {
                kind: "exactMatch",
                allocationRevision: current.revision,
                reservation: existing
            }
        };
    }

    if (!hasCapacity(current.lines, desiredReservation)) {
        return rejected("RETURN_ALLOCATION_EXCEEDED");
    }

    const reservations = {
        ...current.reservations,
        [desiredReservation.commandId]: desiredReservation
    };
    const nextState: ReturnAllocationState = {
        ...current,
        revision: current.revision + 1,
        lines: withRecomputedAggregates(
            current.lines,
            reservations,
            current.commits
        ),
        reservations
    };

    return {
        nextState,
        result: {
            kind: "reserved",
            allocationRevision: nextState.revision,
            reservation: desiredReservation
        }
    };
}

export function parseReturnAllocationState(
    value: unknown
): ReturnAllocationState | null {
    if (!isObject(value)) {
        return null;
    }
    const state = value as Partial<ReturnAllocationState>;
    if (
        state.schemaVersion !== 1
        || !isIdentifier(state.accountId)
        || !isIdentifier(state.invoiceId)
        || !isPositiveInteger(state.revision)
        || !isObject(state.lines)
        || !isObject(state.reservations)
    ) {
        return null;
    }

    const lines: Record<string, ReturnAllocationLineAggregate> = {};
    for (const [lineId, valueLine] of Object.entries(state.lines)) {
        if (!isObject(valueLine)) {
            return null;
        }
        const line = valueLine as Partial<ReturnAllocationLineAggregate>;
        if (
            !isIdentifier(lineId)
            || line.invoiceLineId !== lineId
            || !isPositiveFinite(line.soldQuantity)
            || !isNonNegativeFinite(line.reservedReturnedQuantity)
            || !isNonNegativeFinite(line.committedReturnedQuantity)
            || line.reservedReturnedQuantity + line.committedReturnedQuantity
                > line.soldQuantity
        ) {
            return null;
        }
        lines[lineId] = line as ReturnAllocationLineAggregate;
    }
    if (Object.keys(lines).length === 0) {
        return null;
    }

    const reservations: Record<string, ReturnAllocationReservation> = {};
    for (const [commandId, valueReservation] of Object.entries(state.reservations)) {
        const reservation = parseReservation(valueReservation, commandId);
        if (!reservation) {
            return null;
        }
        reservations[commandId] = reservation;
    }
    if (Object.keys(reservations).length === 0) {
        return null;
    }

    const commits: Record<string, ReturnAllocationCommit> = {};
    if (state.commits !== undefined && !isObject(state.commits)) {
        return null;
    }
    for (const [commandId, valueCommit] of Object.entries(state.commits ?? {})) {
        const commit = parseCommit(valueCommit, commandId);
        if (!commit) {
            return null;
        }
        commits[commandId] = commit;
    }

    return {
        schemaVersion: 1,
        accountId: state.accountId,
        invoiceId: state.invoiceId,
        revision: state.revision,
        lines,
        reservations,
        commits
    };
}

function parseAndValidateState(
    value: unknown,
    input: ReturnAllocationTransactionInput,
    invoiceLines: CanonicalInvoiceLine[]
): ReturnAllocationState | null {
    const state = parseReturnAllocationState(value);
    if (
        !state
        || state.accountId !== input.request.accountId
        || state.invoiceId !== input.request.invoiceId
    ) {
        return null;
    }

    const expectedLineIds = invoiceLines.map(line => line.id).sort();
    const actualLineIds = Object.keys(state.lines).sort();
    if (
        expectedLineIds.length !== actualLineIds.length
        || expectedLineIds.some((lineId, index) => lineId !== actualLineIds[index])
    ) {
        return null;
    }
    for (const invoiceLine of invoiceLines) {
        if (state.lines[invoiceLine.id]?.soldQuantity !== invoiceLine.soldQuantity) {
            return null;
        }
    }
    for (const reservation of Object.values(state.reservations)) {
        if (
            reservation.accountId !== state.accountId
            || reservation.invoiceId !== state.invoiceId
        ) {
            return null;
        }
        for (const allocation of Object.values(reservation.allocations)) {
            if (!state.lines[allocation.invoiceLineId]) {
                return null;
            }
        }
    }

    for (const [commandId, commit] of Object.entries(state.commits)) {
        const reservation = state.reservations[commandId];
        if (
            !reservation
            || commit.accountId !== state.accountId
            || commit.invoiceId !== state.invoiceId
            || commit.returnId !== reservation.returnId
            || commit.requestChecksum !== reservation.requestChecksum
            || commit.reservationChecksum
                !== calculateReturnAllocationReservationChecksum(reservation)
            || !allocationsMatch(commit.allocations, reservation.allocations)
        ) {
            return null;
        }
    }

    const recomputed = withRecomputedAggregates(
        state.lines,
        state.reservations,
        state.commits
    );
    for (const lineId of actualLineIds) {
        if (
            recomputed[lineId]?.reservedReturnedQuantity
            !== state.lines[lineId]?.reservedReturnedQuantity
            || recomputed[lineId]?.committedReturnedQuantity
                !== state.lines[lineId]?.committedReturnedQuantity
        ) {
            return null;
        }
    }
    return state;
}

function buildReservation(
    input: ReturnAllocationTransactionInput
): ReturnAllocationReservation {
    const allocations: Record<string, ReturnAllocationReservationLine> = {};
    for (const line of input.request.lines) {
        allocations[line.returnLineId] = { ...line };
    }

    return {
        schemaVersion: 1,
        accountId: input.request.accountId,
        invoiceId: input.request.invoiceId,
        returnId: input.request.returnId,
        commandId: input.request.commandId,
        commandType: "invoiceReturn.execute",
        requestChecksum: input.request.requestChecksum,
        sourceReturnRevision: input.request.expectedReturnRevision,
        sourceReturnChecksum: input.request.expectedReturnChecksum,
        status: "processing",
        allocations,
        createdAt: input.now,
        updatedAt: input.now
    };
}

function buildInitialAggregates(
    invoiceLines: CanonicalInvoiceLine[]
): Record<string, ReturnAllocationLineAggregate> {
    return Object.fromEntries(invoiceLines.map(line => [line.id, {
        invoiceLineId: line.id,
        soldQuantity: line.soldQuantity,
        reservedReturnedQuantity: 0,
        committedReturnedQuantity: 0
    }]));
}

function hasCapacity(
    lines: Record<string, ReturnAllocationLineAggregate>,
    reservation: ReturnAllocationReservation
): boolean {
    for (const allocation of Object.values(reservation.allocations)) {
        const aggregate = lines[allocation.invoiceLineId];
        if (!aggregate) {
            return false;
        }
        const next = aggregate.reservedReturnedQuantity
            + aggregate.committedReturnedQuantity
            + allocation.quantity;
        if (!Number.isFinite(next) || next > aggregate.soldQuantity) {
            return false;
        }
    }
    return true;
}

function withRecomputedReserved(
    lines: Record<string, ReturnAllocationLineAggregate>,
    reservations: Record<string, ReturnAllocationReservation>
): Record<string, ReturnAllocationLineAggregate> {
    return withRecomputedAggregates(lines, reservations, {});
}

export function withRecomputedAggregates(
    lines: Record<string, ReturnAllocationLineAggregate>,
    reservations: Record<string, ReturnAllocationReservation>,
    commits: Record<string, ReturnAllocationCommit>
): Record<string, ReturnAllocationLineAggregate> {
    const totals: Record<string, number> = Object.fromEntries(
        Object.keys(lines).map(lineId => [lineId, 0])
    );
    for (const commandId of Object.keys(reservations).sort()) {
        if (commits[commandId]) {
            continue;
        }
        const reservation = reservations[commandId]!;
        for (const returnLineId of Object.keys(reservation.allocations).sort()) {
            const allocation = reservation.allocations[returnLineId]!;
            totals[allocation.invoiceLineId] =
                (totals[allocation.invoiceLineId] ?? 0) + allocation.quantity;
        }
    }

    const committedTotals: Record<string, number> = Object.fromEntries(
        Object.keys(lines).map(lineId => [lineId, 0])
    );
    for (const commandId of Object.keys(commits).sort()) {
        const commit = commits[commandId]!;
        for (const returnLineId of Object.keys(commit.allocations).sort()) {
            const allocation = commit.allocations[returnLineId]!;
            committedTotals[allocation.invoiceLineId] =
                (committedTotals[allocation.invoiceLineId] ?? 0)
                + allocation.quantity;
        }
    }

    return Object.fromEntries(Object.keys(lines).sort().map(lineId => [lineId, {
        ...lines[lineId]!,
        reservedReturnedQuantity: totals[lineId] ?? 0,
        committedReturnedQuantity: committedTotals[lineId] ?? 0
    }]));
}

function parseCommit(
    value: unknown,
    commandId: string
): ReturnAllocationCommit | null {
    if (!isObject(value)) {
        return null;
    }
    const commit = value as Partial<ReturnAllocationCommit>;
    if (
        commit.schemaVersion !== 1
        || !isIdentifier(commit.accountId)
        || !isIdentifier(commit.invoiceId)
        || !isIdentifier(commit.returnId)
        || commit.commandId !== commandId
        || commit.commandType !== "invoiceReturn.execute"
        || !isChecksum(commit.requestChecksum)
        || !isChecksum(commit.reservationChecksum)
        || !isIdentifier(commit.publicationId)
        || !isObject(commit.allocations)
        || !isNonNegativeFinite(commit.committedAt)
        || !isChecksum(commit.commitChecksum)
    ) {
        return null;
    }

    const allocations: Record<string, ReturnAllocationReservationLine> = {};
    const invoiceLineIds = new Set<string>();
    for (const [returnLineId, valueAllocation] of Object.entries(
        commit.allocations
    )) {
        if (!isObject(valueAllocation)) {
            return null;
        }
        const allocation = valueAllocation as Partial<ReturnAllocationReservationLine>;
        if (
            allocation.returnLineId !== returnLineId
            || !isIdentifier(returnLineId)
            || !isIdentifier(allocation.invoiceLineId)
            || !isPositiveFinite(allocation.quantity)
            || invoiceLineIds.has(allocation.invoiceLineId)
        ) {
            return null;
        }
        invoiceLineIds.add(allocation.invoiceLineId);
        allocations[returnLineId] = allocation as ReturnAllocationReservationLine;
    }
    if (Object.keys(allocations).length === 0) {
        return null;
    }

    const normalized = { ...(commit as ReturnAllocationCommit), allocations };
    return normalized.commitChecksum === calculateReturnAllocationCommitChecksum(normalized)
        ? normalized
        : null;
}

function parseReservation(
    value: unknown,
    commandId: string
): ReturnAllocationReservation | null {
    if (!isObject(value)) {
        return null;
    }
    const reservation = value as Partial<ReturnAllocationReservation>;
    if (
        reservation.schemaVersion !== 1
        || !isIdentifier(reservation.accountId)
        || !isIdentifier(reservation.invoiceId)
        || !isIdentifier(reservation.returnId)
        || reservation.commandId !== commandId
        || reservation.commandType !== "invoiceReturn.execute"
        || !isChecksum(reservation.requestChecksum)
        || !isRevision(reservation.sourceReturnRevision)
        || !isChecksum(reservation.sourceReturnChecksum)
        || reservation.status !== "processing"
        || !isNonNegativeFinite(reservation.createdAt)
        || !isNonNegativeFinite(reservation.updatedAt)
        || !isObject(reservation.allocations)
    ) {
        return null;
    }

    const allocations: Record<string, ReturnAllocationReservationLine> = {};
    const invoiceLineIds = new Set<string>();
    for (const [returnLineId, valueAllocation] of Object.entries(
        reservation.allocations
    )) {
        if (!isObject(valueAllocation)) {
            return null;
        }
        const allocation = valueAllocation as Partial<ReturnAllocationReservationLine>;
        if (
            allocation.returnLineId !== returnLineId
            || !isIdentifier(returnLineId)
            || !isIdentifier(allocation.invoiceLineId)
            || !isPositiveFinite(allocation.quantity)
            || invoiceLineIds.has(allocation.invoiceLineId)
        ) {
            return null;
        }
        invoiceLineIds.add(allocation.invoiceLineId);
        allocations[returnLineId] = allocation as ReturnAllocationReservationLine;
    }
    if (Object.keys(allocations).length === 0) {
        return null;
    }

    return {
        ...(reservation as ReturnAllocationReservation),
        allocations
    };
}

function sameReservationIdentity(
    left: ReturnAllocationReservation,
    right: ReturnAllocationReservation
): boolean {
    return canonicalChecksum(normalizeJsonObject(immutableReservation(left)))
        === canonicalChecksum(normalizeJsonObject(immutableReservation(right)));
}

function immutableReservation(reservation: ReturnAllocationReservation) {
    return {
        schemaVersion: reservation.schemaVersion,
        accountId: reservation.accountId,
        invoiceId: reservation.invoiceId,
        returnId: reservation.returnId,
        commandId: reservation.commandId,
        commandType: reservation.commandType,
        requestChecksum: reservation.requestChecksum,
        sourceReturnRevision: reservation.sourceReturnRevision,
        sourceReturnChecksum: reservation.sourceReturnChecksum,
        status: reservation.status,
        allocations: reservation.allocations
    };
}

export function calculateReturnAllocationReservationChecksum(
    reservation: ReturnAllocationReservation
): string {
    return canonicalChecksum(normalizeJsonObject(immutableReservation(reservation)));
}

export function calculateReturnAllocationCommitChecksum(
    commit: Omit<ReturnAllocationCommit, "commitChecksum"> | ReturnAllocationCommit
): string {
    return canonicalChecksum(normalizeJsonObject({
        schemaVersion: commit.schemaVersion,
        accountId: commit.accountId,
        invoiceId: commit.invoiceId,
        returnId: commit.returnId,
        commandId: commit.commandId,
        commandType: commit.commandType,
        requestChecksum: commit.requestChecksum,
        reservationChecksum: commit.reservationChecksum,
        publicationId: commit.publicationId,
        allocations: commit.allocations,
        committedAt: commit.committedAt
    }));
}

function allocationsMatch(
    left: Record<string, ReturnAllocationReservationLine>,
    right: Record<string, ReturnAllocationReservationLine>
): boolean {
    return canonicalChecksum(normalizeJsonObject(left))
        === canonicalChecksum(normalizeJsonObject(right));
}

function normalizeInvoiceLines(
    lines: CanonicalInvoiceLine[]
): CanonicalInvoiceLine[] | null {
    const ids = new Set<string>();
    const normalized: CanonicalInvoiceLine[] = [];
    for (const line of lines) {
        if (!isIdentifier(line.id) || !isPositiveFinite(line.soldQuantity) || ids.has(line.id)) {
            return null;
        }
        ids.add(line.id);
        normalized.push({ ...line });
    }
    return normalized.length > 0
        ? normalized.sort((left, right) => left.id.localeCompare(right.id))
        : null;
}

function conflict(
    code: Extract<ReserveReturnAllocationResult, { kind: "conflict" }>["code"]
): ReturnAllocationEvaluation {
    return { nextState: null, result: { kind: "conflict", code } };
}

function rejected(
    code: Extract<ReserveReturnAllocationResult, { kind: "rejected" }>["code"]
): ReturnAllocationEvaluation {
    return { nextState: null, result: { kind: "rejected", code } };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
    return typeof value === "string"
        && value.length > 0
        && !/[.#$\[\]\/]/.test(value);
}

function isChecksum(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRevision(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
