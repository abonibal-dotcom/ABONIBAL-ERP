import { Container } from "../../../core/Container";
import { Page } from "../../../framework/Page";
import type { Product } from "../../products/Product";
import type { ProductService } from "../../products/services/ProductService";
import type {
    Invoice,
    InvoiceDraftInput,
    InvoiceDraftLineInput
} from "../Invoice";
import type { InvoiceService } from "../services/InvoiceService";

export class InvoiceDraftPage extends Page {

    private readonly invoiceService: InvoiceService;
    private readonly productService: ProductService;

    private form: HTMLFormElement | null = null;
    private customerNameInput: HTMLInputElement | null = null;
    private productSelect: HTMLSelectElement | null = null;
    private quantityInput: HTMLInputElement | null = null;
    private unitPriceInput: HTMLInputElement | null = null;
    private discountInput: HTMLInputElement | null = null;
    private taxInput: HTMLInputElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private messageElement: HTMLElement | null = null;
    private newDraftButton: HTMLButtonElement | null = null;
    private draftsBody: HTMLElement | null = null;
    private subtotalElement: HTMLElement | null = null;
    private discountElement: HTMLElement | null = null;
    private taxElement: HTMLElement | null = null;
    private totalElement: HTMLElement | null = null;
    private draftCountElement: HTMLElement | null = null;
    private editingInvoiceId: string | null = null;

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        this.saveDraft();

    };

    private readonly handleProductChange = (): void => {

        this.populateSelectedProductPrice();

        this.renderTotalsPreview();

    };

    private readonly handleCalculationInput = (): void => {

        this.renderTotalsPreview();

    };

    private readonly handleNewDraft = (): void => {

        this.resetForm();

        this.setMessage("");

    };

    private readonly handleDraftTableClick = (event: Event): void => {

        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editButton = target.closest<HTMLButtonElement>(
            "[data-action=\"edit-invoice-draft\"]"
        );
        const issueButton = target.closest<HTMLButtonElement>(
            "[data-action=\"issue-invoice-draft\"]"
        );

        const invoiceId = editButton?.dataset.invoiceId;
        const issueInvoiceId = issueButton?.dataset.invoiceId;

        if (invoiceId) {
            this.openDraftForEdit(invoiceId);
            return;
        }

        if (issueInvoiceId) {
            this.issueDraft(issueInvoiceId);
        }

    };

    public constructor() {

        super();

        this.invoiceService = Container.get<InvoiceService>("invoiceService");
        this.productService = Container.get<ProductService>("productService");

    }

    public title(): string {

        return "Invoices";

    }

    public render(): string {

        return `
            <section id="invoice-draft-page" data-editing-invoice-id="">

                <div class="page-header">

                    <h1>Invoices</h1>

                    <button id="invoice-new-draft" type="button">
                        New draft
                    </button>

                </div>

                <p id="invoice-draft-message" role="status"></p>

                <form id="invoice-draft-form" autocomplete="off">

                    <div class="form-group">

                        <label for="invoice-customer-name">Customer name</label>

                        <input id="invoice-customer-name" type="text" required>

                    </div>

                    <div class="form-group">

                        <label for="invoice-product-select">Product</label>

                        <select id="invoice-product-select" required></select>

                    </div>

                    <div class="form-group">

                        <label for="invoice-quantity">Quantity</label>

                        <input
                            id="invoice-quantity"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-unit-price">Unit price</label>

                        <input
                            id="invoice-unit-price"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-discount">Discount</label>

                        <input
                            id="invoice-discount"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-tax">Tax</label>

                        <input
                            id="invoice-tax"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-notes">Notes</label>

                        <textarea id="invoice-notes"></textarea>

                    </div>

                    <section id="invoice-totals-preview">

                        <p>Subtotal: <span id="invoice-subtotal">0</span></p>
                        <p>Discount: <span id="invoice-total-discount">0</span></p>
                        <p>Tax: <span id="invoice-total-tax">0</span></p>
                        <p>Total: <span id="invoice-total">0</span></p>

                    </section>

                    <button id="invoice-save-draft" type="submit">
                        Save draft
                    </button>

                </form>

                <section id="invoice-draft-list">

                    <h2>Invoices</h2>

                    <p>
                        Invoice count:
                        <span id="invoice-draft-count">0</span>
                    </p>

                    <table>

                        <thead>

                            <tr>

                                <th>Invoice</th>
                                <th>Customer</th>
                                <th>Created</th>
                                <th>Issued</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>

                            </tr>

                        </thead>

                        <tbody id="invoice-draft-list-body"></tbody>

                    </table>

                </section>

            </section>
        `;

    }

    public onEnter(): void {

        this.onLeave();

        this.form = document.getElementById("invoice-draft-form") as HTMLFormElement | null;
        this.customerNameInput = document.getElementById("invoice-customer-name") as HTMLInputElement | null;
        this.productSelect = document.getElementById("invoice-product-select") as HTMLSelectElement | null;
        this.quantityInput = document.getElementById("invoice-quantity") as HTMLInputElement | null;
        this.unitPriceInput = document.getElementById("invoice-unit-price") as HTMLInputElement | null;
        this.discountInput = document.getElementById("invoice-discount") as HTMLInputElement | null;
        this.taxInput = document.getElementById("invoice-tax") as HTMLInputElement | null;
        this.notesInput = document.getElementById("invoice-notes") as HTMLTextAreaElement | null;
        this.messageElement = document.getElementById("invoice-draft-message");
        this.newDraftButton = document.getElementById("invoice-new-draft") as HTMLButtonElement | null;
        this.draftsBody = document.getElementById("invoice-draft-list-body");
        this.subtotalElement = document.getElementById("invoice-subtotal");
        this.discountElement = document.getElementById("invoice-total-discount");
        this.taxElement = document.getElementById("invoice-total-tax");
        this.totalElement = document.getElementById("invoice-total");
        this.draftCountElement = document.getElementById("invoice-draft-count");

        this.populateProductOptions();
        this.renderDrafts();
        this.renderTotalsPreview();

        this.form?.addEventListener("submit", this.handleSubmit);
        this.productSelect?.addEventListener("change", this.handleProductChange);
        this.quantityInput?.addEventListener("input", this.handleCalculationInput);
        this.unitPriceInput?.addEventListener("input", this.handleCalculationInput);
        this.discountInput?.addEventListener("input", this.handleCalculationInput);
        this.taxInput?.addEventListener("input", this.handleCalculationInput);
        this.newDraftButton?.addEventListener("click", this.handleNewDraft);
        this.draftsBody?.addEventListener("click", this.handleDraftTableClick);

    }

    public onLeave(): void {

        this.form?.removeEventListener("submit", this.handleSubmit);
        this.productSelect?.removeEventListener("change", this.handleProductChange);
        this.quantityInput?.removeEventListener("input", this.handleCalculationInput);
        this.unitPriceInput?.removeEventListener("input", this.handleCalculationInput);
        this.discountInput?.removeEventListener("input", this.handleCalculationInput);
        this.taxInput?.removeEventListener("input", this.handleCalculationInput);
        this.newDraftButton?.removeEventListener("click", this.handleNewDraft);
        this.draftsBody?.removeEventListener("click", this.handleDraftTableClick);

        this.form = null;
        this.customerNameInput = null;
        this.productSelect = null;
        this.quantityInput = null;
        this.unitPriceInput = null;
        this.discountInput = null;
        this.taxInput = null;
        this.notesInput = null;
        this.messageElement = null;
        this.newDraftButton = null;
        this.draftsBody = null;
        this.subtotalElement = null;
        this.discountElement = null;
        this.taxElement = null;
        this.totalElement = null;
        this.draftCountElement = null;
        this.editingInvoiceId = null;

    }

    private populateProductOptions(): void {

        if (!this.productSelect) {
            return;
        }

        const products = this.selectableProducts();

        this.productSelect.innerHTML = [
            "<option value=\"\">Select a product</option>",
            ...products.map(product => `
                <option
                    value="${this.escapeHtml(product.id)}"
                    data-product-name="${this.escapeHtml(product.name)}"
                >
                    ${this.escapeHtml(product.name)}
                </option>
            `)
        ].join("");

        this.populateSelectedProductPrice();

    }

    private selectableProducts(): Product[] {

        return this.productService
            .getAll()
            .filter(product => product.isActive);

    }

    private populateSelectedProductPrice(): void {

        const product = this.selectedProduct();

        if (!product || !this.unitPriceInput) {
            return;
        }

        this.unitPriceInput.value = String(product.salePrice);

    }

    private renderDrafts(): void {

        const invoices = this.invoiceService.getAll();

        if (this.draftCountElement) {
            this.draftCountElement.textContent = String(invoices.length);
        }

        if (!this.draftsBody) {
            return;
        }

        if (invoices.length === 0) {
            this.draftsBody.innerHTML = `
                <tr>
                    <td colspan="7">No invoices.</td>
                </tr>
            `;
            return;
        }

        this.draftsBody.innerHTML = invoices
            .map(invoice => this.renderDraftRow(invoice))
            .join("");

    }

    private renderDraftRow(invoice: Invoice): string {

        return `
            <tr
                class="invoice-draft-row"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
                data-invoice-status="${this.escapeHtml(invoice.status)}"
                data-invoice-total="${this.escapeHtml(invoice.total)}"
                data-issued-at="${this.escapeHtml(invoice.issuedAt ?? "")}"
            >
                <td>${this.escapeHtml(invoice.invoiceNumber)}</td>
                <td>${this.escapeHtml(this.customerDisplayName(invoice))}</td>
                <td>${this.escapeHtml(this.formatDateTime(invoice.createdAt))}</td>
                <td>${this.escapeHtml(this.formatOptionalDateTime(invoice.issuedAt))}</td>
                <td>${this.formatCurrency(invoice.total)}</td>
                <td>${this.escapeHtml(invoice.status)}</td>
                <td>${this.renderInvoiceActions(invoice)}</td>
            </tr>
            <tr
                class="invoice-line-audit-container"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
            >
                <td colspan="7">
                    ${this.renderInvoiceLines(invoice)}
                </td>
            </tr>
        `;

    }

    private renderInvoiceLines(invoice: Invoice): string {

        return `
            <table
                class="invoice-line-audit-table"
                aria-label="Invoice lines ${this.escapeHtml(invoice.invoiceNumber)}"
            >
                <thead>
                    <tr>
                        <th>Product snapshot</th>
                        <th>Quantity</th>
                        <th>Unit price</th>
                        <th>Line total</th>
                        <th>Stock movement</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.lines
                        .map(line => this.renderInvoiceLine(invoice, line))
                        .join("")}
                </tbody>
            </table>
        `;

    }

    private renderInvoiceLine(
        invoice: Invoice,
        line: Invoice["lines"][number]
    ): string {

        const stockMovementId = line.stockMovementId?.trim() ?? "";
        const stockMovementDisplay = invoice.status === "issued"
            ? stockMovementId || "Missing movement"
            : "Not issued";

        return `
            <tr
                class="invoice-line-audit-row"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
                data-product-id="${this.escapeHtml(line.productId)}"
                data-stock-movement-id="${this.escapeHtml(stockMovementId)}"
            >
                <td class="invoice-line-product-snapshot">
                    ${this.escapeHtml(line.productNameSnapshot)}
                </td>
                <td class="invoice-line-quantity">
                    ${this.escapeHtml(line.quantity)}
                </td>
                <td class="invoice-line-unit-price">
                    ${this.formatCurrency(line.unitPrice)}
                </td>
                <td class="invoice-line-total">
                    ${this.formatCurrency(line.lineTotal)}
                </td>
                <td class="invoice-line-stock-movement-id">
                    ${this.escapeHtml(stockMovementDisplay)}
                </td>
            </tr>
        `;

    }

    private renderInvoiceActions(invoice: Invoice): string {

        if (invoice.status !== "draft") {
            return `<span class="invoice-action-readonly">${this.escapeHtml(invoice.status)}</span>`;
        }

        return `
            <button
                type="button"
                data-action="edit-invoice-draft"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
            >
                Edit
            </button>
            <button
                type="button"
                data-action="issue-invoice-draft"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
            >
                Issue
            </button>
        `;

    }

    private saveDraft(): void {

        const draft = this.buildDraftInput();

        if (!draft.input) {
            this.setMessage(draft.errors.join(" "));
            return;
        }

        const result = this.editingInvoiceId
            ? this.invoiceService.updateDraft(this.editingInvoiceId, draft.input)
            : this.invoiceService.createDraft(draft.input);

        if (!result.success || !result.invoice) {
            this.setMessage(result.errors.join(" "));
            return;
        }

        this.setMessage(
            this.editingInvoiceId
                ? "Draft invoice updated."
                : "Draft invoice saved."
        );
        this.resetForm();
        this.renderDrafts();

    }

    private buildDraftInput(): DraftInputResult {

        const errors: string[] = [];
        const customerName = this.customerNameInput?.value.trim() ?? "";
        const product = this.selectedProduct();
        const quantity = this.readNumber(this.quantityInput);
        const unitPrice = this.readNumber(this.unitPriceInput);
        const discount = this.readOptionalAmount(this.discountInput);
        const tax = this.readOptionalAmount(this.taxInput);

        if (!customerName) {
            errors.push("Customer name is required.");
        }

        if (!product) {
            errors.push("Product is required.");
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            errors.push("Quantity must be greater than zero.");
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            errors.push("Unit price must be zero or greater.");
        }

        if (!Number.isFinite(discount) || discount < 0) {
            errors.push("Discount must be zero or greater.");
        }

        if (!Number.isFinite(tax) || tax < 0) {
            errors.push("Tax must be zero or greater.");
        }

        const lineTotal = (quantity * unitPrice) - discount + tax;

        if (Number.isFinite(lineTotal) && lineTotal < 0) {
            errors.push("Line total cannot be negative.");
        }

        if (errors.length > 0 || !product) {
            return {
                errors,
                input: null
            };
        }

        const line: InvoiceDraftLineInput = {
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            barcodeSnapshot: product.barcode,
            unitSnapshot: product.unit,
            quantity,
            unitPrice,
            discount,
            tax
        };

        return {
            errors: [],
            input: {
                customerSnapshot: {
                    displayName: customerName
                },
                lines: [line],
                discount: 0,
                tax: 0,
                notes: this.notesInput?.value.trim()
            }
        };

    }

    private openDraftForEdit(invoiceId: string): void {

        const invoice = this.invoiceService.getById(invoiceId);
        const line = invoice?.lines[0];

        if (!invoice || !line) {
            this.setMessage("Draft invoice was not found.");
            return;
        }

        if (invoice.status !== "draft") {
            this.setMessage("Only draft invoices can be edited.");
            return;
        }

        this.editingInvoiceId = invoice.id;
        this.setEditingInvoiceId(invoice.id);

        if (this.customerNameInput) {
            this.customerNameInput.value = this.customerDisplayName(invoice);
        }

        if (this.productSelect) {
            this.productSelect.value = line.productId;
        }

        if (this.quantityInput) {
            this.quantityInput.value = String(line.quantity);
        }

        if (this.unitPriceInput) {
            this.unitPriceInput.value = String(line.unitPrice);
        }

        if (this.discountInput) {
            this.discountInput.value = String(line.discount);
        }

        if (this.taxInput) {
            this.taxInput.value = String(line.tax);
        }

        if (this.notesInput) {
            this.notesInput.value = invoice.notes ?? "";
        }

        this.renderTotalsPreview();
        this.setMessage("Editing draft invoice.");

    }

    private issueDraft(invoiceId: string): void {

        const result = this.invoiceService.markIssued(invoiceId);

        if (!result.success || !result.invoice) {
            this.setMessage(result.errors.join(" "));
            this.renderDrafts();
            return;
        }

        this.resetForm();
        this.renderDrafts();
        this.setMessage("Invoice issued.");

    }

    private resetForm(): void {

        this.form?.reset();

        if (this.discountInput) {
            this.discountInput.value = "0";
        }

        if (this.taxInput) {
            this.taxInput.value = "0";
        }

        this.editingInvoiceId = null;
        this.setEditingInvoiceId("");
        this.populateSelectedProductPrice();
        this.renderTotalsPreview();

    }

    private setEditingInvoiceId(invoiceId: string): void {

        const page = document.getElementById("invoice-draft-page");

        if (page) {
            page.dataset.editingInvoiceId = invoiceId;
        }

    }

    private selectedProduct(): Product | null {

        const productId = this.productSelect?.value.trim() ?? "";

        if (!productId) {
            return null;
        }

        return this.selectableProducts()
            .find(product => product.id === productId)
            ?? null;

    }

    private renderTotalsPreview(): void {

        const quantity = this.safeNumber(this.readNumber(this.quantityInput));
        const unitPrice = this.safeNumber(this.readNumber(this.unitPriceInput));
        const discount = Math.max(0, this.readOptionalAmount(this.discountInput));
        const tax = Math.max(0, this.readOptionalAmount(this.taxInput));
        const subtotal = quantity * unitPrice;
        const total = Math.max(0, subtotal - discount + tax);

        if (this.subtotalElement) {
            this.subtotalElement.textContent = this.formatCurrency(subtotal);
        }

        if (this.discountElement) {
            this.discountElement.textContent = this.formatCurrency(discount);
        }

        if (this.taxElement) {
            this.taxElement.textContent = this.formatCurrency(tax);
        }

        if (this.totalElement) {
            this.totalElement.textContent = this.formatCurrency(total);
        }

    }

    private readNumber(input: HTMLInputElement | null): number {

        const value = input?.value.trim() ?? "";

        return value
            ? Number(value)
            : Number.NaN;

    }

    private readOptionalAmount(input: HTMLInputElement | null): number {

        const value = input?.value.trim() ?? "";

        if (!value) {
            return 0;
        }

        const numberValue = Number(value);

        return Number.isFinite(numberValue)
            ? numberValue
            : Number.NaN;

    }

    private safeNumber(value: number): number {

        return Number.isFinite(value)
            ? value
            : 0;

    }

    private customerDisplayName(invoice: Invoice): string {

        const snapshot = invoice.customerSnapshot;

        if (
            snapshot
            && typeof snapshot.displayName === "string"
            && snapshot.displayName.trim()
        ) {
            return snapshot.displayName;
        }

        return "Customer";

    }

    private setMessage(message: string): void {

        if (this.messageElement) {
            this.messageElement.textContent = message;
        }

    }

    private escapeHtml(value: unknown): string {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

    private formatCurrency(value: number): string {

        if (!Number.isFinite(value)) {
            return "0.00";
        }

        return value.toFixed(2);

    }

    private formatOptionalDateTime(value: string | undefined): string {

        return value ? this.formatDateTime(value) : "-";

    }

    private formatDateTime(value: string): string {

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toISOString();

    }

}

interface DraftInputResult {

    errors: string[];
    input: InvoiceDraftInput | null;

}
