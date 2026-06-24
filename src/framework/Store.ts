export class Store<T> {
    private state: T;
    private listeners: Array<(state: T) => void> = [];

    constructor(initialState: T) {
        this.state = initialState;
    }

    public getState(): T {
        return this.state;
    }

    public setState(newState: T): void {
        this.state = newState;

        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    public subscribe(listener: (state: T) => void): void {
        this.listeners.push(listener);
    }
}
