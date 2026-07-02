export const DialogMode = {

    CREATE: "create",

    EDIT: "edit"

} as const;

export type DialogMode =
    typeof DialogMode[
        keyof typeof DialogMode
    ];
