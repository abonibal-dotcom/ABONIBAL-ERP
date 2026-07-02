import type { Product } from "../Product";
import type { ProductData } from "../dto/ProductData";

import { ProductFactory } from "../factories/ProductFactory";
import { ProductRepository } from "../repositories/ProductRepository";
import { ProductValidator } from "../validators/ProductValidator";

export class ProductService {

    private readonly repository: ProductRepository;

    private readonly validator: ProductValidator;

    private readonly factory: ProductFactory;

    constructor(
        repository: ProductRepository,
        validator: ProductValidator,
        factory: ProductFactory
    ) {

        this.repository = repository;
        this.validator = validator;
        this.factory = factory;

    }

    public getAll(): Product[] {

        return this.repository.all();

    }

    public find(id: string): Product | undefined {

        return this.repository.find(id);

    }

    public add(data: ProductData): string[] {

        const product =
            this.factory.create(data);

        const errors =
            this.validator.validate(product);

        if (errors.length > 0) {

            return errors;

        }

        this.repository.add(product);

        return [];

    }

    public update(
        id: string,
        data: Partial<Product>
    ): string[] {

        const current =
            this.repository.find(id);

        if (!current) {

            return [
                "المنتج غير موجود."
            ];

        }

        const updated: Product = {

            ...current,

            ...data

        };

        const errors =
            this.validator.validate(updated);

        if (errors.length > 0) {

            return errors;

        }

        this.repository.update(
            id,
            data
        );

        return [];

    }

    public remove(id: string): void {

        this.repository.remove(id);

    }

}
