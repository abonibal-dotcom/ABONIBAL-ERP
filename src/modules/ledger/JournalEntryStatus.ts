export const journalEntryStatuses = ["draft", "posted", "reversed"] as const;

export type JournalEntryStatus = typeof journalEntryStatuses[number];

export function isJournalEntryStatus(
    value: unknown
): value is JournalEntryStatus {

    return typeof value === "string"
        && journalEntryStatuses.includes(value as JournalEntryStatus);

}
