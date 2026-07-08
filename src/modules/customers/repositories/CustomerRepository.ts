import type { Customer } from "../Customer";

import { Repository } from "../../../core/repositories/Repository";
import type { Driver } from "../../../core/persistence/Driver";
import { customerStorageKeyForAccount } from "../persistence/CustomerPersistenceKey";

export class CustomerRepository extends Repository<Customer> {

    constructor(driver: Driver) {

        super("customers", driver);

    }

    public allForAccount(accountId: string): Customer[] {

        return this.driver.read<Customer[]>(
            customerStorageKeyForAccount(accountId)
        ) ?? [];

    }

    public saveAllForAccount(accountId: string, customers: Customer[]): void {

        this.saveForAccount(accountId, customers);

    }

    public addToAccount(accountId: string, customer: Customer): void {

        const customers = this.allForAccount(accountId);

        customers.push(customer);

        this.saveForAccount(accountId, customers);

    }

    public updateForAccount(
        accountId: string,
        id: string,
        data: Partial<Customer>
    ): void {

        const customers = this.allForAccount(accountId);

        const index = customers.findIndex(
            customer => customer.id === id
        );

        if (index === -1) {
            return;
        }

        customers[index] = {
            ...customers[index],
            ...data
        };

        this.saveForAccount(accountId, customers);

    }

    public findForAccount(
        accountId: string,
        id: string
    ): Customer | undefined {

        return this
            .allForAccount(accountId)
            .find(customer => customer.id === id);

    }

    private saveForAccount(accountId: string, customers: Customer[]): void {

        this.driver.write<Customer[]>(
            customerStorageKeyForAccount(accountId),
            customers
        );

    }

}
