import type { Supplier } from "../Supplier";

import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import { supplierStorageKeyForAccount } from "../persistence/SupplierPersistenceKey";

export class SupplierRepository extends Repository<Supplier> {

    public constructor(driver: Driver) {

        super("suppliers", driver);

    }

    public allForAccount(accountId: string): Supplier[] {

        return this.driver.read<Supplier[]>(
            supplierStorageKeyForAccount(accountId)
        ) ?? [];

    }

    public saveAllForAccount(accountId: string, suppliers: Supplier[]): void {

        this.saveForAccount(accountId, suppliers);

    }

    public addToAccount(accountId: string, supplier: Supplier): void {

        const suppliers = this.allForAccount(accountId);

        suppliers.push(supplier);

        this.saveForAccount(accountId, suppliers);

    }

    public updateForAccount(
        accountId: string,
        id: string,
        data: Partial<Supplier>
    ): void {

        const suppliers = this.allForAccount(accountId);
        const index = suppliers.findIndex(
            supplier => supplier.id === id
        );

        if (index === -1) {
            return;
        }

        suppliers[index] = {
            ...suppliers[index],
            ...data
        };

        this.saveForAccount(accountId, suppliers);

    }

    public findForAccount(
        accountId: string,
        id: string
    ): Supplier | undefined {

        return this
            .allForAccount(accountId)
            .find(supplier => supplier.id === id);

    }

    private saveForAccount(accountId: string, suppliers: Supplier[]): void {

        this.driver.write<Supplier[]>(
            supplierStorageKeyForAccount(accountId),
            suppliers
        );

    }

}
