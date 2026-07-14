import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import { ProductDialog } from "../dialogs/ProductDialog";
import { ProductFactory } from "../factories/ProductFactory";
import type { Product } from "../Product";
import type { ProductService } from "../services/ProductService";
import type { InventoryService } from "../../inventory/services/InventoryService";

export class ProductListPage extends Page {

    private dialog: ProductDialog;

    private productService: ProductService;

    private inventoryService: InventoryService;

    private productFactory: ProductFactory;

    private openButton: HTMLElement | null = null;

    private saveButton: HTMLElement | null = null;

    private productsBody: HTMLElement | null = null;

    private searchInput: HTMLInputElement | null = null;

    private closeButton: HTMLElement | null = null;

    private cancelButton: HTMLElement | null = null;

    private dialogElement: HTMLElement | null = null;

    private messageElement: HTMLElement | null = null;

    private editingProductId: string | null = null;

    private searchQuery = "";

    private isSaving = false;

    private readonly openDialog = (): void => {

        this.dialogElement?.classList.remove("hidden");

    };

    private readonly openCreateDialog = (): void => {

        this.editingProductId = null;

        this.dialog.clear();

        this.dialog.setCreateMode();

        this.setMessage("");

        this.openDialog();

    };

    private readonly closeDialog = (): void => {

        this.dialogElement?.classList.add("hidden");

        this.editingProductId = null;

    };

    private readonly saveProduct = (): void => {

        if (this.isSaving) {
            return;
        }

        this.isSaving = true;

        if (this.saveButton instanceof HTMLButtonElement) {
            this.saveButton.disabled = true;
        }

        try {

            if (this.editingProductId) {
                this.updateProduct(this.editingProductId);
                return;
            }

            const data = this.dialog.values();

            if (!Number.isFinite(data.openingQuantity) || data.openingQuantity < 0) {
                this.setMessage("الكمية الافتتاحية يجب أن تكون صفراً أو أكبر.");
                return;
            }

            const product = this.productFactory.create(data);

            const errors = this.productService.add(product);

            if (errors.length > 0) {
                this.setMessage(errors.join(" "));
                return;
            }

            if (data.openingQuantity > 0) {
                const movementResult = this.inventoryService
                    .addOpeningBalanceForNewProduct(
                        product.id,
                        data.openingQuantity
                    );

                if (!movementResult.success) {
                    const rollbackErrors = this.productService.safeDelete(product.id);
                    const rollbackMessage = rollbackErrors.length === 0
                        ? "تمت أرشفة المنتج الجديد لمنع حالة جزئية."
                        : "تعذر أرشفة المنتج الجديد بعد فشل حركة المخزون.";

                    this.setMessage([
                        ...movementResult.errors,
                        rollbackMessage
                    ].join(" "));
                    this.renderProductsIntoTable();
                    return;
                }
            }

            this.closeDialog();

            this.renderProductsIntoTable();

            this.setMessage("تم حفظ المنتج.");

        } finally {

            this.isSaving = false;

            if (this.saveButton instanceof HTMLButtonElement) {
                this.saveButton.disabled = false;
            }

        }

    };

    private readonly handleSearchInput = (): void => {

        this.searchQuery = this.searchInput?.value.trim().toLowerCase() ?? "";

        this.renderProductsIntoTable();

    };

    private readonly handleProductTableClick = (event: Event): void => {

        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editButton = target.closest<HTMLButtonElement>(
            "[data-action=\"edit-product\"]"
        );

        const deleteButton = target.closest<HTMLButtonElement>(
            "[data-action=\"safe-delete-product\"]"
        );

        const productId = editButton?.dataset.productId
            ?? deleteButton?.dataset.productId;

        if (!productId) {
            return;
        }

        if (editButton) {
            this.openEditDialog(productId);
            return;
        }

        if (deleteButton) {
            this.safeDeleteProduct(productId);
        }

    };

    constructor() {

        super();

        this.dialog = new ProductDialog();

        this.productFactory = new ProductFactory();

        this.productService = Container.get<ProductService>("productService");

        this.inventoryService = Container.get<InventoryService>("inventoryService");

    }

    public title(): string {

        return "المنتجات";

    }

    public render(): string {

        return `
            <div class="products-page">

                <div class="page-header">

                    <h1>📦 المنتجات</h1>

                    <button id="create-product">
                        + منتج جديد
                    </button>

                </div>

                <p id="product-message" role="status" aria-live="polite"></p>

                <div class="page-toolbar">

                    <input
                        id="product-search"
                        type="text"
                        placeholder="🔍 ابحث عن منتج..."
                    >

                </div>

                <div id="products-table">

                    <table>

                        <thead>

                            <tr>

                                <th>الصورة</th>
                                <th>الاسم</th>
                                <th>الباركود</th>
                                <th>الكمية</th>
                                <th>السعر</th>
                                <th>الإجراءات</th>

                            </tr>

                        </thead>

                        <tbody id="products-body">

                            <tr>

                                <td colspan="6">

                                    لا توجد منتجات حتى الآن.

                                </td>

                            </tr>

                        </tbody>

                    </table>

                </div>

                ${this.dialog.render()}

            </div>
        `;

    }

    private renderProductsIntoTable(): void {

        const productsBody = document.getElementById("products-body");

        if (!productsBody) {
            return;
        }

        const products = this.filterProducts(
            this.readProducts()
        );

        if (products.length === 0) {
            productsBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        ظ„ط§ طھظˆط¬ط¯ ظ…ظ†طھط¬ط§طھ ط­طھظ‰ ط§ظ„ط¢ظ†.
                    </td>
                </tr>
            `;
            return;
        }

        productsBody.innerHTML = this.renderProductRows(products);

    }

    private readProducts(): Product[] {

        const products = this.productService.getAll();

        if (!Array.isArray(products)) {
            return [];
        }

        return products;

    }

    private filterProducts(products: Product[]): Product[] {

        if (!this.searchQuery) {
            return products;
        }

        return products.filter(product => this.productMatchesSearch(product));

    }

    private productMatchesSearch(product: Product): boolean {

        const searchableText = [
            product.name,
            product.barcode,
            product.category
        ]
            .map(value => String(value ?? "").toLowerCase())
            .join(" ");

        return searchableText.includes(this.searchQuery);

    }

    private renderProductRows(products: Product[]): string {

        return products.map(product => `
            <tr data-product-id="${this.escapeHtml(product.id)}">

                <td>-</td>
                <td>${this.escapeHtml(product.name)}</td>
                <td>${this.escapeHtml(product.barcode)}</td>
                <td>${this.formatNumber(this.inventoryService.getCurrentQuantity(product.id))}</td>
                <td>${this.formatNumber(product.salePrice)}</td>
                <td>
                    <button
                        type="button"
                        data-action="edit-product"
                        data-product-id="${this.escapeHtml(product.id)}"
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        data-action="safe-delete-product"
                        data-product-id="${this.escapeHtml(product.id)}"
                    >
                        Delete
                    </button>
                </td>

            </tr>
        `).join("");

    }

    private openEditDialog(productId: string): void {

        const product = this.productService.find(productId);

        if (!product) {
            return;
        }

        this.editingProductId = product.id;

        this.dialog.fill({
            name: product.name,
            englishName: product.englishName ?? "",
            sku: product.sku,
            barcode: product.barcode,
            salePrice: product.salePrice ?? 0,
            openingQuantity: 0
        });

        this.dialog.setEditMode(
            this.inventoryService.getCurrentQuantity(product.id)
        );

        this.openDialog();

    }

    private updateProduct(productId: string): void {

        const data = this.dialog.values();
        const errors = this.productService.update(productId, {
            name: data.name,
            englishName: data.englishName,
            sku: data.sku,
            barcode: data.barcode,
            salePrice: data.salePrice
        });

        if (errors.length > 0) {
            this.setMessage(errors.join(" "));
            return;
        }

        this.closeDialog();

        this.renderProductsIntoTable();

        this.setMessage("تم تعديل المنتج.");

    }

    private safeDeleteProduct(productId: string): void {

        if (!window.confirm("Archive this product?")) {
            return;
        }

        const errors = this.productService.safeDelete(productId);

        if (errors.length > 0) {
            this.setMessage(errors.join(" "));
            return;
        }

        this.renderProductsIntoTable();

        this.setMessage("تمت أرشفة المنتج.");

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

    private setMessage(message: string): void {

        if (this.messageElement) {
            this.messageElement.textContent = message;
        }

    }

    public onEnter(): void {

        this.onLeave();

        this.openButton = document.getElementById("create-product");
        this.saveButton = document.getElementById("save-product");
        this.productsBody = document.getElementById("products-body");
        this.searchInput = document.getElementById("product-search") as HTMLInputElement | null;
        this.dialogElement = document.getElementById("product-dialog");
        this.messageElement = document.getElementById("product-message");
        this.closeButton = document.getElementById("close-product-dialog");
        this.cancelButton = document.getElementById("cancel-product");
        this.searchQuery = this.searchInput?.value.trim().toLowerCase() ?? "";

        this.renderProductsIntoTable();

        this.openButton?.addEventListener("click", this.openCreateDialog);

        this.searchInput?.addEventListener("input", this.handleSearchInput);

        this.saveButton?.addEventListener("click", this.saveProduct);

        this.productsBody?.addEventListener("click", this.handleProductTableClick);

        this.closeButton?.addEventListener("click", this.closeDialog);

        this.cancelButton?.addEventListener("click", this.closeDialog);

    }

    public onLeave(): void {

        this.openButton?.removeEventListener("click", this.openCreateDialog);

        this.searchInput?.removeEventListener("input", this.handleSearchInput);

        this.saveButton?.removeEventListener("click", this.saveProduct);

        this.productsBody?.removeEventListener("click", this.handleProductTableClick);

        this.closeButton?.removeEventListener("click", this.closeDialog);

        this.cancelButton?.removeEventListener("click", this.closeDialog);

        this.openButton = null;

        this.saveButton = null;

        this.productsBody = null;

        this.searchInput = null;

        this.closeButton = null;

        this.cancelButton = null;

        this.dialogElement = null;

        this.messageElement = null;

        this.editingProductId = null;

        this.searchQuery = "";

        this.isSaving = false;

    }

}
