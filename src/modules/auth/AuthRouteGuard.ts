import type { AuthStateService } from "./AuthStateService";

export type PublicRouteCheck = (route: string) => boolean;

export class AuthRouteGuard {

    private readonly authStateService: AuthStateService;

    private readonly isPublicRoute: PublicRouteCheck;

    public constructor(authStateService: AuthStateService, isPublicRoute: PublicRouteCheck) {

        this.authStateService = authStateService;

        this.isPublicRoute = isPublicRoute;

    }

    public async canActivate(route: string): Promise<boolean> {

        if (this.isPublicRoute(route)) {

            return true;

        }

        const currentState = this.authStateService.getState();

        if (currentState.status === "authenticated") {

            return true;

        }

        try {

            const initializedState = await this.authStateService.initialize();

            return initializedState.status === "authenticated";

        } catch {

            return false;

        }

    }

}
