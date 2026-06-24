import type { Driver } from "./Driver";

export class LocalStorageDriver implements Driver {

    public read<T>(key: string): T | null {

        const json = localStorage.getItem(key);

        if (!json) {
            return null;
        }

        return JSON.parse(json) as T;

    }

    public write<T>(key: string, value: T): void {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    }

    public remove(key: string): void {

        localStorage.removeItem(key);

    }

    public clear(): void {

        localStorage.clear();

    }

}
