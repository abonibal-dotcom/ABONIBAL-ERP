import type { Driver } from "../persistence/Driver";

export abstract class Repository<T> {

    protected key: string;
    protected driver: Driver;

    constructor(
        key: string,
        driver: Driver
    ) {

        this.key = key;
        this.driver = driver;

    }

    public all(): T[] {

        return this.driver.read<T[]>(this.key) ?? [];

    }

    protected save(items: T[]): void {

        this.driver.write<T[]>(this.key, items);

    }

    public clear(): void {

        this.driver.remove(this.key);

    }

}
