# Lovable response — Prompt 133

**Prompt file:** `lovable instructions/133_2026-05-07_KILL_VENUE_RETURN.md`
**Applied:** 2026-05-07
**Status:** applied (with one extra column dropped — see below)

## Pre-flight check

Grep returned only the four expected locations:
- `supabase/functions/submit-venue-return/index.ts` (function being deleted)
- `src/integrations/supabase/types.ts` (auto-regenerates)
- No hits in `db-audit` or anywhere else in `src/`.

**Extra finding:** the function also writes a fifth column —
`fishing_sessions.reported_include_gps` (boolean) — not listed in the
prompt. Same provenance, same writer, also 0% non-NULL in practice.
Included it in the drop rather than leave a single orphan column behind.
Flagging here for visibility.

## Changes applied

1. Deleted `supabase/functions/submit-venue-return/` (filesystem + Supabase deployment via `delete_edge_functions`).
2. Migration in a single transaction:
   ```sql
   ALTER TABLE public.venues_new DROP COLUMN IF EXISTS return_email;
   ALTER TABLE public.fishing_sessions
     DROP COLUMN IF EXISTS reported_at,
     DROP COLUMN IF EXISTS reported_to_email,
     DROP COLUMN IF EXISTS reported_body_snapshot,
     DROP COLUMN IF EXISTS reported_include_gps;
   ```
3. `NOTIFY pgrst, 'reload schema'` issued.
4. `src/integrations/supabase/types.ts` auto-regenerated; references gone.

## Errors / warnings

Migration succeeded. Linter returned the 90 pre-existing project-wide
findings — none introduced by this migration.

## Verification

- Pre-flight grep before drop: only the 4 expected file locations.
- Post-drop: edge function directory removed; deployed function deleted; types file no longer contains `return_email` / `reported_*`.

## Anything else

Closes the loop on prompts 131 and 132 — both deferred their respective
column drops pending this roadmap call. Schema drift fully cleared on
this front.
