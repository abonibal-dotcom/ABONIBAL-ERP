const baseUrl = "http://127.0.0.1:5002/abonibal-erp-test/us-central1";

for (const callableName of [
    "submitCommercialCommand",
    "getCommercialCommandReceipt"
]) {
    const response = await fetch(`${baseUrl}/${callableName}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: {} })
    });
    const body = await response.json();

    if (response.ok || body?.error?.status !== "UNAUTHENTICATED") {
        throw new Error(`${callableName} did not deny the unauthenticated request.`);
    }
}

console.log("PASS: Functions emulator loaded both callables and denied unauthenticated requests.");
