export type ButtonVariant =
    | "primary"
    | "secondary"
    | "danger"
    | "success";

export class BaseButton {

    private readonly id: string;
    private readonly text: string;
    private readonly variant: ButtonVariant;

    constructor(
        id: string,
        text: string,
        variant: ButtonVariant = "primary"
    ) {
        this.id = id;
        this.text = text;
        this.variant = variant;
    }

    public render(): string {

        return `
            <button
                id="${this.id}"
                class="ab-button ab-button-${this.variant}"
            >
                ${this.text}
            </button>
        `;

    }

}
