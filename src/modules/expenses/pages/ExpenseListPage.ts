import { Container } from "../../../core/Container";
import { Page } from "../../../framework/Page";
import type {
    Expense,
    ExpenseDraftInput,
    ExpenseDraftUpdateInput
} from "../Expense";
import type { ExpensePayeeType } from "../ExpensePayeeType";
import type { ExpensePaymentMethod } from "../ExpensePaymentMethod";
import type { ExpenseStatus } from "../ExpenseStatus";
import type { ExpenseService } from "../services/ExpenseService";

export class ExpenseListPage extends Page {

    private readonly expenseService: ExpenseService;
    private editingExpenseId: string | null = null;
    private formElement: HTMLFormElement | null = null;
    private messageElement: HTMLElement | null = null;
    private expensesBody: HTMLElement | null = null;
    private categoryInput: HTMLInputElement | null = null;
    private payeeTypeInput: HTMLSelectElement | null = null;
    private payeeNameInput: HTMLInputElement | null = null;
    private amountInput: HTMLInputElement | null = null;
    private dateInput: HTMLInputElement | null = null;
    private paymentMethodInput: HTMLSelectElement | null = null;
    private referenceInput: HTMLInputElement | null = null;
    private notesInput: HTMLTextAreaElement | null = null;
    private submitButton: HTMLButtonElement | null = null;
    private resetButton: HTMLButtonElement | null = null;

    public constructor() {

        super();
        this.expenseService = Container.get<ExpenseService>("expenseService");

    }

    public title(): string {

        return "المصروفات";

    }

    public render(): string {

        return `
            <section id="expenses-page" class="expenses-page" data-editing-expense-id="">
                <div class="page-header">
                    <h1>المصروفات</h1>
                </div>

                <section class="expense-form-card">
                    <h2>مصروف جديد</h2>
                    <form id="expense-form">
                        <div class="form-grid">
                            <label>
                                التصنيف
                                <input id="expense-category" type="text" required>
                            </label>

                            <label>
                                نوع المستفيد
                                <select id="expense-payee-type">
                                    <option value="supplier">مورد</option>
                                    <option value="customer">عميل</option>
                                    <option value="employee">موظف</option>
                                    <option value="other" selected>آخر</option>
                                </select>
                            </label>

                            <label>
                                اسم المستفيد
                                <input id="expense-payee-name" type="text">
                            </label>

                            <label>
                                المبلغ
                                <input id="expense-amount" type="number" min="0" step="0.01" required>
                            </label>

                            <label>
                                تاريخ المصروف
                                <input id="expense-date" type="date" required>
                            </label>

                            <label>
                                طريقة الدفع
                                <select id="expense-payment-method">
                                    <option value="cash">نقداً</option>
                                    <option value="bank_transfer">تحويل بنكي</option>
                                    <option value="card">بطاقة</option>
                                    <option value="other">أخرى</option>
                                </select>
                            </label>

                            <label>
                                رقم المرجع
                                <input id="expense-reference" type="text">
                            </label>

                            <label>
                                ملاحظات
                                <textarea id="expense-notes" rows="3"></textarea>
                            </label>
                        </div>

                        <div class="form-actions">
                            <button id="expense-submit" type="submit">حفظ المسودة</button>
                            <button id="expense-reset" type="button">إلغاء</button>
                        </div>

                        <p id="expense-message" class="expense-message" role="status" aria-live="polite" hidden></p>
                    </form>
                </section>

                <section class="expense-list-card">
                    <h2>قائمة المصروفات</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>رقم المصروف</th>
                                <th>التاريخ</th>
                                <th>التصنيف</th>
                                <th>المستفيد</th>
                                <th>المبلغ</th>
                                <th>طريقة الدفع</th>
                                <th>الحالة</th>
                                <th>آخر تعديل</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="expenses-body">
                            <tr><td colspan="9">لا توجد مصروفات حتى الآن.</td></tr>
                        </tbody>
                    </table>
                </section>
            </section>
        `;

    }

    public override onEnter(): void {

        this.bindElements();
        this.bindEvents();
        this.setDefaultDate();
        this.renderExpensesIntoTable();

    }

    public override onLeave(): void {

        this.formElement = null;
        this.messageElement = null;
        this.expensesBody = null;
        this.categoryInput = null;
        this.payeeTypeInput = null;
        this.payeeNameInput = null;
        this.amountInput = null;
        this.dateInput = null;
        this.paymentMethodInput = null;
        this.referenceInput = null;
        this.notesInput = null;
        this.submitButton = null;
        this.resetButton = null;
        this.editingExpenseId = null;

    }

    private bindElements(): void {

        this.formElement = document.getElementById("expense-form") as HTMLFormElement | null;
        this.messageElement = document.getElementById("expense-message");
        this.expensesBody = document.getElementById("expenses-body");
        this.categoryInput = document.getElementById("expense-category") as HTMLInputElement | null;
        this.payeeTypeInput = document.getElementById("expense-payee-type") as HTMLSelectElement | null;
        this.payeeNameInput = document.getElementById("expense-payee-name") as HTMLInputElement | null;
        this.amountInput = document.getElementById("expense-amount") as HTMLInputElement | null;
        this.dateInput = document.getElementById("expense-date") as HTMLInputElement | null;
        this.paymentMethodInput = document.getElementById("expense-payment-method") as HTMLSelectElement | null;
        this.referenceInput = document.getElementById("expense-reference") as HTMLInputElement | null;
        this.notesInput = document.getElementById("expense-notes") as HTMLTextAreaElement | null;
        this.submitButton = document.getElementById("expense-submit") as HTMLButtonElement | null;
        this.resetButton = document.getElementById("expense-reset") as HTMLButtonElement | null;

    }

    private bindEvents(): void {

        this.formElement?.addEventListener("submit", this.handleSubmit);
        this.resetButton?.addEventListener("click", this.handleReset);
        this.expensesBody?.addEventListener("click", this.handleTableClick);

    }

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        if (this.editingExpenseId) {
            this.updateExpenseDraft(this.editingExpenseId);
            return;
        }

        this.createExpenseDraft();

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

        const editButton = target.closest<HTMLButtonElement>("[data-action=\"edit-expense\"]");
        const postButton = target.closest<HTMLButtonElement>("[data-action=\"post-expense\"]");
        const voidButton = target.closest<HTMLButtonElement>("[data-action=\"void-expense\"]");
        const expenseId = editButton?.dataset.expenseId
            ?? postButton?.dataset.expenseId
            ?? voidButton?.dataset.expenseId;

        if (!expenseId) {
            return;
        }

        if (editButton) {
            this.openEditExpense(expenseId);
        } else if (postButton) {
            this.postExpense(expenseId);
        } else if (voidButton) {
            this.voidExpense(expenseId);
        }

    };

    private createExpenseDraft(): void {

        const result = this.expenseService.createDraft(this.readDraftInput());

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم حفظ مسودة المصروف بنجاح.", "success");
        this.renderExpensesIntoTable();

    }

    private updateExpenseDraft(expenseId: string): void {

        const result = this.expenseService.updateDraft(
            expenseId,
            this.readUpdateInput()
        );

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        this.clearForm();
        this.setMessage("تم تعديل مسودة المصروف بنجاح.", "success");
        this.renderExpensesIntoTable();

    }

    private postExpense(expenseId: string): void {

        const result = this.expenseService.post(expenseId);

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        if (this.editingExpenseId === expenseId) {
            this.clearForm();
        }

        this.setMessage("تم ترحيل المصروف بنجاح.", "success");
        this.renderExpensesIntoTable();

    }

    private voidExpense(expenseId: string): void {

        const reason = window.prompt("أدخل سبب إلغاء المصروف:");

        if (reason === null) {
            return;
        }

        if (!reason.trim()) {
            this.setMessage("سبب إلغاء المصروف مطلوب.", "error");
            return;
        }

        const result = this.expenseService.voidExpense(expenseId, reason);

        if (!result.success) {
            this.setMessage(result.errors.join(" "), "error");
            return;
        }

        if (this.editingExpenseId === expenseId) {
            this.clearForm();
        }

        this.setMessage("تم إلغاء المصروف مع الاحتفاظ بالسجل.", "success");
        this.renderExpensesIntoTable();

    }

    private openEditExpense(expenseId: string): void {

        const expense = this.expenseService.find(expenseId);

        if (!expense) {
            this.setMessage("المصروف غير موجود.", "error");
            return;
        }

        if (expense.status !== "draft") {
            this.setMessage("يمكن تعديل المصروفات المسودة فقط.", "error");
            return;
        }

        this.editingExpenseId = expense.id;
        this.setEditingExpenseId(expense.id);
        this.setInputValue(this.categoryInput, expense.categorySnapshot.displayName);
        this.setInputValue(this.payeeNameInput, expense.payeeSnapshot?.displayName ?? "");
        this.setInputValue(this.amountInput, String(expense.amount));
        this.setInputValue(this.dateInput, expense.expenseDate);
        this.setInputValue(this.referenceInput, expense.referenceNumber ?? "");

        if (this.payeeTypeInput) {
            this.payeeTypeInput.value = expense.payeeType;
        }

        if (this.paymentMethodInput) {
            this.paymentMethodInput.value = expense.paymentMethod;
        }

        if (this.notesInput) {
            this.notesInput.value = expense.notes ?? "";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "تعديل المسودة";
        }

        this.setMessage("وضع تعديل مسودة المصروف مفعل.");

    }

    private renderExpensesIntoTable(): void {

        if (!this.expensesBody) {
            return;
        }

        const expenses = this.expenseService.getAll();

        if (expenses.length === 0) {
            this.expensesBody.innerHTML = `<tr><td colspan="9">لا توجد مصروفات حتى الآن.</td></tr>`;
            return;
        }

        this.expensesBody.innerHTML = expenses
            .map(expense => this.renderExpenseRow(expense))
            .join("");

    }

    private renderExpenseRow(expense: Expense): string {

        return `
            <tr data-expense-id="${this.escapeHtml(expense.id)}" data-expense-status="${expense.status}">
                <td>${this.escapeHtml(expense.expenseNumber)}</td>
                <td>${this.escapeHtml(expense.expenseDate)}</td>
                <td>${this.escapeHtml(expense.categorySnapshot.displayName)}</td>
                <td>${this.escapeHtml(expense.payeeSnapshot?.displayName ?? "-")}</td>
                <td>${this.escapeHtml(formatAmount(expense.amount))}</td>
                <td>${this.renderPaymentMethod(expense.paymentMethod)}</td>
                <td>${this.renderStatus(expense.status)}</td>
                <td>${this.escapeHtml(this.formatDateTime(expense.updatedAt))}</td>
                <td>${this.renderActions(expense)}</td>
            </tr>
        `;

    }

    private renderActions(expense: Expense): string {

        const expenseId = this.escapeHtml(expense.id);
        const actions: string[] = [];

        if (expense.status === "draft") {
            actions.push(`<button type="button" data-action="edit-expense" data-expense-id="${expenseId}">تعديل</button>`);
            actions.push(`<button type="button" data-action="post-expense" data-expense-id="${expenseId}">ترحيل</button>`);
        }

        if (expense.status !== "voided") {
            actions.push(`<button type="button" data-action="void-expense" data-expense-id="${expenseId}">إلغاء</button>`);
        }

        return actions.join("") || "-";

    }

    private readDraftInput(): ExpenseDraftInput {

        return {
            expenseDate: this.dateInput?.value ?? "",
            categorySnapshot: {
                displayName: this.categoryInput?.value ?? ""
            },
            payeeType: this.readPayeeType(),
            payeeSnapshot: this.readPayeeSnapshot(),
            amount: Number(this.amountInput?.value ?? 0),
            paymentMethod: this.readPaymentMethod(),
            referenceNumber: this.referenceInput?.value,
            notes: this.notesInput?.value
        };

    }

    private readUpdateInput(): ExpenseDraftUpdateInput {

        return this.readDraftInput();

    }

    private readPayeeType(): ExpensePayeeType {

        const value = this.payeeTypeInput?.value;

        if (value === "supplier" || value === "customer" || value === "employee") {
            return value;
        }

        return "other";

    }

    private readPaymentMethod(): ExpensePaymentMethod {

        const value = this.paymentMethodInput?.value;

        if (value === "bank_transfer" || value === "card" || value === "other") {
            return value;
        }

        return "cash";

    }

    private readPayeeSnapshot(): { displayName: string } | null {

        const displayName = this.payeeNameInput?.value.trim() ?? "";

        return displayName ? { displayName } : null;

    }

    private clearForm(): void {

        this.editingExpenseId = null;
        this.setEditingExpenseId("");
        this.formElement?.reset();
        this.setDefaultDate();

        if (this.payeeTypeInput) {
            this.payeeTypeInput.value = "other";
        }

        if (this.paymentMethodInput) {
            this.paymentMethodInput.value = "cash";
        }

        if (this.submitButton) {
            this.submitButton.textContent = "حفظ المسودة";
        }

    }

    private setDefaultDate(): void {

        if (this.dateInput && !this.dateInput.value) {
            this.dateInput.value = new Date().toISOString().slice(0, 10);
        }

    }

    private setInputValue(input: HTMLInputElement | null, value: string): void {

        if (input) {
            input.value = value;
        }

    }

    private setEditingExpenseId(expenseId: string): void {

        const page = document.getElementById("expenses-page");

        if (page) {
            page.dataset.editingExpenseId = expenseId;
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

    private renderPaymentMethod(method: ExpensePaymentMethod): string {

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

    private renderStatus(status: ExpenseStatus): string {

        if (status === "posted") {
            return "مرحّل";
        }

        if (status === "voided") {
            return "ملغى";
        }

        return "مسودة";

    }

    private formatDateTime(value: string): string {

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleString("ar");

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

function formatAmount(amount: number): string {

    return amount.toLocaleString("ar", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}
