import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import type { Payment, PaymentDraftInput, PaymentUpdateInput } from "../Payment";
import type { PaymentDirection } from "../PaymentDirection";
import type { PaymentMethod } from "../PaymentMethod";
import type { PaymentPartyType } from "../PaymentPartyType";
import type { PaymentStatus } from "../PaymentStatus";
import type { PaymentService } from "../services/PaymentService";

export class PaymentListPage extends Page {

    private paymentService: PaymentService;
    private editingPaymentId: string | null = null;
    private formElement: HTMLFormElement | null = null;
    private messageElement: HTMLElement | null = null;
    private paymentsBody: HTMLElement | null = null;
    private directionInput: HTMLSelectElement | null = null;
    private partyTypeInput: HTMLSelectElement | null = null;
    private partyNameInput: HTMLInputElement | null = null;
    private amountInput: HTMLInputElement | null = null;
    private methodInput: HTMLSelectElement | null = null;
    private referenceNumberInput: HTMLInputElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private submitButton: HTMLButtonElement | null = null;
    private resetButton: HTMLButtonElement | null = null;

    public constructor() {

        super();

        this.paymentService = Container.get<PaymentService>("paymentService");

    }

    public title(): string {

        return "الدفعات";

    }

    public render(): string {

        return `
            <div class="payments-page">

                <div class="page-header">
                    <h1>الدفعات</h1>
                </div>

                <section class="payment-form-card">
                    <h2 id="payment-form-title">دفعة جديدة</h2>

                    <form id="payment-form">
                        <div class="form-grid">

                            <label>
                                الاتجاه
                                <select id="payment-direction">
                                    <option value="in">قبض</option>
                                    <option value="out">دفع</option>
                                </select>
                            </label>

                            <label>
                                نوع الطرف
                                <select id="payment-party-type">
                                    <option value="customer">عميل</option>
                                    <option value="supplier">مورد</option>
                                    <option value="other">آخر</option>
                                </select>
                            </label>

                            <label>
                                اسم الطرف
                                <input id="payment-party-name" type="text">
                            </label>

                            <label>
                                المبلغ
                                <input id="payment-amount" type="number" min="0" step="0.01" required>
                            </label>

                            <label>
                                طريقة الدفع
                                <select id="payment-method">
                                    <option value="cash">نقداً</option>
                                    <option value="bank_transfer">تحويل بنكي</option>
                                    <option value="card">بطاقة</option>
                                    <option value="other">أخرى</option>
                                </select>
                            </label>

                            <label>
                                رقم المرجع
                                <input id="payment-reference-number" type="text">
                            </label>

                            <label>
                                ملاحظات
                                <textarea id="payment-notes" rows="3"></textarea>
                            </label>

                        </div>

                        <div class="form-actions">
                            <button id="payment-submit" type="submit">حفظ المسودة</button>
                            <button id="payment-reset" type="button">إلغاء</button>
                        </div>

                        <p id="payment-message" class="payment-message" role="status" aria-live="polite" hidden></p>
                    </form>
                </section>

                <section class="payment-list-card">
                    <h2>قائمة الدفعات</h2>

                    <table>
                        <thead>
                            <tr>
                                <th>رقم الدفعة</th>
                                <th>الاتجاه</th>
                                <th>نوع الطرف</th>
                                <th>اسم الطرف</th>
                                <th>المبلغ</th>
                                <th>طريقة الدفع</th>
                                <th>الحالة</th>
                                <th>آخر تعديل</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>

                        <tbody id="payments-body">
                            <tr>
                                <td colspan="9">لا توجد دفعات حتى الآن.</td>
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
        this.renderPaymentsIntoTable();

    }

    public override onLeave(): void {

        this.formElement = null;
        this.messageElement = null;
        this.paymentsBody = null;
        this.directionInput = null;
        this.partyTypeInput = null;
        this.partyNameInput = null;
        this.amountInput = null;
        this.methodInput = null;
        this.referenceNumberInput = null;
        this.notesInput = null;
        this.submitButton = null;
        this.resetButton = null;
        this.editingPaymentId = null;

    }

    private bindElements(): void {

        this.formElement = document.getElementById("payment-form") as HTMLFormElement | null;
        this.messageElement = document.getElementById("payment-message");
        this.paymentsBody = document.getElementById("payments-body");
        this.directionInput = document.getElementById("payment-direction") as HTMLSelectElement | null;
        this.partyTypeInput = document.getElementById("payment-party-type") as HTMLSelectElement | null;
        this.partyNameInput = document.getElementById("payment-party-name") as HTMLInputElement | null;
        this.amountInput = document.getElementById("payment-amount") as HTMLInputElement | null;
        this.methodInput = document.getElementById("payment-method") as HTMLSelectElement | null;
        this.referenceNumberInput = document.getElementById("payment-reference-number") as HTMLInputElement | null;
        this.notesInput = document.getElementById("payment-notes") as HTMLTextAreaElement | null;
        this.submitButton = document.getElementById("payment-submit") as HTMLButtonElement | null;
        this.resetButton = document.getElementById("payment-reset") as HTMLButtonElement | null;

    }

    private bindEvents(): void {

        this.formElement?.addEventListener("submit", this.handleSubmit);
        this.resetButton?.addEventListener("click", this.handleReset);
        this.paymentsBody?.addEventListener("click", this.handleTableClick);

    }

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        if (this.editingPaymentId) {
            this.updatePaymentDraft(this.editingPaymentId);
            return;
        }

        this.createPaymentDraft();

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
            "[data-action=\"edit-payment\"]"
        );
        const postButton = target.closest<HTMLButtonElement>(
            "[data-action=\"post-payment\"]"
        );
        const voidButton = target.closest<HTMLButtonElement>(
            "[data-action=\"void-payment\"]"
        );
        const paymentId = editButton?.dataset.paymentId
            ?? postButton?.dataset.paymentId
            ?? voidButton?.dataset.paymentId;

        if (!paymentId) {
            return;
        }

        if (editButton) {
            this.openEditPayment(paymentId);
            return;
        }

        if (postButton) {
            this.postPayment(paymentId);
            return;
        }

        if (voidButton) {
            this.voidPayment(paymentId);
        }

    };

    private createPaymentDraft(): void {

        const result = this.paymentService.createDraft(
            this.readDraftInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم حفظ مسودة الدفعة بنجاح.", "success");
        this.renderPaymentsIntoTable();

    }

    private updatePaymentDraft(paymentId: string): void {

        const result = this.paymentService.updateDraft(
            paymentId,
            this.readUpdateInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم تعديل مسودة الدفعة بنجاح.", "success");
        this.renderPaymentsIntoTable();

    }

    private postPayment(paymentId: string): void {

        const result = this.paymentService.post(paymentId);

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        if (this.editingPaymentId === paymentId) {
            this.clearForm();
        }

        this.setMessage("تم ترحيل الدفعة بنجاح.", "success");
        this.renderPaymentsIntoTable();

    }

    private voidPayment(paymentId: string): void {

        const confirmed = window.confirm("هل تريد إلغاء هذه الدفعة؟");

        if (!confirmed) {
            return;
        }

        const result = this.paymentService.voidPayment(
            paymentId,
            "Payment voided from payments page"
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        if (this.editingPaymentId === paymentId) {
            this.clearForm();
        }

        this.setMessage("تم إلغاء الدفعة بنجاح.", "success");
        this.renderPaymentsIntoTable();

    }

    private openEditPayment(paymentId: string): void {

        const payment = this.paymentService.find(paymentId);

        if (!payment) {
            this.setMessage("الدفعة غير موجودة.", "error");
            return;
        }

        if (payment.status !== "draft") {
            this.setMessage("يمكن تعديل الدفعات المسودة فقط.", "error");
            return;
        }

        this.editingPaymentId = payment.id;

        if (this.directionInput) {
            this.directionInput.value = payment.direction;
        }

        if (this.partyTypeInput) {
            this.partyTypeInput.value = payment.partyType;
        }

        if (this.partyNameInput) {
            this.partyNameInput.value = readPartyDisplayName(payment);
        }

        if (this.amountInput) {
            this.amountInput.value = String(payment.amount);
        }

        if (this.methodInput) {
            this.methodInput.value = payment.method;
        }

        if (this.referenceNumberInput) {
            this.referenceNumberInput.value = payment.referenceNumber ?? "";
        }

        if (this.notesInput) {
            this.notesInput.value = payment.notes ?? "";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "تعديل";
        }

        this.setMessage("وضع تعديل الدفعة مفعل.");

    }

    private renderPaymentsIntoTable(): void {

        if (!this.paymentsBody) {
            return;
        }

        const payments = this.paymentService.getAll();

        if (payments.length === 0) {
            this.paymentsBody.innerHTML = `
                <tr>
                    <td colspan="9">لا توجد دفعات حتى الآن.</td>
                </tr>
            `;
            return;
        }

        this.paymentsBody.innerHTML = payments
            .map(payment => this.renderPaymentRow(payment))
            .join("");

    }

    private renderPaymentRow(payment: Payment): string {

        return `
            <tr data-payment-id="${this.escapeHtml(payment.id)}" data-payment-status="${this.escapeHtml(payment.status)}">
                <td>${this.escapeHtml(payment.paymentNumber)}</td>
                <td>${this.renderDirection(payment.direction)}</td>
                <td>${this.renderPartyType(payment.partyType)}</td>
                <td>${this.escapeHtml(readPartyDisplayName(payment) || "-")}</td>
                <td>${this.escapeHtml(formatAmount(payment.amount))}</td>
                <td>${this.renderMethod(payment.method)}</td>
                <td>${this.renderStatus(payment.status)}</td>
                <td>${this.escapeHtml(this.formatDate(payment.updatedAt))}</td>
                <td>${this.renderActions(payment)}</td>
            </tr>
        `;

    }

    private renderActions(payment: Payment): string {

        const escapedPaymentId = this.escapeHtml(payment.id);
        const actions: string[] = [];

        if (payment.status === "draft") {
            actions.push(`
                <button type="button" data-action="edit-payment" data-payment-id="${escapedPaymentId}">
                    تعديل
                </button>
            `);
            actions.push(`
                <button type="button" data-action="post-payment" data-payment-id="${escapedPaymentId}">
                    ترحيل
                </button>
            `);
        }

        if (payment.status !== "voided") {
            actions.push(`
                <button type="button" data-action="void-payment" data-payment-id="${escapedPaymentId}">
                    إلغاء
                </button>
            `);
        }

        return actions.join("") || "-";

    }

    private readDraftInput(): PaymentDraftInput {

        return {
            direction: this.readDirection(),
            partyType: this.readPartyType(),
            partySnapshot: this.readPartySnapshot(),
            amount: this.readAmount(),
            method: this.readMethod(),
            referenceNumber: this.referenceNumberInput?.value,
            notes: this.notesInput?.value
        };

    }

    private readUpdateInput(): PaymentUpdateInput {

        return {
            direction: this.readDirection(),
            partyType: this.readPartyType(),
            partySnapshot: this.readPartySnapshot(),
            amount: this.readAmount(),
            method: this.readMethod(),
            referenceNumber: this.referenceNumberInput?.value,
            notes: this.notesInput?.value
        };

    }

    private readDirection(): PaymentDirection {

        return this.directionInput?.value === "out"
            ? "out"
            : "in";

    }

    private readPartyType(): PaymentPartyType {

        if (this.partyTypeInput?.value === "supplier") {
            return "supplier";
        }

        if (this.partyTypeInput?.value === "other") {
            return "other";
        }

        return "customer";

    }

    private readMethod(): PaymentMethod {

        if (this.methodInput?.value === "bank_transfer") {
            return "bank_transfer";
        }

        if (this.methodInput?.value === "card") {
            return "card";
        }

        if (this.methodInput?.value === "other") {
            return "other";
        }

        return "cash";

    }

    private readAmount(): number {

        return Number(this.amountInput?.value ?? 0);

    }

    private readPartySnapshot(): Record<string, unknown> | null {

        const displayName = this.partyNameInput?.value.trim() ?? "";

        return displayName
            ? { displayName }
            : null;

    }

    private clearForm(): void {

        this.editingPaymentId = null;
        this.formElement?.reset();

        if (this.directionInput) {
            this.directionInput.value = "in";
        }

        if (this.partyTypeInput) {
            this.partyTypeInput.value = "customer";
        }

        if (this.methodInput) {
            this.methodInput.value = "cash";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "حفظ المسودة";
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

    private renderDirection(direction: PaymentDirection): string {

        return direction === "in"
            ? "قبض"
            : "دفع";

    }

    private renderPartyType(partyType: PaymentPartyType): string {

        if (partyType === "supplier") {
            return "مورد";
        }

        if (partyType === "other") {
            return "آخر";
        }

        return "عميل";

    }

    private renderMethod(method: PaymentMethod): string {

        if (method === "bank_transfer") {
            return "تحويل بنكي";
        }

        if (method === "card") {
            return "بطاقة";
        }

        if (method === "other") {
            return "أخرى";
        }

        return "نقداً";

    }

    private renderStatus(status: PaymentStatus): string {

        if (status === "posted") {
            return "مرحلة";
        }

        if (status === "voided") {
            return "ملغاة";
        }

        return "مسودة";

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

function readPartyDisplayName(payment: Payment): string {

    const displayName = payment.partySnapshot?.displayName;

    return typeof displayName === "string"
        ? displayName
        : "";

}

function formatAmount(amount: number): string {

    return amount.toLocaleString("ar", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}
