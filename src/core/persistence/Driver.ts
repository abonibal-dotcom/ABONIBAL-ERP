export interface Driver {

    read<T>(key: string): T | null;

    write<T>(key: string, value: T): void;

    remove(key: string): void;

    clear(): void;

}
