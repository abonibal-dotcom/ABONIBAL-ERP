import type { Dialog } from "../../../framework/dialogs/Dialog";
import { DialogMode } from "../../../framework/dialogs/DialogMode";
import { Button } from "../../../ui/buttons/Button";

import type { Product } from "../Product";
import type { ProductData } from "../dto/ProductData";

import { GeneralTab } from "./tabs/GeneralTab";

export class ProductDialog
implements Dialog<Product> {

    private readonly generalTab: GeneralTab;

    private readonly saveButton: Button;

    private readonly cancelButton: Button;

    constructor() {

        this.generalTab = new GeneralTab();

        this.saveButton = new Button({

            id: "save-product",

            text: "حفظ",

            icon: "💾",

            variant: "success"

        });

        this.cancelButton = new Button({

            id: "cancel-product",

            text: "إلغاء",

            variant: "secondary"

        });

    }

    public render(): string {

        return `
            <div
                id="product-dialog"
                class="dialog hidden"
            >

                <div class="dialog-content">

                    <div class="dialog-header">

                        <h2 id="product-dialog-title">

                            📦 منتج جديد

                        </h2>

                        <button id="close-product-dialog">

                            ✕

                        </button>

                    </div>

                    <div class="dialog-body">

                        ${this.generalTab.render()}

                    </div>

                    <div class="dialog-footer">

                        ${this.saveButton.render()}

                        ${this.cancelButton.render()}

                    </div>

                </div>

            </div>
        `;

    }

    public open(): void {

        document
            .getElementById("product-dialog")
            ?.classList.remove("hidden");

    }

    public close(): void {

        document
            .getElementById("product-dialog")
            ?.classList.add("hidden");

    }

    public clear(): void {

        this.generalTab.clear();

        this.setMode(DialogMode.CREATE);

    }

    public fill(product: Product): void {

        this.generalTab.fill(product);

        this.setMode(DialogMode.EDIT);

    }

    public setMode(
        mode: DialogMode
    ): void {

        const title =
            document.getElementById(
                "product-dialog-title"
            );

        if (!title) {

            return;

        }

        title.textContent =
            mode === DialogMode.CREATE
                ? "📦 منتج جديد"
                : "✏️ تعديل المنتج";

    }

    public values(): ProductData {

        return {

            name: (
                document.getElementById(
                    "product-name"
                ) as HTMLInputElement
            ).value.trim(),

            englishName: (
                document.getElementById(
                    "product-english-name"
                ) as HTMLInputElement
            ).value.trim(),

            sku: (
                document.getElementById(
                    "product-sku"
                ) as HTMLInputElement
            ).value.trim(),

            barcode: (
                document.getElementById(
                    "product-barcode"
                ) as HTMLInputElement
            ).value.trim()

        };

    }

}
