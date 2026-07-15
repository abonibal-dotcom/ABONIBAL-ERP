import { Config } from "./Config";
import { Storage } from "./Storage";
import { Router } from "./Router";

import { LocalStorageDriver } from "./persistence/LocalStorageDriver";

import { CustomerRepository } from "../modules/customers/repositories/CustomerRepository";
import { CustomerSyncRepository } from "../modules/customers/repositories/CustomerSyncRepository";
import { customerSyncCodec } from "../modules/customers/sync/CustomerSyncCodec";
import { CustomerValidator } from "../modules/customers/validators/CustomerValidator";
import { CustomerService } from "../modules/customers/services/CustomerService";
import { SupplierRepository } from "../modules/suppliers/repositories/SupplierRepository";
import { SupplierSyncRepository } from "../modules/suppliers/repositories/SupplierSyncRepository";
import { supplierSyncCodec } from "../modules/suppliers/sync/SupplierSyncCodec";
import { SupplierValidator } from "../modules/suppliers/validators/SupplierValidator";
import { SupplierService } from "../modules/suppliers/services/SupplierService";
import { PaymentRepository } from "../modules/payments/repositories/PaymentRepository";
import { PaymentValidator } from "../modules/payments/validators/PaymentValidator";
import { PaymentService } from "../modules/payments/services/PaymentService";
import { PurchaseRepository } from "../modules/purchases/repositories/PurchaseRepository";
import { PurchaseValidator } from "../modules/purchases/validators/PurchaseValidator";
import { PurchaseService } from "../modules/purchases/services/PurchaseService";
import { ExpenseRepository } from "../modules/expenses/repositories/ExpenseRepository";
import { ExpenseValidator } from "../modules/expenses/validators/ExpenseValidator";
import { ExpenseService } from "../modules/expenses/services/ExpenseService";
import { SafeRepository } from "../modules/cash/repositories/SafeRepository";
import { SafeValidator } from "../modules/cash/validators/SafeValidator";
import { SafeService } from "../modules/cash/services/SafeService";
import { CashMovementRepository } from "../modules/cash/repositories/CashMovementRepository";
import { CashMovementValidator } from "../modules/cash/validators/CashMovementValidator";
import { CashMovementService } from "../modules/cash/services/CashMovementService";
import { LedgerAccountRepository } from "../modules/ledger/repositories/LedgerAccountRepository";
import { LedgerAccountValidator } from "../modules/ledger/validators/LedgerAccountValidator";
import { LedgerAccountService } from "../modules/ledger/services/LedgerAccountService";
import { JournalEntryRepository } from "../modules/ledger/repositories/JournalEntryRepository";
import { JournalEntryValidator } from "../modules/ledger/validators/JournalEntryValidator";
import { JournalEntryService } from "../modules/ledger/services/JournalEntryService";
import { ProductRepository } from "../modules/products/repositories/ProductRepository";
import { ProductSyncRepository } from "../modules/products/repositories/ProductSyncRepository";
import { productSyncCodec } from "../modules/products/sync/ProductSyncCodec";
import { ProductValidator } from "../modules/products/validators/ProductValidator";
import { ProductService } from "../modules/products/services/ProductService";
import { StockMovementRepository } from "../modules/inventory/repositories/StockMovementRepository";
import { StockMovementValidator } from "../modules/inventory/validators/StockMovementValidator";
import { InventoryService } from "../modules/inventory/services/InventoryService";
import { InvoiceRepository } from "../modules/sales/repositories/InvoiceRepository";
import { InvoiceValidator } from "../modules/sales/validators/InvoiceValidator";
import { InvoiceService } from "../modules/sales/services/InvoiceService";
import { InvoiceReturnRepository } from "../modules/sales/repositories/InvoiceReturnRepository";
import { InvoiceReturnValidator } from "../modules/sales/validators/InvoiceReturnValidator";
import { InvoiceReturnService } from "../modules/sales/services/InvoiceReturnService";
import { getDatabase } from "firebase/database";
import { getAuthStateService } from "../modules/auth/AuthRuntime";
import { getFirebaseApp } from "../modules/auth/firebase/FirebaseAuthClient";
import { FirebaseRealtimeClient } from "../modules/sync/firebase/FirebaseRealtimeClient";
import { PersistentOutboxRepository } from "../modules/sync/repositories/PersistentOutboxRepository";
import { MasterDataSyncStateRepository } from "../modules/sync/repositories/MasterDataSyncStateRepository";
import { SyncConflictRepository } from "../modules/sync/repositories/SyncConflictRepository";
import { SyncReceiptRepository } from "../modules/sync/repositories/SyncReceiptRepository";
import { ListenerCoordinator } from "../modules/sync/services/ListenerCoordinator";
import { DurableMutationCapture } from "../modules/sync/services/DurableMutationCapture";
import { DurableMutationGroupCapture } from "../modules/sync/services/DurableMutationGroupCapture";
import { LocalMutationApplierRegistry } from "../modules/sync/services/LocalMutationApplierRegistry";
import { LocalMutationReconciler } from "../modules/sync/services/LocalMutationReconciler";
import { MasterDataLocalMutationApplier } from "../modules/sync/master-data/MasterDataLocalMutationApplier";
import { MasterDataModuleSyncAdapter } from "../modules/sync/master-data/MasterDataModuleSyncAdapter";
import { MasterDataSyncOperationTransport } from "../modules/sync/master-data/MasterDataSyncOperationTransport";
import { MasterDataSyncRepositoryBridge } from "../modules/sync/master-data/MasterDataSyncRepositoryBridge";
import { RetryPolicy } from "../modules/sync/services/RetryPolicy";
import { SyncCoordinator } from "../modules/sync/services/SyncCoordinator";
import { SyncEchoPolicy } from "../modules/sync/services/SyncEchoPolicy";
import { SyncModeService } from "../modules/sync/services/SyncModeService";
import { SyncStatusService } from "../modules/sync/services/SyncStatusService";

export class Container {

    private static services = new Map<string, any>();

    public static boot(): void {

        this.register("config", Config);

        this.register("storage", new Storage());

        this.register("router", new Router());

        const driver = new LocalStorageDriver();

        this.register("driver", driver);

        const syncOutboxRepository = new PersistentOutboxRepository(driver);
        const syncReceiptRepository = new SyncReceiptRepository(driver);
        const syncConflictRepository = new SyncConflictRepository(driver);
        const masterDataSyncStateRepository = new MasterDataSyncStateRepository(driver);
        const syncModeService = new SyncModeService();
        const syncStatusService = new SyncStatusService();
        const syncRetryPolicy = new RetryPolicy();
        const syncListenerCoordinator = new ListenerCoordinator();
        const localMutationApplierRegistry = new LocalMutationApplierRegistry();
        const durableMutationCapture = new DurableMutationCapture(
            syncOutboxRepository
        );
        const durableMutationGroupCapture = new DurableMutationGroupCapture(
            syncOutboxRepository,
            localMutationApplierRegistry,
            durableMutationCapture
        );
        const localMutationReconciler = new LocalMutationReconciler(
            syncOutboxRepository,
            localMutationApplierRegistry,
            durableMutationCapture
        );
        const syncEchoPolicy = new SyncEchoPolicy();
        const firebaseRealtimeClient = new FirebaseRealtimeClient(() => {
            const firebaseApp = getFirebaseApp();

            return firebaseApp ? getDatabase(firebaseApp) : null;
        });
        const syncOperationTransport = new MasterDataSyncOperationTransport(
            firebaseRealtimeClient,
            () => getFirebaseApp()?.options.projectId ?? null
        );
        const syncCoordinator = new SyncCoordinator(
            syncModeService,
            syncOutboxRepository,
            syncReceiptRepository,
            syncConflictRepository,
            syncRetryPolicy,
            syncListenerCoordinator,
            syncStatusService,
            syncOperationTransport,
            getAuthStateService()
        );
        syncCoordinator.configureLocalMutationReconciler(
            localMutationReconciler
        );

        this.register("syncOutboxRepository", syncOutboxRepository);
        this.register("syncReceiptRepository", syncReceiptRepository);
        this.register("syncConflictRepository", syncConflictRepository);
        this.register("masterDataSyncStateRepository", masterDataSyncStateRepository);
        this.register("syncModeService", syncModeService);
        this.register("syncStatusService", syncStatusService);
        this.register("syncRetryPolicy", syncRetryPolicy);
        this.register("syncListenerCoordinator", syncListenerCoordinator);
        this.register("localMutationApplierRegistry", localMutationApplierRegistry);
        this.register("durableMutationCapture", durableMutationCapture);
        this.register("durableMutationGroupCapture", durableMutationGroupCapture);
        this.register("localMutationReconciler", localMutationReconciler);
        this.register("syncEchoPolicy", syncEchoPolicy);
        this.register("firebaseRealtimeClient", firebaseRealtimeClient);
        this.register("syncOperationTransport", syncOperationTransport);
        this.register("syncCoordinator", syncCoordinator);

        const customerCacheRepository = new CustomerRepository(driver);
        const customerLocalMutationApplier = new MasterDataLocalMutationApplier(
            customerCacheRepository,
            masterDataSyncStateRepository,
            customerSyncCodec
        );
        localMutationApplierRegistry.register(customerLocalMutationApplier);
        const customerSyncBridge = new MasterDataSyncRepositoryBridge(
            customerCacheRepository,
            syncModeService,
            durableMutationCapture,
            customerLocalMutationApplier,
            masterDataSyncStateRepository,
            customerSyncCodec
        );
        const customerRepository = new CustomerSyncRepository(
            customerCacheRepository,
            customerSyncBridge
        );
        const customerSyncAdapter = new MasterDataModuleSyncAdapter(
            firebaseRealtimeClient,
            syncModeService,
            getAuthStateService(),
            syncOutboxRepository,
            syncConflictRepository,
            syncReceiptRepository,
            syncListenerCoordinator,
            syncEchoPolicy,
            customerLocalMutationApplier,
            customerSyncCodec
        );

        this.register("customerCacheRepository", customerCacheRepository);
        this.register("customerRepository", customerRepository);
        this.register("customerLocalMutationApplier", customerLocalMutationApplier);
        this.register("customerSyncAdapter", customerSyncAdapter);

        const customerValidator = new CustomerValidator();

        this.register("customerValidator", customerValidator);

        const customerService = new CustomerService(
            customerRepository,
            customerValidator,
            getAuthStateService()
        );

        this.register("customerService", customerService);

        const supplierCacheRepository = new SupplierRepository(driver);
        const supplierLocalMutationApplier = new MasterDataLocalMutationApplier(
            supplierCacheRepository,
            masterDataSyncStateRepository,
            supplierSyncCodec
        );
        localMutationApplierRegistry.register(supplierLocalMutationApplier);
        const supplierSyncBridge = new MasterDataSyncRepositoryBridge(
            supplierCacheRepository,
            syncModeService,
            durableMutationCapture,
            supplierLocalMutationApplier,
            masterDataSyncStateRepository,
            supplierSyncCodec
        );
        const supplierRepository = new SupplierSyncRepository(
            supplierCacheRepository,
            supplierSyncBridge
        );
        const supplierSyncAdapter = new MasterDataModuleSyncAdapter(
            firebaseRealtimeClient,
            syncModeService,
            getAuthStateService(),
            syncOutboxRepository,
            syncConflictRepository,
            syncReceiptRepository,
            syncListenerCoordinator,
            syncEchoPolicy,
            supplierLocalMutationApplier,
            supplierSyncCodec
        );

        this.register("supplierCacheRepository", supplierCacheRepository);
        this.register("supplierRepository", supplierRepository);
        this.register("supplierLocalMutationApplier", supplierLocalMutationApplier);
        this.register("supplierSyncAdapter", supplierSyncAdapter);

        const supplierValidator = new SupplierValidator();

        this.register("supplierValidator", supplierValidator);

        const supplierService = new SupplierService(
            supplierRepository,
            supplierValidator,
            getAuthStateService()
        );

        this.register("supplierService", supplierService);

        const paymentRepository = new PaymentRepository(driver);

        this.register("paymentRepository", paymentRepository);

        const paymentValidator = new PaymentValidator();

        this.register("paymentValidator", paymentValidator);

        const paymentService = new PaymentService(
            paymentRepository,
            paymentValidator,
            getAuthStateService()
        );

        this.register("paymentService", paymentService);

        const purchaseRepository = new PurchaseRepository(driver);

        this.register("purchaseRepository", purchaseRepository);

        const purchaseValidator = new PurchaseValidator();

        this.register("purchaseValidator", purchaseValidator);

        const purchaseService = new PurchaseService(
            purchaseRepository,
            purchaseValidator,
            getAuthStateService()
        );

        this.register("purchaseService", purchaseService);

        const expenseRepository = new ExpenseRepository(driver);

        this.register("expenseRepository", expenseRepository);

        const expenseValidator = new ExpenseValidator();

        this.register("expenseValidator", expenseValidator);

        const expenseService = new ExpenseService(
            expenseRepository,
            expenseValidator,
            getAuthStateService()
        );

        this.register("expenseService", expenseService);

        const safeRepository = new SafeRepository(driver);

        this.register("safeRepository", safeRepository);

        const safeValidator = new SafeValidator();

        this.register("safeValidator", safeValidator);

        const safeService = new SafeService(
            safeRepository,
            safeValidator,
            getAuthStateService()
        );

        this.register("safeService", safeService);

        const cashMovementRepository = new CashMovementRepository(driver);

        this.register("cashMovementRepository", cashMovementRepository);

        const cashMovementValidator = new CashMovementValidator();

        this.register("cashMovementValidator", cashMovementValidator);

        const cashMovementService = new CashMovementService(
            cashMovementRepository,
            cashMovementValidator,
            getAuthStateService(),
            safeService
        );

        this.register("cashMovementService", cashMovementService);

        safeService.configureMovementPolicy({
            hasPostedMovements: safeId =>
                cashMovementService.hasPostedMovementForSafe(safeId),
            getCurrentBalance: safeId =>
                cashMovementService.calculateCurrentBalance(safeId)
        });

        const ledgerAccountRepository = new LedgerAccountRepository(driver);

        this.register("ledgerAccountRepository", ledgerAccountRepository);

        const ledgerAccountValidator = new LedgerAccountValidator();

        this.register("ledgerAccountValidator", ledgerAccountValidator);

        const ledgerAccountService = new LedgerAccountService(
            ledgerAccountRepository,
            ledgerAccountValidator,
            getAuthStateService()
        );

        this.register("ledgerAccountService", ledgerAccountService);

        const journalEntryRepository = new JournalEntryRepository(driver);

        this.register("journalEntryRepository", journalEntryRepository);

        const journalEntryValidator = new JournalEntryValidator();

        this.register("journalEntryValidator", journalEntryValidator);

        const journalEntryService = new JournalEntryService(
            journalEntryRepository,
            journalEntryValidator,
            getAuthStateService(),
            ledgerAccountService
        );

        this.register("journalEntryService", journalEntryService);

        ledgerAccountService.configureUsagePolicy({
            hasPostedUsage: ledgerAccountId =>
                journalEntryService.hasPostedUsage(ledgerAccountId),
            getCurrentBalance: ledgerAccountId =>
                journalEntryService.calculateAccountBalance(ledgerAccountId)
        });

        const productCacheRepository = new ProductRepository(driver);
        const productLocalMutationApplier = new MasterDataLocalMutationApplier(
            productCacheRepository,
            masterDataSyncStateRepository,
            productSyncCodec
        );
        localMutationApplierRegistry.register(productLocalMutationApplier);
        const productSyncBridge = new MasterDataSyncRepositoryBridge(
            productCacheRepository,
            syncModeService,
            durableMutationCapture,
            productLocalMutationApplier,
            masterDataSyncStateRepository,
            productSyncCodec
        );
        const productRepository = new ProductSyncRepository(
            productCacheRepository,
            productSyncBridge
        );
        const productSyncAdapter = new MasterDataModuleSyncAdapter(
            firebaseRealtimeClient,
            syncModeService,
            getAuthStateService(),
            syncOutboxRepository,
            syncConflictRepository,
            syncReceiptRepository,
            syncListenerCoordinator,
            syncEchoPolicy,
            productLocalMutationApplier,
            productSyncCodec
        );

        this.register("productCacheRepository", productCacheRepository);
        this.register("productRepository", productRepository);
        this.register("productLocalMutationApplier", productLocalMutationApplier);
        this.register("productSyncAdapter", productSyncAdapter);

        const productValidator = new ProductValidator();

        this.register("productValidator", productValidator);

        const productService = new ProductService(
            productRepository,
            productValidator,
            getAuthStateService()
        );

        this.register("productService", productService);

        const stockMovementRepository = new StockMovementRepository(driver);

        this.register("stockMovementRepository", stockMovementRepository);

        const stockMovementValidator = new StockMovementValidator();

        this.register("stockMovementValidator", stockMovementValidator);

        const inventoryService = new InventoryService(
            stockMovementRepository,
            stockMovementValidator,
            getAuthStateService(),
            productService
        );

        this.register("inventoryService", inventoryService);

        const invoiceRepository = new InvoiceRepository(driver);

        this.register("invoiceRepository", invoiceRepository);

        const invoiceValidator = new InvoiceValidator();

        this.register("invoiceValidator", invoiceValidator);

        const invoiceService = new InvoiceService(
            invoiceRepository,
            invoiceValidator,
            getAuthStateService(),
            inventoryService
        );

        this.register("invoiceService", invoiceService);

        const invoiceReturnRepository = new InvoiceReturnRepository(driver);

        this.register("invoiceReturnRepository", invoiceReturnRepository);

        const invoiceReturnValidator = new InvoiceReturnValidator();

        this.register("invoiceReturnValidator", invoiceReturnValidator);

        const invoiceReturnService = new InvoiceReturnService(
            invoiceReturnRepository,
            invoiceReturnValidator,
            invoiceRepository,
            getAuthStateService(),
            inventoryService
        );

        this.register("invoiceReturnService", invoiceReturnService);

    }

    public static register(name: string, service: any): void {

        this.services.set(name, service);

    }

    public static get<T>(name: string): T {

        if (!this.services.has(name)) {
            throw new Error(`Service "${name}" is not registered.`);
        }

        return this.services.get(name);

    }

    public static has(name: string): boolean {

        return this.services.has(name);

    }

    public static remove(name: string): void {

        this.services.delete(name);

    }

    public static clear(): void {

        this.services.clear();

    }

}
