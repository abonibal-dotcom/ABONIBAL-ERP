import { describe, expect, it } from "vitest";
import { CanonicalReturnAllocationService } from "../../src/allocation/CanonicalReturnAllocationService.js";
import type { ReturnAllocationRepository } from "../../src/allocation/ReturnAllocationRepository.js";
import type {
    CanonicalInvoice,
    CanonicalInvoiceReturn,
    ReserveReturnAllocationRequest,
    ReturnAllocationState,
    ReturnAllocationTransactionInput
} from "../../src/allocation/ReturnAllocationTypes.js";
import {
    calculateReturnAllocationRequestChecksum
} from "../../src/allocation/ReturnAllocationValidation.js";
import { InMemoryCanonicalCommercialRecordReader } from "../helpers/InMemoryCanonicalCommercialRecordReader.js";
import { InMemoryReturnAllocationRepository } from "../helpers/InMemoryReturnAllocationRepository.js";

const ACCOUNT_ID = "allocation-account";
const RETURN_CHECKSUM = "a".repeat(64);

function invoice(
    id = "invoice-001",
    quantities: number[] = [10],
    status: CanonicalInvoice["status"] = "issued"
): CanonicalInvoice {
    return {
        id,
        accountId: ACCOUNT_ID,
        status,
        revision: 1,
        recordChecksum: "b".repeat(64),
        lines: quantities.map((soldQuantity, index) => ({
            id: `invoice-line-${index + 1}`,
            soldQuantity
        }))
    };
}

function invoiceReturn(
    id = "return-001",
    quantities: number[] = [4],
    status: CanonicalInvoiceReturn["status"] = "recorded",
    invoiceId = "invoice-001"
): CanonicalInvoiceReturn {
    return {
        id,
        accountId: ACCOUNT_ID,
        invoiceId,
        status,
        revision: 0,
        recordChecksum: RETURN_CHECKSUM,
        lines: quantities.map((returnQuantity, index) => ({
            id: `return-line-${index + 1}`,
            invoiceLineId: `invoice-line-${index + 1}`,
            returnQuantity
        }))
    };
}

function request(
    currentReturn = invoiceReturn()
): ReserveReturnAllocationRequest {
    const unsigned = {
        schemaVersion: 1 as const,
        accountId: ACCOUNT_ID,
        commandId: `invoice-return-execute-${currentReturn.id}`,
        commandType: "invoiceReturn.execute" as const,
        returnId: currentReturn.id,
        invoiceId: currentReturn.invoiceId,
        expectedReturnRevision: currentReturn.revision,
        expectedReturnChecksum: currentReturn.recordChecksum,
        lines: currentReturn.lines.map(line => ({
            returnLineId: line.id,
            invoiceLineId: line.invoiceLineId,
            quantity: line.returnQuantity
        }))
    };
    return {
        ...unsigned,
        requestChecksum: calculateReturnAllocationRequestChecksum(unsigned)
    };
}

function fixture(
    currentInvoice = invoice(),
    currentReturn = invoiceReturn()
) {
    const reader = new InMemoryCanonicalCommercialRecordReader();
    reader.putInvoice(currentInvoice);
    reader.putReturn(currentReturn);
    const repository = new InMemoryReturnAllocationRepository();
    const service = new CanonicalReturnAllocationService(
        reader,
        repository,
        () => 1_000
    );
    return { reader, repository, service, currentInvoice, currentReturn };
}

describe("canonical return allocation service", () => {
    it("reserves a valid single line from the immutable issued Invoice quantity", async () => {
        const { service, repository, currentReturn } = fixture();
        const result = await service.reserve(request(currentReturn));
        const state = await repository.find(ACCOUNT_ID, currentReturn.invoiceId);

        expect(result.kind).toBe("reserved");
        expect(state?.lines["invoice-line-1"]).toMatchObject({
            soldQuantity: 10,
            reservedReturnedQuantity: 4,
            committedReturnedQuantity: 0
        });
    });

    it("reserves all lines of a valid multi-line request atomically", async () => {
        const currentReturn = invoiceReturn("return-multi", [2, 3]);
        const { service, repository } = fixture(invoice("invoice-001", [5, 3]), currentReturn);

        await expect(service.reserve(request(currentReturn))).resolves.toMatchObject({
            kind: "reserved"
        });
        const state = await repository.find(ACCOUNT_ID, "invoice-001");
        expect(state?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(2);
        expect(state?.lines["invoice-line-2"]?.reservedReturnedQuantity).toBe(3);
    });

    it("returns an exact match without a second aggregate increment or revision", async () => {
        const { service, repository, currentReturn } = fixture();
        const command = request(currentReturn);
        const first = await service.reserve(command);
        const retry = await service.reserve(command);
        const state = await repository.find(ACCOUNT_ID, "invoice-001");

        expect(first.kind).toBe("reserved");
        expect(retry.kind).toBe("exactMatch");
        expect(state?.revision).toBe(1);
        expect(state?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(4);
        expect(Object.keys(state?.reservations ?? {})).toHaveLength(1);
    });

    it("conflicts on the same command with a different checksum or allocation payload", async () => {
        const { repository, currentReturn } = fixture();
        const first = request(currentReturn);
        const firstInput: ReturnAllocationTransactionInput = {
            request: first,
            invoiceLines: invoice().lines,
            now: 1_000
        };
        await repository.reserve(firstInput);
        const conflicting = {
            ...first,
            requestChecksum: "c".repeat(64),
            lines: [{ ...first.lines[0]!, quantity: 3 }]
        };

        await expect(repository.reserve({
            ...firstInput,
            request: conflicting,
            now: 1_001
        })).resolves.toEqual({
            kind: "conflict",
            code: "ALLOCATION_REQUEST_CONFLICT"
        });
        const state = await repository.find(ACCOUNT_ID, "invoice-001");
        expect(state?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(4);
    });

    it.each(["invoice", "return"] as const)(
        "rejects a missing canonical %s baseline without an allocation write",
        async missing => {
            const { reader, repository, service, currentReturn } = fixture();
            if (missing === "invoice") {
                reader.invoices.clear();
            } else {
                reader.returns.clear();
            }
            await expect(service.reserve(request(currentReturn))).resolves.toEqual({
                kind: "rejected",
                code: "MISSING_CLOUD_BASELINE"
            });
            expect(repository.reserveCalls).toBe(0);
        }
    );

    it.each(["draft", "cancelled"] as const)(
        "rejects a %s Invoice before the allocation transaction",
        async status => {
            const currentReturn = invoiceReturn();
            const { service, repository } = fixture(invoice("invoice-001", [10], status), currentReturn);
            await expect(service.reserve(request(currentReturn))).resolves.toEqual({
                kind: "rejected",
                code: "INVOICE_NOT_ISSUED"
            });
            expect(repository.reserveCalls).toBe(0);
        }
    );

    it("rejects an already executed InvoiceReturn", async () => {
        const currentReturn = invoiceReturn("return-executed", [4], "executed");
        const { service, repository } = fixture(invoice(), currentReturn);
        await expect(service.reserve(request(currentReturn))).resolves.toEqual({
            kind: "rejected",
            code: "RETURN_NOT_RECORDED"
        });
        expect(repository.reserveCalls).toBe(0);
    });

    it.each([
        ["stale revision", { expectedReturnRevision: 1 }, "RETURN_REVISION_CONFLICT"],
        ["checksum mismatch", { expectedReturnChecksum: "d".repeat(64) }, "RETURN_CHECKSUM_CONFLICT"]
    ] as const)("rejects %s before allocation", async (_label, override, code) => {
        const { service, repository, currentReturn } = fixture();
        const changed = { ...request(currentReturn), ...override };
        const unsigned = { ...changed };
        delete (unsigned as Partial<ReserveReturnAllocationRequest>).requestChecksum;
        changed.requestChecksum = calculateReturnAllocationRequestChecksum(unsigned);

        await expect(service.reserve(changed)).resolves.toMatchObject({
            kind: "conflict",
            code
        });
        expect(repository.reserveCalls).toBe(0);
    });

    it("rejects a Return linked to a different Invoice", async () => {
        const currentReturn = invoiceReturn("return-cross-link", [4], "recorded", "invoice-other");
        const { reader, service, repository } = fixture(invoice(), currentReturn);
        reader.putInvoice(invoice("invoice-other"));
        const command = request(currentReturn);
        reader.returns.get(`${ACCOUNT_ID}/${currentReturn.id}`)!.invoiceId = "invoice-001";

        await expect(service.reserve(command)).resolves.toMatchObject({
            kind: "conflict",
            code: "CANONICAL_RECORD_CONFLICT"
        });
        expect(repository.reserveCalls).toBe(0);
    });

    it("rejects unknown Invoice lines and Return payload mismatch", async () => {
        const currentReturn = invoiceReturn();
        currentReturn.lines[0]!.invoiceLineId = "unknown-line";
        const { service, repository } = fixture(invoice(), currentReturn);

        await expect(service.reserve(request(currentReturn))).resolves.toMatchObject({
            kind: "conflict",
            code: "RETURN_PAYLOAD_CONFLICT"
        });
        expect(repository.reserveCalls).toBe(0);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
        "rejects invalid quantity %s before canonical reads",
        async quantity => {
            const { reader, repository, service, currentReturn } = fixture();
            const command = request(currentReturn);
            command.lines[0]!.quantity = quantity;
            await expect(service.reserve(command)).resolves.toEqual({
                kind: "rejected",
                code: "INVALID_REQUEST"
            });
            expect(reader.invoiceReads).toBe(0);
            expect(repository.reserveCalls).toBe(0);
        }
    );

    it("rejects duplicate return-line and Invoice-line identities conservatively", async () => {
        const { reader, repository, service, currentReturn } = fixture();
        const command = request(currentReturn);
        command.lines.push({ ...command.lines[0]!, returnLineId: "return-line-2" });

        await expect(service.reserve(command)).resolves.toEqual({
            kind: "rejected",
            code: "INVALID_REQUEST"
        });
        expect(reader.invoiceReads).toBe(0);
        expect(repository.reserveCalls).toBe(0);
    });

    it("rejects corrupt aggregate evidence without overwrite", async () => {
        const { service, repository, currentReturn } = fixture();
        const command = request(currentReturn);
        await service.reserve(command);
        const corrupt = repository.raw(ACCOUNT_ID, "invoice-001") as ReturnAllocationState;
        corrupt.lines["invoice-line-1"]!.reservedReturnedQuantity = 9;
        repository.seed(ACCOUNT_ID, "invoice-001", corrupt);

        await expect(service.reserve(command)).resolves.toEqual({
            kind: "conflict",
            code: "ALLOCATION_STATE_CONFLICT"
        });
        expect((repository.raw(ACCOUNT_ID, "invoice-001") as ReturnAllocationState)
            .lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(9);
    });

    it("rejects an immutable sold snapshot mismatch without repairing it", async () => {
        const { service, repository, currentReturn } = fixture();
        await service.reserve(request(currentReturn));
        const changedInvoice = invoice("invoice-001", [11]);
        const reader = new InMemoryCanonicalCommercialRecordReader();
        reader.putInvoice(changedInvoice);
        reader.putReturn(currentReturn);
        const changedService = new CanonicalReturnAllocationService(reader, repository, () => 2_000);

        await expect(changedService.reserve(request(currentReturn))).resolves.toEqual({
            kind: "conflict",
            code: "ALLOCATION_STATE_CONFLICT"
        });
    });

    it("serializes concurrent 6 + 6 and never stores 12 against sold 10", async () => {
        const repository = new InMemoryReturnAllocationRepository();
        const firstReturn = invoiceReturn("return-a", [6]);
        const secondReturn = invoiceReturn("return-b", [6]);
        const first = request(firstReturn);
        const second = request(secondReturn);

        const outcomes = await Promise.all([first, second].map((command, index) =>
            repository.reserve({ request: command, invoiceLines: invoice().lines, now: 1_000 + index })
        ));
        expect(outcomes.map(outcome => outcome.kind).sort()).toEqual(["rejected", "reserved"]);
        const state = await repository.find(ACCOUNT_ID, "invoice-001");
        expect(state?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(6);
    });

    it("serializes concurrent 4 + 6 and fills exactly sold 10", async () => {
        const repository = new InMemoryReturnAllocationRepository();
        const commands = [invoiceReturn("return-a", [4]), invoiceReturn("return-b", [6])]
            .map(request);
        const outcomes = await Promise.all(commands.map((command, index) =>
            repository.reserve({ request: command, invoiceLines: invoice().lines, now: 1_000 + index })
        ));

        expect(outcomes.every(outcome => outcome.kind === "reserved")).toBe(true);
        expect((await repository.find(ACCOUNT_ID, "invoice-001"))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(10);
    });

    it("rejects a multi-line overflow without changing any line", async () => {
        const currentReturn = invoiceReturn("return-overflow", [2, 4]);
        const { service, repository } = fixture(invoice("invoice-001", [5, 3]), currentReturn);

        await expect(service.reserve(request(currentReturn))).resolves.toEqual({
            kind: "rejected",
            code: "RETURN_ALLOCATION_EXCEEDED"
        });
        expect(await repository.find(ACCOUNT_ID, "invoice-001")).toBeNull();
    });

    it("propagates canonical read and transaction failures without a partial write", async () => {
        const currentReturn = invoiceReturn();
        const { reader } = fixture(invoice(), currentReturn);
        reader.findInvoice = async () => { throw new Error("synthetic read failure"); };
        const repository = new InMemoryReturnAllocationRepository();
        const readFailureService = new CanonicalReturnAllocationService(reader, repository);
        await expect(readFailureService.reserve(request(currentReturn))).rejects.toThrow("synthetic read failure");
        expect(repository.reserveCalls).toBe(0);

        const validReader = fixture(invoice(), currentReturn).reader;
        const failingRepository: ReturnAllocationRepository = {
            reserve: async () => { throw new Error("synthetic transaction failure"); },
            find: async () => null
        };
        const transactionFailureService = new CanonicalReturnAllocationService(
            validReader,
            failingRepository
        );
        await expect(transactionFailureService.reserve(request(currentReturn)))
            .rejects.toThrow("synthetic transaction failure");
    });

    it("recovers a simulated post-transaction crash by exact retry", async () => {
        const { reader, currentReturn } = fixture();
        const inner = new InMemoryReturnAllocationRepository();
        let crash = true;
        const repository: ReturnAllocationRepository = {
            reserve: async input => {
                const result = await inner.reserve(input);
                if (crash) {
                    crash = false;
                    throw new Error("synthetic post-transaction crash");
                }
                return result;
            },
            find: (accountId, invoiceId) => inner.find(accountId, invoiceId)
        };
        const service = new CanonicalReturnAllocationService(reader, repository, () => 1_000);
        const command = request(currentReturn);

        await expect(service.reserve(command)).rejects.toThrow("synthetic post-transaction crash");
        await expect(service.reserve(command)).resolves.toMatchObject({ kind: "exactMatch" });
        expect((await inner.find(ACCOUNT_ID, "invoice-001"))
            ?.lines["invoice-line-1"]?.reservedReturnedQuantity).toBe(4);
    });
});
