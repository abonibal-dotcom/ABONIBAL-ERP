import { Input } from "../../../../ui/forms/Input";

import type { Product } from "../../Product";

export class GeneralTab {

    private readonly nameInput: Input;

    private readonly englishNameInput: Input;

    private readonly skuInput: Input;

    private readonly barcodeInput: Input;

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

    public fill(product: Product): void {

        (
            document.getElementById(
                "product-name"
            ) as HTMLInputElement
        ).value = product.name;

        (
            document.getElementById(
                "product-english-name"
            ) as HTMLInputElement
        ).value = product.englishName ?? "";

        (
            document.getElementById(
                "product-sku"
            ) as HTMLInputElement
        ).value = product.sku ?? "";

        (
            document.getElementById(
                "product-barcode"
            ) as HTMLInputElement
        ).value = product.barcode ?? "";

    }

    public clear(): void {

        (
            document.getElementById(
                "product-name"
            ) as HTMLInputElement
        ).value = "";

        (
            document.getElementById(
                "product-english-name"
            ) as HTMLInputElement
        ).value = "";

        (
            document.getElementById(
                "product-sku"
            ) as HTMLInputElement
        ).value = "";

        (
            document.getElementById(
                "product-barcode"
            ) as HTMLInputElement
        ).value = "";

    }

}
