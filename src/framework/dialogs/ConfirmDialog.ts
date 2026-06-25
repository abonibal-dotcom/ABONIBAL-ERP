import { BaseDialog } from "../BaseDialog";

export class ConfirmDialog extends BaseDialog {

    private onConfirm: (() => void) | null = null;

    constructor() {

        super({

            id: "confirm-dialog",

            title: "تأكيد العملية",

            body: `
                <p id="confirm-dialog-message">
                    هل أنت متأكد؟
                </p>
            `,

            footer: `
                <button id="confirm-dialog-ok">
                    نعم
                </button>

                <button id="confirm-dialog-cancel">
                    إلغاء
                </button>
            `

        });

    }

    public bind(): void {

        this.bindClose();

        document
            .getElementById("confirm-dialog-cancel")
            ?.addEventListener("click", () => {

                this.close();

                this.onConfirm = null;

            });

        document
            .getElementById("confirm-dialog-ok")
            ?.addEventListener("click", () => {

                this.close();

                const callback =
                    this.onConfirm;

                this.onConfirm = null;

                callback?.();

            });

    }

    public confirm(
        message: string,
        callback: () => void
    ): void {

        this.onConfirm = callback;

        const label =
            document.getElementById(
                "confirm-dialog-message"
            );

        if (label) {

            label.textContent = message;

        }

        this.open();

    }

}
