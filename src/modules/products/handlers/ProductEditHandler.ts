import { ProductController } from "../controllers/ProductController";
import { ProductDialog } from "../dialogs/ProductDialog";

export class ProductEditHandler {

    private readonly controller: ProductController;

    private readonly dialog: ProductDialog;

    constructor(
        controller: ProductController,
        dialog: ProductDialog
    ) {

        this.controller = controller;
        this.dialog = dialog;

    }

    public bind(): void {

        const productsBody =
            document.getElementById("products-body");

        if (!productsBody) {
            return;
        }

        productsBody.addEventListener("click", event => {

            const target =
                event.target as HTMLElement;

            const button =
                target.closest(
                    ".edit-product"
                ) as HTMLButtonElement | null;

            if (!button) {
                return;
            }

            const id =
                button.dataset.id;

            if (!id) {
                return;
            }

            const product =
                this.controller.find(id);

            if (!product) {
                return;
            }

            this.dialog.fill(product);

            this.dialog.open();

        });

    }

}
