import { Container } from "../../../core/Container";
import { Page } from "../../../framework/Page";
import type { JournalEntry } from "../JournalEntry";
import type { JournalLineInput } from "../JournalLine";
import type { LedgerAccount } from "../LedgerAccount";
import type { LedgerAccountType } from "../LedgerAccountType";
import type { JournalEntryService } from "../services/JournalEntryService";
import type { LedgerAccountService } from "../services/LedgerAccountService";

export class LedgerManagementPage extends Page {

    private readonly accountService: LedgerAccountService;
    private readonly entryService: JournalEntryService;
    private editingAccountId: string | null = null;
    private editingEntryId: string | null = null;
    private root: HTMLElement | null = null;

    public constructor() {

        super();
        this.accountService = Container.get<LedgerAccountService>(
            "ledgerAccountService"
        );
        this.entryService = Container.get<JournalEntryService>(
            "journalEntryService"
        );

    }

    public title(): string {

        return "الدفتر المحاسبي";

    }

    public render(): string {

        return `
            <div id="ledger-management-page" class="ledger-management-page">
                <style>
                    .ledger-header{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:18px}.ledger-header p{margin:0}.ledger-section{border-top:1px solid var(--border);padding-top:18px;margin-top:22px}
                    .ledger-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.ledger-grid .ledger-wide{grid-column:span 2}.ledger-actions,.ledger-row-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ledger-row-actions button{min-height:34px;padding:6px 9px}.ledger-secondary{background:#fff;color:var(--primary-dark);border-color:var(--primary);box-shadow:none}.ledger-danger{background:var(--danger)}
                    .ledger-message{padding:10px 12px;border-radius:8px;font-weight:700;margin-bottom:14px}.ledger-message[data-tone="success"]{color:#166534;background:#dcfce7}.ledger-message[data-tone="error"]{color:#991b1b;background:#fee2e2}.ledger-message[data-tone="neutral"]{color:#1e3a8a;background:#dbeafe}
                    .ledger-checkbox{flex-direction:row;align-items:center;align-self:end}.ledger-checkbox input{width:auto;min-height:auto}.journal-lines{display:grid;gap:10px}.journal-line{display:grid;grid-template-columns:1.4fr 1.4fr .8fr .8fr auto;gap:8px;align-items:end;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-soft)}.journal-line label{margin:0}.journal-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px;background:var(--surface-soft);border:1px solid var(--border);border-radius:8px}.journal-totals strong{display:block;font-size:18px}.ledger-status{font-weight:800}.ledger-status[data-status="active"],.ledger-status[data-status="posted"]{color:#166534}.ledger-status[data-status="inactive"],.ledger-status[data-status="reversed"]{color:#6b7280}.ledger-status[data-status="draft"]{color:#92400e}
                    @media(max-width:1000px){.ledger-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.journal-line{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.ledger-header{display:block}.ledger-grid,.journal-line,.journal-totals{grid-template-columns:1fr}.ledger-grid .ledger-wide{grid-column:span 1}}
                </style>
                <header class="ledger-header"><div><h1>الدفتر المحاسبي</h1><p>قيود يدوية متوازنة وأرصدة مشتقة من السجل المرحّل.</p></div></header>
                <p id="ledger-message" class="ledger-message" role="status" aria-live="polite" hidden></p>

                <section aria-labelledby="ledger-accounts-title">
                    <h2 id="ledger-accounts-title">دليل الحسابات اليدوي</h2>
                    <form id="ledger-account-form">
                        <div class="ledger-grid">
                            <label>الكود<input id="ledger-account-code" required></label>
                            <label>اسم الحساب<input id="ledger-account-name" required></label>
                            <label>النوع<select id="ledger-account-type"><option value="asset">أصل</option><option value="liability">التزام</option><option value="equity">حقوق ملكية</option><option value="revenue">إيراد</option><option value="expense">مصروف</option></select></label>
                            <label>الحساب الأب<select id="ledger-account-parent"><option value="">بدون حساب أب</option></select></label>
                            <label>العملة<input id="ledger-account-currency" maxlength="3" value="USD" required></label>
                            <label class="ledger-checkbox"><input id="ledger-account-posting" type="checkbox" checked> حساب ترحيل</label>
                            <label class="ledger-wide">ملاحظات<textarea id="ledger-account-notes" rows="2"></textarea></label>
                        </div>
                        <div class="ledger-actions"><button id="ledger-account-submit" type="submit">إضافة حساب</button><button id="ledger-account-reset" type="button" class="ledger-secondary">إلغاء التعديل</button></div>
                    </form>
                    <table id="ledger-accounts-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>الأب</th><th>الترحيل</th><th>العملة</th><th>الحالة</th><th>الرصيد</th><th>الإجراءات</th></tr></thead><tbody id="ledger-accounts-body"></tbody></table>
                </section>

                <section class="ledger-section" aria-labelledby="journal-entry-title">
                    <h2 id="journal-entry-title">قيد يومية يدوي</h2>
                    <form id="journal-entry-form">
                        <div class="ledger-grid">
                            <label>تاريخ القيد<input id="journal-entry-date" type="date" required></label>
                            <label>العملة<input id="journal-entry-currency" maxlength="3" value="USD" required></label>
                            <label class="ledger-wide">البيان<input id="journal-entry-description" required></label>
                            <label class="ledger-wide">مرجع اختياري<input id="journal-entry-reference"></label>
                        </div>
                        <div class="journal-lines" id="journal-lines"></div>
                        <div class="ledger-actions"><button id="journal-add-line" type="button" class="ledger-secondary">إضافة سطر</button></div>
                        <div class="journal-totals" id="journal-totals" data-balanced="false"><div>إجمالي المدين<strong id="journal-total-debit">0.00</strong></div><div>إجمالي الدائن<strong id="journal-total-credit">0.00</strong></div><div>الفرق<strong id="journal-total-difference">0.00</strong></div></div>
                        <div class="ledger-actions"><button id="journal-entry-submit" type="submit" disabled>حفظ المسودة</button><button id="journal-entry-reset" type="button" class="ledger-secondary">إلغاء التعديل</button></div>
                    </form>
                </section>

                <section class="ledger-section" aria-labelledby="journal-history-title">
                    <h2 id="journal-history-title">سجل القيود</h2>
                    <table id="journal-entries-table"><thead><tr><th>الرقم</th><th>التاريخ</th><th>البيان</th><th>الحالة</th><th>المدين</th><th>الدائن</th><th>تفاصيل السطور</th><th>الإجراءات</th></tr></thead><tbody id="journal-entries-body"></tbody></table>
                </section>
            </div>`;

    }

    public override onEnter(): void {

        this.root = document.getElementById("ledger-management-page");
        this.root?.addEventListener("click", this.handleClick);
        this.root?.addEventListener("input", this.handleInput);
        document.getElementById("ledger-account-form")?.addEventListener("submit", this.handleAccountSubmit);
        document.getElementById("ledger-account-reset")?.addEventListener("click", this.resetAccountForm);
        document.getElementById("journal-entry-form")?.addEventListener("submit", this.handleEntrySubmit);
        document.getElementById("journal-entry-reset")?.addEventListener("click", this.resetEntryForm);
        document.getElementById("journal-add-line")?.addEventListener("click", () => this.addJournalLine());
        this.input("journal-entry-date").value = todayDate();
        this.setJournalLines([emptyLine(), emptyLine()]);
        this.refresh();

    }

    public override onLeave(): void {

        this.root?.removeEventListener("click", this.handleClick);
        this.root?.removeEventListener("input", this.handleInput);
        this.root = null;
        this.editingAccountId = null;
        this.editingEntryId = null;

    }

    private readonly handleAccountSubmit = (event: Event): void => {

        event.preventDefault();
        const parentValue = this.select("ledger-account-parent").value;
        const common = {
            code: this.input("ledger-account-code").value,
            displayName: this.input("ledger-account-name").value,
            type: this.readAccountType(),
            isPostingAccount: this.input("ledger-account-posting").checked,
            currency: this.input("ledger-account-currency").value,
            notes: this.textarea("ledger-account-notes").value
        };
        const result = this.editingAccountId
            ? this.accountService.update(this.editingAccountId, {
                ...common,
                parentAccountId: parentValue || null
            })
            : this.accountService.create({
                ...common,
                parentAccountId: parentValue || undefined
            });

        if (!result.success) return this.setMessage(result.errors.join(" "), "error");
        this.setMessage(this.editingAccountId ? "تم تعديل الحساب." : "تم إنشاء الحساب.", "success");
        this.resetAccountForm();
        this.refresh();

    };

    private readonly handleEntrySubmit = (event: Event): void => {

        event.preventDefault();
        const lines = this.readJournalLines();
        const validationError = validateJournalLines(lines);
        if (validationError) return this.setMessage(validationError, "error");
        const reference = this.input("journal-entry-reference").value.trim();
        const common = {
            entryDate: this.input("journal-entry-date").value,
            currency: this.input("journal-entry-currency").value,
            description: this.input("journal-entry-description").value,
            sourceType: "manual" as const,
            sourceId: reference || undefined,
            sourceEvent: reference ? "manual_reference" : undefined,
            lines
        };
        const result = this.editingEntryId
            ? this.entryService.updateDraft(this.editingEntryId, common)
            : this.entryService.createDraft({
                ...common,
                idempotencyKey: commandKey("journal")
            });
        if (!result.success) return this.setMessage(result.errors.join(" "), "error");
        this.setMessage(this.editingEntryId ? "تم تعديل مسودة القيد." : "تم حفظ مسودة القيد.", "success");
        this.resetEntryForm();
        this.refresh();

    };

    private readonly handleClick = (event: Event): void => {

        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const remove = target.closest<HTMLButtonElement>("[data-action='remove-journal-line']");
        if (remove) {
            if (document.querySelectorAll(".journal-line").length > 2) remove.closest(".journal-line")?.remove();
            this.updateJournalTotals();
            return;
        }
        const button = target.closest<HTMLButtonElement>("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const accountId = button.dataset.accountId;
        const entryId = button.dataset.entryId;
        if (action === "edit-ledger-account" && accountId) this.openAccountEdit(accountId);
        if (action === "deactivate-ledger-account" && accountId) this.deactivateAccount(accountId);
        if (action === "edit-journal-entry" && entryId) this.openEntryEdit(entryId);
        if (action === "post-journal-entry" && entryId) this.applyEntryResult(this.entryService.post(entryId), "تم ترحيل القيد.");
        if (action === "reverse-journal-entry" && entryId) this.reverseEntry(entryId);

    };

    private readonly handleInput = (event: Event): void => {

        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.matches(".journal-line-debit,.journal-line-credit")) this.updateJournalTotals();
        if (target.id === "journal-entry-currency") this.refreshLineAccountOptions();

    };

    private openAccountEdit(accountId: string): void {

        const account = this.accountService.find(accountId);
        if (!account || account.status !== "active") return this.setMessage("الحساب غير متاح للتعديل.", "error");
        this.editingAccountId = account.id;
        this.input("ledger-account-code").value = account.code;
        this.input("ledger-account-name").value = account.displayName;
        this.select("ledger-account-type").value = account.type;
        this.select("ledger-account-parent").value = account.parentAccountId ?? "";
        this.input("ledger-account-posting").checked = account.isPostingAccount;
        this.input("ledger-account-currency").value = account.currency;
        this.textarea("ledger-account-notes").value = account.notes ?? "";
        this.button("ledger-account-submit").textContent = "حفظ التعديل";
        this.setMessage("وضع تعديل الحساب مفعل.", "neutral");

    }

    private deactivateAccount(accountId: string): void {

        const reason = window.prompt("سبب تعطيل الحساب:", "إيقاف استخدام الحساب")?.trim();
        if (!reason) return;
        const result = this.accountService.deactivate(accountId, reason);
        this.setMessage(result.success ? "تم تعطيل الحساب." : result.errors.join(" "), result.success ? "success" : "error");
        this.refresh();

    }

    private openEntryEdit(entryId: string): void {

        const entry = this.entryService.find(entryId);
        if (!entry || entry.status !== "draft") return this.setMessage("يمكن تعديل القيد المسودة فقط.", "error");
        this.editingEntryId = entry.id;
        this.input("journal-entry-date").value = entry.entryDate;
        this.input("journal-entry-currency").value = entry.currency;
        this.input("journal-entry-description").value = entry.description;
        this.input("journal-entry-reference").value = entry.sourceId ?? "";
        this.setJournalLines(entry.lines.map(line => ({
            ledgerAccountId: line.ledgerAccountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description
        })));
        this.button("journal-entry-submit").textContent = "حفظ التعديل";
        this.setMessage("وضع تعديل مسودة القيد مفعل.", "neutral");

    }

    private reverseEntry(entryId: string): void {

        const reason = window.prompt("سبب عكس القيد:", "تصحيح قيد يدوي")?.trim();
        if (!reason) return;
        this.applyEntryResult(this.entryService.reverse(entryId, reason), "تم إنشاء قيد عكسي وحفظ الأصل.");

    }

    private applyEntryResult(
        result: ReturnType<JournalEntryService["post"]>,
        successMessage: string
    ): void {

        this.setMessage(result.success ? successMessage : result.errors.join(" "), result.success ? "success" : "error");
        if (result.success) this.resetEntryForm();
        this.refresh();

    }

    private refresh(): void {

        const accounts = this.accountService.getAll();
        this.renderAccounts(accounts);
        this.renderParentOptions(accounts);
        this.refreshLineAccountOptions();
        this.renderEntries(this.entryService.getAll());

    }

    private renderAccounts(accounts: LedgerAccount[]): void {

        const body = document.getElementById("ledger-accounts-body");
        if (!body) return;
        const names = new Map(accounts.map(account => [account.id, account.displayName]));
        body.innerHTML = accounts.length === 0 ? `<tr><td colspan="9">لا توجد حسابات. لن يتم إنشاؤها تلقائياً.</td></tr>` : accounts.map(account => `<tr data-ledger-account-id="${escapeHtml(account.id)}"><td>${escapeHtml(account.code)}</td><td>${escapeHtml(account.displayName)}</td><td>${accountTypeLabel(account.type)}</td><td>${escapeHtml(account.parentAccountId ? names.get(account.parentAccountId) ?? "-" : "-")}</td><td>${account.isPostingAccount ? "نعم" : "تجميعي"}</td><td>${escapeHtml(account.currency)}</td><td><span class="ledger-status" data-status="${account.status}">${account.status === "active" ? "نشط" : "معطل"}</span></td><td>${formatAmount(this.entryService.calculateAccountBalance(account.id))}</td><td>${this.accountActions(account)}</td></tr>`).join("");

    }

    private accountActions(account: LedgerAccount): string {

        if (account.status === "inactive") return "-";
        const id = escapeHtml(account.id);
        return `<div class="ledger-row-actions"><button type="button" data-action="edit-ledger-account" data-account-id="${id}">تعديل</button><button type="button" class="ledger-danger" data-action="deactivate-ledger-account" data-account-id="${id}">تعطيل</button></div>`;

    }

    private renderParentOptions(accounts: LedgerAccount[]): void {

        const select = this.select("ledger-account-parent");
        const current = select.value;
        const options = accounts.filter(account => account.status === "active" && !account.isPostingAccount && account.id !== this.editingAccountId);
        select.innerHTML = `<option value="">بدون حساب أب</option>${options.map(account => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.code)} - ${escapeHtml(account.displayName)}</option>`).join("")}`;
        if (options.some(account => account.id === current)) select.value = current;

    }

    private refreshLineAccountOptions(): void {

        const currency = this.input("journal-entry-currency").value.trim().toUpperCase();
        const accounts = this.accountService.getAll().filter(account => account.status === "active" && account.isPostingAccount && account.currency === currency);
        document.querySelectorAll<HTMLSelectElement>(".journal-line-account").forEach(select => {
            const current = select.value;
            select.innerHTML = `<option value="">اختر حساب ترحيل</option>${accounts.map(account => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.code)} - ${escapeHtml(account.displayName)}</option>`).join("")}`;
            if (accounts.some(account => account.id === current)) select.value = current;
        });

    }

    private renderEntries(entries: JournalEntry[]): void {

        const body = document.getElementById("journal-entries-body");
        if (!body) return;
        const ordered = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        body.innerHTML = ordered.length === 0 ? `<tr><td colspan="8">لا توجد قيود حتى الآن.</td></tr>` : ordered.map(entry => {
            const totals = this.entryService.getTotals(entry.id) ?? { debit: 0, credit: 0 };
            const details = entry.lines.map(line => `${line.accountSnapshot.code}: ${line.debit > 0 ? `مدين ${formatAmount(line.debit)}` : `دائن ${formatAmount(line.credit)}`}`).join(" | ");
            return `<tr data-journal-entry-id="${escapeHtml(entry.id)}" data-journal-entry-status="${entry.status}"><td>${escapeHtml(entry.journalNumber)}</td><td>${escapeHtml(entry.entryDate)}</td><td>${escapeHtml(entry.description)}</td><td><span class="ledger-status" data-status="${entry.status}">${entryStatusLabel(entry.status)}</span></td><td>${formatAmount(totals.debit)}</td><td>${formatAmount(totals.credit)}</td><td>${escapeHtml(details)}</td><td>${this.entryActions(entry)}</td></tr>`;
        }).join("");

    }

    private entryActions(entry: JournalEntry): string {

        const id = escapeHtml(entry.id);
        if (entry.status === "draft") return `<div class="ledger-row-actions"><button type="button" data-action="edit-journal-entry" data-entry-id="${id}">تعديل</button><button type="button" data-action="post-journal-entry" data-entry-id="${id}">ترحيل</button></div>`;
        if (entry.status === "posted" && !entry.reversalOfEntryId) return `<button type="button" class="ledger-danger" data-action="reverse-journal-entry" data-entry-id="${id}">عكس القيد</button>`;
        return "-";

    }

    private addJournalLine(input: Partial<JournalLineInput> = {}): void {

        const container = document.getElementById("journal-lines");
        if (!container) return;
        const row = document.createElement("div");
        row.className = "journal-line";
        row.innerHTML = `<label>الحساب<select class="journal-line-account"></select></label><label>وصف السطر<input class="journal-line-description" value="${escapeHtml(input.description ?? "")}"></label><label>مدين<input class="journal-line-debit" type="number" min="0" step="0.01" value="${escapeHtml(String(input.debit ?? 0))}"></label><label>دائن<input class="journal-line-credit" type="number" min="0" step="0.01" value="${escapeHtml(String(input.credit ?? 0))}"></label><button type="button" class="ledger-danger" data-action="remove-journal-line" title="حذف السطر">حذف</button>`;
        container.appendChild(row);
        this.refreshLineAccountOptions();
        const select = row.querySelector<HTMLSelectElement>(".journal-line-account");
        if (select && input.ledgerAccountId) select.value = input.ledgerAccountId;
        this.updateJournalTotals();

    }

    private setJournalLines(lines: Partial<JournalLineInput>[]): void {

        const container = document.getElementById("journal-lines");
        if (!container) return;
        container.innerHTML = "";
        for (const line of lines) this.addJournalLine(line);
        this.updateJournalTotals();

    }

    private readJournalLines(): JournalLineInput[] {

        return Array.from(document.querySelectorAll<HTMLElement>(".journal-line")).map(row => ({
            ledgerAccountId: row.querySelector<HTMLSelectElement>(".journal-line-account")?.value ?? "",
            description: row.querySelector<HTMLInputElement>(".journal-line-description")?.value,
            debit: Number(row.querySelector<HTMLInputElement>(".journal-line-debit")?.value ?? 0),
            credit: Number(row.querySelector<HTMLInputElement>(".journal-line-credit")?.value ?? 0)
        }));

    }

    private updateJournalTotals(): void {

        const lines = this.readJournalLines();
        const debit = lines.reduce((total, line) => total + finiteAmount(line.debit), 0);
        const credit = lines.reduce((total, line) => total + finiteAmount(line.credit), 0);
        const difference = debit - credit;
        this.text("journal-total-debit", formatAmount(debit));
        this.text("journal-total-credit", formatAmount(credit));
        this.text("journal-total-difference", formatAmount(difference));
        const valid = !validateJournalLines(lines);
        this.button("journal-entry-submit").disabled = !valid;
        const totals = document.getElementById("journal-totals");
        if (totals) totals.dataset.balanced = String(valid);

    }

    private readonly resetAccountForm = (): void => {

        this.editingAccountId = null;
        (document.getElementById("ledger-account-form") as HTMLFormElement | null)?.reset();
        this.input("ledger-account-currency").value = "USD";
        this.input("ledger-account-posting").checked = true;
        this.button("ledger-account-submit").textContent = "إضافة حساب";
        this.renderParentOptions(this.accountService.getAll());

    };

    private readonly resetEntryForm = (): void => {

        this.editingEntryId = null;
        (document.getElementById("journal-entry-form") as HTMLFormElement | null)?.reset();
        this.input("journal-entry-date").value = todayDate();
        this.input("journal-entry-currency").value = "USD";
        this.button("journal-entry-submit").textContent = "حفظ المسودة";
        this.setJournalLines([emptyLine(), emptyLine()]);

    };

    private setMessage(message: string, tone: "success" | "error" | "neutral"): void {

        const element = document.getElementById("ledger-message");
        if (!element) return;
        element.textContent = message;
        element.dataset.tone = tone;
        element.hidden = !message;

    }

    private readAccountType(): LedgerAccountType {

        const value = this.select("ledger-account-type").value;
        return value === "liability" || value === "equity" || value === "revenue" || value === "expense" ? value : "asset";

    }

    private input(id: string): HTMLInputElement { return document.getElementById(id) as HTMLInputElement; }
    private select(id: string): HTMLSelectElement { return document.getElementById(id) as HTMLSelectElement; }
    private textarea(id: string): HTMLTextAreaElement { return document.getElementById(id) as HTMLTextAreaElement; }
    private button(id: string): HTMLButtonElement { return document.getElementById(id) as HTMLButtonElement; }
    private text(id: string, value: string): void { const element = document.getElementById(id); if (element) element.textContent = value; }

}

function validateJournalLines(lines: JournalLineInput[]): string | null {

    if (lines.length < 2) return "القيد يحتاج إلى سطرين على الأقل.";
    for (const line of lines) {
        if (!line.ledgerAccountId.trim()) return "يجب اختيار حساب لكل سطر.";
        if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit) || line.debit < 0 || line.credit < 0) return "قيم المدين والدائن غير صالحة.";
        if ((line.debit > 0) === (line.credit > 0)) return "كل سطر يجب أن يحتوي مديناً أو دائناً موجباً، وليس كليهما.";
    }
    const debit = lines.reduce((total, line) => total + line.debit, 0);
    const credit = lines.reduce((total, line) => total + line.credit, 0);
    if (debit <= 0 || credit <= 0 || Math.abs(debit - credit) > 1e-9) return "يجب أن يتساوى إجمالي المدين والدائن.";
    return null;

}

function emptyLine(): JournalLineInput { return { ledgerAccountId: "", debit: 0, credit: 0 }; }
function finiteAmount(value: number): number { return Number.isFinite(value) ? value : 0; }
function commandKey(prefix: string): string { const id = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; return `${prefix}:${id}`; }
function todayDate(): string { return new Date().toISOString().slice(0, 10); }
function formatAmount(value: number): string { return new Intl.NumberFormat("ar", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
function accountTypeLabel(type: LedgerAccountType): string { return ({ asset: "أصل", liability: "التزام", equity: "حقوق ملكية", revenue: "إيراد", expense: "مصروف" })[type]; }
function entryStatusLabel(status: JournalEntry["status"]): string { return status === "posted" ? "مرحّل" : status === "reversed" ? "معكوس" : "مسودة"; }
function escapeHtml(value: string): string { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }
