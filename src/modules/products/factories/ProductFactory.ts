import type { Product } from "../Product";
import type { ProductData } from "../dto/ProductData";

export class ProductFactory {

    public create(
        data: ProductData,
        identity?: ProductFactoryIdentity
    ): Product {

        const timestamp = identity
            ? new Date(identity.timestamp.getTime())
            : new Date();

        return {

            // الهوية
            id: identity?.id ?? crypto.randomUUID(),

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

            salePrice: data.salePrice,

            taxRate: 0,

            // المخزون
            quantity: 0,

            minimumQuantity: 0,

            // الحالة
            isActive: true,

            // التواريخ
            createdAt: timestamp,

            updatedAt: new Date(timestamp.getTime())

        };

    }

}

export interface ProductFactoryIdentity {

    id: string;

    timestamp: Date;

}
