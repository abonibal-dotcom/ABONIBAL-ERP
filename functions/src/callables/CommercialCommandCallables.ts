import type { App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FirebaseAccountMembershipRepository } from "../trusted/AccountMembershipRepository.js";
import { CallableSecurityGuard } from "../trusted/CallableSecurityGuard.js";
import { CommercialCommandError } from "../trusted/CommercialCommandErrors.js";
import { FirebaseCommercialCommandReceiptStore } from "../trusted/FirebaseCommercialCommandReceiptStore.js";
import { TrustedCommercialCommandService } from "../trusted/TrustedCommercialCommandService.js";
import { createRuntimeTrustedCommandHandlerRegistry } from "../trusted/TrustedCommandHandlerRegistry.js";
import {
    validateCommercialCommandRequest,
    validateReceiptLookupRequest
} from "../trusted/CommercialCommandValidation.js";
import { mapCallableError } from "./CallableErrorMapping.js";

const CALLABLE_OPTIONS = {
    enforceAppCheck: true,
    region: "us-central1"
} as const;

export function createCommercialCommandCallables(app: App) {
    const database = getDatabase(app);
    const securityGuard = new CallableSecurityGuard(
        new FirebaseAccountMembershipRepository(database)
    );
    const service = new TrustedCommercialCommandService(
        new FirebaseCommercialCommandReceiptStore(database),
        createRuntimeTrustedCommandHandlerRegistry()
    );

    const submitCommercialCommand = onCall(
        CALLABLE_OPTIONS,
        async (request: CallableRequest<unknown>) => {
            try {
                assertCallableAuthentication(request);
                const command = validateCommercialCommandRequest(request.data);
                await securityGuard.authorize(callableContext(request), command.accountId);
                return await service.submit(command);
            } catch (error) {
                throw mapCallableError(error);
            }
        }
    );

    const getCommercialCommandReceipt = onCall(
        CALLABLE_OPTIONS,
        async (request: CallableRequest<unknown>) => {
            try {
                assertCallableAuthentication(request);
                const lookup = validateReceiptLookupRequest(request.data);
                await securityGuard.authorize(callableContext(request), lookup.accountId);
                return await service.lookup(lookup.accountId, lookup.commandId);
            } catch (error) {
                throw mapCallableError(error);
            }
        }
    );

    return {
        submitCommercialCommand,
        getCommercialCommandReceipt
    };
}

function assertCallableAuthentication(request: CallableRequest<unknown>): void {
    if (!request.auth?.uid) {
        throw new CommercialCommandError(
            "AUTH_REQUIRED",
            "Authentication is required."
        );
    }
}

function callableContext(request: CallableRequest<unknown>) {
    const firebaseUid = request.auth?.uid;

    return {
        ...(firebaseUid ? { firebaseUid } : {}),
        appCheckVerified: request.app !== undefined
    };
}
