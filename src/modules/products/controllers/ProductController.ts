import { BaseController } from "../../../framework/BaseController";

import type { Product } from "../Product";
import type { ProductData } from "../dto/ProductData";

import { ProductService } from "../services/ProductService";

export class ProductController extends BaseController {

    private readonly service: ProductService;

    constructor(service: ProductService) {

        super();

        this.service = service;

    }

    public getAll(): Product[] {

        return this.service.getAll();

    }

    public find(id: string): Product | undefined {

        return this.service.find(id);

    }

    public create(data: ProductData): string[] {

        const errors = this.service.add(data);

        if (errors.length > 0) {

            return errors;

        }

        this.emit(
            "product.created",
            data
        );

        return [];

    }

    public update(
        id: string,
        data: Partial<Product>
    ): string[] {

        const errors =
            this.service.update(
                id,
                data
            );

        if (errors.length > 0) {

            return errors;

        }

        this.emit(
            "product.updated",
            id
        );

        return [];

    }

    public delete(id: string): void {

        this.service.remove(id);

        this.emit(
            "product.deleted",
            id
        );

    }

}
