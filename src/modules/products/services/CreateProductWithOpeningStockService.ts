import type { AuthStateService } from "../../auth/AuthStateService";
import {
    buildProductOpeningStockMovementIdentity,
    IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
    type StockMovement
} from "../../inventory/StockMovement";
import type { StockMovementRepository } from "../../inventory/repositories/StockMovementRepository";
import { buildOpeningStockMovementAppendOperation } from "../../inventory/sync/StockMovementSyncOperation";
import type { StockMovementValidator } from "../../inventory/validators/StockMovementValidator";
import {
    jsonValuesMatch,
    toJsonObject
} from "../../sync/master-data/CanonicalJson";
import type { MasterDataSyncRepositoryBridge } from "../../sync/master-data/MasterDataSyncRepositoryBridge";
import type { DurableMutationGroupCapture } from "../../sync/services/DurableMutationGroupCapture";
import type { SyncModeService } from "../../sync/services/SyncModeService";
import type { Product } from "../Product";
import type { ProductData } from "../dto/ProductData";
import type { ProductFactory } from "../factories/ProductFactory";
import type { ProductRepository } from "../repositories/ProductRepository";
import { productSyncCodec } from "../sync/ProductSyncCodec";
import type { ProductValidator } from "../validators/ProductValidator";
import type { ProductService } from "./ProductService";

export interface CreateProductWithOpeningStockCommand {
    productId: string;
    createdAt: string;
    data: ProductData;
}

export type ProductOpeningCreatePath =
    | "local"
    | "single_operation"
    | "durable_group";

export interface CreateProductWithOpeningStockResult {
    success: boolean;
    outcome: "applied" | "already_applied" | "conflict" | "failed";
    path: ProductOpeningCreatePath;
    product: Product | null;
    openingMovement: StockMovement | null;
    groupId: string | null;
    errors: string[];
}

export class CreateProductWithOpeningStockService {
    private readonly productFactory: ProductFactory;
    private readonly productService: ProductService;
    private readonly productValidator: ProductValidator;
    private readonly productCacheRepository: ProductRepository;
    private readonly productSyncBridge: MasterDataSyncRepositoryBridge<Product>;
    private readonly stockMovementRepository: StockMovementRepository;
    private readonly stockMovementValidator: StockMovementValidator;
    private readonly groupCapture: DurableMutationGroupCapture;
    private readonly syncModeService: SyncModeService;
    private readonly authStateService: AuthStateService;

    public constructor(
        productFactory: ProductFactory,
        productService: ProductService,
        productValidator: ProductValidator,
        productCacheRepository: ProductRepository,
        productSyncBridge: MasterDataSyncRepositoryBridge<Product>,
        stockMovementRepository: StockMovementRepository,
        stockMovementValidator: StockMovementValidator,
        groupCapture: DurableMutationGroupCapture,
        syncModeService: SyncModeService,
        authStateService: AuthStateService
    ) {
        this.productFactory = productFactory;
        this.productService = productService;
        this.productValidator = productValidator;
        this.productCacheRepository = productCacheRepository;
        this.productSyncBridge = productSyncBridge;
        this.stockMovementRepository = stockMovementRepository;
        this.stockMovementValidator = stockMovementValidator;
        this.groupCapture = groupCapture;
        this.syncModeService = syncModeService;
        this.authStateService = authStateService;
    }

    public execute(
        command: CreateProductWithOpeningStockCommand
    ): CreateProductWithOpeningStockResult {
        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failed("local", "Authenticated account is required.");
        }

        const productId = command.productId.trim();
        const timestamp = parseStableTimestamp(command.createdAt);
        const openingQuantity = command.data.openingQuantity;

        if (!/^[A-Za-z0-9_-]+$/.test(productId)) {
            return failed("local", "Stable Product id is invalid.");
        }

        if (!timestamp) {
            return failed("local", "Product command timestamp is invalid.");
        }

        if (!Number.isFinite(openingQuantity) || openingQuantity < 0) {
            return failed(
                "local",
                "Opening quantity must be zero or a positive number."
            );
        }

        const product: Product = {
            ...this.productFactory.create(command.data, {
                id: productId,
                timestamp
            }),
            accountId: accountContext.accountId,
            createdBy: accountContext.userId,
            updatedBy: accountContext.userId
        };
        const productErrors = this.productValidator.validate(product);

        if (productErrors.length > 0) {
            return failed("local", productErrors);
        }

        try {
            productSyncCodec.validateRecord(
                product,
                accountContext.accountId,
                product.id
            );
        } catch {
            return failed("local", "Product payload failed sync-safe validation.");
        }

        if (openingQuantity === 0) {
            return this.createProductOnly(product);
        }

        const openingMovement = this.buildOpeningMovement(
            product,
            openingQuantity,
            accountContext.userId,
            command.createdAt
        );

        if (!openingMovement) {
            return failed("local", "Opening stock identity is invalid.");
        }

        const movementErrors = this.stockMovementValidator.validate(
            openingMovement
        );

        if (movementErrors.length > 0) {
            return failed("local", movementErrors);
        }

        if (this.syncModeService.getMode() !== "active") {
            return this.applyLocal(product, openingMovement);
        }

        try {
            return this.captureDurableGroup(
                product,
                openingMovement,
                command.createdAt
            );
        } catch {
            return failed(
                "durable_group",
                "Product opening-stock group preparation failed safely."
            );
        }
    }

    private createProductOnly(
        product: Product
    ): CreateProductWithOpeningStockResult {
        if (this.syncModeService.getMode() !== "active") {
            return this.applyLocal(product, null);
        }

        const errors = this.productService.add(product);

        if (errors.length > 0) {
            return failed("single_operation", errors);
        }

        return successful(
            "single_operation",
            "applied",
            this.productCacheRepository.findForAccount(
                product.accountId as string,
                product.id
            ) ?? product,
            null,
            null
        );
    }

    private applyLocal(
        product: Product,
        openingMovement: StockMovement | null
    ): CreateProductWithOpeningStockResult {
        const accountId = product.accountId as string;
        const currentProduct = this.productCacheRepository.findForAccount(
            accountId,
            product.id
        );
        const currentMovement = openingMovement
            ? this.stockMovementRepository.findForAccount(
                accountId,
                openingMovement.id
            )
            : undefined;

        try {
            if (currentProduct && !productsMatch(currentProduct, product)) {
                return conflict(
                    "local",
                    "Stable Product identity has divergent data."
                );
            }

            if (
                currentMovement
                && openingMovement
                && !stockMovementsMatch(currentMovement, openingMovement)
            ) {
                return conflict(
                    "local",
                    "Opening stock movement identity has divergent data."
                );
            }
        } catch {
            return conflict(
                "local",
                "Existing local state could not be matched safely."
            );
        }

        let applied = false;

        if (!currentProduct) {
            const productErrors = this.productService.add(product);

            if (productErrors.length > 0) {
                return failed("local", productErrors);
            }

            applied = true;
        }

        if (openingMovement && !currentMovement) {
            try {
                this.stockMovementRepository.appendForAccount(
                    accountId,
                    openingMovement
                );
            } catch {
                return failed(
                    "local",
                    "Opening stock persistence failed; retry the same Product command."
                );
            }

            applied = true;
        }

        return successful(
            "local",
            applied ? "applied" : "already_applied",
            this.productCacheRepository.findForAccount(accountId, product.id)
                ?? product,
            openingMovement
                ? this.stockMovementRepository.findForAccount(
                    accountId,
                    openingMovement.id
                ) ?? openingMovement
                : null,
            null
        );
    }

    private captureDurableGroup(
        product: Product,
        openingMovement: StockMovement,
        createdAt: string
    ): CreateProductWithOpeningStockResult {
        const accountId = product.accountId as string;
        const groupId = `product-create-${product.id}`;
        const productOperation = this.productSyncBridge.prepareCreateOperation(
            accountId,
            product,
            createdAt
        );
        const movementOperation = buildOpeningStockMovementAppendOperation(
            openingMovement,
            createdAt
        );
        const result = this.groupCapture.capture({
            accountId,
            group: {
                groupId,
                groupType: "product_create_with_opening_stock",
                members: [
                    {
                        operation: productOperation,
                        groupSequence: 1,
                        requiredForLocalCompletion: true
                    },
                    {
                        operation: movementOperation,
                        groupSequence: 2,
                        requiredForLocalCompletion: true
                    }
                ]
            }
        });

        if (!result.success) {
            return result.outcome === "conflict"
                ? conflict("durable_group", result.errors)
                : failed("durable_group", result.errors);
        }

        return successful(
            "durable_group",
            result.outcome === "already_applied"
                ? "already_applied"
                : "applied",
            this.productCacheRepository.findForAccount(accountId, product.id)
                ?? product,
            this.stockMovementRepository.findForAccount(
                accountId,
                openingMovement.id
            ) ?? openingMovement,
            groupId
        );
    }

    private buildOpeningMovement(
        product: Product,
        quantity: number,
        userId: string,
        createdAt: string
    ): StockMovement | null {
        const identity = buildProductOpeningStockMovementIdentity(product.id);

        if (!identity) {
            return null;
        }

        return {
            id: identity.movementId,
            accountId: product.accountId as string,
            productId: product.id,
            type: "opening_balance",
            quantityDelta: quantity,
            reason: "Opening stock created with product.",
            referenceType: "opening_balance",
            referenceId: product.id,
            createdAt,
            createdBy: userId,
            ledgerSemanticsVersion:
                IMMUTABLE_STOCK_MOVEMENT_SEMANTICS_VERSION,
            metadata: {
                source: "product_create"
            }
        };
    }

    private currentAccountContext(): ProductCreationAccountContext | null {
        const state = this.authStateService.getState();

        if (state.status !== "authenticated") {
            return null;
        }

        const accountId = state.session.account.id.trim();
        const userAccountId = state.session.user.accountId.trim();
        const userId = state.session.user.id.trim();

        if (!accountId || accountId !== userAccountId || !userId) {
            return null;
        }

        return { accountId, userId };
    }
}

interface ProductCreationAccountContext {
    accountId: string;
    userId: string;
}

function parseStableTimestamp(value: string): Date | null {
    const timestamp = new Date(value);

    return !value.trim()
        || Number.isNaN(timestamp.getTime())
        || timestamp.toISOString() !== value
        ? null
        : timestamp;
}

function productsMatch(left: Product, right: Product): boolean {
    return jsonValuesMatch(
        productSyncCodec.toCloudRecord(left),
        productSyncCodec.toCloudRecord(right)
    );
}

function stockMovementsMatch(
    left: StockMovement,
    right: StockMovement
): boolean {
    return jsonValuesMatch(toJsonObject(left), toJsonObject(right));
}

function successful(
    path: ProductOpeningCreatePath,
    outcome: "applied" | "already_applied",
    product: Product,
    openingMovement: StockMovement | null,
    groupId: string | null
): CreateProductWithOpeningStockResult {
    return {
        success: true,
        outcome,
        path,
        product,
        openingMovement,
        groupId,
        errors: []
    };
}

function conflict(
    path: ProductOpeningCreatePath,
    errors: string | string[]
): CreateProductWithOpeningStockResult {
    return {
        success: false,
        outcome: "conflict",
        path,
        product: null,
        openingMovement: null,
        groupId: null,
        errors: Array.isArray(errors) ? errors : [errors]
    };
}

function failed(
    path: ProductOpeningCreatePath,
    errors: string | string[]
): CreateProductWithOpeningStockResult {
    return {
        success: false,
        outcome: "failed",
        path,
        product: null,
        openingMovement: null,
        groupId: null,
        errors: Array.isArray(errors) ? errors : [errors]
    };
}
