import type { MasterDataSyncRepositoryBridge } from "../../sync/master-data/MasterDataSyncRepositoryBridge";
import type { Supplier } from "../Supplier";
import type {
    SupplierRepository,
    SupplierRepositoryPort
} from "./SupplierRepository";

export class SupplierSyncRepository implements SupplierRepositoryPort {
    private readonly cacheRepository: SupplierRepository;
    private readonly bridge: MasterDataSyncRepositoryBridge<Supplier>;

    public constructor(
        cacheRepository: SupplierRepository,
        bridge: MasterDataSyncRepositoryBridge<Supplier>
    ) {
        this.cacheRepository = cacheRepository;
        this.bridge = bridge;
    }

    public allForAccount(accountId: string): Supplier[] {
        return this.cacheRepository.allForAccount(accountId);
    }

    public saveAllForAccount(accountId: string, suppliers: Supplier[]): void {
        this.cacheRepository.saveAllForAccount(accountId, suppliers);
    }

    public addToAccount(accountId: string, supplier: Supplier): void {
        this.bridge.addToAccount(accountId, supplier);
    }

    public updateForAccount(
        accountId: string,
        id: string,
        data: Partial<Supplier>
    ): void {
        this.bridge.updateForAccount(accountId, id, data);
    }

    public findForAccount(accountId: string, id: string): Supplier | undefined {
        return this.cacheRepository.findForAccount(accountId, id);
    }
}
