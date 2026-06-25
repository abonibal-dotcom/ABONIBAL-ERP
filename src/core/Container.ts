import { CoreServiceProvider } from "./providers/CoreServiceProvider";
import { ProductServiceProvider } from "./providers/ProductServiceProvider";

export class Container {

    private static services =
        new Map<string, unknown>();

    public static boot(): void {

        new CoreServiceProvider()
            .register();

        new ProductServiceProvider()
            .register();

    }

    public static register(
        name: string,
        service: unknown
    ): void {

        this.services.set(
            name,
            service
        );

    }

    public static get<T>(
        name: string
    ): T {

        const service =
            this.services.get(name);

        if (!service) {

            throw new Error(
                `Service "${name}" is not registered.`
            );

        }

        return service as T;

    }

    public static has(
        name: string
    ): boolean {

        return this.services.has(name);

    }

    public static remove(
        name: string
    ): void {

        this.services.delete(name);

    }

    public static clear(): void {

        this.services.clear();

    }

}
