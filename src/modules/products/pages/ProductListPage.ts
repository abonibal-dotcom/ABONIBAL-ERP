import { Page } from "../../../framework/Page";
import { ProductDialog } from "../dialogs/ProductDialog";

export class ProductListPage extends Page {

    private dialog: ProductDialog;

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

        this.onLeave();

        this.openButton = document.getElementById("create-product");
        this.dialogElement = document.getElementById("product-dialog");
        this.closeButton = document.getElementById("close-product-dialog");
        this.cancelButton = document.getElementById("cancel-product");

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
