import { Config } from "./Config";
import { Storage } from "./Storage";
import { Router } from "./Router";

import { LocalStorageDriver } from "./persistence/LocalStorageDriver";

import { ProductRepository } from "../modules/products/repositories/ProductRepository";
import { ProductValidator } from "../modules/products/validators/ProductValidator";
import { ProductService } from "../modules/products/services/ProductService";
import { StockMovementRepository } from "../modules/inventory/repositories/StockMovementRepository";
import { StockMovementValidator } from "../modules/inventory/validators/StockMovementValidator";
import { InventoryService } from "../modules/inventory/services/InventoryService";
import { InvoiceRepository } from "../modules/sales/repositories/InvoiceRepository";
import { InvoiceValidator } from "../modules/sales/validators/InvoiceValidator";
import { InvoiceService } from "../modules/sales/services/InvoiceService";
import { getAuthStateService } from "../modules/auth/AuthRuntime";

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
            productValidator,
            getAuthStateService()
        );

        this.register("productService", productService);

        const stockMovementRepository = new StockMovementRepository(driver);

        this.register("stockMovementRepository", stockMovementRepository);

        const stockMovementValidator = new StockMovementValidator();

        this.register("stockMovementValidator", stockMovementValidator);

        const inventoryService = new InventoryService(
            stockMovementRepository,
            stockMovementValidator,
            getAuthStateService(),
            productService
        );

        this.register("inventoryService", inventoryService);

        const invoiceRepository = new InvoiceRepository(driver);

        this.register("invoiceRepository", invoiceRepository);

        const invoiceValidator = new InvoiceValidator();

        this.register("invoiceValidator", invoiceValidator);

        const invoiceService = new InvoiceService(
            invoiceRepository,
            invoiceValidator,
            getAuthStateService(),
            inventoryService
        );

        this.register("invoiceService", invoiceService);

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
