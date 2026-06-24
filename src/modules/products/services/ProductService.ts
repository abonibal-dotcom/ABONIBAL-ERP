import type { Product } from "../Product";
import { ProductRepository } from "../repositories/ProductRepository";
import { ProductValidator } from "../validators/ProductValidator";

export class ProductService {

    private repository: ProductRepository;
    private validator: ProductValidator;

    constructor(
        repository: ProductRepository,
        validator: ProductValidator
    ) {

        this.repository = repository;
        this.validator = validator;

    }

    public getAll(): Product[] {

        return this.repository.all();

    }

    public add(product: Product): string[] {

        const errors = this.validator.validate(product);

        if (errors.length > 0) {
            return errors;
        }

        this.repository.add(product);

        return [];

    }

    public update(id: string, data: Partial<Product>): string[] {

        const current = this.repository.find(id);

        if (!current) {
            return ["المنتج غير موجود."];
        }

        const updated: Product = {
            ...current,
            ...data
        };

        const errors = this.validator.validate(updated);

        if (errors.length > 0) {
            return errors;
        }

        this.repository.update(id, data);

        return [];

    }

    public remove(id: string): void {

        this.repository.remove(id);

    }

    public find(id: string): Product | undefined {

        return this.repository.find(id);

    }

}
