import type { Product } from "../Product";

export class ProductStore {

    private products: Product[] = [];

    public all(): Product[] {
        return this.products;
    }

    public add(product: Product): void {
        this.products.push(product);
    }

    public update(id: string, data: Partial<Product>): void {

        const product = this.products.find(p => p.id === id);

        if (!product) {
            return;
        }

        Object.assign(product, data);
    }

    public remove(id: string): void {

        this.products = this.products.filter(
            p => p.id !== id
        );

    }

    public find(id: string): Product | undefined {

        return this.products.find(
            p => p.id === id
        );

    }

    public clear(): void {

        this.products = [];

    }

}
