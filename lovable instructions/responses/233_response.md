# 233 — Fix three display bugs

## Fix A — catch note JSON blob
- **Created** `src/lib/displayNote.ts` exporting `displayNote(notes)`: returns `notes` unchanged for plain strings; for RN-style `{ text, voice_transcript, input_method, kept_released, rod_index, rod_name, ... }` blobs returns `text — voice_transcript` (whichever are present) or `null` when only metadata is present (so the caller suppresses the note row entirely). Non-JSON strings starting with `{` (defensive) fall through to original text.
- `src/pages/DiaryEntry.tsx:652` timeline note render now resolves `displayNote(event.notes)` first; the bordered/italic block only mounts when the result is non-null, so metadata-only catches show no note row. Real typed notes render normally. `kept_released` stays in the Outcome surface — never reintroduced as a note.
- Only one timeline render site exists (`DiaryEntry.tsx:652`); `session.notes` at line 777 is the user-typed session-level note (no metadata folding), left untouched.

## Fix B — `Change [object Object]` in Recent feed
- `src/components/diary/ReadyView.tsx` `RecentBody` `change` branch now flattens each `change_to` value with `flatten()`: objects → `pattern ?? fly ?? name ?? null`; primitives → `String(v)`; `null/undefined` skipped. Falls back to `"Setup change"` when everything was unstringifiable.
- `change_from` is not rendered in `RecentBody`, so nothing else to patch here.

## Fix C — empty `/results` from Recent Queries
- `src/pages/Dashboard.tsx` `handleViewQuery` now navigates with `advice_text: query.advice_text` (was `advice: …`). Results reads `state.advice_text` on the legacy path and renders correctly.
- **Structured payload not stored:** the `queries` table only persists `advice_text`, `recommended_locations`, `weather_data`, `map_image_url` — there is no per-query column for the v2 structured tactical/prediction payload. So a viewed Recent Query renders the markdown advice text + weather + locations only; the rich v2 card (tactical flies/methods/spots, confidence pills, model_info) is unavailable for historical queries until that payload is persisted. This is the prompt's "render what's available" branch.

## Verify
- A: synced catch whose `notes` is a pure metadata blob → no note row; one with a real `text` → renders the human text.
- B: live fly-change → `Change · <pattern>` (e.g. `Change · Cruncher`), never `[object Object]`.
- C: Dashboard → Recent Queries → View → Results page renders the advice text and weather block; no empty page.
