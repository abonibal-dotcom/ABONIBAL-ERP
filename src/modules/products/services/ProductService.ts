import type { Product } from "../Product";
import { ProductRepository } from "../repositories/ProductRepository";
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

        return this.repository.allForAccount(accountContext.accountId);

    }

    public add(product: Product): string[] {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return ["Authenticated account is required."];
        }

        const ownedProduct: Product = {
            ...product,
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

        if (!current) {
            return ["المنتج غير موجود."];
        }

        const updated: Product = {
            ...current,
            ...data,
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

    public remove(id: string): void {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return;
        }

        this.repository.removeFromAccount(
            accountContext.accountId,
            id
        );

    }

    public find(id: string): Product | undefined {

        const accountContext = this.currentAccountContext();

        if (!accountContext) {
            return undefined;
        }

        return this.repository.findForAccount(
            accountContext.accountId,
            id
        );

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

interface ProductAccountContext {

    accountId: string;
    userId: string;

}
