import { randomUUID } from "node:crypto";
import { normalizeJsonObject } from "./CanonicalJson.js";
import { CommercialCommandError } from "./CommercialCommandErrors.js";
import type { CommercialCommandReceiptStore } from "./CommercialCommandReceiptStore.js";
import type {
    CommercialCommandReceipt,
    CommercialCommandRequest,
    ReceiptLookupResponse,
    SafeCommercialCommandReceipt,
    TrustedCommandHandlerResult
} from "./CommercialCommandTypes.js";
import {
    assertClientChecksumMatches,
    calculateCommandRequestChecksum
} from "./CommercialCommandValidation.js";
import type { TrustedCommandHandlerRegistry } from "./TrustedCommandHandlerRegistry.js";

const DEFAULT_LEASE_DURATION_MS = 30_000;

export type TrustedCommercialCommandServiceOptions = {
    now?: () => number;
    createLeaseId?: () => string;
    leaseDurationMs?: number;
};

export class TrustedCommercialCommandService {
    private readonly now: () => number;
    private readonly createLeaseId: () => string;
    private readonly leaseDurationMs: number;

    constructor(
        private readonly receiptStore: CommercialCommandReceiptStore,
        private readonly handlerRegistry: TrustedCommandHandlerRegistry,
        options: TrustedCommercialCommandServiceOptions = {}
    ) {
        this.now = options.now ?? Date.now;
        this.createLeaseId = options.createLeaseId ?? randomUUID;
        this.leaseDurationMs = options.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
    }

    async submit(
        request: CommercialCommandRequest
    ): Promise<SafeCommercialCommandReceipt> {
        const requestChecksum = calculateCommandRequestChecksum(request);
        assertClientChecksumMatches(request, requestChecksum);

        const handler = this.handlerRegistry.resolve(request.commandType);
        if (!handler) {
            throw new CommercialCommandError(
                "UNSUPPORTED_COMMAND",
                "The command type is not registered in the trusted runtime."
            );
        }

        const leaseId = this.createLeaseId();
        const claim = await this.receiptStore.claim({
            request,
            requestChecksum,
            now: this.now(),
            leaseId,
            leaseDurationMs: this.leaseDurationMs
        });

        if (claim.kind === "conflicting-request") {
            throw new CommercialCommandError(
                "COMMAND_ID_CONFLICT",
                "The command ID is already bound to a different request."
            );
        }

        if (claim.kind === "processing" || claim.kind === "terminal") {
            return toSafeReceipt(claim.receipt);
        }

        let result: TrustedCommandHandlerResult;
        try {
            result = normalizeHandlerResult(await handler(request));
        } catch (error) {
            if (error instanceof CommercialCommandError) {
                throw error;
            }

            throw new CommercialCommandError(
                "INTERNAL_RETRYABLE",
                "Trusted command processing was interrupted and remains retryable."
            );
        }

        const receipt = await this.receiptStore.complete({
            accountId: request.accountId,
            commandId: request.commandId,
            requestChecksum,
            leaseId,
            now: this.now(),
            result
        });

        return toSafeReceipt(receipt);
    }

    async lookup(accountId: string, commandId: string): Promise<ReceiptLookupResponse> {
        const receipt = await this.receiptStore.find(accountId, commandId);
        return receipt
            ? { found: true, receipt: toSafeReceipt(receipt) }
            : { found: false };
    }
}

export function toSafeReceipt(
    receipt: CommercialCommandReceipt
): SafeCommercialCommandReceipt {
    const {
        processingLeaseId: _processingLeaseId,
        ...safeReceipt
    } = receipt;

    return structuredClone(safeReceipt);
}

function normalizeHandlerResult(
    result: TrustedCommandHandlerResult
): TrustedCommandHandlerResult {
    const safeResultSummary = result.safeResultSummary
        ? normalizeJsonObject(result.safeResultSummary)
        : undefined;

    if (result.status === "accepted") {
        return {
            status: "accepted",
            safeResultSummary: safeResultSummary ?? {},
            ...(result.publicationId ? { publicationId: result.publicationId } : {})
        };
    }

    return {
        status: result.status,
        errorCode: result.errorCode,
        ...(safeResultSummary ? { safeResultSummary } : {})
    };
}
