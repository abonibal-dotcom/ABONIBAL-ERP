export interface ButtonOptions {

    id?: string;

    text: string;

    icon?: string;

    type?: "button" | "submit" | "reset";

    variant?:
        | "primary"
        | "secondary"
        | "success"
        | "danger"
        | "warning";

    size?:
        | "sm"
        | "md"
        | "lg";

    disabled?: boolean;

}

export class Button {

    private readonly options: ButtonOptions;

    constructor(options: ButtonOptions) {

        this.options = options;

    }

    public render(): string {

        const variant =
            this.options.variant ?? "primary";

        const size =
            this.options.size ?? "md";

        return `
            <button
                ${this.options.id ? `id="${this.options.id}"` : ""}
                type="${this.options.type ?? "button"}"
                class="btn btn-${variant} btn-${size}"
                ${this.options.disabled ? "disabled" : ""}
            >

                ${this.options.icon
                    ? `<span class="btn-icon">${this.options.icon}</span>`
                    : ""}

                <span class="btn-text">

                    ${this.options.text}

                </span>

            </button>
        `;

    }

}
