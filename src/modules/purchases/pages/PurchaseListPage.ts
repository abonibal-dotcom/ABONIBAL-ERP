import { Container } from "../../../core/Container";
import { Page } from "../../../framework/Page";
import type {
    Purchase,
    PurchaseDraftInput,
    PurchaseDraftLineInput,
    PurchaseDraftUpdateInput
} from "../Purchase";
import type { PurchaseStatus } from "../PurchaseStatus";
import type { PurchaseService } from "../services/PurchaseService";

export class PurchaseListPage extends Page {

    private readonly purchaseService: PurchaseService;
    private editingPurchaseId: string | null = null;
    private formElement: HTMLFormElement | null = null;
    private messageElement: HTMLElement | null = null;
    private purchasesBody: HTMLElement | null = null;
    private supplierNameInput: HTMLInputElement | null = null;
    private productNameInput: HTMLInputElement | null = null;
    private skuInput: HTMLInputElement | null = null;
    private barcodeInput: HTMLInputElement | null = null;
    private unitInput: HTMLInputElement | null = null;
    private quantityInput: HTMLInputElement | null = null;
    private unitCostInput: HTMLInputElement | null = null;
    private discountInput: HTMLInputElement | null = null;
    private taxInput: HTMLInputElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private submitButton: HTMLButtonElement | null = null;
    private resetButton: HTMLButtonElement | null = null;

    public constructor() {

        super();
        this.purchaseService = Container.get<PurchaseService>("purchaseService");

    }

    public title(): string {

        return "المشتريات";

    }

    public render(): string {

        return `
            <section id="purchases-page" class="purchases-page" data-editing-purchase-id="">
                <div class="page-header">
                    <h1>المشتريات</h1>
                </div>

                <section class="purchase-form-card">
                    <h2>شراء جديد</h2>
                    <form id="purchase-form">
                        <div class="form-grid">
                            <label>اسم المورد<input id="purchase-supplier-name" type="text"></label>
                            <label>اسم المنتج<input id="purchase-product-name" type="text" required></label>
                            <label>SKU<input id="purchase-sku" type="text"></label>
                            <label>الباركود<input id="purchase-barcode" type="text"></label>
                            <label>الوحدة<input id="purchase-unit" type="text"></label>
                            <label>الكمية<input id="purchase-quantity" type="number" min="0" step="0.01" required></label>
                            <label>تكلفة الوحدة<input id="purchase-unit-cost" type="number" min="0" step="0.01" required></label>
                            <label>الخصم<input id="purchase-discount" type="number" min="0" step="0.01" value="0"></label>
                            <label>الضريبة<input id="purchase-tax" type="number" min="0" step="0.01" value="0"></label>
                            <label>ملاحظات<textarea id="purchase-notes" rows="3"></textarea></label>
                        </div>

                        <div class="form-actions">
                            <button id="purchase-submit" type="submit">حفظ المسودة</button>
                            <button id="purchase-reset" type="button">إلغاء</button>
                        </div>

                        <p id="purchase-message" class="purchase-message" role="status" aria-live="polite" hidden></p>
                    </form>
                </section>

                <section class="purchase-list-card">
                    <h2>قائمة المشتريات</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>رقم الشراء</th><th>المورد</th><th>المنتج</th><th>الكمية</th>
                                <th>تكلفة الوحدة</th><th>الإجمالي</th><th>الحالة</th><th>آخر تعديل</th><th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="purchases-body">
                            <tr><td colspan="9">لا توجد مشتريات حتى الآن.</td></tr>
                        </tbody>
                    </table>
                </section>
            </section>
        `;

    }

    public override onEnter(): void {

        this.bindElements();
        this.bindEvents();
        this.renderPurchasesIntoTable();

    }

    public override onLeave(): void {

        this.formElement = null;
        this.messageElement = null;
        this.purchasesBody = null;
        this.supplierNameInput = null;
        this.productNameInput = null;
        this.skuInput = null;
        this.barcodeInput = null;
        this.unitInput = null;
        this.quantityInput = null;
        this.unitCostInput = null;
        this.discountInput = null;
        this.taxInput = null;
        this.notesInput = null;
        this.submitButton = null;
        this.resetButton = null;
        this.editingPurchaseId = null;

    }

    private bindElements(): void {

        this.formElement = document.getElementById("purchase-form") as HTMLFormElement | null;
        this.messageElement = document.getElementById("purchase-message");
        this.purchasesBody = document.getElementById("purchases-body");
        this.supplierNameInput = document.getElementById("purchase-supplier-name") as HTMLInputElement | null;
        this.productNameInput = document.getElementById("purchase-product-name") as HTMLInputElement | null;
        this.skuInput = document.getElementById("purchase-sku") as HTMLInputElement | null;
        this.barcodeInput = document.getElementById("purchase-barcode") as HTMLInputElement | null;
        this.unitInput = document.getElementById("purchase-unit") as HTMLInputElement | null;
        this.quantityInput = document.getElementById("purchase-quantity") as HTMLInputElement | null;
        this.unitCostInput = document.getElementById("purchase-unit-cost") as HTMLInputElement | null;
        this.discountInput = document.getElementById("purchase-discount") as HTMLInputElement | null;
        this.taxInput = document.getElementById("purchase-tax") as HTMLInputElement | null;
        this.notesInput = document.getElementById("purchase-notes") as HTMLTextAreaElement | null;
        this.submitButton = document.getElementById("purchase-submit") as HTMLButtonElement | null;
        this.resetButton = document.getElementById("purchase-reset") as HTMLButtonElement | null;

    }

    private bindEvents(): void {

        this.formElement?.addEventListener("submit", this.handleSubmit);
        this.resetButton?.addEventListener("click", this.handleReset);
        this.purchasesBody?.addEventListener("click", this.handleTableClick);

    }

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        if (this.editingPurchaseId) {
            this.updatePurchaseDraft(this.editingPurchaseId);
            return;
        }

        this.createPurchaseDraft();

    };

    private readonly handleReset = (): void => {

        this.clearForm();
        this.setMessage("");

    };

    private readonly handleTableClick = (event: Event): void => {

        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editButton = target.closest<HTMLButtonElement>("[data-action=\"edit-purchase\"]");
        const postButton = target.closest<HTMLButtonElement>("[data-action=\"post-purchase\"]");
        const cancelButton = target.closest<HTMLButtonElement>("[data-action=\"cancel-purchase\"]");
        const purchaseId = editButton?.dataset.purchaseId
            ?? postButton?.dataset.purchaseId
            ?? cancelButton?.dataset.purchaseId;

        if (!purchaseId) {
            return;
        }

        if (editButton) {
            this.openEditPurchase(purchaseId);
        } else if (postButton) {
            this.postPurchase(purchaseId);
        } else if (cancelButton) {
            this.cancelPurchase(purchaseId);
        }

    };

    private createPurchaseDraft(): void {

        const result = this.purchaseService.createDraft(this.readDraftInput());

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم حفظ مسودة الشراء بنجاح.", "success");
        this.renderPurchasesIntoTable();

    }

    private updatePurchaseDraft(purchaseId: string): void {

        const result = this.purchaseService.updateDraft(purchaseId, this.readUpdateInput());

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم تعديل مسودة الشراء بنجاح.", "success");
        this.renderPurchasesIntoTable();

    }

    private postPurchase(purchaseId: string): void {

        const result = this.purchaseService.post(purchaseId);

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        if (this.editingPurchaseId === purchaseId) {
            this.clearForm();
        }

        this.setMessage("تم ترحيل الشراء بنجاح.", "success");
        this.renderPurchasesIntoTable();

    }

    private cancelPurchase(purchaseId: string): void {

        if (!window.confirm("هل تريد إلغاء هذا الشراء؟")) {
            return;
        }

        const result = this.purchaseService.cancel(purchaseId, "Purchase cancelled from purchases page");

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        if (this.editingPurchaseId === purchaseId) {
            this.clearForm();
        }

        this.setMessage("تم إلغاء الشراء بنجاح.", "success");
        this.renderPurchasesIntoTable();

    }

    private openEditPurchase(purchaseId: string): void {

        const purchase = this.purchaseService.find(purchaseId);

        if (!purchase) {
            this.setMessage("عملية الشراء غير موجودة.", "error");
            return;
        }

        if (purchase.status !== "draft") {
            this.setMessage("يمكن تعديل المشتريات المسودة فقط.", "error");
            return;
        }

        const line = purchase.lines[0];

        if (!line) {
            this.setMessage("لا تحتوي عملية الشراء على بند صالح.", "error");
            return;
        }

        this.editingPurchaseId = purchase.id;
        this.setEditingPurchaseId(purchase.id);
        this.setInputValue(this.supplierNameInput, readSupplierDisplayName(purchase));
        this.setInputValue(this.productNameInput, line.productNameSnapshot);
        this.setInputValue(this.skuInput, line.skuSnapshot ?? "");
        this.setInputValue(this.barcodeInput, line.barcodeSnapshot ?? "");
        this.setInputValue(this.unitInput, line.unitSnapshot ?? "");
        this.setInputValue(this.quantityInput, String(line.quantity));
        this.setInputValue(this.unitCostInput, String(line.unitCost));
        this.setInputValue(this.discountInput, String(line.discount));
        this.setInputValue(this.taxInput, String(line.tax));

        if (this.notesInput) {
            this.notesInput.value = purchase.notes ?? "";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "تعديل";
        }

        this.setMessage("وضع تعديل مسودة الشراء مفعل.");

    }

    private renderPurchasesIntoTable(): void {

        if (!this.purchasesBody) {
            return;
        }

        const purchases = this.purchaseService.getAll();

        if (purchases.length === 0) {
            this.purchasesBody.innerHTML = `<tr><td colspan="9">لا توجد مشتريات حتى الآن.</td></tr>`;
            return;
        }

        this.purchasesBody.innerHTML = purchases.map(purchase => this.renderPurchaseRow(purchase)).join("");

    }

    private renderPurchaseRow(purchase: Purchase): string {

        const line = purchase.lines[0];

        return `
            <tr data-purchase-id="${this.escapeHtml(purchase.id)}" data-purchase-status="${purchase.status}">
                <td>${this.escapeHtml(purchase.purchaseNumber)}</td>
                <td>${this.escapeHtml(readSupplierDisplayName(purchase) || "-")}</td>
                <td>${this.escapeHtml(line?.productNameSnapshot ?? "-")}</td>
                <td>${this.escapeHtml(formatAmount(line?.quantity ?? 0))}</td>
                <td>${this.escapeHtml(formatAmount(line?.unitCost ?? 0))}</td>
                <td>${this.escapeHtml(formatAmount(purchase.total))}</td>
                <td>${this.renderStatus(purchase.status)}</td>
                <td>${this.escapeHtml(this.formatDate(purchase.updatedAt))}</td>
                <td>${this.renderActions(purchase)}</td>
            </tr>
        `;

    }

    private renderActions(purchase: Purchase): string {

        const purchaseId = this.escapeHtml(purchase.id);
        const actions: string[] = [];

        if (purchase.status === "draft") {
            actions.push(`<button type="button" data-action="edit-purchase" data-purchase-id="${purchaseId}">تعديل</button>`);
            actions.push(`<button type="button" data-action="post-purchase" data-purchase-id="${purchaseId}">ترحيل</button>`);
        }

        if (purchase.status !== "cancelled") {
            actions.push(`<button type="button" data-action="cancel-purchase" data-purchase-id="${purchaseId}">إلغاء</button>`);
        }

        return actions.join("") || "-";

    }

    private readDraftInput(): PurchaseDraftInput {

        return {
            supplierSnapshot: this.readSupplierSnapshot(),
            lines: [this.readLineInput()],
            notes: this.notesInput?.value
        };

    }

    private readUpdateInput(): PurchaseDraftUpdateInput {

        return {
            supplierSnapshot: this.readSupplierSnapshot(),
            lines: [this.readLineInput()],
            notes: this.notesInput?.value
        };

    }

    private readLineInput(): PurchaseDraftLineInput {

        return {
            productNameSnapshot: this.productNameInput?.value ?? "",
            skuSnapshot: this.skuInput?.value,
            barcodeSnapshot: this.barcodeInput?.value,
            unitSnapshot: this.unitInput?.value,
            quantity: Number(this.quantityInput?.value ?? 0),
            unitCost: Number(this.unitCostInput?.value ?? 0),
            discount: Number(this.discountInput?.value ?? 0),
            tax: Number(this.taxInput?.value ?? 0)
        };

    }

    private readSupplierSnapshot(): Record<string, unknown> | null {

        const displayName = this.supplierNameInput?.value.trim() ?? "";

        return displayName ? { displayName } : null;

    }

    private clearForm(): void {

        this.editingPurchaseId = null;
        this.setEditingPurchaseId("");
        this.formElement?.reset();
        this.setInputValue(this.discountInput, "0");
        this.setInputValue(this.taxInput, "0");

        if (this.submitButton) {
            this.submitButton.textContent = "حفظ المسودة";
        }

    }

    private setInputValue(input: HTMLInputElement | null, value: string): void {

        if (input) {
            input.value = value;
        }

    }

    private setEditingPurchaseId(purchaseId: string): void {

        const page = document.getElementById("purchases-page");

        if (page) {
            page.dataset.editingPurchaseId = purchaseId;
        }

    }

    private setMessage(message: string, tone: "success" | "error" | "neutral" = "neutral"): void {

        if (!this.messageElement) {
            return;
        }

        this.messageElement.textContent = message;
        this.messageElement.dataset.tone = tone;
        this.messageElement.hidden = !message;

    }

    private renderStatus(status: PurchaseStatus): string {

        if (status === "posted") {
            return "مرحلة";
        }

        if (status === "cancelled") {
            return "ملغاة";
        }

        return "مسودة";

    }

    private formatDate(value: string): string {

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar");

    }

    private escapeHtml(value: string): string {

        return value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }

}

function readSupplierDisplayName(purchase: Purchase): string {

    const displayName = purchase.supplierSnapshot?.displayName;

    return typeof displayName === "string" ? displayName : "";

}

function formatAmount(amount: number): string {

    return amount.toLocaleString("ar", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}
