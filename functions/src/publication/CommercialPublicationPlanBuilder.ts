import { createHash } from "node:crypto";
import {
    canonicalChecksum,
    normalizeJsonObject,
    type JsonObject
} from "../trusted/CanonicalJson.js";
import {
    completeProcessingReceipt
} from "../trusted/CommercialCommandReceiptStore.js";
import type { ReturnAllocationCommit } from "../allocation/ReturnAllocationTypes.js";
import type {
    AtomicCommercialPublicationPlan,
    CanonicalDocumentNumberProof,
    CommercialCloudEnvelope,
    CommercialGroupCommitMarker,
    ExecuteReturnPublicationRequest
} from "./CommercialPublicationTypes.js";

export function validateExecuteReturnPublicationRequest(
    request: ExecuteReturnPublicationRequest
): void {
    if (
        request.schemaVersion !== 1
        || request.commandType !== "invoiceReturn.execute"
        || !isKey(request.accountId)
        || !isKey(request.commandId)
        || request.commandId !== `invoice-return-execute-${request.returnId}`
        || !isKey(request.returnId)
        || !isKey(request.invoiceId)
        || !isChecksum(request.requestChecksum)
        || !isChecksum(request.reservationChecksum)
        || !isKey(request.actorId)
    ) {
        throw new Error("INVALID_PUBLICATION_REQUEST");
    }
    validateDocumentNumberProof(request.documentNumberProof, request);
    validateProcessingReceipt(request);
    validateRecordedEnvelope(request);
}

export function calculateCanonicalDocumentNumberAllocationChecksum(
    proof: Omit<CanonicalDocumentNumberProof, "allocationChecksum">
        | CanonicalDocumentNumberProof
): string {
    return canonicalChecksum(normalizeJsonObject({
        schemaVersion: proof.schemaVersion,
        allocationId: proof.allocationId,
        accountId: proof.accountId,
        documentType: proof.documentType,
        targetId: proof.targetId,
        documentNumber: proof.documentNumber,
        businessDate: proof.businessDate,
        timezone: proof.timezone
    }));
}

export function buildAtomicCommercialPublicationPlan(
    request: ExecuteReturnPublicationRequest,
    allocationCommit: ReturnAllocationCommit,
    now: number
): AtomicCommercialPublicationPlan {
    validateExecuteReturnPublicationRequest(request);
    validateAllocationCommit(request, allocationCommit);
    if (!Number.isFinite(now) || now < 0) {
        throw new Error("INVALID_PUBLICATION_REQUEST");
    }

    const publicationId = request.commandId;
    const executedAt = new Date(now).toISOString();
    const recordedData = cloneJson(request.recordedReturnEnvelope.data);
    const rawLines = asObjectArray(recordedData.lines, "InvoiceReturn lines");
    const movementEnvelopes: Record<string, CommercialCloudEnvelope> = {};
    const movementMembers: CommercialGroupCommitMarker["movementMembers"] = {};
    const executedLines = rawLines.map(line => {
        const returnLineId = requireKey(line.id, "returnLineId");
        const allocation = allocationCommit.allocations[returnLineId];
        if (!allocation) {
            throw new Error("ALLOCATION_COMMIT_CONFLICT");
        }
        const invoiceLineId = requireKey(line.invoiceLineId, "invoiceLineId");
        const productId = requireKey(line.productId, "productId");
        const quantity = requirePositive(line.returnQuantity, "returnQuantity");
        if (
            allocation.invoiceLineId !== invoiceLineId
            || allocation.quantity !== quantity
        ) {
            throw new Error("ALLOCATION_COMMIT_CONFLICT");
        }

        const movementId = `invoice-return-${request.returnId}-${returnLineId}`;
        const idempotencyKey =
            `invoice-return-execute-${request.returnId}-line-${returnLineId}`;
        const movementData = normalizeJsonObject({
            id: movementId,
            accountId: request.accountId,
            productId,
            type: "sale_return",
            quantityDelta: quantity,
            reason: `Invoice return ${request.documentNumberProof.documentNumber}`,
            referenceType: "invoice_return",
            referenceId: request.returnId,
            createdAt: executedAt,
            createdBy: request.actorId,
            ledgerSemanticsVersion: 2,
            idempotencyKey,
            metadata: {
                commandId: request.commandId,
                publicationId,
                invoiceReturnId: request.returnId,
                invoiceReturnLineId: returnLineId,
                invoiceId: request.invoiceId,
                invoiceLineId
            }
        });
        const movementChecksum = canonicalChecksum(movementData);
        const operationId = `stockMovements-${sha256Hex(
            `${idempotencyKey}:${movementChecksum}`
        ).slice(0, 32)}`;
        movementEnvelopes[movementId] = {
            data: movementData,
            meta: normalizeJsonObject({
                schemaVersion: 1,
                revision: 1,
                immutable: true,
                serverUpdatedAt: now,
                lastOperationId: operationId,
                idempotencyKey,
                writeSetChecksum: movementChecksum,
                publicationId
            })
        };
        movementMembers[movementId] = {
            movementId,
            returnLineId,
            invoiceLineId,
            recordChecksum: movementChecksum
        };
        return { ...line, returnStockMovementId: movementId };
    });
    if (
        executedLines.length === 0
        || executedLines.length !== Object.keys(allocationCommit.allocations).length
    ) {
        throw new Error("ALLOCATION_COMMIT_CONFLICT");
    }

    const executedData = normalizeJsonObject({
        ...recordedData,
        returnNumber: request.documentNumberProof.documentNumber,
        status: "executed",
        revision: requireRevision(recordedData.revision) + 1,
        executionCommandId: request.commandId,
        lines: executedLines,
        updatedAt: executedAt,
        updatedBy: request.actorId
    });
    const returnChecksum = canonicalChecksum(executedData);
    const executedReturnEnvelope: CommercialCloudEnvelope = {
        data: executedData,
        meta: normalizeJsonObject({
            schemaVersion: 1,
            revision: executedData.revision,
            serverUpdatedAt: now,
            lastOperationId: request.commandId,
            idempotencyKey: request.commandId,
            writeSetChecksum: returnChecksum,
            recordChecksum: returnChecksum,
            tombstone: false,
            operationKind: "execute_invoice_return",
            lifecycleStatus: "executed",
            publicationId
        })
    };

    const safeResultSummary = normalizeJsonObject({
        returnId: request.returnId,
        invoiceId: request.invoiceId,
        documentNumber: request.documentNumberProof.documentNumber,
        executedRevision: executedData.revision,
        movementCount: executedLines.length
    });
    const acceptedReceipt = completeProcessingReceipt(
        request.processingReceipt,
        {
            accountId: request.accountId,
            commandId: request.commandId,
            requestChecksum: request.requestChecksum,
            leaseId: request.processingReceipt.processingLeaseId!,
            now,
            result: {
                status: "accepted",
                safeResultSummary,
                publicationId
            }
        },
        canonicalChecksum(normalizeJsonObject({
            status: "accepted",
            safeResultSummary,
            publicationId
        }))
    );

    const proofChecksum = canonicalChecksum(normalizeJsonObject(
        request.documentNumberProof
    ));
    const markerBase = {
        schemaVersion: 1 as const,
        accountId: request.accountId,
        publicationId,
        commandId: request.commandId,
        commandType: "invoiceReturn.execute" as const,
        targetId: request.returnId,
        requestChecksum: request.requestChecksum,
        allocationCommitChecksum: allocationCommit.commitChecksum,
        allocationInvoiceId: request.invoiceId,
        invoiceReturnChecksum: returnChecksum,
        invoiceReturnRevision: executedData.revision as number,
        movementMembers,
        receiptResultChecksum: acceptedReceipt.resultChecksum!,
        documentNumberAllocationId: request.documentNumberProof.allocationId,
        documentNumberProofChecksum: proofChecksum,
        status: "committed" as const,
        committedAt: now
    };
    const publicationChecksum = canonicalChecksum(normalizeJsonObject(markerBase));
    const marker: CommercialGroupCommitMarker = {
        ...markerBase,
        publicationChecksum
    };

    return {
        accountId: request.accountId,
        publicationId,
        commandId: request.commandId,
        invoiceId: request.invoiceId,
        returnId: request.returnId,
        requestChecksum: request.requestChecksum,
        processingLeaseId: request.processingReceipt.processingLeaseId!,
        recordedReturnEnvelope: request.recordedReturnEnvelope,
        executedReturnEnvelope,
        movementEnvelopes,
        expectedProcessingReceipt: request.processingReceipt,
        acceptedReceipt,
        allocationCommit,
        marker
    };
}

function validateDocumentNumberProof(
    proof: CanonicalDocumentNumberProof | undefined,
    request: ExecuteReturnPublicationRequest
): void {
    if (!proof) {
        throw new Error("DOCUMENT_NUMBER_PROOF_REQUIRED");
    }
    if (
        proof.schemaVersion !== 1
        || !isKey(proof.allocationId)
        || proof.accountId !== request.accountId
        || proof.documentType !== "invoiceReturn"
        || proof.targetId !== request.returnId
        || typeof proof.documentNumber !== "string"
        || proof.documentNumber.trim().length === 0
        || typeof proof.businessDate !== "string"
        || proof.businessDate.length !== 10
        || typeof proof.timezone !== "string"
        || proof.timezone.trim().length === 0
        || !isChecksum(proof.allocationChecksum)
        || proof.allocationChecksum
            !== calculateCanonicalDocumentNumberAllocationChecksum(proof)
    ) {
        throw new Error("DOCUMENT_NUMBER_PROOF_REQUIRED");
    }
}

function validateProcessingReceipt(request: ExecuteReturnPublicationRequest): void {
    const receipt = request.processingReceipt;
    if (
        receipt.accountId !== request.accountId
        || receipt.commandId !== request.commandId
        || receipt.commandType !== request.commandType
        || receipt.targetId !== request.returnId
        || receipt.requestChecksum !== request.requestChecksum
        || receipt.status !== "processing"
        || !isKey(receipt.processingLeaseId)
        || typeof receipt.processingLeaseExpiresAt !== "number"
    ) {
        throw new Error("RECEIPT_STATE_CONFLICT");
    }
}

function validateRecordedEnvelope(request: ExecuteReturnPublicationRequest): void {
    const data = request.recordedReturnEnvelope?.data;
    const meta = request.recordedReturnEnvelope?.meta;
    if (
        !data || !meta
        || data.id !== request.returnId
        || data.accountId !== request.accountId
        || data.invoiceId !== request.invoiceId
        || data.status !== "recorded"
        || !Number.isInteger(data.revision)
        || meta.lifecycleStatus !== "recorded"
        || meta.revision !== data.revision
        || meta.recordChecksum !== canonicalChecksum(data)
    ) {
        throw new Error("RETURN_BASELINE_CONFLICT");
    }
}

function validateAllocationCommit(
    request: ExecuteReturnPublicationRequest,
    commit: ReturnAllocationCommit
): void {
    if (
        commit.accountId !== request.accountId
        || commit.invoiceId !== request.invoiceId
        || commit.returnId !== request.returnId
        || commit.commandId !== request.commandId
        || commit.requestChecksum !== request.requestChecksum
        || commit.reservationChecksum !== request.reservationChecksum
        || commit.publicationId !== request.commandId
    ) {
        throw new Error("ALLOCATION_COMMIT_CONFLICT");
    }
}

function asObjectArray(value: unknown, field: string): JsonObject[] {
    if (!Array.isArray(value) || value.some(item => !isObject(item))) {
        throw new Error(`${field} are invalid.`);
    }
    return value.map(item => cloneJson(item));
}

function cloneJson(value: JsonObject): JsonObject {
    return normalizeJsonObject(JSON.parse(JSON.stringify(value)) as unknown);
}

function requireKey(value: unknown, field: string): string {
    if (!isKey(value)) {
        throw new Error(`${field} is invalid.`);
    }
    return value;
}

function requirePositive(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(`${field} is invalid.`);
    }
    return value;
}

function requireRevision(value: unknown): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error("InvoiceReturn revision is invalid.");
    }
    return value;
}

function isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isKey(value: unknown): value is string {
    return typeof value === "string"
        && value.trim().length > 0
        && !/[.#$\[\]\/]/.test(value);
}

function isChecksum(value: unknown): value is string {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sha256Hex(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}
