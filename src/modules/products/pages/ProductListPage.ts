import { Page } from "../../../framework/Page";
import { ProductDialog } from "../dialogs/ProductDialog";

export class ProductListPage extends Page {

    private dialog: ProductDialog;

    constructor() {

        super();

        this.dialog = new ProductDialog();

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

    public onEnter(): void {

        const openButton = document.getElementById("create-product");
        const dialog = document.getElementById("product-dialog");
        const closeButton = document.getElementById("close-product-dialog");
        const cancelButton = document.getElementById("cancel-product");

        openButton?.addEventListener("click", () => {
            dialog?.classList.remove("hidden");
        });

        closeButton?.addEventListener("click", () => {
            dialog?.classList.add("hidden");
        });

        cancelButton?.addEventListener("click", () => {
            dialog?.classList.add("hidden");
        });

    }

}
