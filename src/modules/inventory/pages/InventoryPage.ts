import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import type { Product } from "../../products/Product";
import type { ProductService } from "../../products/services/ProductService";
import {
    isLegacyVoidedStockMovement,
    isReversalStockMovement,
    type StockMovement
} from "../StockMovement";
import type { StockMovementType } from "../StockMovementType";
import type { InventoryService } from "../services/InventoryService";

type InventoryUiMovementType = Extract<
    StockMovementType,
    "opening_balance" | "manual_adjustment"
>;

export class InventoryPage extends Page {

    private readonly productService: ProductService;
    private readonly inventoryService: InventoryService;

    private form: HTMLFormElement | null = null;
    private productSelect: HTMLSelectElement | null = null;
    private movementTypeSelect: HTMLSelectElement | null = null;
    private quantityInput: HTMLInputElement | null = null;
    private reasonInput: HTMLInputElement | null = null;
    private submitButton: HTMLButtonElement | null = null;
    private messageElement: HTMLElement | null = null;
    private currentQuantityElement: HTMLElement | null = null;
    private productsBody: HTMLElement | null = null;
    private movementHistoryBody: HTMLElement | null = null;
    private selectedProductId = "";

    private readonly handleSubmit = (event: Event): void => {

        event.preventDefault();

        this.submitMovement();

    };

    private readonly handleProductChange = (): void => {

        this.selectedProductId = this.productSelect?.value.trim() ?? "";

        this.updateCurrentQuantity();

    };

    public constructor() {

        super();

        this.productService = Container.get<ProductService>("productService");
        this.inventoryService = Container.get<InventoryService>("inventoryService");

    }

    public title(): string {

        return "المخزون";

    }

    public render(): string {

        return `
            <section id="inventory-page" data-last-submit-status="idle">

                <div class="page-header">

                    <h1>المخزون</h1>

                </div>

                <form id="inventory-movement-form" autocomplete="off">

                    <div class="form-group">

                        <label for="inventory-product-select">المنتج</label>

                        <select id="inventory-product-select" required></select>

                    </div>

                    <div class="form-group">

                        <label for="inventory-movement-type">نوع الحركة</label>

                        <select id="inventory-movement-type" required>
                            <option value="opening_balance">رصيد افتتاحي</option>
                            <option value="manual_adjustment">تعديل يدوي</option>
                        </select>

                    </div>

                    <div class="form-group">

                        <label for="inventory-quantity">فرق الكمية</label>

                        <input
                            id="inventory-quantity"
                            type="number"
                            step="any"
                            required
                        >

                    </div>

                    <div class="form-group">

                        <label for="inventory-reason">السبب</label>

                        <input id="inventory-reason" type="text" required>

                    </div>

                    <button id="inventory-submit" type="submit">
                        حفظ الحركة
                    </button>

                </form>

                <p id="inventory-message" role="status"></p>

                <p id="inventory-current-quantity" data-current-quantity="0">
                    الكمية الحالية: 0
                </p>

                <section id="inventory-current-stock-view">

                    <h2>المخزون الحالي</h2>

                    <table id="inventory-products-table">

                        <thead>

                            <tr>
                                <th>المنتج</th>
                                <th>الباركود</th>
                                <th>الكمية الحالية</th>
                            </tr>

                        </thead>

                        <tbody id="inventory-products-body"></tbody>

                    </table>

                </section>

                <section id="inventory-movement-history-view">

                    <h2>سجل الحركات</h2>

                    <table id="inventory-movement-history-table">

                        <thead>

                            <tr>
                                <th>المنتج</th>
                                <th>النوع</th>
                                <th>الكمية</th>
                                <th>السبب</th>
                                <th>تاريخ الإنشاء</th>
                                <th>الحالة</th>
                            </tr>

                        </thead>

                        <tbody id="inventory-movement-history-body"></tbody>

                    </table>

                </section>

            </section>
        `;

    }

    public onEnter(): void {

        this.onLeave();

        this.form = document.getElementById("inventory-movement-form") as HTMLFormElement | null;
        this.productSelect = document.getElementById("inventory-product-select") as HTMLSelectElement | null;
        this.movementTypeSelect = document.getElementById("inventory-movement-type") as HTMLSelectElement | null;
        this.quantityInput = document.getElementById("inventory-quantity") as HTMLInputElement | null;
        this.reasonInput = document.getElementById("inventory-reason") as HTMLInputElement | null;
        this.submitButton = document.getElementById("inventory-submit") as HTMLButtonElement | null;
        this.messageElement = document.getElementById("inventory-message");
        this.currentQuantityElement = document.getElementById("inventory-current-quantity");
        this.productsBody = document.getElementById("inventory-products-body");
        this.movementHistoryBody = document.getElementById("inventory-movement-history-body");

        this.form?.addEventListener("submit", this.handleSubmit);
        this.productSelect?.addEventListener("change", this.handleProductChange);

        this.renderInventory();

    }

    public onLeave(): void {

        this.form?.removeEventListener("submit", this.handleSubmit);
        this.productSelect?.removeEventListener("change", this.handleProductChange);

        this.form = null;
        this.productSelect = null;
        this.movementTypeSelect = null;
        this.quantityInput = null;
        this.reasonInput = null;
        this.submitButton = null;
        this.messageElement = null;
        this.currentQuantityElement = null;
        this.productsBody = null;
        this.movementHistoryBody = null;

    }

    private submitMovement(): void {

        const productId = this.productSelect?.value.trim() ?? "";
        const movementType = this.movementTypeSelect?.value.trim() ?? "";
        const quantityDelta = Number(this.quantityInput?.value ?? "");
        const reason = this.reasonInput?.value.trim() ?? "";

        if (!productId) {
            this.setSubmitStatus("error", "اختر منتجاً.");
            return;
        }

        if (!this.isSupportedMovementType(movementType)) {
            this.setSubmitStatus("error", "اختر نوع حركة مدعوماً.");
            return;
        }

        if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
            this.setSubmitStatus("error", "فرق الكمية يجب أن يكون رقماً غير صفري.");
            return;
        }

        if (!reason) {
            this.setSubmitStatus("error", "السبب مطلوب.");
            return;
        }

        const result = this.inventoryService.addMovement({
            productId,
            type: movementType,
            quantityDelta,
            reason,
            referenceType: movementType === "opening_balance"
                ? "opening_balance"
                : "manual",
            metadata: {
                source: "inventory-manual-flow"
            }
        });

        if (!result.success) {
            this.setSubmitStatus("error", result.errors.join(" "));
            return;
        }

        this.selectedProductId = productId;

        if (this.quantityInput) {
            this.quantityInput.value = "";
        }

        if (this.reasonInput) {
            this.reasonInput.value = "";
        }

        this.setSubmitStatus("success", "تم حفظ الحركة.");
        this.renderInventory();

    }

    private renderInventory(): void {

        const products = this.productService.getAll();

        if (
            this.selectedProductId
            && !products.some(product => product.id === this.selectedProductId)
        ) {
            this.selectedProductId = "";
        }

        if (!this.selectedProductId && products.length > 0) {
            this.selectedProductId = products[0].id;
        }

        this.renderProductOptions(products);
        this.renderProductRows(products);
        this.renderMovementHistory(products);
        this.updateCurrentQuantity();
        this.updateDisabledState(products.length === 0);

    }

    private renderProductOptions(products: Product[]): void {

        if (!this.productSelect) {
            return;
        }

        this.productSelect.innerHTML = products.length === 0
            ? `<option value="">لا توجد منتجات نشطة</option>`
            : products.map(product => `
                <option
                    value="${this.escapeHtml(product.id)}"
                    ${product.id === this.selectedProductId ? "selected" : ""}
                >
                    ${this.escapeHtml(product.name)}
                </option>
            `).join("");

    }

    private renderProductRows(products: Product[]): void {

        if (!this.productsBody) {
            return;
        }

        if (products.length === 0) {
            this.productsBody.innerHTML = `
                <tr>
                    <td colspan="3">لا توجد منتجات نشطة.</td>
                </tr>
            `;
            return;
        }

        this.productsBody.innerHTML = products.map(product => {
            const currentQuantity = this.inventoryService.getCurrentQuantity(product.id);

            return `
                <tr
                    data-product-id="${this.escapeHtml(product.id)}"
                    data-current-quantity="${this.escapeHtml(currentQuantity)}"
                >
                    <td>${this.escapeHtml(product.name)}</td>
                    <td>${this.escapeHtml(product.barcode)}</td>
                    <td>${this.formatNumber(currentQuantity)}</td>
                </tr>
            `;
        }).join("");

    }

    private updateCurrentQuantity(): void {

        if (!this.currentQuantityElement) {
            return;
        }

        if (!this.selectedProductId) {
            this.currentQuantityElement.textContent = "الكمية الحالية: 0";
            this.currentQuantityElement.dataset.currentQuantity = "0";
            return;
        }

        const currentQuantity = this.inventoryService.getCurrentQuantity(
            this.selectedProductId
        );

        this.currentQuantityElement.textContent =
            `الكمية الحالية: ${this.formatNumber(currentQuantity)}`;
        this.currentQuantityElement.dataset.currentQuantity = String(currentQuantity);

    }

    private renderMovementHistory(products: Product[]): void {

        if (!this.movementHistoryBody) {
            return;
        }

        const movements = this.inventoryService.getAll();

        if (movements.length === 0) {
            this.movementHistoryBody.innerHTML = `
                <tr data-empty-history="true">
                    <td colspan="6">لا توجد حركات مخزون.</td>
                </tr>
            `;
            return;
        }

        const productsById = new Map(
            products.map(product => [product.id, product])
        );
        const reversedMovementIds = new Set(
            movements
                .filter(isReversalStockMovement)
                .map(movement => movement.reversalOfMovementId)
                .filter((movementId): movementId is string =>
                    Boolean(movementId)
                )
        );

        this.movementHistoryBody.innerHTML = movements
            .map(movement => this.renderMovementHistoryRow(
                movement,
                productsById.get(movement.productId),
                reversedMovementIds.has(movement.id)
            ))
            .join("");

    }

    private renderMovementHistoryRow(
        movement: StockMovement,
        product: Product | undefined,
        isReversed: boolean
    ): string {

        const isLegacyVoided = isLegacyVoidedStockMovement(movement);
        const isReversal = isReversalStockMovement(movement);
        const productLabel = product?.name ?? movement.productId;
        const movementReason = isReversal
            ? `${movement.reason} (الأصل: ${movement.reversalOfMovementId ?? ""})`
            : movement.reason;
        const movementStatus = isLegacyVoided
            ? "ملغاة (سجل قديم)"
            : isReversal
                ? "حركة عكس"
                : isReversed
                    ? "معكوسة"
                    : "نشطة";

        return `
            <tr
                data-movement-id="${this.escapeHtml(movement.id)}"
                data-product-id="${this.escapeHtml(movement.productId)}"
                data-movement-type="${this.escapeHtml(movement.type)}"
                data-quantity-delta="${this.escapeHtml(movement.quantityDelta)}"
                data-voided="${isLegacyVoided}"
                data-legacy-voided="${isLegacyVoided}"
                data-reversal="${isReversal}"
                data-reversal-of="${this.escapeHtml(movement.reversalOfMovementId)}"
                data-reversed="${isReversed}"
            >
                <td>${this.escapeHtml(productLabel)}</td>
                <td>${this.escapeHtml(this.formatMovementType(movement.type))}</td>
                <td>${this.formatNumber(movement.quantityDelta)}</td>
                <td>${this.escapeHtml(movementReason)}</td>
                <td>${this.escapeHtml(this.formatDateTime(movement.createdAt))}</td>
                <td>${movementStatus}</td>
            </tr>
        `;

    }

    private updateDisabledState(disabled: boolean): void {

        if (this.productSelect) {
            this.productSelect.disabled = disabled;
        }

        if (this.submitButton) {
            this.submitButton.disabled = disabled;
        }

    }

    private setSubmitStatus(status: "error" | "success", message: string): void {

        const page = document.getElementById("inventory-page");

        if (page) {
            page.dataset.lastSubmitStatus = status;
        }

        if (this.messageElement) {
            this.messageElement.textContent = message;
        }

    }

    private isSupportedMovementType(
        value: string
    ): value is InventoryUiMovementType {

        return value === "opening_balance" || value === "manual_adjustment";

    }

    private formatMovementType(value: string): string {
        if (value === "opening_balance") {
            return "رصيد افتتاحي";
        }

        if (value === "manual_adjustment") {
            return "تعديل يدوي";
        }

        if (value === "reversal") {
            return "عكس حركة";
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

    private escapeHtml(value: unknown): string {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

    private formatNumber(value: unknown): string {

        const numericValue = Number(value);

        if (!Number.isFinite(numericValue)) {
            return "0";
        }

        return String(numericValue);

    }

}
