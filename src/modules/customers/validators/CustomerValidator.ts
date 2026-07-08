import type { Customer } from "../Customer";

export class CustomerValidator {

    public validate(customer: Customer): string[] {

        const errors: string[] = [];

        if (!customer.id.trim()) {
            errors.push("معرّف العميل مطلوب.");
        }

        if (!customer.accountId.trim()) {
            errors.push("حساب العميل مطلوب.");
        }

        if (!customer.displayName.trim()) {
            errors.push("اسم العميل مطلوب.");
        }

        if (customer.status !== "active" && customer.status !== "inactive") {
            errors.push("حالة العميل غير صحيحة.");
        }

        if (!customer.createdAt.trim()) {
            errors.push("تاريخ إنشاء العميل مطلوب.");
        }

        if (!customer.createdBy.trim()) {
            errors.push("منشئ العميل مطلوب.");
        }

        if (!customer.updatedAt.trim()) {
            errors.push("تاريخ تعديل العميل مطلوب.");
        }

        if (!customer.updatedBy.trim()) {
            errors.push("محدّث العميل مطلوب.");
        }

        return errors;

    }

}
