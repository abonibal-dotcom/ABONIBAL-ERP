import { CommercialCommandError } from "./CommercialCommandErrors.js";
import type { TrustedCommandHandler } from "./CommercialCommandTypes.js";

export class TrustedCommandHandlerRegistry {
    private readonly handlers = new Map<string, TrustedCommandHandler>();

    register(commandType: string, handler: TrustedCommandHandler): void {
        if (this.handlers.has(commandType)) {
            throw new CommercialCommandError(
                "RECEIPT_STATE_CONFLICT",
                `A trusted handler is already registered for ${commandType}.`
            );
        }

        this.handlers.set(commandType, handler);
    }

    resolve(commandType: string): TrustedCommandHandler | null {
        return this.handlers.get(commandType) ?? null;
    }

    get size(): number {
        return this.handlers.size;
    }
}

export function createRuntimeTrustedCommandHandlerRegistry(): TrustedCommandHandlerRegistry {
    return new TrustedCommandHandlerRegistry();
}
