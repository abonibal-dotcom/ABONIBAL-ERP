import { Page } from "../../../framework/Page";
import { Container } from "../../../core/Container";
import { ProductDialog } from "../dialogs/ProductDialog";
import type { Product } from "../Product";
import type { ProductService } from "../services/ProductService";

export class ProductListPage extends Page {

    private dialog: ProductDialog;

    private productService: ProductService;

    private openButton: HTMLElement | null = null;

    private closeButton: HTMLElement | null = null;

    private cancelButton: HTMLElement | null = null;

    private dialogElement: HTMLElement | null = null;

    private readonly openDialog = (): void => {

        this.dialogElement?.classList.remove("hidden");

    };

    private readonly closeDialog = (): void => {

        this.dialogElement?.classList.add("hidden");

    };

    constructor() {

        super();

        this.dialog = new ProductDialog();

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
                <td>-</td>

            </tr>
        `).join("");

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
        this.dialogElement = document.getElementById("product-dialog");
        this.closeButton = document.getElementById("close-product-dialog");
        this.cancelButton = document.getElementById("cancel-product");

        this.renderProductsIntoTable();

        this.openButton?.addEventListener("click", this.openDialog);

        this.closeButton?.addEventListener("click", this.closeDialog);

        this.cancelButton?.addEventListener("click", this.closeDialog);

    }

    public onLeave(): void {

        this.openButton?.removeEventListener("click", this.openDialog);

        this.closeButton?.removeEventListener("click", this.closeDialog);

        this.cancelButton?.removeEventListener("click", this.closeDialog);

        this.openButton = null;

        this.closeButton = null;

        this.cancelButton = null;

        this.dialogElement = null;

    }

}
