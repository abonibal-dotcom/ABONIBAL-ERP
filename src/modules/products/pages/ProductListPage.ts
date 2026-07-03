import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import { ProductDialog } from "../dialogs/ProductDialog";
import { ProductFactory } from "../factories/ProductFactory";
import type { Product } from "../Product";
import type { ProductService } from "../services/ProductService";

export class ProductListPage extends Page {

    private dialog: ProductDialog;

    private productService: ProductService;

    private productFactory: ProductFactory;

    private openButton: HTMLElement | null = null;

    private saveButton: HTMLElement | null = null;

    private productsBody: HTMLElement | null = null;

    private closeButton: HTMLElement | null = null;

    private cancelButton: HTMLElement | null = null;

    private dialogElement: HTMLElement | null = null;

    private editingProductId: string | null = null;

    private readonly openDialog = (): void => {

        this.dialogElement?.classList.remove("hidden");

    };

    private readonly openCreateDialog = (): void => {

        this.editingProductId = null;

        this.dialog.clear();

        this.openDialog();

    };

    private readonly closeDialog = (): void => {

        this.dialogElement?.classList.add("hidden");

        this.editingProductId = null;

    };

    private readonly saveProduct = (): void => {

        if (this.editingProductId) {
            this.updateProduct(this.editingProductId);
            return;
        }

        const product = this.productFactory.create(
            this.dialog.values()
        );

        const errors = this.productService.add(product);

        if (errors.length > 0) {
            return;
        }

        this.closeDialog();

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

        if (!editButton) {
            return;
        }

        const productId = editButton.dataset.productId;

        if (!productId) {
            return;
        }

        this.openEditDialog(productId);

    };

    constructor() {

        super();

        this.dialog = new ProductDialog();

        this.productFactory = new ProductFactory();

        this.productService = Container.get<ProductService>("productService");

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

        const products = this.readProducts();

        if (products.length === 0) {
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

    private renderProductRows(products: Product[]): string {

        return products.map(product => `
            <tr data-product-id="${this.escapeHtml(product.id)}">

                <td>-</td>
                <td>${this.escapeHtml(product.name)}</td>
                <td>${this.escapeHtml(product.barcode)}</td>
                <td>${this.formatNumber(product.quantity)}</td>
                <td>${this.formatNumber(product.salePrice)}</td>
                <td>
                    <button
                        type="button"
                        data-action="edit-product"
                        data-product-id="${this.escapeHtml(product.id)}"
                    >
                        Edit
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
            barcode: product.barcode
        });

        this.openDialog();

    }

    private updateProduct(productId: string): void {

        const errors = this.productService.update(
            productId,
            this.dialog.values()
        );

        if (errors.length > 0) {
            return;
        }

        this.closeDialog();

        this.renderProductsIntoTable();

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

    public onEnter(): void {

        this.onLeave();

        this.openButton = document.getElementById("create-product");
        this.saveButton = document.getElementById("save-product");
        this.productsBody = document.getElementById("products-body");
        this.dialogElement = document.getElementById("product-dialog");
        this.closeButton = document.getElementById("close-product-dialog");
        this.cancelButton = document.getElementById("cancel-product");

        this.renderProductsIntoTable();

        this.openButton?.addEventListener("click", this.openCreateDialog);

        this.saveButton?.addEventListener("click", this.saveProduct);

        this.productsBody?.addEventListener("click", this.handleProductTableClick);

        this.closeButton?.addEventListener("click", this.closeDialog);

        this.cancelButton?.addEventListener("click", this.closeDialog);

    }

    public onLeave(): void {

        this.openButton?.removeEventListener("click", this.openCreateDialog);

        this.saveButton?.removeEventListener("click", this.saveProduct);

        this.productsBody?.removeEventListener("click", this.handleProductTableClick);

        this.closeButton?.removeEventListener("click", this.closeDialog);

        this.cancelButton?.removeEventListener("click", this.closeDialog);

        this.openButton = null;

        this.saveButton = null;

        this.productsBody = null;

        this.closeButton = null;

        this.cancelButton = null;

        this.dialogElement = null;

        this.editingProductId = null;

    }

}
