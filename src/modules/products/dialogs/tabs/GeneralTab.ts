import { Input } from "../../../../ui/forms/Input";

export class GeneralTab {

    private nameInput: Input;
    private englishNameInput: Input;
    private skuInput: Input;
    private barcodeInput: Input;

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

            placeholder: "English Name"

        });

        this.skuInput = new Input({

            id: "product-sku",

            label: "SKU",

            placeholder: "SKU"

        });

        this.barcodeInput = new Input({

            id: "product-barcode",

            label: "Barcode",

            placeholder: "Barcode"

        });

    }

    public render(): string {

        return `
            <div class="product-tab">

                ${this.nameInput.render()}

                ${this.englishNameInput.render()}

                ${this.skuInput.render()}

                ${this.barcodeInput.render()}

            </div>
        `;

    }

}
