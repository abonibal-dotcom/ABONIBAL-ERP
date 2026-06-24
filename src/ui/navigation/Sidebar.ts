import { Container } from "../../core/Container";
import { Router } from "../../core/Router";
export class Sidebar {

    public render(): string {

        return `
            <nav id="sidebar">

                <h2>ABONIBAL ERP</h2>

                <ul class="menu">

                    <li class="menu-item" data-page="dashboard">🏠 الرئيسية</li>

                    <li class="menu-item" data-page="products">📦 المنتجات</li>

                    <li class="menu-item" data-page="sales">🛒 المبيعات</li>

                    <li class="menu-item" data-page="purchases">📥 المشتريات</li>

                    <li class="menu-item" data-page="customers">👥 العملاء</li>

                    <li class="menu-item" data-page="suppliers">🚚 الموردون</li>

                    <li class="menu-item" data-page="cash">💰 الصندوق</li>

                    <li class="menu-item" data-page="reports">📊 التقارير</li>

                    <li class="menu-item" data-page="settings">⚙ الإعدادات</li>

                </ul>

            </nav>
        `;
    }

    public bind(): void {

        const router = Container.get<Router>("router");

        document.querySelectorAll(".menu-item").forEach(item => {

            item.addEventListener("click", () => {

                const page = (item as HTMLElement).dataset.page;

                if (page) {

                    router.navigate(page);

                }

            });

        });

    }

}
