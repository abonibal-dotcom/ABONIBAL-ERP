import { EventBus } from "../core/EventBus";

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
