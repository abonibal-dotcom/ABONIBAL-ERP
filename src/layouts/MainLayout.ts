import { Sidebar } from "../ui/navigation/Sidebar";
import { Workspace } from "../ui/workspace/Workspace";
export class MainLayout {

    private readonly sidebar = new Sidebar();
    private readonly workspace = new Workspace();

    public render(): string {

        return `
            <div id="layout">

                ${this.sidebar.render()}

                ${this.workspace.render()}

            </div>
        `;

    }

    public bind(): void {

        this.sidebar.bind();

    }

}
