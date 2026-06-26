import { DashboardPage } from "../pages/DashboardPage";

import { ProductListPage } from "../modules/products/pages/ProductListPage";

export const routes = {

    dashboard: DashboardPage,

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
        name: "products",
        label: "📦 المنتجات"
    },

];
