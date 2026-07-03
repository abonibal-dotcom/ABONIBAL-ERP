export interface Product {

    // الهوية
    id: string;
    sku: string;
    barcode: string;

    // البيانات الأساسية
    name: string;
    englishName?: string;
    description: string;

    // الصور
    images: string[];

    // التصنيف
    category: string;
    brand: string;
    unit: string;

    // الأسعار
    purchasePrice: number;
    salePrice: number;
    taxRate: number;

    // المخزون
    quantity: number;
    minimumQuantity: number;

    // الحالة
    isActive: boolean;

    accountId?: string;
    createdBy?: string;
    updatedBy?: string;

    // التواريخ
    createdAt: Date;
    updatedAt: Date;

}
