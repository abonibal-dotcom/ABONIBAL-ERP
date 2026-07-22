import type { DurableMutationCapture } from "../../sync/services/DurableMutationCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { Invoice } from "../Invoice";
import type { InvoiceLocalMutationApplier } from "../sync/InvoiceLocalMutationApplier";
import {
    buildInvoiceDraftCreateOperation,
    buildInvoiceDraftTombstoneOperation,
    buildInvoiceDraftUpdateOperation
} from "../sync/InvoiceSyncOperation";
import type {
    InvoiceRepository,
    InvoiceRepositoryPort
} from "./InvoiceRepository";

export class InvoiceSyncMutationError extends Error {
    public readonly messageSafe: string;

    public constructor(messageSafe: string) {
        super(messageSafe);
        this.name = "InvoiceSyncMutationError";
        this.messageSafe = messageSafe;
    }
}

export type InvoiceSyncClock = () => string;
export type InvoiceSyncActorProvider = () => string | null;

export class InvoiceSyncRepository implements InvoiceRepositoryPort {
    private readonly cacheRepository: InvoiceRepository;
    private readonly modeService: SyncModeService;
    private readonly capture: DurableMutationCapture;
    private readonly localApplier: InvoiceLocalMutationApplier;
    private readonly actorProvider: InvoiceSyncActorProvider;
    private readonly clock: InvoiceSyncClock;

    public constructor(
        cacheRepository: InvoiceRepository,
        modeService: SyncModeService,
        capture: DurableMutationCapture,
        localApplier: InvoiceLocalMutationApplier,
        actorProvider: InvoiceSyncActorProvider = () => null,
        clock: InvoiceSyncClock = () => new Date().toISOString()
    ) {
        this.cacheRepository = cacheRepository;
        this.modeService = modeService;
        this.capture = capture;
        this.localApplier = localApplier;
        this.actorProvider = actorProvider;
        this.clock = clock;
    }

    public allForAccount(accountId: string): Invoice[] {
        return this.cacheRepository.allForAccount(accountId);
    }

    public appendForAccount(accountId: string, invoice: Invoice): void {
        if (this.modeService.getMode() !== "active") {
            this.cacheRepository.appendForAccount(accountId, invoice);
            return;
        }

        this.captureOperation(
            accountId,
            buildInvoiceDraftCreateOperation(invoice, this.clock())
        );
    }

    public findForAccount(
        accountId: string,
        invoiceId: string
    ): Invoice | undefined {
        return this.cacheRepository.findForAccount(accountId, invoiceId);
    }

    public updateForAccount(
        accountId: string,
        invoiceId: string,
        invoice: Invoice
    ): Invoice | null {
        if (this.modeService.getMode() !== "active") {
            return this.cacheRepository.updateForAccount(
                accountId,
                invoiceId,
                invoice
            );
        }

        const current = this.cacheRepository.findForAccount(
            accountId,
            invoiceId
        );

        if (!current) {
            return null;
        }

        if (current.status !== "draft" || invoice.status !== "draft") {
            throw new InvoiceSyncMutationError(
                "Issued and cancelled Invoice transitions require the durable commercial command boundary."
            );
        }

        this.captureOperation(
            accountId,
            buildInvoiceDraftUpdateOperation(
                current,
                invoice,
                this.clock()
            )
        );

        return this.cacheRepository.findForAccount(accountId, invoiceId) ?? null;
    }

    public removeForAccount(
        accountId: string,
        invoiceId: string
    ): boolean {
        if (this.modeService.getMode() !== "active") {
            return this.cacheRepository.removeForAccount(accountId, invoiceId);
        }

        const current = this.cacheRepository.findForAccount(
            accountId,
            invoiceId
        );

        if (!current || current.status !== "draft") {
            return false;
        }

        const tombstonedAt = this.clock();
        const tombstonedBy = this.actorProvider()?.trim()
            || current.updatedBy;

        this.captureOperation(
            accountId,
            buildInvoiceDraftTombstoneOperation(
                current,
                tombstonedAt,
                tombstonedBy
            )
        );

        return !this.cacheRepository.findForAccount(accountId, invoiceId);
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
            throw new InvoiceSyncMutationError(
                result.errors[0] ?? "Invoice mutation capture failed."
            );
        }
    }
}
