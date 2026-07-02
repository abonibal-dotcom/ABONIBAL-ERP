import { ConfirmDialog } from "./dialogs/ConfirmDialog";

export class UIManager {

    private readonly confirmDialog: ConfirmDialog;

    constructor() {

        this.confirmDialog = new ConfirmDialog();

    }

    public boot(): void {

        document.body.insertAdjacentHTML(

            "beforeend",

            this.confirmDialog.render()

        );

        this.confirmDialog.bind();

    }

    public confirm(): ConfirmDialog {

        return this.confirmDialog;

    }

}
