// Prompt 233 — decode RN-style metadata blob folded into session_events.notes.
// The RN diary writes a JSON object into `notes` when the row lacks dedicated
// columns: { text, voice_transcript, input_method, kept_released, rod_index, rod_name, ... }
// PWA-typed notes stay as plain strings.
//
// Returns the human-facing portion (text + voice_transcript) or null when the
// blob carries only metadata (so the caller can skip rendering the note row).
export function displayNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const t = notes.trim();
  if (!t.startsWith("{")) return notes;
  try {
    const o = JSON.parse(t);
    if (o && typeof o === "object") {
      const parts = [o.text, o.voice_transcript].filter(
        (v): v is string => typeof v === "string" && v.trim().length > 0,
      );
      return parts.length ? parts.join(" — ") : null;
    }
  } catch {
    /* not JSON — fall through */
  }
  return notes;
}
