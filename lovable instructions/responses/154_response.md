# 154 — Ghillie grounding for Home sessions

## Pre-flight
- `AskGhillieOverlay.tsx` was sending `venue_name` + `venue_id` only — no `venue_type`.
- `ask-ghillie/index.ts` `AskBody` accepted `venue_id` / `venue_name`; venue lookup short-circuited Home with no fallback.

## Changes
- **`src/components/diary/AskGhillieOverlay.tsx`**: added `venue_type: (session as any).venue_type ?? null` to the `ask-ghillie` invoke body.
- **`supabase/functions/ask-ghillie/index.ts`**:
  - `AskBody` widened with `venue_type?: "stillwater" | "river" | null`.
  - Added `ARCHETYPE_DEFAULTS` map (`river → 4 / Chalkstream`, `stillwater → 2 / Large Reservoir`).
  - When venue lookup yields no `waterTypeId` and `body.venue_type` is set, fall back to the archetype; label suffixed with `(archetype)` so the LLM sees it.
  - `grounding` JSONB now records `archetype: boolean` (true when no venue_id and venue_name is Home/empty).

## Out of scope
- Question-text venue parsing (noted as future work).
- Per-archetype confidence weighting.

## Verification
Edge function will be auto-deployed. End-to-end Wensum / Grafham / no-venue_type checks left for the user to exercise from the running PWA per §3 in the prompt.
