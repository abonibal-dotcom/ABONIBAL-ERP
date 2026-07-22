import { describe, expect, it } from "vitest";
import {
    calculateReturnAllocationReservationChecksum
} from "../../src/allocation/ReturnAllocationTransaction.js";
import type {
    ReserveReturnAllocationRequest
} from "../../src/allocation/ReturnAllocationTypes.js";
import { InMemoryReturnAllocationRepository } from "../helpers/InMemoryReturnAllocationRepository.js";

const ACCOUNT_ID = "commit-account";
const INVOICE_ID = "invoice-commit";
const RETURN_ID = "return-commit";
const COMMAND_ID = `invoice-return-execute-${RETURN_ID}`;

function reserveRequest(): ReserveReturnAllocationRequest {
    return {
        schemaVersion: 1,
        accountId: ACCOUNT_ID,
        commandId: COMMAND_ID,
        commandType: "invoiceReturn.execute",
        returnId: RETURN_ID,
        invoiceId: INVOICE_ID,
        expectedReturnRevision: 0,
        expectedReturnChecksum: "a".repeat(64),
        requestChecksum: "b".repeat(64),
        lines: [{
            returnLineId: "return-line-1",
            invoiceLineId: "invoice-line-1",
            quantity: 4
        }]
    };
}

async function fixture() {
    const repository = new InMemoryReturnAllocationRepository();
    const request = reserveRequest();
    const reserved = await repository.reserve({
        request,
        invoiceLines: [{ id: "invoice-line-1", soldQuantity: 10 }],
        now: 1_000
    });
    if (reserved.kind !== "reserved") {
        throw new Error("Fixture reservation failed.");
    }
    return { repository, request, reservation: reserved.reservation };
}

describe("return allocation commit transaction", () => {
    it("moves an immutable reservation from reserved to committed", async () => {
        const { repository, request, reservation } = await fixture();
        const result = await repository.commit({
            request: {
                schemaVersion: 1,
                accountId: ACCOUNT_ID,
                invoiceId: INVOICE_ID,
                returnId: RETURN_ID,
                commandId: COMMAND_ID,
                commandType: "invoiceReturn.execute",
                requestChecksum: request.requestChecksum,
                reservationChecksum:
                    calculateReturnAllocationReservationChecksum(reservation),
                publicationId: COMMAND_ID
            },
            now: 2_000
        });
        const state = await repository.find(ACCOUNT_ID, INVOICE_ID);

        expect(result.kind).toBe("committed");
        expect(state?.lines["invoice-line-1"]).toMatchObject({
            soldQuantity: 10,
            reservedReturnedQuantity: 0,
            committedReturnedQuantity: 4
        });
        expect(state?.reservations[COMMAND_ID]).toBeDefined();
        expect(state?.commits[COMMAND_ID]).toBeDefined();
    });

    it("is idempotent for an exact retry and conflicts on a changed publication", async () => {
        const { repository, request, reservation } = await fixture();
        const base = {
            schemaVersion: 1 as const,
            accountId: ACCOUNT_ID,
            invoiceId: INVOICE_ID,
            returnId: RETURN_ID,
            commandId: COMMAND_ID,
            commandType: "invoiceReturn.execute" as const,
            requestChecksum: request.requestChecksum,
            reservationChecksum:
                calculateReturnAllocationReservationChecksum(reservation),
            publicationId: COMMAND_ID
        };
        await repository.commit({ request: base, now: 2_000 });
        await expect(repository.commit({ request: base, now: 3_000 }))
            .resolves.toMatchObject({ kind: "exactMatch" });
        await expect(repository.commit({
            request: { ...base, publicationId: "different-publication" },
            now: 3_000
        })).resolves.toEqual({
            kind: "conflict",
            code: "ALLOCATION_COMMIT_CONFLICT"
        });
        expect((await repository.find(ACCOUNT_ID, INVOICE_ID))?.revision).toBe(2);
    });

    it("rejects a checksum mismatch without moving aggregates", async () => {
        const { repository, request } = await fixture();
        await expect(repository.commit({
            request: {
                schemaVersion: 1,
                accountId: ACCOUNT_ID,
                invoiceId: INVOICE_ID,
                returnId: RETURN_ID,
                commandId: COMMAND_ID,
                commandType: "invoiceReturn.execute",
                requestChecksum: request.requestChecksum,
                reservationChecksum: "c".repeat(64),
                publicationId: COMMAND_ID
            },
            now: 2_000
        })).resolves.toEqual({
            kind: "conflict",
            code: "RESERVATION_CHECKSUM_CONFLICT"
        });
        expect((await repository.find(ACCOUNT_ID, INVOICE_ID))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(4);
    });
});
