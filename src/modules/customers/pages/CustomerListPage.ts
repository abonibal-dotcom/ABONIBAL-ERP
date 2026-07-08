import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import type { Customer, CustomerDraftInput, CustomerStatus, CustomerUpdateInput } from "../Customer";
import type { CustomerService } from "../services/CustomerService";

export class CustomerListPage extends Page {

    private customerService: CustomerService;
    private editingCustomerId: string | null = null;
    private formElement: HTMLFormElement | null = null;
    private messageElement: HTMLElement | null = null;
    private customersBody: HTMLElement | null = null;
    private displayNameInput: HTMLInputElement | null = null;
    private phoneInput: HTMLInputElement | null = null;
    private secondaryPhoneInput: HTMLInputElement | null = null;
    private emailInput: HTMLInputElement | null = null;
    private addressInput: HTMLInputElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private statusInput: HTMLSelectElement | null = null;
    private submitButton: HTMLButtonElement | null = null;
    private resetButton: HTMLButtonElement | null = null;

    constructor() {

        super();

        this.customerService = Container.get<CustomerService>("customerService");

    }

    public title(): string {

        return "العملاء";

    }

    public render(): string {

        return `
            <div class="customers-page">

                <div class="page-header">
                    <h1>👥 العملاء</h1>
                </div>

                <section class="customer-form-card">
                    <h2 id="customer-form-title">إضافة عميل</h2>

                    <form id="customer-form">
                        <div class="form-grid">

                            <label>
                                اسم العميل
                                <input id="customer-display-name" type="text" required>
                            </label>

                            <label>
                                الهاتف
                                <input id="customer-phone" type="text">
                            </label>

                            <label>
                                هاتف إضافي
                                <input id="customer-secondary-phone" type="text">
                            </label>

                            <label>
                                البريد الإلكتروني
                                <input id="customer-email" type="email">
                            </label>

                            <label>
                                العنوان
                                <input id="customer-address" type="text">
                            </label>

                            <label>
                                الحالة
                                <select id="customer-status">
                                    <option value="active">نشط</option>
                                    <option value="inactive">غير نشط</option>
                                </select>
                            </label>

                            <label>
                                ملاحظات
                                <textarea id="customer-notes" rows="3"></textarea>
                            </label>

                        </div>

                        <div class="form-actions">
                            <button id="customer-submit" type="submit">حفظ العميل</button>
                            <button id="customer-reset" type="button">إلغاء</button>
                        </div>

                        <p id="customer-message" class="customer-message" role="status" aria-live="polite" hidden></p>
                    </form>
                </section>

                <section class="customer-list-card">
                    <h2>قائمة العملاء</h2>

                    <table>
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>الهاتف</th>
                                <th>البريد</th>
                                <th>الحالة</th>
                                <th>آخر تعديل</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>

                        <tbody id="customers-body">
                            <tr>
                                <td colspan="6">لا يوجد عملاء حتى الآن.</td>
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
        this.renderCustomersIntoTable();

    }

    public override onLeave(): void {

        this.formElement = null;
        this.messageElement = null;
        this.customersBody = null;
        this.displayNameInput = null;
        this.phoneInput = null;
        this.secondaryPhoneInput = null;
        this.emailInput = null;
        this.addressInput = null;
        this.notesInput = null;
        this.statusInput = null;
        this.submitButton = null;
        this.resetButton = null;
        this.editingCustomerId = null;

    }

    private bindElements(): void {

        this.formElement = document.getElementById("customer-form") as HTMLFormElement | null;
        this.messageElement = document.getElementById("customer-message");
        this.customersBody = document.getElementById("customers-body");
        this.displayNameInput = document.getElementById("customer-display-name") as HTMLInputElement | null;
        this.phoneInput = document.getElementById("customer-phone") as HTMLInputElement | null;
        this.secondaryPhoneInput = document.getElementById("customer-secondary-phone") as HTMLInputElement | null;
        this.emailInput = document.getElementById("customer-email") as HTMLInputElement | null;
        this.addressInput = document.getElementById("customer-address") as HTMLInputElement | null;
        this.notesInput = document.getElementById("customer-notes") as HTMLTextAreaElement | null;
        this.statusInput = document.getElementById("customer-status") as HTMLSelectElement | null;
        this.submitButton = document.getElementById("customer-submit") as HTMLButtonElement | null;
        this.resetButton = document.getElementById("customer-reset") as HTMLButtonElement | null;

    }

    private bindEvents(): void {

        this.formElement?.addEventListener("submit", this.handleSubmit);
        this.resetButton?.addEventListener("click", this.handleReset);
        this.customersBody?.addEventListener("click", this.handleTableClick);

    }

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        if (this.editingCustomerId) {
            this.updateCustomer(this.editingCustomerId);
            return;
        }

        this.createCustomer();

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
            "[data-action=\"edit-customer\"]"
        );

        const deleteButton = target.closest<HTMLButtonElement>(
            "[data-action=\"safe-delete-customer\"]"
        );

        const customerId = editButton?.dataset.customerId
            ?? deleteButton?.dataset.customerId;

        if (!customerId) {
            return;
        }

        if (editButton) {
            this.openEditCustomer(customerId);
            return;
        }

        if (deleteButton) {
            this.safeDeleteCustomer(customerId);
        }

    };

    private createCustomer(): void {

        const result = this.customerService.create(
            this.readDraftInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تمت إضافة العميل بنجاح.", "success");
        this.renderCustomersIntoTable();

    }

    private updateCustomer(customerId: string): void {

        const result = this.customerService.update(
            customerId,
            this.readUpdateInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم تعديل العميل بنجاح.", "success");
        this.renderCustomersIntoTable();

    }

    private safeDeleteCustomer(customerId: string): void {

        const confirmed = window.confirm("هل تريد حذف هذا العميل؟");

        if (!confirmed) {
            return;
        }

        const errors = this.customerService.safeDelete(customerId);

        if (errors.length > 0) {
            this.setMessage(errors.join(" "), "error");
            return;
        }

        if (this.editingCustomerId === customerId) {
            this.clearForm();
        }

        this.setMessage("تم حذف العميل بأمان.", "success");
        this.renderCustomersIntoTable();

    }

    private openEditCustomer(customerId: string): void {

        const customer = this.customerService.find(customerId);

        if (!customer) {
            this.setMessage("العميل غير موجود.", "error");
            return;
        }

        this.editingCustomerId = customer.id;

        if (this.displayNameInput) {
            this.displayNameInput.value = customer.displayName;
        }

        if (this.phoneInput) {
            this.phoneInput.value = customer.phone ?? "";
        }

        if (this.secondaryPhoneInput) {
            this.secondaryPhoneInput.value = customer.secondaryPhone ?? "";
        }

        if (this.emailInput) {
            this.emailInput.value = customer.email ?? "";
        }

        if (this.addressInput) {
            this.addressInput.value = customer.address ?? "";
        }

        if (this.notesInput) {
            this.notesInput.value = customer.notes ?? "";
        }

        if (this.statusInput) {
            this.statusInput.value = customer.status;
        }

        if (this.submitButton) {
            this.submitButton.textContent = "تعديل العميل";
        }

        this.setMessage("وضع تعديل العميل مفعل.");

    }

    private renderCustomersIntoTable(): void {

        if (!this.customersBody) {
            return;
        }

        const customers = this.customerService.getAll();

        if (customers.length === 0) {
            this.customersBody.innerHTML = `
                <tr>
                    <td colspan="6">لا يوجد عملاء حتى الآن.</td>
                </tr>
            `;
            return;
        }

        this.customersBody.innerHTML = customers
            .map(customer => this.renderCustomerRow(customer))
            .join("");

    }

    private renderCustomerRow(customer: Customer): string {

        return `
            <tr>
                <td>${this.escapeHtml(customer.displayName)}</td>
                <td>${this.escapeHtml(customer.phone ?? "-")}</td>
                <td>${this.escapeHtml(customer.email ?? "-")}</td>
                <td>${this.renderStatus(customer.status)}</td>
                <td>${this.escapeHtml(this.formatDate(customer.updatedAt))}</td>
                <td>
                    <button type="button" data-action="edit-customer" data-customer-id="${this.escapeHtml(customer.id)}">
                        تعديل
                    </button>
                    <button type="button" data-action="safe-delete-customer" data-customer-id="${this.escapeHtml(customer.id)}">
                        حذف
                    </button>
                </td>
            </tr>
        `;

    }

    private readDraftInput(): CustomerDraftInput {

        return {
            displayName: this.displayNameInput?.value ?? "",
            phone: this.phoneInput?.value,
            secondaryPhone: this.secondaryPhoneInput?.value,
            email: this.emailInput?.value,
            address: this.addressInput?.value,
            notes: this.notesInput?.value,
            status: this.readStatus()
        };

    }

    private readUpdateInput(): CustomerUpdateInput {

        return {
            displayName: this.displayNameInput?.value ?? "",
            phone: this.phoneInput?.value,
            secondaryPhone: this.secondaryPhoneInput?.value,
            email: this.emailInput?.value,
            address: this.addressInput?.value,
            notes: this.notesInput?.value,
            status: this.readStatus()
        };

    }

    private readStatus(): CustomerStatus {

        return this.statusInput?.value === "inactive"
            ? "inactive"
            : "active";

    }

    private clearForm(): void {

        this.editingCustomerId = null;
        this.formElement?.reset();

        if (this.statusInput) {
            this.statusInput.value = "active";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "حفظ العميل";
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

    private renderStatus(status: CustomerStatus): string {

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
