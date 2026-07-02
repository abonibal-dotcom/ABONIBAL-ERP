import { Container } from "../../core/Container";
import { Router } from "../../core/Router";
import { navigationRoutes } from "../../router/routes";

export class Sidebar {

    public render(): string {

        return `
            <nav id="sidebar">

                <h2>ABONIBAL ERP</h2>

                <ul class="menu">

                    ${navigationRoutes.map(route => `
                        <li class="menu-item" data-page="${route.name}">
                            ${route.label}
                        </li>
                    `).join("")}

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

                    void router.navigate(page);

                }

            });

        });

    }

}
