import "../styles/variables.css";
import "../styles/reset.css";
import "../styles/buttons.css";

export class Theme {

    private static loaded = false;

    public static load(): void {

        if (this.loaded) {
            return;
        }

        this.loaded = true;

    }

}
