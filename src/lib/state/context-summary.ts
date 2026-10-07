/**
 * Context summary joiners (025 contracts/pure-api.md). Pure: separators come from the message
 * catalog, so a locale can change them. Empty parts are dropped.
 */
import { m } from '$lib/paraglide/messages.js';

/** Join summary parts with the catalog separator (" · "). */
export function joinSummary(parts: readonly string[]): string {
  return parts.filter((p) => p !== '').join(m.summary_separator());
}

/** Join note names with the catalog note separator (" – "). */
export function joinNotes(names: readonly string[]): string {
  return names.filter((n) => n !== '').join(m.summary_note_separator());
}
