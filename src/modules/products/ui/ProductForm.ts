export class ProductForm {

    public render(): string {

        return `
            <div class="product-form">

                <h2>📦 إضافة منتج جديد</h2>

                <div class="form-group">
                    <label>اسم المنتج</label>
                    <input
                        id="product-name"
                        type="text"
                        placeholder="اسم المنتج">
                </div>

                <div class="form-group">
                    <label>الاسم الإنجليزي</label>
                    <input
                        id="product-english-name"
                        type="text"
                        placeholder="English Name">
                </div>

                <div class="form-group">
                    <label>SKU</label>
                    <input
                        id="product-sku"
                        type="text"
                        placeholder="SKU">
                </div>

                <div class="form-group">
                    <label>الباركود</label>
                    <input
                        id="product-barcode"
                        type="text"
                        placeholder="Barcode">
                </div>

                <div class="form-group">
                    <label>التصنيف</label>
                    <input
                        id="product-category"
                        type="text"
                        placeholder="التصنيف">
                </div>

                <div class="form-group">
                    <label>العلامة التجارية</label>
                    <input
                        id="product-brand"
                        type="text"
                        placeholder="العلامة التجارية">
                </div>

                <div class="form-group">
                    <label>الوحدة</label>
                    <input
                        id="product-unit"
                        type="text"
                        placeholder="مثل: قطعة - كرتون - كيلو">
                </div>

                <div class="form-group">
                    <label>سعر الشراء</label>
                    <input
                        id="product-purchase"
                        type="number"
                        step="0.01"
                        placeholder="0">
                </div>

                <div class="form-group">
                    <label>سعر البيع</label>
                    <input
                        id="product-sale"
                        type="number"
                        step="0.01"
                        placeholder="0">
                </div>

                <div class="form-group">
                    <label>الضريبة (%)</label>
                    <input
                        id="product-tax"
                        type="number"
                        step="0.01"
                        placeholder="0">
                </div>

                <div class="form-group">
                    <label>الكمية</label>
                    <input
                        id="product-quantity"
                        type="number"
                        placeholder="0">
                </div>

                <div class="form-group">
                    <label>الحد الأدنى للمخزون</label>
                    <input
                        id="product-minimum"
                        type="number"
                        placeholder="0">
                </div>

                <div class="form-group">
                    <label>الوصف</label>
                    <textarea
                        id="product-description"
                        rows="4"
                        placeholder="وصف المنتج"></textarea>
                </div>

                <div class="form-group">
                    <label>صور المنتج</label>
                    <input
                        id="product-images"
                        type="file"
                        accept="image/*"
                        multiple>
                </div>

                <div class="form-group">
                    <label>
                        <input
                            id="product-active"
                            type="checkbox"
                            checked>

                        المنتج نشط
                    </label>
                </div>

                <button id="save-product">
                    💾 حفظ المنتج
                </button>

            </div>
        `;

    }

}
