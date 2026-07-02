export class Form {

    public input(
        id: string
    ): HTMLInputElement {

        const element =
            document.getElementById(id);

        if (!(element instanceof HTMLInputElement)) {

            throw new Error(
                `Input "${id}" not found.`
            );

        }

        return element;

    }

    public value(id: string): string {

        return this
            .input(id)
            .value
            .trim();

    }

    public setValue(
        id: string,
        value: string
    ): void {

        this.input(id).value = value;

    }

    public clear(
        ...ids: string[]
    ): void {

        ids.forEach(id => {

            this.setValue(id, "");

        });

    }

}
