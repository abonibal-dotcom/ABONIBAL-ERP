import { Container } from "../../../core/Container";
import { Page } from "../../../framework/Page";
import type { Customer } from "../../customers/Customer";
import type { CustomerService } from "../../customers/services/CustomerService";
import type { Product } from "../../products/Product";
import type { ProductService } from "../../products/services/ProductService";
import type {
    Invoice,
    InvoiceDraftInput,
    InvoiceDraftLineInput
} from "../Invoice";
import type { InvoiceReturnService } from "../services/InvoiceReturnService";
import type { InvoiceService } from "../services/InvoiceService";

export class InvoiceDraftPage extends Page {

    private readonly customerService: CustomerService;
    private readonly invoiceService: InvoiceService;
    private readonly invoiceReturnService: InvoiceReturnService;
    private readonly productService: ProductService;

    private form: HTMLFormElement | null = null;
    private customerSelect: HTMLSelectElement | null = null;
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
    private editingInvoiceRevision = 0;

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
        const deleteButton = target.closest<HTMLButtonElement>(
            "[data-action=\"delete-invoice-draft\"]"
        );
        const cancelButton = target.closest<HTMLButtonElement>(
            "[data-action=\"cancel-invoice\"]"
        );
        const returnButton = target.closest<HTMLButtonElement>(
            "[data-action=\"create-invoice-return\"]"
        );

        const invoiceId = editButton?.dataset.invoiceId;
        const issueInvoiceId = issueButton?.dataset.invoiceId;
        const deleteInvoiceId = deleteButton?.dataset.invoiceId;
        const cancelInvoiceId = cancelButton?.dataset.invoiceId;
        const returnInvoiceId = returnButton?.dataset.invoiceId;
        const returnInvoiceLineId = returnButton?.dataset.invoiceLineId;

        if (returnInvoiceId && returnInvoiceLineId) {
            this.createReturnFromUi(returnInvoiceId, returnInvoiceLineId);
            return;
        }

        if (invoiceId) {
            this.openDraftForEdit(invoiceId);
            return;
        }

        if (issueInvoiceId) {
            this.issueDraft(issueInvoiceId);
            return;
        }

        if (deleteInvoiceId) {
            this.deleteDraft(deleteInvoiceId);
            return;
        }

        if (cancelInvoiceId) {
            this.cancelInvoice(cancelInvoiceId);
        }

    };

    public constructor() {

        super();

        this.customerService = Container.get<CustomerService>("customerService");
        this.invoiceService = Container.get<InvoiceService>("invoiceService");
        this.invoiceReturnService =
            Container.get<InvoiceReturnService>("invoiceReturnService");
        this.productService = Container.get<ProductService>("productService");

    }

    public title(): string {

        return "الفواتير";

    }

    public render(): string {

        return `
            <section id="invoice-draft-page" data-editing-invoice-id="">

                <div class="page-header">

                    <h1>الفواتير</h1>

                    <button id="invoice-new-draft" type="button">
                        فاتورة جديدة
                    </button>

                </div>

                <p id="invoice-draft-message" role="status"></p>

                <form id="invoice-draft-form" autocomplete="off">

                    <div class="form-group">

                        <label for="invoice-customer-select">العميل المسجل</label>

                        <select id="invoice-customer-select"></select>

                    </div>

                    <div class="form-group">

                        <label for="invoice-customer-name">اسم عميل يدوي اختياري</label>

                        <input id="invoice-customer-name" type="text">

                    </div>

                    <div class="form-group">

                        <label for="invoice-product-select">المنتج</label>

                        <select id="invoice-product-select" required></select>

                    </div>

                    <div class="form-group">

                        <label for="invoice-quantity">الكمية</label>

                        <input
                            id="invoice-quantity"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-unit-price">سعر الوحدة</label>

                        <input
                            id="invoice-unit-price"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-discount">الخصم</label>

                        <input
                            id="invoice-discount"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-tax">الضريبة</label>

                        <input
                            id="invoice-tax"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0"
                        >

                    </div>

                    <div class="form-group">

                        <label for="invoice-notes">ملاحظات</label>

                        <textarea id="invoice-notes"></textarea>

                    </div>

                    <section id="invoice-totals-preview">

                        <p>المجموع الفرعي: <span id="invoice-subtotal">0</span></p>
                        <p>الخصم: <span id="invoice-total-discount">0</span></p>
                        <p>الضريبة: <span id="invoice-total-tax">0</span></p>
                        <p>الإجمالي: <span id="invoice-total">0</span></p>

                    </section>

                    <button id="invoice-save-draft" type="submit">
                        حفظ المسودة
                    </button>

                </form>

                <section id="invoice-draft-list">

                    <h2>الفواتير</h2>

                    <p>
                        عدد الفواتير:
                        <span id="invoice-draft-count">0</span>
                    </p>

                    <table>

                        <thead>

                            <tr>

                                <th>الفاتورة</th>
                                <th>العميل</th>
                                <th>تاريخ الإنشاء</th>
                                <th>تاريخ الإصدار</th>
                                <th>الإجمالي</th>
                                <th>الحالة</th>
                                <th>الإجراءات</th>

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
        this.customerSelect = document.getElementById("invoice-customer-select") as HTMLSelectElement | null;
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

        this.populateCustomerOptions();
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
        this.customerSelect = null;
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
        this.editingInvoiceRevision = 0;

    }

    private populateCustomerOptions(): void {

        if (!this.customerSelect) {
            return;
        }

        const customers = this.customerService.getAll();

        this.customerSelect.innerHTML = [
            "<option value=\"\">بدون عميل مسجل</option>",
            ...customers.map(customer => {
                const phone = customer.phone
                    ? ` — ${customer.phone}`
                    : "";

                return `
                <option value="${this.escapeHtml(customer.id)}">
                    ${this.escapeHtml(customer.displayName + phone)}
                </option>
            `;
            })
        ].join("");

    }

    private populateProductOptions(): void {

        if (!this.productSelect) {
            return;
        }

        const products = this.selectableProducts();

        this.productSelect.innerHTML = [
            "<option value=\"\">اختر منتجاً</option>",
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
                    <td colspan="7">لا توجد فواتير.</td>
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
                <td>${this.escapeHtml(this.formatInvoiceStatus(invoice.status))}</td>
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
                        <th>نسخة المنتج</th>
                        <th>الكمية</th>
                        <th>سعر الوحدة</th>
                        <th>إجمالي السطر</th>
                        <th>حركة المخزون</th>
                        <th>حركة العكس</th>
                        <th>الكمية القابلة للإرجاع</th>
                        <th>الإرجاع</th>
                        <th>سجل الإرجاع</th>
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
        const reversalStockMovementId =
            line.reversalStockMovementId?.trim() ?? "";
        const stockMovementDisplay = invoice.status !== "draft"
            ? stockMovementId || "حركة مفقودة"
            : "غير مُصدرة";
        const reversalDisplay = invoice.status === "cancelled"
            ? reversalStockMovementId || "حركة عكس مفقودة"
            : "-";
        const remainingReturnable =
            this.remainingReturnableQuantity(invoice, line);

        return `
            <tr
                class="invoice-line-audit-row invoice-return-line-row"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
                data-invoice-line-id="${this.escapeHtml(line.id)}"
                data-product-id="${this.escapeHtml(line.productId)}"
                data-stock-movement-id="${this.escapeHtml(stockMovementId)}"
                data-reversal-stock-movement-id="${this.escapeHtml(reversalStockMovementId)}"
                data-remaining-returnable="${this.escapeHtml(remainingReturnable)}"
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
                <td class="invoice-line-reversal-stock-movement-id">
                    ${this.escapeHtml(reversalDisplay)}
                </td>
                <td class="invoice-return-remaining">
                    ${this.escapeHtml(remainingReturnable)}
                </td>
                <td class="invoice-return-action">
                    ${this.renderReturnControls(invoice, line, remainingReturnable)}
                </td>
                <td class="invoice-return-audit">
                    ${this.renderReturnAudit(invoice, line)}
                </td>
            </tr>
        `;

    }

    private renderReturnControls(
        invoice: Invoice,
        line: Invoice["lines"][number],
        remainingReturnable: number
    ): string {

        if (invoice.status !== "issued") {
            return "-";
        }

        if (!line.stockMovementId?.trim()) {
            return "خصم مخزون مفقود";
        }

        if (remainingReturnable <= 0) {
            return "مُرجع بالكامل";
        }

        const defaultQuantity = Math.min(1, remainingReturnable);

        return `
            <input
                class="invoice-return-quantity-input"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
                data-invoice-line-id="${this.escapeHtml(line.id)}"
                type="number"
                min="0.01"
                max="${this.escapeHtml(remainingReturnable)}"
                step="0.01"
                value="${this.escapeHtml(defaultQuantity)}"
            >
            <button
                type="button"
                data-action="create-invoice-return"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
                data-invoice-line-id="${this.escapeHtml(line.id)}"
            >
                إرجاع
            </button>
        `;

    }

    private renderReturnAudit(
        invoice: Invoice,
        line: Invoice["lines"][number]
    ): string {

        const returnSummaries: string[] = [];

        for (const invoiceReturn of this.invoiceReturnService.getByInvoiceId(invoice.id)) {
            const returnLine = invoiceReturn.lines.find(
                currentLine => currentLine.invoiceLineId === line.id
            );

            if (!returnLine) {
                continue;
            }

            returnSummaries.push(`
                <div class="invoice-return-audit-entry">
                    ${this.escapeHtml(invoiceReturn.returnNumber)}
                    ${this.escapeHtml(this.formatInvoiceReturnStatus(invoiceReturn.status))}
                    الكمية ${this.escapeHtml(returnLine.returnQuantity)}
                    الحركة ${this.escapeHtml(
                        returnLine.returnStockMovementId ?? "حركة معلّقة"
                    )}
                </div>
            `);
        }

        return returnSummaries.length > 0
            ? returnSummaries.join("")
            : "لا توجد مرتجعات";

    }

    private renderInvoiceActions(invoice: Invoice): string {

        if (invoice.status === "issued") {
            return `
                <button
                    type="button"
                    data-action="cancel-invoice"
                    data-invoice-id="${this.escapeHtml(invoice.id)}"
                >
                    إلغاء
                </button>
            `;
        }

        if (invoice.status !== "draft") {
            return `<span class="invoice-action-readonly">${this.escapeHtml(this.formatInvoiceStatus(invoice.status))}</span>`;
        }

        return `
            <button
                type="button"
                data-action="edit-invoice-draft"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
            >
                تعديل
            </button>
            <button
                type="button"
                data-action="issue-invoice-draft"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
            >
                إصدار
            </button>
            <button
                type="button"
                data-action="delete-invoice-draft"
                data-invoice-id="${this.escapeHtml(invoice.id)}"
            >
                حذف المسودة
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
            ? this.invoiceService.updateDraft(
                this.editingInvoiceId,
                draft.input,
                this.editingInvoiceRevision
            )
            : this.invoiceService.createDraft(draft.input);

        if (!result.success || !result.invoice) {
            this.setMessage(result.errors.join(" "));
            return;
        }

        this.setMessage(
            this.editingInvoiceId
                ? "تم تحديث مسودة الفاتورة."
                : "تم حفظ مسودة الفاتورة."
        );
        this.resetForm();
        this.renderDrafts();

    }

    private buildDraftInput(): DraftInputResult {

        const errors: string[] = [];
        const customer = this.selectedCustomer();
        const manualCustomerName = this.customerNameInput?.value.trim() ?? "";
        const product = this.selectedProduct();
        const quantity = this.readNumber(this.quantityInput);
        const unitPrice = this.readNumber(this.unitPriceInput);
        const discount = this.readOptionalAmount(this.discountInput);
        const tax = this.readOptionalAmount(this.taxInput);

        if (!product) {
            errors.push("المنتج مطلوب.");
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            errors.push("يجب أن تكون الكمية أكبر من صفر.");
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            errors.push("يجب أن يكون سعر الوحدة صفراً أو أكثر.");
        }

        if (!Number.isFinite(discount) || discount < 0) {
            errors.push("يجب أن يكون الخصم صفراً أو أكثر.");
        }

        if (!Number.isFinite(tax) || tax < 0) {
            errors.push("يجب أن تكون الضريبة صفراً أو أكثر.");
        }

        const lineTotal = (quantity * unitPrice) - discount + tax;

        if (Number.isFinite(lineTotal) && lineTotal < 0) {
            errors.push("لا يمكن أن يكون إجمالي السطر سالباً.");
        }

        if (errors.length > 0 || !product) {
            return {
                errors,
                input: null
            };
        }

        const line: InvoiceDraftLineInput = {
            id: this.editingInvoiceId
                ? this.invoiceService.getById(this.editingInvoiceId)
                    ?.lines[0]?.id
                : undefined,
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
                customerId: customer?.id ?? "",
                customerSnapshot: this.buildCustomerSnapshot(customer, manualCustomerName),
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
            this.setMessage("لم يتم العثور على مسودة الفاتورة.");
            return;
        }

        if (invoice.status !== "draft") {
            this.setMessage("يمكن تعديل الفواتير المسودة فقط.");
            return;
        }

        this.editingInvoiceId = invoice.id;
        this.editingInvoiceRevision = invoice.revision ?? 0;
        this.setEditingInvoiceId(invoice.id);

        if (this.customerSelect) {
            this.customerSelect.value = invoice.customerId ?? "";
        }

        if (this.customerNameInput) {
            this.customerNameInput.value = invoice.customerId
                ? ""
                : this.customerDisplayName(invoice);
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
        this.setMessage("جارٍ تعديل مسودة الفاتورة.");

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
        this.setMessage("تم إصدار الفاتورة.");

    }

    private deleteDraft(invoiceId: string): void {

        if (!confirm("هل تريد حذف هذه المسودة نهائياً؟")) {
            this.setMessage("تم إلغاء حذف المسودة.");
            return;
        }

        const result = this.invoiceService.deleteDraft(invoiceId);

        if (!result.success) {
            this.setMessage(result.errors.join(" "));
            this.renderDrafts();
            return;
        }

        if (this.editingInvoiceId === invoiceId) {
            this.resetForm();
        }

        this.renderDrafts();
        this.setMessage("تم حذف مسودة الفاتورة.");

    }

    private cancelInvoice(invoiceId: string): void {

        if (!confirm("هل تريد إلغاء هذه الفاتورة المُصدرة وعكس حركة المخزون؟")) {
            this.setMessage("تم إلغاء عملية إلغاء الفاتورة.");
            return;
        }

        const result = this.invoiceService.markCancelled(
            invoiceId,
            "تأكيد المستخدم إلغاء الفاتورة"
        );

        if (!result.success || !result.invoice) {
            this.setMessage(result.errors.join(" "));
            this.renderDrafts();
            return;
        }

        this.resetForm();
        this.renderDrafts();
        this.setMessage("تم إلغاء الفاتورة وعكس حركة المخزون.");

    }

    private createReturnFromUi(invoiceId: string, invoiceLineId: string): void {

        const invoice = this.invoiceService.getById(invoiceId);
        const line = invoice?.lines.find(
            currentLine => currentLine.id === invoiceLineId
        );

        if (!invoice || !line) {
            this.setMessage("لم يتم العثور على سطر الفاتورة.");
            return;
        }

        if (invoice.status !== "issued") {
            this.setMessage("يمكن إرجاع الفواتير المُصدرة فقط.");
            return;
        }

        const returnQuantity = this.readReturnQuantity(invoiceLineId);

        if (!Number.isFinite(returnQuantity) || returnQuantity <= 0) {
            this.setMessage("يجب أن تكون كمية الإرجاع أكبر من صفر.");
            return;
        }

        const remainingReturnable =
            this.invoiceReturnService.getRemainingReturnableQuantity(
                invoice.id,
                line.id
            );

        if (returnQuantity > remainingReturnable) {
            this.setMessage(
                "كمية الإرجاع تتجاوز الكمية القابلة للإرجاع."
            );
            return;
        }

        const createResult = this.invoiceReturnService.createReturnRecord({
            invoiceId: invoice.id,
            reason: "إرجاع فاتورة من واجهة الفواتير",
            lines: [
                {
                    invoiceLineId: line.id,
                    returnQuantity
                }
            ]
        });

        if (!createResult.success || !createResult.invoiceReturn) {
            this.setMessage(createResult.errors.join(" "));
            this.renderDrafts();
            return;
        }

        const executeResult = this.invoiceReturnService.executeReturn(
            createResult.invoiceReturn.id
        );

        if (!executeResult.success || !executeResult.invoiceReturn) {
            this.setMessage(executeResult.errors.join(" "));
            this.renderDrafts();
            return;
        }

        const executedLine = executeResult.invoiceReturn.lines.find(
            currentLine => currentLine.invoiceLineId === line.id
        );

        this.renderDrafts();
        this.setMessage(
            `تم تنفيذ إرجاع الفاتورة. رقم الإرجاع ${executeResult.invoiceReturn.returnNumber}. حركة المخزون ${executedLine?.returnStockMovementId ?? ""}.`
        );

    }

    private resetForm(): void {

        this.form?.reset();

        if (this.discountInput) {
            this.discountInput.value = "0";
        }

        if (this.taxInput) {
            this.taxInput.value = "0";
        }

        if (this.customerSelect) {
            this.customerSelect.value = "";
        }

        this.editingInvoiceId = null;
        this.editingInvoiceRevision = 0;
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

    private selectedCustomer(): Customer | null {

        const customerId = this.customerSelect?.value.trim() ?? "";

        if (!customerId) {
            return null;
        }

        return this.customerService.find(customerId) ?? null;

    }

    private buildCustomerSnapshot(
        customer: Customer | null,
        manualCustomerName: string
    ): Record<string, unknown> | null {

        if (!customer) {
            return manualCustomerName
                ? { displayName: manualCustomerName }
                : null;
        }

        const snapshot: Record<string, unknown> = {
            displayName: customer.displayName
        };

        if (customer.phone) {
            snapshot.phone = customer.phone;
        }

        if (customer.secondaryPhone) {
            snapshot.secondaryPhone = customer.secondaryPhone;
        }

        if (customer.email) {
            snapshot.email = customer.email;
        }

        if (customer.address) {
            snapshot.address = customer.address;
        }

        return snapshot;

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

    private remainingReturnableQuantity(
        invoice: Invoice,
        line: Invoice["lines"][number]
    ): number {

        if (invoice.status !== "issued") {
            return 0;
        }

        return this.invoiceReturnService.getRemainingReturnableQuantity(
            invoice.id,
            line.id
        );

    }

    private readReturnQuantity(invoiceLineId: string): number {

        const inputs = Array.from(
            this.draftsBody?.querySelectorAll<HTMLInputElement>(
                ".invoice-return-quantity-input"
            )
            ?? []
        );
        const input = inputs.find(
            currentInput => currentInput.dataset.invoiceLineId === invoiceLineId
        );
        const value = input?.value.trim() ?? "";

        return value
            ? Number(value)
            : Number.NaN;

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

        return "بدون عميل";

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

    private formatInvoiceStatus(value: string): string {
        if (value === "draft") {
            return "مسودة";
        }

        if (value === "issued") {
            return "مُصدرة";
        }

        if (value === "cancelled") {
            return "ملغاة";
        }

        return value;
    }

    private formatInvoiceReturnStatus(value: string): string {
        if (value === "recorded") {
            return "مسجل";
        }

        if (value === "executed") {
            return "منفذ";
        }

        if (value === "voided") {
            return "ملغى";
        }

        return value;
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
