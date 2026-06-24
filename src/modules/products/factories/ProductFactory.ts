import type { Product } from "../Product";
import type { ProductData } from "../dto/ProductData";

export class ProductFactory {

    public create(data: ProductData): Product {

        return {

            // الهوية
            id: crypto.randomUUID(),

            sku: data.sku,

            barcode: data.barcode,

            // البيانات الأساسية
            name: data.name,

            englishName: data.englishName,

            description: "",

            // الصور
            images: [],

            // التصنيف
            category: "",

            brand: "",

            unit: "",

            // الأسعار
            purchasePrice: 0,

            salePrice: 0,

            taxRate: 0,

            // المخزون
            quantity: 0,

            minimumQuantity: 0,

            // الحالة
            isActive: true,

            // التواريخ
            createdAt: new Date(),

            updatedAt: new Date()

        };

    }

}
