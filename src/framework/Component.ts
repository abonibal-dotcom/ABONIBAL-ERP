export abstract class Component {

    protected html = "";

    public abstract render(): string;

    public mount(): void {}

    public update(): void {}

    public destroy(): void {}

}
