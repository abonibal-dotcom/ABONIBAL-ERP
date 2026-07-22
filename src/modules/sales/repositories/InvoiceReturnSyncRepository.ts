import type { DurableMutationCapture } from "../../sync/services/DurableMutationCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { InvoiceReturn } from "../InvoiceReturn";
import type { InvoiceReturnLocalMutationApplier } from "../sync/InvoiceReturnLocalMutationApplier";
import {
    buildInvoiceReturnRecordedCreateOperation,
    buildInvoiceReturnRecordedUpdateOperation
} from "../sync/InvoiceReturnSyncOperation";
import type {
    InvoiceReturnRepository,
    InvoiceReturnRepositoryPort
} from "./InvoiceReturnRepository";

export class InvoiceReturnSyncMutationError extends Error {
    public readonly messageSafe: string;

    public constructor(messageSafe: string) {
        super(messageSafe);
        this.name = "InvoiceReturnSyncMutationError";
        this.messageSafe = messageSafe;
    }
}

export type InvoiceReturnSyncClock = () => string;

export class InvoiceReturnSyncRepository
implements InvoiceReturnRepositoryPort {
    private readonly cacheRepository: InvoiceReturnRepository;
    private readonly modeService: SyncModeService;
    private readonly capture: DurableMutationCapture;
    private readonly localApplier: InvoiceReturnLocalMutationApplier;
    private readonly clock: InvoiceReturnSyncClock;

    public constructor(
        cacheRepository: InvoiceReturnRepository,
        modeService: SyncModeService,
        capture: DurableMutationCapture,
        localApplier: InvoiceReturnLocalMutationApplier,
        clock: InvoiceReturnSyncClock = () => new Date().toISOString()
    ) {
        this.cacheRepository = cacheRepository;
        this.modeService = modeService;
        this.capture = capture;
        this.localApplier = localApplier;
        this.clock = clock;
    }

    public allForAccount(accountId: string): InvoiceReturn[] {
        return this.cacheRepository.allForAccount(accountId);
    }

    public appendForAccount(
        accountId: string,
        invoiceReturn: InvoiceReturn
    ): void {
        if (this.modeService.getMode() !== "active") {
            this.cacheRepository.appendForAccount(accountId, invoiceReturn);
            return;
        }

        this.captureOperation(
            accountId,
            buildInvoiceReturnRecordedCreateOperation(
                invoiceReturn,
                this.clock()
            )
        );
    }

    public findForAccount(
        accountId: string,
        invoiceReturnId: string
    ): InvoiceReturn | undefined {
        return this.cacheRepository.findForAccount(accountId, invoiceReturnId);
    }

    public updateForAccount(
        accountId: string,
        invoiceReturnId: string,
        invoiceReturn: InvoiceReturn
    ): InvoiceReturn | null {
        if (this.modeService.getMode() !== "active") {
            return this.cacheRepository.updateForAccount(
                accountId,
                invoiceReturnId,
                invoiceReturn
            );
        }

        const current = this.cacheRepository.findForAccount(
            accountId,
            invoiceReturnId
        );

        if (!current) {
            return null;
        }

        if (
            current.status !== "recorded"
            || invoiceReturn.status !== "recorded"
        ) {
            throw new InvoiceReturnSyncMutationError(
                "InvoiceReturn execution requires the durable commercial command boundary."
            );
        }

        this.captureOperation(
            accountId,
            buildInvoiceReturnRecordedUpdateOperation(
                current,
                invoiceReturn,
                this.clock()
            )
        );

        return this.cacheRepository.findForAccount(
            accountId,
            invoiceReturnId
        ) ?? null;
    }

    public allForInvoice(
        accountId: string,
        invoiceId: string
    ): InvoiceReturn[] {
        return this.cacheRepository.allForInvoice(accountId, invoiceId);
    }

    private captureOperation(
        accountId: string,
        operation: Parameters<DurableMutationCapture["capture"]>[0]["operation"]
    ): void {
        const result = this.capture.capture({
            accountId,
            operation,
            localApplier: this.localApplier
        });

        if (!result.success) {
            throw new InvoiceReturnSyncMutationError(
                result.errors[0] ?? "InvoiceReturn mutation capture failed."
            );
        }
    }
}
