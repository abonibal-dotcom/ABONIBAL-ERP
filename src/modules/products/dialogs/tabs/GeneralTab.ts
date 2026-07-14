import { Input } from "../../../../ui/forms/Input";

export class GeneralTab {

    private nameInput: Input;
    private englishNameInput: Input;
    private skuInput: Input;
    private barcodeInput: Input;

    private salePriceInput: Input;

    private openingQuantityInput: Input;

    constructor() {

        this.nameInput = new Input({

            id: "product-name",

            label: "اسم المنتج",

            placeholder: "أدخل اسم المنتج",

            required: true

        });

        this.englishNameInput = new Input({

            id: "product-english-name",

            label: "الاسم الإنجليزي",

            placeholder: "الاسم الإنجليزي"

        });

        this.skuInput = new Input({

            id: "product-sku",

            label: "رمز SKU",

            placeholder: "رمز SKU"

        });

        this.barcodeInput = new Input({

            id: "product-barcode",

            label: "الباركود",

            placeholder: "الباركود"

        });

        this.salePriceInput = new Input({

            id: "product-sale-price",

            label: "سعر البيع الافتراضي",

            type: "number",

            placeholder: "0"

        });

        this.openingQuantityInput = new Input({

            id: "product-opening-quantity",

            label: "الكمية الافتتاحية",

            type: "number",

            placeholder: "0"

        });

    }

    public render(): string {

        return `
            <div class="product-tab">

                ${this.nameInput.render()}

                ${this.englishNameInput.render()}

                ${this.skuInput.render()}

                ${this.barcodeInput.render()}

                ${this.salePriceInput.render()}

                <div id="product-opening-quantity-field">
                    ${this.openingQuantityInput.render()}
                </div>

                <p id="product-current-quantity-field" hidden>
                    الكمية الحالية المشتقة من المخزون:
                    <strong id="product-current-quantity">0</strong>
                </p>

            </div>
        `;

    }

}
