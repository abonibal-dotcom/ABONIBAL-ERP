export interface DialogOptions {

    id: string;

    title: string;

    body: string;

    footer?: string;

}

export abstract class BaseDialog {

    protected readonly options: DialogOptions;

    constructor(options: DialogOptions) {

        this.options = options;

    }

    public render(): string {

        return `
            <div
                id="${this.options.id}"
                class="dialog hidden"
            >

                <div class="dialog-content">

                    <div class="dialog-header">

                        <h2>

                            ${this.options.title}

                        </h2>

                        <button
                            class="dialog-close"
                        >
                            ✕

                        </button>

                    </div>

                    <div class="dialog-body">

                        ${this.options.body}

                    </div>

                    <div class="dialog-footer">

                        ${this.options.footer ?? ""}

                    </div>

                </div>

            </div>
        `;

    }

    protected element(): HTMLElement | null {

        return document.getElementById(
            this.options.id
        );

    }

    public open(): void {

        this.element()
            ?.classList.remove("hidden");

    }

    public close(): void {

        this.element()
            ?.classList.add("hidden");

    }

    public toggle(): void {

        this.element()
            ?.classList.toggle("hidden");

    }

    public isOpen(): boolean {

        const dialog =
            this.element();

        if (!dialog) {

            return false;

        }

        return !dialog.classList.contains(
            "hidden"
        );

    }

    protected bindClose(): void {

        const dialog =
            this.element();

        if (!dialog) {

            return;

        }

        dialog
            .querySelector(".dialog-close")
            ?.addEventListener("click", () => {

                this.close();

            });

    }

}
