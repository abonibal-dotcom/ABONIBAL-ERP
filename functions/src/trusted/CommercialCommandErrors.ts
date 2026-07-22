export type CommercialCommandErrorCode =
    | "AUTH_REQUIRED"
    | "APP_CHECK_REQUIRED"
    | "INVALID_REQUEST"
    | "CHECKSUM_MISMATCH"
    | "MEMBERSHIP_REQUIRED"
    | "UNSUPPORTED_COMMAND"
    | "COMMAND_ID_CONFLICT"
    | "RECEIPT_STATE_CONFLICT"
    | "INTERNAL_RETRYABLE";

export class CommercialCommandError extends Error {
    constructor(
        readonly code: CommercialCommandErrorCode,
        message: string
    ) {
        super(message);
        this.name = "CommercialCommandError";
    }
}
