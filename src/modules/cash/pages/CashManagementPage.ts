import { Container } from "../../../core/Container";
import { Page } from "../../../framework/Page";
import type { CashMovement } from "../CashMovement";
import type { CashMovementType } from "../CashMovementType";
import type { Safe } from "../Safe";
import type { CashMovementService } from "../services/CashMovementService";
import type { SafeService } from "../services/SafeService";

export class CashManagementPage extends Page {

    private readonly safeService: SafeService;
    private readonly movementService: CashMovementService;
    private editingSafeId: string | null = null;
    private editingMovementId: string | null = null;
    private root: HTMLElement | null = null;

    public constructor() {

        super();
        this.safeService = Container.get<SafeService>("safeService");
        this.movementService = Container.get<CashMovementService>("cashMovementService");

    }

    public title(): string {

        return "الخزائن وحركات النقد";

    }

    public render(): string {

        return `
            <div id="cash-management-page" class="cash-management-page">
                <style>
                    .cash-page-header{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:18px}.cash-page-header p{margin:0}
                    .cash-section{border-top:1px solid var(--border);padding-top:18px;margin-top:22px}.cash-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.cash-form-grid .cash-wide{grid-column:span 2}
                    .cash-form-actions,.cash-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.cash-actions button{min-height:34px;padding:6px 9px}.cash-message{padding:10px 12px;border-radius:8px;font-weight:700;margin-bottom:14px}.cash-message[data-tone="success"]{color:#166534;background:#dcfce7}.cash-message[data-tone="error"]{color:#991b1b;background:#fee2e2}.cash-message[data-tone="neutral"]{color:#1e3a8a;background:#dbeafe}
                    .cash-secondary{background:#fff;color:var(--primary-dark);border-color:var(--primary);box-shadow:none}.cash-danger{background:var(--danger)}.cash-status{font-weight:800}.cash-status[data-status="active"],.cash-status[data-status="posted"]{color:#166534}.cash-status[data-status="inactive"],.cash-status[data-status="reversed"]{color:#6b7280}.cash-status[data-status="draft"]{color:#92400e}.cash-checkbox{flex-direction:row;align-items:center;align-self:end}.cash-checkbox input{width:auto;min-height:auto}
                    @media(max-width:1000px){.cash-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.cash-page-header{display:block}.cash-form-grid{grid-template-columns:1fr}.cash-form-grid .cash-wide{grid-column:span 1}}
                </style>
                <header class="cash-page-header"><div><h1>الخزائن وحركات النقد</h1><p>الأرصدة المعروضة مشتقة من الحركات المرحّلة.</p></div></header>
                <p id="cash-message" class="cash-message" role="status" aria-live="polite" hidden></p>

                <section aria-labelledby="safe-section-title">
                    <h2 id="safe-section-title">الخزائن</h2>
                    <form id="safe-form">
                        <div class="cash-form-grid">
                            <label>اسم الخزنة<input id="safe-display-name" required></label>
                            <label>الرمز<input id="safe-code"></label>
                            <label>العملة<input id="safe-currency" maxlength="3" value="USD" required></label>
                            <label class="cash-checkbox"><input id="safe-is-default" type="checkbox"> تعيين كخزنة افتراضية</label>
                            <label class="cash-wide">ملاحظات<textarea id="safe-notes" rows="2"></textarea></label>
                        </div>
                        <div class="cash-form-actions"><button id="safe-submit" type="submit">إضافة خزنة</button><button id="safe-reset" class="cash-secondary" type="button">إلغاء التعديل</button></div>
                    </form>
                    <table id="cash-safes-table"><thead><tr><th>الخزنة</th><th>الرمز</th><th>العملة</th><th>الحالة</th><th>الافتراضية</th><th>الرصيد</th><th>الإجراءات</th></tr></thead><tbody id="cash-safes-body"></tbody></table>
                </section>

                <section class="cash-section" aria-labelledby="movement-section-title">
                    <h2 id="movement-section-title">حركة نقدية يدوية</h2>
                    <form id="cash-movement-form">
                        <div class="cash-form-grid">
                            <label>الخزنة<select id="cash-movement-safe" required></select></label>
                            <label>نوع الحركة<select id="cash-movement-type"><option value="opening_balance">رصيد افتتاحي</option><option value="cash_in">قبض نقدي</option><option value="cash_out">صرف نقدي</option><option value="adjustment_in">تسوية بالزيادة</option><option value="adjustment_out">تسوية بالنقص</option></select></label>
                            <label>المبلغ<input id="cash-movement-amount" type="number" min="0.01" step="0.01" required></label>
                            <label>تاريخ الحركة<input id="cash-movement-date" type="date" required></label>
                            <label class="cash-wide">السبب<input id="cash-movement-reason" required></label>
                            <label class="cash-wide">ملاحظات<textarea id="cash-movement-notes" rows="2"></textarea></label>
                        </div>
                        <div class="cash-form-actions"><button id="cash-movement-submit" type="submit">حفظ المسودة</button><button id="cash-movement-reset" class="cash-secondary" type="button">إلغاء التعديل</button></div>
                    </form>
                </section>

                <section class="cash-section" aria-labelledby="transfer-section-title">
                    <h2 id="transfer-section-title">تحويل بين خزنتين</h2>
                    <form id="cash-transfer-form">
                        <div class="cash-form-grid">
                            <label>من خزنة<select id="cash-transfer-source" required></select></label><label>إلى خزنة<select id="cash-transfer-destination" required></select></label>
                            <label>المبلغ<input id="cash-transfer-amount" type="number" min="0.01" step="0.01" required></label><label>تاريخ التحويل<input id="cash-transfer-date" type="date" required></label>
                            <label class="cash-wide">السبب<input id="cash-transfer-reason" required></label><label class="cash-wide">ملاحظات<textarea id="cash-transfer-notes" rows="2"></textarea></label>
                        </div>
                        <div class="cash-form-actions"><button type="submit">تنفيذ التحويل</button></div>
                    </form>
                </section>

                <section class="cash-section" aria-labelledby="history-section-title">
                    <h2 id="history-section-title">سجل الحركات</h2>
                    <table id="cash-movements-table"><thead><tr><th>الرقم</th><th>الخزنة</th><th>النوع</th><th>الحالة</th><th>المبلغ</th><th>التاريخ</th><th>المرجع</th><th>السبب</th><th>الإجراءات</th></tr></thead><tbody id="cash-movements-body"></tbody></table>
                </section>
            </div>`;

    }

    public override onEnter(): void {

        this.root = document.getElementById("cash-management-page");
        this.root?.addEventListener("click", this.handleClick);
        document.getElementById("safe-form")?.addEventListener("submit", this.handleSafeSubmit);
        document.getElementById("safe-reset")?.addEventListener("click", this.resetSafeForm);
        document.getElementById("cash-movement-form")?.addEventListener("submit", this.handleMovementSubmit);
        document.getElementById("cash-movement-reset")?.addEventListener("click", this.resetMovementForm);
        document.getElementById("cash-transfer-form")?.addEventListener("submit", this.handleTransferSubmit);
        this.setDefaultDates();
        this.refresh();

    }

    public override onLeave(): void {

        this.root?.removeEventListener("click", this.handleClick);
        this.root = null;
        this.editingSafeId = null;
        this.editingMovementId = null;

    }

    private readonly handleSafeSubmit = (event: Event): void => {

        event.preventDefault();
        const result = this.editingSafeId
            ? this.safeService.update(this.editingSafeId, {
                displayName: this.input("safe-display-name").value,
                code: this.input("safe-code").value,
                currency: this.input("safe-currency").value,
                notes: this.textarea("safe-notes").value
            })
            : this.safeService.create({
                displayName: this.input("safe-display-name").value,
                code: this.input("safe-code").value,
                currency: this.input("safe-currency").value,
                notes: this.textarea("safe-notes").value,
                isDefault: this.input("safe-is-default").checked
            });
        if (!result.success) return this.setMessage(result.errors.join(" "), "error");
        this.setMessage(this.editingSafeId ? "تم تعديل الخزنة بنجاح." : "تمت إضافة الخزنة بنجاح.", "success");
        this.resetSafeForm();
        this.refresh();

    };

    private readonly handleMovementSubmit = (event: Event): void => {

        event.preventDefault();
        const input = {
            safeId: this.select("cash-movement-safe").value,
            type: this.readMovementType(),
            amount: Number(this.input("cash-movement-amount").value),
            movementDate: this.input("cash-movement-date").value,
            reason: this.input("cash-movement-reason").value,
            notes: this.textarea("cash-movement-notes").value
        };
        const result = this.editingMovementId
            ? this.movementService.updateDraft(this.editingMovementId, input)
            : this.movementService.createDraft({ ...input, idempotencyKey: commandKey("movement") });
        if (!result.success) return this.setMessage(result.errors.join(" "), "error");
        this.setMessage(this.editingMovementId ? "تم تعديل مسودة الحركة." : "تم حفظ مسودة الحركة.", "success");
        this.resetMovementForm();
        this.refresh();

    };

    private readonly handleTransferSubmit = (event: Event): void => {

        event.preventDefault();
        const result = this.movementService.createTransfer({
            sourceSafeId: this.select("cash-transfer-source").value,
            destinationSafeId: this.select("cash-transfer-destination").value,
            amount: Number(this.input("cash-transfer-amount").value),
            movementDate: this.input("cash-transfer-date").value,
            reason: this.input("cash-transfer-reason").value,
            notes: this.textarea("cash-transfer-notes").value,
            idempotencyKey: commandKey("transfer")
        });
        if (!result.success) return this.setMessage(result.errors.join(" "), "error");
        (event.currentTarget as HTMLFormElement).reset();
        this.setDefaultDates();
        this.setMessage("تم تنفيذ التحويل بنجاح.", "success");
        this.refresh();

    };

    private readonly handleClick = (event: Event): void => {

        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const button = target.closest<HTMLButtonElement>("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const safeId = button.dataset.safeId;
        const movementId = button.dataset.movementId;
        const transferId = button.dataset.transferId;
        if (action === "edit-safe" && safeId) this.openSafeEdit(safeId);
        if (action === "default-safe" && safeId) this.applySafeResult(this.safeService.setDefaultSafe(safeId), "تم تعيين الخزنة الافتراضية.");
        if (action === "deactivate-safe" && safeId) this.deactivateSafe(safeId);
        if (action === "edit-movement" && movementId) this.openMovementEdit(movementId);
        if (action === "post-movement" && movementId) this.applyMovementResult(this.movementService.post(movementId), "تم ترحيل الحركة.");
        if (action === "reverse-movement" && movementId) this.reverseMovement(movementId);
        if (action === "reverse-transfer" && transferId) this.reverseTransfer(transferId);

    };

    private openSafeEdit(safeId: string): void {

        const safe = this.safeService.find(safeId);
        if (!safe) return this.setMessage("الخزنة غير موجودة.", "error");
        this.editingSafeId = safe.id;
        this.input("safe-display-name").value = safe.displayName;
        this.input("safe-code").value = safe.code ?? "";
        this.input("safe-currency").value = safe.currency;
        this.input("safe-is-default").checked = safe.isDefault;
        this.input("safe-is-default").disabled = true;
        this.textarea("safe-notes").value = safe.notes ?? "";
        this.button("safe-submit").textContent = "حفظ التعديل";
        this.setMessage("وضع تعديل الخزنة مفعل.", "neutral");

    }

    private deactivateSafe(safeId: string): void {

        if (!window.confirm("تعطيل هذه الخزنة مع الحفاظ على سجلها؟")) return;
        this.applySafeResult(this.safeService.deactivate(safeId), "تم تعطيل الخزنة.");

    }

    private openMovementEdit(movementId: string): void {

        const movement = this.movementService.find(movementId);
        if (!movement || movement.status !== "draft") return this.setMessage("يمكن تعديل الحركة المسودة فقط.", "error");
        this.editingMovementId = movement.id;
        this.select("cash-movement-safe").value = movement.safeId;
        this.select("cash-movement-type").value = movement.type;
        this.input("cash-movement-amount").value = String(movement.amount);
        this.input("cash-movement-date").value = movement.movementDate;
        this.input("cash-movement-reason").value = movement.reason;
        this.textarea("cash-movement-notes").value = movement.notes ?? "";
        this.button("cash-movement-submit").textContent = "حفظ التعديل";
        this.setMessage("وضع تعديل مسودة الحركة مفعل.", "neutral");

    }

    private reverseMovement(movementId: string): void {

        const reason = window.prompt("سبب عكس الحركة:", "تصحيح حركة نقدية")?.trim();
        if (!reason) return;
        this.applyMovementResult(this.movementService.reverse(movementId, reason), "تم عكس الحركة مع الحفاظ على السجل.");

    }

    private reverseTransfer(transferId: string): void {

        const reason = window.prompt("سبب عكس التحويل بالكامل:", "تصحيح تحويل")?.trim();
        if (!reason) return;
        const result = this.movementService.reverseTransfer(transferId, reason);
        this.setMessage(result.success ? "تم عكس التحويل بالكامل." : result.errors.join(" "), result.success ? "success" : "error");
        this.refresh();

    }

    private applySafeResult(result: ReturnType<SafeService["deactivate"]>, message: string): void {

        this.setMessage(result.success ? message : result.errors.join(" "), result.success ? "success" : "error");
        if (result.success) this.resetSafeForm();
        this.refresh();

    }

    private applyMovementResult(result: ReturnType<CashMovementService["post"]>, message: string): void {

        this.setMessage(result.success ? message : result.errors.join(" "), result.success ? "success" : "error");
        if (result.success) this.resetMovementForm();
        this.refresh();

    }

    private refresh(): void {

        const safes = this.safeService.getAll();
        this.renderSafeOptions(safes);
        this.renderSafes(safes);
        this.renderMovements(this.movementService.getAll());

    }

    private renderSafeOptions(safes: Safe[]): void {

        const active = safes.filter(safe => safe.status === "active");
        const options = [`<option value="">اختر خزنة صراحة</option>`, ...active.map(safe => `<option value="${escapeHtml(safe.id)}">${escapeHtml(safe.displayName)} (${escapeHtml(safe.currency)})</option>`)].join("");
        for (const id of ["cash-movement-safe", "cash-transfer-source", "cash-transfer-destination"]) {
            const select = this.select(id);
            const current = select.value;
            select.innerHTML = options;
            if (active.some(safe => safe.id === current)) select.value = current;
        }

    }

    private renderSafes(safes: Safe[]): void {

        const body = document.getElementById("cash-safes-body");
        if (!body) return;
        body.innerHTML = safes.length === 0 ? `<tr><td colspan="7">لا توجد خزائن حتى الآن.</td></tr>` : safes.map(safe => `<tr data-safe-id="${escapeHtml(safe.id)}"><td>${escapeHtml(safe.displayName)}</td><td>${escapeHtml(safe.code ?? "-")}</td><td>${escapeHtml(safe.currency)}</td><td><span class="cash-status" data-status="${safe.status}">${safe.status === "active" ? "نشطة" : "معطلة"}</span></td><td>${safe.isDefault ? "نعم" : "لا"}</td><td>${formatAmount(this.movementService.calculateCurrentBalance(safe.id))} ${escapeHtml(safe.currency)}</td><td>${this.safeActions(safe)}</td></tr>`).join("");

    }

    private safeActions(safe: Safe): string {

        if (safe.status === "inactive") return "-";
        return `<div class="cash-actions"><button type="button" data-action="edit-safe" data-safe-id="${escapeHtml(safe.id)}">تعديل</button>${safe.isDefault ? "" : `<button class="cash-secondary" type="button" data-action="default-safe" data-safe-id="${escapeHtml(safe.id)}">افتراضية</button>`}<button class="cash-danger" type="button" data-action="deactivate-safe" data-safe-id="${escapeHtml(safe.id)}">تعطيل</button></div>`;

    }

    private renderMovements(movements: CashMovement[]): void {

        const body = document.getElementById("cash-movements-body");
        if (!body) return;
        const ordered = [...movements].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        body.innerHTML = ordered.length === 0 ? `<tr><td colspan="9">لا توجد حركات حتى الآن.</td></tr>` : ordered.map(movement => `<tr data-movement-id="${escapeHtml(movement.id)}" data-movement-status="${movement.status}"><td>${escapeHtml(movement.movementNumber)}</td><td>${escapeHtml(movement.safeSnapshot.displayName)}</td><td>${movementTypeLabel(movement.type)}</td><td><span class="cash-status" data-status="${movement.status}">${movementStatusLabel(movement.status)}</span></td><td>${formatAmount(movement.amount)} ${escapeHtml(movement.currency)}</td><td>${escapeHtml(movement.movementDate)}</td><td>${escapeHtml(movement.transferId ?? movement.referenceId ?? "-")}</td><td>${escapeHtml(movement.reason)}</td><td>${this.movementActions(movement)}</td></tr>`).join("");

    }

    private movementActions(movement: CashMovement): string {

        const id = escapeHtml(movement.id);
        if (movement.status === "draft") return `<div class="cash-actions"><button type="button" data-action="edit-movement" data-movement-id="${id}">تعديل</button><button type="button" data-action="post-movement" data-movement-id="${id}">ترحيل</button></div>`;
        if (movement.status !== "posted" || movement.reversalOfMovementId) return "-";
        if (movement.type === "transfer_out" && movement.transferId) return `<button class="cash-danger" type="button" data-action="reverse-transfer" data-transfer-id="${escapeHtml(movement.transferId)}">عكس التحويل</button>`;
        if (movement.type === "transfer_in") return "-";
        return `<button class="cash-danger" type="button" data-action="reverse-movement" data-movement-id="${id}">عكس الحركة</button>`;

    }

    private readonly resetSafeForm = (): void => {

        this.editingSafeId = null;
        (document.getElementById("safe-form") as HTMLFormElement | null)?.reset();
        this.input("safe-currency").value = "USD";
        this.input("safe-is-default").disabled = false;
        this.button("safe-submit").textContent = "إضافة خزنة";

    };

    private readonly resetMovementForm = (): void => {

        this.editingMovementId = null;
        (document.getElementById("cash-movement-form") as HTMLFormElement | null)?.reset();
        this.input("cash-movement-date").value = todayDate();
        this.button("cash-movement-submit").textContent = "حفظ المسودة";

    };

    private setDefaultDates(): void {

        this.input("cash-movement-date").value = todayDate();
        this.input("cash-transfer-date").value = todayDate();

    }

    private setMessage(message: string, tone: "success" | "error" | "neutral"): void {

        const element = document.getElementById("cash-message");
        if (!element) return;
        element.textContent = message;
        element.dataset.tone = tone;
        element.hidden = !message;

    }

    private readMovementType(): CashMovementType {

        const value = this.select("cash-movement-type").value;
        return value === "cash_in" || value === "cash_out" || value === "adjustment_in" || value === "adjustment_out" ? value : "opening_balance";

    }

    private input(id: string): HTMLInputElement { return document.getElementById(id) as HTMLInputElement; }
    private select(id: string): HTMLSelectElement { return document.getElementById(id) as HTMLSelectElement; }
    private textarea(id: string): HTMLTextAreaElement { return document.getElementById(id) as HTMLTextAreaElement; }
    private button(id: string): HTMLButtonElement { return document.getElementById(id) as HTMLButtonElement; }

}

function commandKey(prefix: string): string {

    const id = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}:${id}`;

}

function todayDate(): string { return new Date().toISOString().slice(0, 10); }
function formatAmount(value: number): string { return new Intl.NumberFormat("ar", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }

function movementTypeLabel(type: CashMovementType): string {

    return ({ opening_balance: "رصيد افتتاحي", cash_in: "قبض نقدي", cash_out: "صرف نقدي", transfer_in: "تحويل وارد", transfer_out: "تحويل صادر", adjustment_in: "تسوية بالزيادة", adjustment_out: "تسوية بالنقص" })[type];

}

function movementStatusLabel(status: CashMovement["status"]): string {

    return status === "posted" ? "مرحّلة" : status === "reversed" ? "معكوسة" : "مسودة";

}

function escapeHtml(value: string): string {

    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;

}
