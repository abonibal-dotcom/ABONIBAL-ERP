import { Container } from "./Container";

import { MainLayout } from "../layouts/MainLayout";

import { Router } from "./Router";

export class Application {

    public start(): void {

        Container.boot();

        const layout = new MainLayout();

        document.body.innerHTML = layout.render();

        layout.bind();

        const router = Container.get<Router>("router");

        router.start()

        console.log("ABONIBAL ERP Started");

    }

}
