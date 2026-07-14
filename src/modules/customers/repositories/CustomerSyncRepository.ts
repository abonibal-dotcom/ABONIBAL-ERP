import type { MasterDataSyncRepositoryBridge } from "../../sync/master-data/MasterDataSyncRepositoryBridge";
import type { Customer } from "../Customer";
import type {
    CustomerRepository,
    CustomerRepositoryPort
} from "./CustomerRepository";

export class CustomerSyncRepository implements CustomerRepositoryPort {
    private readonly cacheRepository: CustomerRepository;
    private readonly bridge: MasterDataSyncRepositoryBridge<Customer>;

    public constructor(
        cacheRepository: CustomerRepository,
        bridge: MasterDataSyncRepositoryBridge<Customer>
    ) {
        this.cacheRepository = cacheRepository;
        this.bridge = bridge;
    }

    public allForAccount(accountId: string): Customer[] {
        return this.cacheRepository.allForAccount(accountId);
    }

    public saveAllForAccount(accountId: string, customers: Customer[]): void {
        this.cacheRepository.saveAllForAccount(accountId, customers);
    }

    public addToAccount(accountId: string, customer: Customer): void {
        this.bridge.addToAccount(accountId, customer);
    }

    public updateForAccount(
        accountId: string,
        id: string,
        data: Partial<Customer>
    ): void {
        this.bridge.updateForAccount(accountId, id, data);
    }

    public findForAccount(accountId: string, id: string): Customer | undefined {
        return this.cacheRepository.findForAccount(accountId, id);
    }
}
