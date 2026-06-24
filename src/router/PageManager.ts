import { Page } from "../framework/Page";
import { routes } from "./routes";

export class PageManager {

    private currentPage: Page | null = null;

    public open(page: Page): void {

        if (this.currentPage) {
            this.currentPage.onLeave();
        }

        this.currentPage = page;

        const workspace = document.getElementById("workspace");

        if (workspace) {
            workspace.innerHTML = page.render();
        }

        document.title = page.title();

        page.onEnter();

    }

    public navigate(name: string): void {

      const PageClass = (routes as Record<string, new () => Page>)[name];

        if (!PageClass) {
            console.warn("Page not found:", name);
            return;
        }

        this.open(new PageClass());

    }

}
