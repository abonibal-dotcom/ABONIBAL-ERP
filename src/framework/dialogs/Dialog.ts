export interface Dialog<T> {

    open(): void;

    close(): void;

    clear(): void;

    fill(data: T): void;

}
