import { Config } from "../Config";
import { Router } from "../Router";
import { Storage } from "../Storage";

import { UIManager } from "../../framework/UIManager";

import { ServiceProvider } from "./ServiceProvider";

export class CoreServiceProvider extends ServiceProvider {

    public register(): void {

        this.container.register(
            "config",
            Config
        );

        this.container.register(
            "storage",
            new Storage()
        );

        this.container.register(
            "router",
            new Router()
        );

        this.container.register(
            "ui",
            new UIManager()
        );

    }

}
