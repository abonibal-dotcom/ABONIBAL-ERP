import { Container } from "./Container";
import { Router } from "./Router";

import { MainLayout } from "../layouts/MainLayout";
import { UIManager } from "../framework/UIManager";

export class Application {

    public start(): void {

        Container.boot();

        const layout = new MainLayout();

        document.body.innerHTML = layout.render();

        layout.bind();

        const ui =
            Container.get<UIManager>("ui");

        ui.boot();

        const router =
            Container.get<Router>("router");

        router.start();

        console.log("ABONIBAL ERP Started");

    }

}
