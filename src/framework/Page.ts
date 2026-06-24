import { Component } from "./Component";

export abstract class Page extends Component {

    public abstract title(): string;

    public onEnter(): void {}

    public onLeave(): void {}

}
