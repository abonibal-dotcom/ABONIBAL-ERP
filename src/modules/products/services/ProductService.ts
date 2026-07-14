import type { Product } from "../Product";
import {
    ProductRepository,
    type ProductLegacyImportBackup
} from "../repositories/ProductRepository";
import { ProductValidator } from "../validators/ProductValidator";
import type { AuthStateService } from "../../auth/AuthStateService";

export class ProductService {

    private repository: ProductRepository;
    private validator: ProductValidator;
    private authStateService: AuthStateService;

    constructor(
        repository: ProductRepository,
        validator: ProductValidator,
        authStateService: AuthStateService
    ) {

        this.repository = repository;
        this.validator = validator;
        this.authStateService = authStateService;

    }

    public getAll(): Product[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return [];
        }

        return this.repository
            .allForAccount(accountContext.accountId)
            .filter(product => !product.isDeleted)
            .map(normalizeLegacyProduct);

    }

    public add(product: Product): string[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return ["Authenticated account is required."];
        }

        const ownedProduct: Product = {
            ...product,
            salePrice: normalizeSalePrice(product.salePrice),
            accountId: accountContext.accountId,
            createdBy: product.createdBy ?? accountContext.userId,
            updatedBy: product.updatedBy ?? accountContext.userId
        };

        const errors = this.validator.validate(ownedProduct);

        if (errors.length > 0) {
            return errors;
        }

        this.repository.addToAccount(
            accountContext.accountId,
            ownedProduct
        );

        return [];

    }

    public update(id: string, data: Partial<Product>): string[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return ["Authenticated account is required."];
        }

        const current = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (!current || current.isDeleted) {
            return ["المنتج غير موجود."];
        }

        const updated: Product = {
            ...current,
            ...data,
            salePrice: normalizeSalePrice(
                data.salePrice === undefined
                    ? current.salePrice
                    : data.salePrice
            ),
            accountId: accountContext.accountId,
            createdBy: current.createdBy ?? accountContext.userId,
            updatedBy: accountContext.userId
        };

        const errors = this.validator.validate(updated);

        if (errors.length > 0) {
            return errors;
        }

        this.repository.updateForAccount(
            accountContext.accountId,
            id,
            updated
        );

        return [];

    }

    public remove(id: string): string[] {

        return this.safeDelete(id);

    }

    public safeDelete(id: string): string[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return ["Authenticated account is required."];
        }

        const current = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (!current || current.isDeleted) {
            return ["Product not found."];
        }

        this.repository.updateForAccount(
            accountContext.accountId,
            id,
            {
                ...current,
                accountId: accountContext.accountId,
                createdBy: current.createdBy ?? accountContext.userId,
                updatedBy: accountContext.userId,
                deletedBy: accountContext.userId,
                deletedAt: new Date().toISOString(),
                isDeleted: true,
                updatedAt: new Date()
            }
        );

        return [];

    }

    public find(id: string): Product | undefined {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return undefined;
        }

        const product = this.repository.findForAccount(
            accountContext.accountId,
            id
        );

        if (product?.isDeleted) {
            return undefined;
        }

        return product ? normalizeLegacyProduct(product) : undefined;

    }

    public importLegacyProducts(): LegacyProductImportResult {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return failedLegacyImportResult(
                "Authenticated account is required."
            );
        }

        const legacyProducts = this.repository.allLegacy();
        const scopedProducts = this.repository.allForAccount(
            accountContext.accountId
        );
        const backup: ProductLegacyImportBackup = {
            version: 1,
            createdAt: new Date().toISOString(),
            accountId: accountContext.accountId,
            createdBy: accountContext.userId,
            legacyProductCount: legacyProducts.length,
            scopedProductCountBefore: scopedProducts.length,
            legacyProducts,
            scopedProductsBefore: scopedProducts
        };
        const backupKey = this.repository.saveLegacyImportBackup(
            accountContext.accountId,
            backup
        );
        const scopedProductIds = new Set(
            scopedProducts.map(product => product.id)
        );
        const importedProducts: Product[] = [];
        const skippedDuplicateIds: string[] = [];

        for (const legacyProduct of legacyProducts) {

            const productId = legacyProduct.id.trim();

            if (!productId || scopedProductIds.has(productId)) {
                skippedDuplicateIds.push(productId);
                continue;
            }

            scopedProductIds.add(productId);

            importedProducts.push({
                ...legacyProduct,
                id: productId,
                accountId: accountContext.accountId,
                createdBy: legacyProduct.createdBy ?? accountContext.userId,
                updatedBy: legacyProduct.updatedBy ?? accountContext.userId
            });

        }

        const nextScopedProducts = [
            ...scopedProducts,
            ...importedProducts
        ];

        if (importedProducts.length > 0) {
            this.repository.saveAllForAccount(
                accountContext.accountId,
                nextScopedProducts
            );
        }

        return {
            success: true,
            errors: [],
            backupKey,
            legacyProductCount: legacyProducts.length,
            scopedProductCountBefore: scopedProducts.length,
            copiedProductCount: importedProducts.length,
            skippedDuplicateCount: skippedDuplicateIds.length,
            scopedProductCountAfter: nextScopedProducts.length,
            copiedProductIds: importedProducts.map(product => product.id),
            skippedDuplicateIds
        };

    }

    private currentAccountContext(): ProductAccountContext | null {

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

        return {
            accountId,
            userId
        };

    }

}

export interface LegacyProductImportResult {

    success: boolean;
    errors: string[];
    backupKey: string | null;
    legacyProductCount: number;
    scopedProductCountBefore: number;
    copiedProductCount: number;
    skippedDuplicateCount: number;
    scopedProductCountAfter: number;
    copiedProductIds: string[];
    skippedDuplicateIds: string[];

}

function failedLegacyImportResult(error: string): LegacyProductImportResult {

    return {
        success: false,
        errors: [error],
        backupKey: null,
        legacyProductCount: 0,
        scopedProductCountBefore: 0,
        copiedProductCount: 0,
        skippedDuplicateCount: 0,
        scopedProductCountAfter: 0,
        copiedProductIds: [],
        skippedDuplicateIds: []
    };

}

interface ProductAccountContext {

    accountId: string;
    userId: string;

}

function normalizeLegacyProduct(product: Product): Product {

    return {
        ...product,
        salePrice: normalizeSalePrice(product.salePrice)
    };

}

function normalizeSalePrice(value: unknown): number {

    return typeof value === "number" && Number.isFinite(value)
        ? value
        : 0;

}
