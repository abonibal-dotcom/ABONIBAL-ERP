import { EventBus } from "../core/EventBus";
import type { EventListener } from "../core/EventBus";

export abstract class BaseController {

    protected emit<T>(
        event: string,
        payload: T
    ): void {

        EventBus.emit(
            event,
            payload
        );

    }

    protected on<T>(
        event: string,
        listener: (payload: T) => void
    ): void {

        EventBus.on(
            event,
            listener
        );

    }

protected off(
    event: string,
    listener: EventListener
): void {

    EventBus.off(
        event,
        listener
    );

    }

    protected success(
        message: string
    ): void {

        console.log(message);

    }

    protected error(
        message: string
    ): void {

        console.error(message);

    }

}
