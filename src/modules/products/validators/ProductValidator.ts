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

        if (!Number.isFinite(product.salePrice) || product.salePrice < 0) {
            errors.push("سعر البيع يجب أن يكون رقماً صفراً أو أكبر.");
        }

        return errors;

    }

}
