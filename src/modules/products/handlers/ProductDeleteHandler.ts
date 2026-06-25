import { UIManager } from "../../../framework/UIManager";

import { ProductController } from "../controllers/ProductController";

export class ProductDeleteHandler {

    private readonly controller: ProductController;
    private readonly ui: UIManager;

    constructor(
        controller: ProductController,
        ui: UIManager
    ) {

        this.controller = controller;
        this.ui = ui;

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
                    ".delete-product"
                ) as HTMLButtonElement | null;

            if (!button) {
                return;
            }

            const id =
                button.dataset.id;

            if (!id) {
                return;
            }

            this.ui.confirm().confirm(

                "هل تريد حذف هذا المنتج؟",

                () => {

                    this.controller.delete(id);

                }

            );

        });

    }

}
