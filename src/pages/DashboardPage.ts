import { Page } from "../framework/Page";

export class DashboardPage extends Page {

    public title(): string {
        return "لوحة التحكم";
    }

    public render(): string {

        return `

            <h1>لوحة التحكم</h1>

            <p>مرحباً بك في نظام ABONIBAL ERP</p>

            <hr>

            <h2>هذه الصفحة أصبحت تُدار بواسطة PageManager.</h2>

            <p>الخطوة التالية هي ربط عناصر القائمة الجانبية بالتنقل.</p>

        `;

    }

}
