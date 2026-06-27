export class Storage {
    public set<T>(key: string, value: T): void {
        localStorage.setItem(
            key,
            JSON.stringify(value),
        );
    }

    public get<T>(key: string): T | null {
        const value = localStorage.getItem(key);

        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value) as T;
        } catch (error) {
            if (error instanceof SyntaxError) {
                return null;
            }

            throw error;
        }
    }

    public remove(key: string): void {
        localStorage.removeItem(key);
    }

    public clear(): void {
        localStorage.clear();
    }
}
