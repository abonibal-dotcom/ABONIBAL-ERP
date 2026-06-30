import { DashboardPage } from "../pages/DashboardPage";

import { LoginPage } from "../modules/auth/pages/LoginPage";

import { ProductListPage } from "../modules/products/pages/ProductListPage";

export const routes = {

    dashboard: DashboardPage,

    login: LoginPage,

    products: ProductListPage,

};

export type RouteName = keyof typeof routes;

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
