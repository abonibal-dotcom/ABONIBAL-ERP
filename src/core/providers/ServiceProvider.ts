import { Container } from "../Container";

export abstract class ServiceProvider {

    protected readonly container =
        Container;

    public abstract register(): void;

}
