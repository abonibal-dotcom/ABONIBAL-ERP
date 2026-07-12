import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import type { Supplier, SupplierDraftInput, SupplierStatus, SupplierUpdateInput } from "../Supplier";
import type { SupplierService } from "../services/SupplierService";

export class SupplierListPage extends Page {

    private supplierService: SupplierService;
    private editingSupplierId: string | null = null;
    private formElement: HTMLFormElement | null = null;
    private messageElement: HTMLElement | null = null;
    private suppliersBody: HTMLElement | null = null;
    private displayNameInput: HTMLInputElement | null = null;
    private companyNameInput: HTMLInputElement | null = null;
    private phoneInput: HTMLInputElement | null = null;
    private secondaryPhoneInput: HTMLInputElement | null = null;
    private emailInput: HTMLInputElement | null = null;
    private addressInput: HTMLInputElement | null = null;
    private taxNumberInput: HTMLInputElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private statusInput: HTMLSelectElement | null = null;
    private submitButton: HTMLButtonElement | null = null;
    private resetButton: HTMLButtonElement | null = null;

    public constructor() {

        super();

        this.supplierService = Container.get<SupplierService>("supplierService");

    }

    public title(): string {

        return "الموردون";

    }

    public render(): string {

        return `
            <div class="suppliers-page">

                <div class="page-header">
                    <h1>الموردون</h1>
                </div>

                <section class="supplier-form-card">
                    <h2 id="supplier-form-title">إضافة مورد</h2>

                    <form id="supplier-form">
                        <div class="form-grid">

                            <label>
                                اسم المورد
                                <input id="supplier-display-name" type="text" required>
                            </label>

                            <label>
                                اسم الشركة
                                <input id="supplier-company-name" type="text">
                            </label>

                            <label>
                                الهاتف
                                <input id="supplier-phone" type="text">
                            </label>

                            <label>
                                هاتف إضافي
                                <input id="supplier-secondary-phone" type="text">
                            </label>

                            <label>
                                البريد الإلكتروني
                                <input id="supplier-email" type="email">
                            </label>

                            <label>
                                العنوان
                                <input id="supplier-address" type="text">
                            </label>

                            <label>
                                الرقم الضريبي
                                <input id="supplier-tax-number" type="text">
                            </label>

                            <label>
                                الحالة
                                <select id="supplier-status">
                                    <option value="active">نشط</option>
                                    <option value="inactive">غير نشط</option>
                                </select>
                            </label>

                            <label>
                                ملاحظات
                                <textarea id="supplier-notes" rows="3"></textarea>
                            </label>

                        </div>

                        <div class="form-actions">
                            <button id="supplier-submit" type="submit">حفظ المورد</button>
                            <button id="supplier-reset" type="button">إلغاء</button>
                        </div>

                        <p id="supplier-message" class="supplier-message" role="status" aria-live="polite" hidden></p>
                    </form>
                </section>

                <section class="supplier-list-card">
                    <h2>قائمة الموردين</h2>

                    <table>
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>الشركة</th>
                                <th>الهاتف</th>
                                <th>البريد</th>
                                <th>الحالة</th>
                                <th>آخر تعديل</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>

                        <tbody id="suppliers-body">
                            <tr>
                                <td colspan="7">لا يوجد موردون حتى الآن.</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

            </div>
        `;

    }

    public override onEnter(): void {

        this.bindElements();
        this.bindEvents();
        this.renderSuppliersIntoTable();

    }

    public override onLeave(): void {

        this.formElement = null;
        this.messageElement = null;
        this.suppliersBody = null;
        this.displayNameInput = null;
        this.companyNameInput = null;
        this.phoneInput = null;
        this.secondaryPhoneInput = null;
        this.emailInput = null;
        this.addressInput = null;
        this.taxNumberInput = null;
        this.notesInput = null;
        this.statusInput = null;
        this.submitButton = null;
        this.resetButton = null;
        this.editingSupplierId = null;

    }

    private bindElements(): void {

        this.formElement = document.getElementById("supplier-form") as HTMLFormElement | null;
        this.messageElement = document.getElementById("supplier-message");
        this.suppliersBody = document.getElementById("suppliers-body");
        this.displayNameInput = document.getElementById("supplier-display-name") as HTMLInputElement | null;
        this.companyNameInput = document.getElementById("supplier-company-name") as HTMLInputElement | null;
        this.phoneInput = document.getElementById("supplier-phone") as HTMLInputElement | null;
        this.secondaryPhoneInput = document.getElementById("supplier-secondary-phone") as HTMLInputElement | null;
        this.emailInput = document.getElementById("supplier-email") as HTMLInputElement | null;
        this.addressInput = document.getElementById("supplier-address") as HTMLInputElement | null;
        this.taxNumberInput = document.getElementById("supplier-tax-number") as HTMLInputElement | null;
        this.notesInput = document.getElementById("supplier-notes") as HTMLTextAreaElement | null;
        this.statusInput = document.getElementById("supplier-status") as HTMLSelectElement | null;
        this.submitButton = document.getElementById("supplier-submit") as HTMLButtonElement | null;
        this.resetButton = document.getElementById("supplier-reset") as HTMLButtonElement | null;

    }

    private bindEvents(): void {

        this.formElement?.addEventListener("submit", this.handleSubmit);
        this.resetButton?.addEventListener("click", this.handleReset);
        this.suppliersBody?.addEventListener("click", this.handleTableClick);

    }

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        if (this.editingSupplierId) {
            this.updateSupplier(this.editingSupplierId);
            return;
        }

        this.createSupplier();

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

        const editButton = target.closest<HTMLButtonElement>(
            "[data-action=\"edit-supplier\"]"
        );

        const deleteButton = target.closest<HTMLButtonElement>(
            "[data-action=\"safe-delete-supplier\"]"
        );

        const supplierId = editButton?.dataset.supplierId
            ?? deleteButton?.dataset.supplierId;

        if (!supplierId) {
            return;
        }

        if (editButton) {
            this.openEditSupplier(supplierId);
            return;
        }

        if (deleteButton) {
            this.safeDeleteSupplier(supplierId);
        }

    };

    private createSupplier(): void {

        const result = this.supplierService.create(
            this.readDraftInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تمت إضافة المورد بنجاح.", "success");
        this.renderSuppliersIntoTable();

    }

    private updateSupplier(supplierId: string): void {

        const result = this.supplierService.update(
            supplierId,
            this.readUpdateInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم تعديل المورد بنجاح.", "success");
        this.renderSuppliersIntoTable();

    }

    private safeDeleteSupplier(supplierId: string): void {

        const confirmed = window.confirm("هل تريد حذف هذا المورد؟");

        if (!confirmed) {
            return;
        }

        const errors = this.supplierService.safeDelete(supplierId);

        if (errors.length > 0) {
            this.setMessage(errors.join(" "), "error");
            return;
        }

        if (this.editingSupplierId === supplierId) {
            this.clearForm();
        }

        this.setMessage("تم حذف المورد بأمان.", "success");
        this.renderSuppliersIntoTable();

    }

    private openEditSupplier(supplierId: string): void {

        const supplier = this.supplierService.find(supplierId);

        if (!supplier) {
            this.setMessage("المورد غير موجود.", "error");
            return;
        }

        this.editingSupplierId = supplier.id;

        if (this.displayNameInput) {
            this.displayNameInput.value = supplier.displayName;
        }

        if (this.companyNameInput) {
            this.companyNameInput.value = supplier.companyName ?? "";
        }

        if (this.phoneInput) {
            this.phoneInput.value = supplier.phone ?? "";
        }

        if (this.secondaryPhoneInput) {
            this.secondaryPhoneInput.value = supplier.secondaryPhone ?? "";
        }

        if (this.emailInput) {
            this.emailInput.value = supplier.email ?? "";
        }

        if (this.addressInput) {
            this.addressInput.value = supplier.address ?? "";
        }

        if (this.taxNumberInput) {
            this.taxNumberInput.value = supplier.taxNumber ?? "";
        }

        if (this.notesInput) {
            this.notesInput.value = supplier.notes ?? "";
        }

        if (this.statusInput) {
            this.statusInput.value = supplier.status;
        }

        if (this.submitButton) {
            this.submitButton.textContent = "تعديل المورد";
        }

        this.setMessage("وضع تعديل المورد مفعل.");

    }

    private renderSuppliersIntoTable(): void {

        if (!this.suppliersBody) {
            return;
        }

        const suppliers = this.supplierService.getAll();

        if (suppliers.length === 0) {
            this.suppliersBody.innerHTML = `
                <tr>
                    <td colspan="7">لا يوجد موردون حتى الآن.</td>
                </tr>
            `;
            return;
        }

        this.suppliersBody.innerHTML = suppliers
            .map(supplier => this.renderSupplierRow(supplier))
            .join("");

    }

    private renderSupplierRow(supplier: Supplier): string {

        return `
            <tr>
                <td>${this.escapeHtml(supplier.displayName)}</td>
                <td>${this.escapeHtml(supplier.companyName ?? "-")}</td>
                <td>${this.escapeHtml(supplier.phone ?? "-")}</td>
                <td>${this.escapeHtml(supplier.email ?? "-")}</td>
                <td>${this.renderStatus(supplier.status)}</td>
                <td>${this.escapeHtml(this.formatDate(supplier.updatedAt))}</td>
                <td>
                    <button type="button" data-action="edit-supplier" data-supplier-id="${this.escapeHtml(supplier.id)}">
                        تعديل
                    </button>
                    <button type="button" data-action="safe-delete-supplier" data-supplier-id="${this.escapeHtml(supplier.id)}">
                        حذف
                    </button>
                </td>
            </tr>
        `;

    }

    private readDraftInput(): SupplierDraftInput {

        return {
            displayName: this.displayNameInput?.value ?? "",
            companyName: this.companyNameInput?.value,
            phone: this.phoneInput?.value,
            secondaryPhone: this.secondaryPhoneInput?.value,
            email: this.emailInput?.value,
            address: this.addressInput?.value,
            taxNumber: this.taxNumberInput?.value,
            notes: this.notesInput?.value,
            status: this.readStatus()
        };

    }

    private readUpdateInput(): SupplierUpdateInput {

        return {
            displayName: this.displayNameInput?.value ?? "",
            companyName: this.companyNameInput?.value,
            phone: this.phoneInput?.value,
            secondaryPhone: this.secondaryPhoneInput?.value,
            email: this.emailInput?.value,
            address: this.addressInput?.value,
            taxNumber: this.taxNumberInput?.value,
            notes: this.notesInput?.value,
            status: this.readStatus()
        };

    }

    private readStatus(): SupplierStatus {

        return this.statusInput?.value === "inactive"
            ? "inactive"
            : "active";

    }

    private clearForm(): void {

        this.editingSupplierId = null;
        this.formElement?.reset();

        if (this.statusInput) {
            this.statusInput.value = "active";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "حفظ المورد";
        }

    }

    private setMessage(
        message: string,
        tone: "success" | "error" | "neutral" = "neutral"
    ): void {

        if (!this.messageElement) {
            return;
        }

        this.messageElement.textContent = message;
        this.messageElement.dataset.tone = tone;
        this.messageElement.hidden = !message;

    }

    private renderStatus(status: SupplierStatus): string {

        return status === "active"
            ? "نشط"
            : "غير نشط";

    }

    private formatDate(value: string): string {

        if (!value.trim()) {
            return "-";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString("ar");

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
