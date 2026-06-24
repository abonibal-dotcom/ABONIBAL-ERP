import type { Product } from "../Product";

export class ProductValidator {

    public validate(product: Product): string[] {

        const errors: string[] = [];

        if (!product.name.trim()) {
            errors.push("اسم المنتج مطلوب.");
        }

        if (!product.barcode.trim()) {
            errors.push("الباركود مطلوب.");
        }

        return errors;

    }

}
