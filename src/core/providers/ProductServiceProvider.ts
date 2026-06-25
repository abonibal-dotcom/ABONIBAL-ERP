import { LocalStorageDriver } from "../persistence/LocalStorageDriver";
import { ServiceProvider } from "./ServiceProvider";

import { ProductController } from "../../modules/products/controllers/ProductController";
import { ProductDialog } from "../../modules/products/dialogs/ProductDialog";
import { ProductTable } from "../../modules/products/components/ProductTable";
import { ProductFactory } from "../../modules/products/factories/ProductFactory";
import { ProductRepository } from "../../modules/products/repositories/ProductRepository";
import { ProductService } from "../../modules/products/services/ProductService";
import { ProductValidator } from "../../modules/products/validators/ProductValidator";

export class ProductServiceProvider extends ServiceProvider {

    public register(): void {

        const driver =
            new LocalStorageDriver();

        this.container.register(
            "driver",
            driver
        );

        const repository =
            new ProductRepository(driver);

        this.container.register(
            "productRepository",
            repository
        );

        const validator =
            new ProductValidator();

        this.container.register(
            "productValidator",
            validator
        );

        const factory =
            new ProductFactory();

        this.container.register(
            "productFactory",
            factory
        );

        const service =
            new ProductService(
                repository,
                validator,
                factory
            );

        this.container.register(
            "productService",
            service
        );

        const controller =
            new ProductController(
                service
            );

        this.container.register(
            "productController",
            controller
        );

        const dialog =
            new ProductDialog();

        this.container.register(
            "productDialog",
            dialog
        );

        const table =
            new ProductTable();

        this.container.register(
            "productTable",
            table
        );

    }

}
