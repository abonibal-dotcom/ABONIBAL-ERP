import { DashboardPage } from "../pages/DashboardPage";

import { LoginPage } from "../modules/auth/pages/LoginPage";

import { ProductListPage } from "../modules/products/pages/ProductListPage";
import type { Page } from "../framework/Page";

export type RouteAccess = "public" | "protected";

export type RoutePage = new () => Page;

export interface RouteDefinition {

    page: RoutePage;

    access: RouteAccess;

}

export const routeRegistry = {

    dashboard: {
        page: DashboardPage,
        access: "protected" as const,
    },

    login: {
        page: LoginPage,
        access: "public" as const,
    },

    products: {
        page: ProductListPage,
        access: "protected" as const,
    },

};

export type RouteName = keyof typeof routeRegistry;

export const routes: Record<RouteName, RoutePage> = {

    dashboard: routeRegistry.dashboard.page,

    login: routeRegistry.login.page,

    products: routeRegistry.products.page,

};

export function getRouteDefinition(route: string): RouteDefinition | null {

    if (!isRouteName(route)) {

        return null;

    }

    return routeRegistry[route];

}

export function isPublicRoute(route: string): boolean {

    return getRouteDefinition(route)?.access === "public";

}

function isRouteName(route: string): route is RouteName {

    return route in routeRegistry;

}

export interface NavigationRoute {

    name: RouteName;

    label: string;

}

export const navigationRoutes: NavigationRoute[] = [

    {
        name: "dashboard",
        label: "🏠 الرئيسية"
    },

    {
        name: "login",
        label: "Login"
    },

    {
        name: "products",
        label: "📦 المنتجات"
    },

];
