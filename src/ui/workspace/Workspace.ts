import { DashboardPage } from "../../pages/DashboardPage";
export class Workspace {

  private readonly dashboard = new DashboardPage();

  public render(): string {

    return `
      <section id="workspace">

        ${this.dashboard.render()}

      </section>
    `;

  }

}
