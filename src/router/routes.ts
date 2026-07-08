import { DashboardPage } from "../pages/DashboardPage";

import { LoginPage } from "../modules/auth/pages/LoginPage";

import { InventoryPage } from "../modules/inventory/pages/InventoryPage";

import { CustomerListPage } from "../modules/customers/pages/CustomerListPage";
import { ProductListPage } from "../modules/products/pages/ProductListPage";
import { InvoiceDraftPage } from "../modules/sales/pages/InvoiceDraftPage";
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

    customers: {
        page: CustomerListPage,
        access: "protected" as const,
    },

    inventory: {
        page: InventoryPage,
        access: "protected" as const,
    },

    invoices: {
        page: InvoiceDraftPage,
        access: "protected" as const,
    },

};

export type RouteName = keyof typeof routeRegistry;

export const routes: Record<RouteName, RoutePage> = {

    dashboard: routeRegistry.dashboard.page,

    login: routeRegistry.login.page,

    products: routeRegistry.products.page,

    customers: routeRegistry.customers.page,

    inventory: routeRegistry.inventory.page,

    invoices: routeRegistry.invoices.page,

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
        label: "🔐 تسجيل الدخول"
    },

    {
        name: "products",
        label: "📦 المنتجات"
    },

    {
        name: "customers",
        label: "👥 العملاء"
    },

    {
        name: "inventory",
        label: "🏬 المخزون"
    },

    {
        name: "invoices",
        label: "🧾 الفواتير"
    },

];
