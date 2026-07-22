import { HttpsError } from "firebase-functions/v2/https";
import { CommercialCommandError } from "../trusted/CommercialCommandErrors.js";

export function mapCallableError(error: unknown): HttpsError {
    if (!(error instanceof CommercialCommandError)) {
        return new HttpsError("internal", "INTERNAL_ERROR");
    }

    switch (error.code) {
        case "AUTH_REQUIRED":
            return new HttpsError("unauthenticated", error.code);
        case "APP_CHECK_REQUIRED":
            return new HttpsError("failed-precondition", error.code);
        case "MEMBERSHIP_REQUIRED":
            return new HttpsError("permission-denied", error.code);
        case "INVALID_REQUEST":
        case "CHECKSUM_MISMATCH":
            return new HttpsError("invalid-argument", error.code);
        case "UNSUPPORTED_COMMAND":
            return new HttpsError("unimplemented", error.code);
        case "COMMAND_ID_CONFLICT":
        case "RECEIPT_STATE_CONFLICT":
            return new HttpsError("aborted", error.code);
        case "INTERNAL_RETRYABLE":
            return new HttpsError("unavailable", error.code);
    }
}
