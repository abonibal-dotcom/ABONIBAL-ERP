import type { Product } from "../Product";

import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import {
    legacyProductStorageKey,
    productLegacyImportBackupKeyForAccount,
    productStorageKeyForAccount
} from "../persistence/ProductPersistenceKey";

export interface ProductRepositoryPort {
    allForAccount(accountId: string): Product[];
    allLegacy(): Product[];
    saveAllForAccount(accountId: string, products: Product[]): void;
    addToAccount(accountId: string, product: Product): void;
    updateForAccount(accountId: string, id: string, data: Partial<Product>): void;
    findForAccount(accountId: string, id: string): Product | undefined;
    saveLegacyImportBackup(
        accountId: string,
        backup: ProductLegacyImportBackup
    ): string;
}

export class ProductRepository extends Repository<Product>
implements ProductRepositoryPort {

    constructor(driver: Driver) {

        super("products", driver);

    }

    public allForAccount(accountId: string): Product[] {

        return this.driver.read<Product[]>(
            productStorageKeyForAccount(accountId)
        ) ?? [];

    }

    public allLegacy(): Product[] {

        return this.driver.read<Product[]>(
            legacyProductStorageKey()
        ) ?? [];

    }

    public saveAllForAccount(accountId: string, products: Product[]): void {

        this.saveForAccount(accountId, products);

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

    public saveLegacyImportBackup(
        accountId: string,
        backup: ProductLegacyImportBackup
    ): string {

        const backupKey = productLegacyImportBackupKeyForAccount(
            accountId,
            backup.createdAt
        );

        this.driver.write<ProductLegacyImportBackup>(
            backupKey,
            backup
        );

        return backupKey;

    }

}

export interface ProductLegacyImportBackup {

    version: 1;
    createdAt: string;
    accountId: string;
    createdBy: string;
    legacyProductCount: number;
    scopedProductCountBefore: number;
    legacyProducts: Product[];
    scopedProductsBefore: Product[];

}
