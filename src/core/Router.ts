import { Page } from "../framework/Page";
import { PageManager } from "../router/PageManager";
import { getRouteDefinition, isPublicRoute } from "../router/routes";
import { AuthRouteGuard } from "../modules/auth/AuthRouteGuard";
import { getAuthStateService } from "../modules/auth/AuthRuntime";

export class Router {

    private readonly pageManager = new PageManager();

    private readonly authRouteGuard = new AuthRouteGuard(
        getAuthStateService(),
        isPublicRoute
    );

    public async navigate(route: string): Promise<void> {

        const routeDefinition = getRouteDefinition(route);

        if (!routeDefinition) {
            console.error(`Route "${route}" not found.`);
            return;
        }

        const canActivate = await this.authRouteGuard.canActivate(route);

        if (!canActivate) {

            await this.navigate("login");

            return;

        }

        const page: Page = new routeDefinition.page();

        this.pageManager.open(page);

    }

    public start(): void {

        void this.navigate("dashboard");

    }

}
