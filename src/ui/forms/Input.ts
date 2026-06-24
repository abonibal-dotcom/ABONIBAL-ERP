export interface InputOptions {

    id: string;

    label: string;

    type?: string;

    placeholder?: string;

    value?: string;

    required?: boolean;

}

export class Input {

    private options: InputOptions;

    constructor(options: InputOptions) {

        this.options = options;

    }

    public render(): string {

        return `
            <div class="form-group">

                <label for="${this.options.id}">

                    ${this.options.label}

                </label>

                <input
                    id="${this.options.id}"
                    type="${this.options.type ?? "text"}"
                    placeholder="${this.options.placeholder ?? ""}"
                    value="${this.options.value ?? ""}"
                    ${this.options.required ? "required" : ""}
                >

            </div>
        `;

    }

}
