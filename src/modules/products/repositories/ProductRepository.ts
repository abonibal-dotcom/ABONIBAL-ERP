import type { Product } from "../Product";

import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import { productStorageKeyForAccount } from "../persistence/ProductPersistenceKey";

export class ProductRepository extends Repository<Product> {

    constructor(driver: Driver) {

        super("products", driver);

    }

    public allForAccount(accountId: string): Product[] {

        return this.driver.read<Product[]>(
            productStorageKeyForAccount(accountId)
        ) ?? [];

    }

    public addToAccount(accountId: string, product: Product): void {

        const products = this.allForAccount(accountId);

        products.push(product);

        this.saveForAccount(accountId, products);

    }

    public updateForAccount(
        accountId: string,
        id: string,
        data: Partial<Product>
    ): void {

        const products = this.allForAccount(accountId);

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

        this.saveForAccount(accountId, products);

    }

    public removeFromAccount(accountId: string, id: string): void {

        const products = this
            .allForAccount(accountId)
            .filter(product => product.id !== id);

        this.saveForAccount(accountId, products);

    }

    public findForAccount(
        accountId: string,
        id: string
    ): Product | undefined {

        return this
            .allForAccount(accountId)
            .find(product => product.id === id);

    }

    private saveForAccount(accountId: string, products: Product[]): void {

        this.driver.write<Product[]>(
            productStorageKeyForAccount(accountId),
            products
        );

    }

}
