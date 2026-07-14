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
            ).value.trim(),

            salePrice: this.readNumber("product-sale-price"),

            openingQuantity: this.readNumber("product-opening-quantity")

        };

    }

    public fill(data: ProductData): void {

        this.setInputValue("product-name", data.name);
        this.setInputValue("product-english-name", data.englishName);
        this.setInputValue("product-sku", data.sku);
        this.setInputValue("product-barcode", data.barcode);
        this.setInputValue("product-sale-price", String(data.salePrice ?? 0));
        this.setInputValue("product-opening-quantity", String(data.openingQuantity ?? 0));

    }

    public clear(): void {

        this.fill({
            name: "",
            englishName: "",
            sku: "",
            barcode: "",
            salePrice: 0,
            openingQuantity: 0
        });

    }

    public setCreateMode(): void {

        this.setInputValue("product-opening-quantity", "0");
        this.setHidden("product-opening-quantity-field", false);
        this.setHidden("product-current-quantity-field", true);

    }

    public setEditMode(currentQuantity: number): void {

        this.setHidden("product-opening-quantity-field", true);
        this.setHidden("product-current-quantity-field", false);
        this.setTextValue("product-current-quantity", String(currentQuantity));

    }

    private setInputValue(id: string, value: string): void {

        const input = document.getElementById(id) as HTMLInputElement | null;

        if (!input) {
            return;
        }

        input.value = value;

    }

    private setTextValue(id: string, value: string): void {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }

    }

    private setHidden(id: string, hidden: boolean): void {

        const element = document.getElementById(id);

        if (element) {
            element.hidden = hidden;
        }

    }

    private readNumber(id: string): number {

        const input = document.getElementById(id) as HTMLInputElement | null;

        return Number(input?.value ?? "");

    }

}
