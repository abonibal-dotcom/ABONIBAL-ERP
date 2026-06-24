import type { Product } from "../Product";

import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";

export class ProductRepository extends Repository<Product> {

    constructor(driver: Driver) {

        super("products", driver);

    }

    public add(product: Product): void {

        const products = this.all();

        products.push(product);

        this.save(products);

    }

    public update(id: string, data: Partial<Product>): void {

        const products = this.all();

        const index = products.findIndex(
            product => product.id === id
        );

        if (index === -1) {
            return;
        }

        products[index] = {
            ...products[index],
            ...data
        };

        this.save(products);

    }

    public remove(id: string): void {

        const products = this
            .all()
            .filter(product => product.id !== id);

        this.save(products);

    }

    public find(id: string): Product | undefined {

        return this
            .all()
            .find(product => product.id === id);

    }

}
