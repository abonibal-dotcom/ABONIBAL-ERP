import type { Product } from "../Product";

export class ProductTable {

    public render(products: Product[]): string {

        if (products.length === 0) {

            return this.renderEmpty();

        }

        return products
            .map(product => this.renderRow(product))
            .join("");

    }

    private renderEmpty(): string {

        return `
            <tr>

                <td colspan="6">
                    لا توجد منتجات حتى الآن.
                </td>

            </tr>
        `;

    }

    private renderRow(product: Product): string {

        return `
            <tr>

                <td>📦</td>

                <td>${product.name}</td>

                <td>${product.barcode}</td>

                <td>${product.quantity}</td>

                <td>${product.salePrice}</td>

                <td>

                    <button
                        class="edit-product"
                        data-id="${product.id}"
                    >
                        ✏️
                    </button>

                    <button
                        class="delete-product"
                        data-id="${product.id}"
                    >
                        🗑️
                    </button>

                </td>

            </tr>
        `;

    }

}
