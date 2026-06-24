import { Page } from "../framework/Page";
import { PageManager } from "../router/PageManager";
import { routes } from "../router/routes";

export class Router {

    private readonly pageManager = new PageManager();

    public navigate(route: string): void {

        const PageClass = (routes as any)[route];

        if (!PageClass) {
            console.error(`Route "${route}" not found.`);
            return;
        }

        const page: Page = new PageClass();

        this.pageManager.open(page);

    }

    public start(): void {

        this.navigate("dashboard");

    }

}
