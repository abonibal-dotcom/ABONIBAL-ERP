import type { MasterDataSyncRepositoryBridge } from "../../sync/master-data/MasterDataSyncRepositoryBridge";
import type { Product } from "../Product";
import type {
    ProductLegacyImportBackup,
    ProductRepository,
    ProductRepositoryPort
} from "./ProductRepository";

export class ProductSyncRepository implements ProductRepositoryPort {
    private readonly cacheRepository: ProductRepository;
    private readonly bridge: MasterDataSyncRepositoryBridge<Product>;

    public constructor(
        cacheRepository: ProductRepository,
        bridge: MasterDataSyncRepositoryBridge<Product>
    ) {
        this.cacheRepository = cacheRepository;
        this.bridge = bridge;
    }

    public allForAccount(accountId: string): Product[] {
        return this.cacheRepository.allForAccount(accountId);
    }

    public allLegacy(): Product[] {
        return this.cacheRepository.allLegacy();
    }

    public saveAllForAccount(accountId: string, products: Product[]): void {
        // Bulk/legacy data remains local until the dedicated migration mission.
        this.cacheRepository.saveAllForAccount(accountId, products);
    }

    public addToAccount(accountId: string, product: Product): void {
        this.bridge.addToAccount(accountId, product);
    }

    public updateForAccount(
        accountId: string,
        id: string,
        data: Partial<Product>
    ): void {
        this.bridge.updateForAccount(accountId, id, data);
    }

    public findForAccount(accountId: string, id: string): Product | undefined {
        return this.cacheRepository.findForAccount(accountId, id);
    }

    public saveLegacyImportBackup(
        accountId: string,
        backup: ProductLegacyImportBackup
    ): string {
        return this.cacheRepository.saveLegacyImportBackup(accountId, backup);
    }
}
