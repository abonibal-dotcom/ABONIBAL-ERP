import { Config } from "./Config";
import { Storage } from "./Storage";
import { Router } from "./Router";

import { LocalStorageDriver } from "./persistence/LocalStorageDriver";

import { ProductRepository } from "../modules/products/repositories/ProductRepository";
import { ProductValidator } from "../modules/products/validators/ProductValidator";
import { ProductService } from "../modules/products/services/ProductService";

export class Container {

    private static services = new Map<string, any>();

    public static boot(): void {

        this.register("config", Config);

        this.register("storage", new Storage());

        this.register("router", new Router());

        const driver = new LocalStorageDriver();

        this.register("driver", driver);

        const productRepository = new ProductRepository(driver);

        this.register("productRepository", productRepository);

        const productValidator = new ProductValidator();

        this.register("productValidator", productValidator);

        const productService = new ProductService(
            productRepository,
            productValidator
        );

        this.register("productService", productService);

    }

    public static register(name: string, service: any): void {

        this.services.set(name, service);

    }

    public static get<T>(name: string): T {

        if (!this.services.has(name)) {

            throw new Error(`Service "${name}" is not registered.`);

        }

        return this.services.get(name);

    }

    public static has(name: string): boolean {

        return this.services.has(name);

    }

    public static remove(name: string): void {

        this.services.delete(name);

    }

    public static clear(): void {

        this.services.clear();

    }

}
