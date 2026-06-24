import type { ProductData } from "../dto/ProductData";
import { GeneralTab } from "./tabs/GeneralTab";

export class ProductDialog {

    private generalTab: GeneralTab;

    constructor() {

        this.generalTab = new GeneralTab();

    }

    public render(): string {

        return `
            <div id="product-dialog" class="dialog hidden">

                <div class="dialog-content">

                    <div class="dialog-header">

                        <h2>📦 منتج جديد</h2>

                        <button id="close-product-dialog">
                            ✕
                        </button>

                    </div>

                    <div class="dialog-body">

                        ${this.generalTab.render()}

                    </div>

                    <div class="dialog-footer">

                        <button id="save-product">
                            حفظ
                        </button>

                        <button id="cancel-product">
                            إلغاء
                        </button>

                    </div>

                </div>

            </div>
        `;

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
