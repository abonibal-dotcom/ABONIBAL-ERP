export type EventListener<T = unknown> =
    (payload: T) => void;

export class EventBus {

    private static listeners =
        new Map<string, EventListener[]>();

    public static on<T = unknown>(
        event: string,
        listener: EventListener<T>
    ): void {

        if (!this.listeners.has(event)) {

            this.listeners.set(event, []);

        }

        this.listeners
            .get(event)!
            .push(listener as EventListener);

    }

    public static emit<T = unknown>(
        event: string,
        payload: T
    ): void {

        const listeners =
            this.listeners.get(event);

        if (!listeners) {
            return;
        }

        for (const listener of listeners) {

            listener(payload);

        }

    }

    public static off(
        event: string,
        listener: EventListener
    ): void {

        const listeners =
            this.listeners.get(event);

        if (!listeners) {
            return;
        }

        this.listeners.set(
            event,
            listeners.filter(
                item => item !== listener
            )
        );

    }

    public static clear(): void {

        this.listeners.clear();

    }

}
