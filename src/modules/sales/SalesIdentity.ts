export interface SalesMovementIdentity {

    movementId: string;
    idempotencyKey: string;

}

export function buildInvoiceIssueCommandId(
    invoiceId: string
): string | null {

    return buildSalesIdentity("invoice-issue", invoiceId);

}

export function buildInvoiceSaleMovementIdentity(
    invoiceId: string,
    invoiceLineId: string
): SalesMovementIdentity | null {

    return buildMovementIdentity(
        "sale",
        "invoice-issue",
        invoiceId,
        invoiceLineId
    );

}

export function buildInvoiceCancellationCommandId(
    invoiceId: string
): string | null {

    return buildSalesIdentity("invoice-cancel", invoiceId);

}

export function buildInvoiceCancellationMovementIdentity(
    invoiceId: string,
    invoiceLineId: string
): SalesMovementIdentity | null {

    const movementId = buildSalesIdentity(
        "invoice-cancel-return",
        invoiceId,
        invoiceLineId
    );
    const idempotencyKey = buildSalesIdentity(
        "invoice-cancel",
        invoiceId,
        "line",
        invoiceLineId
    );

    return movementId && idempotencyKey
        ? { movementId, idempotencyKey }
        : null;

}

export function buildInvoiceReturnLineId(
    invoiceReturnId: string,
    invoiceLineId: string
): string | null {

    return buildSalesIdentity(
        "return-line",
        invoiceReturnId,
        invoiceLineId
    );

}

export function buildInvoiceReturnExecutionCommandId(
    invoiceReturnId: string
): string | null {

    return buildSalesIdentity("invoice-return-execute", invoiceReturnId);

}

export function buildInvoiceReturnMovementIdentity(
    invoiceReturnId: string,
    invoiceReturnLineId: string
): SalesMovementIdentity | null {

    const movementId = buildSalesIdentity(
        "invoice-return",
        invoiceReturnId,
        invoiceReturnLineId
    );
    const idempotencyKey = buildSalesIdentity(
        "invoice-return-execute",
        invoiceReturnId,
        "line",
        invoiceReturnLineId
    );

    return movementId && idempotencyKey
        ? { movementId, idempotencyKey }
        : null;

}

export function isStableSalesIdentity(value: string): boolean {

    const normalizedValue = value.trim();

    return normalizedValue.length > 0
        && normalizedValue.length <= 512
        && /^[A-Za-z0-9_-]+$/.test(normalizedValue);

}

function buildMovementIdentity(
    movementPrefix: string,
    commandPrefix: string,
    invoiceId: string,
    lineId: string
): SalesMovementIdentity | null {

    const movementId = buildSalesIdentity(
        movementPrefix,
        invoiceId,
        lineId
    );
    const idempotencyKey = buildSalesIdentity(
        commandPrefix,
        invoiceId,
        "line",
        lineId
    );

    return movementId && idempotencyKey
        ? { movementId, idempotencyKey }
        : null;

}

function buildSalesIdentity(...parts: string[]): string | null {

    const normalizedParts = parts.map(part => part.trim());

    if (normalizedParts.some(part => !isStableSalesIdentity(part))) {
        return null;
    }

    const identity = normalizedParts.join("-");

    return isStableSalesIdentity(identity) ? identity : null;

}
