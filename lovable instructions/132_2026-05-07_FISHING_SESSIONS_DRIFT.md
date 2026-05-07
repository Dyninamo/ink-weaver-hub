# Lovable Prompt 132 — Eliminate `fishing_sessions` schema drift

**Context:** Final companion to **prompts 125** (`SESSION_EVENTS_DRIFT`)
and **131** (`VENUES_NEW_DRIFT`). The Phase 1 drift audit
(`PHASE1_DRIFT_AUDIT.md`, 2026-05-03) flagged `fishing_sessions` as the
worst-drifted table:

- Master rows: **45,092** (40 cols)
- Supabase rows: **45,092** (52 cols)
- Common: 36
- Master-only: 4 cols
- Supabase-only: 16 cols

The **row counts match** (good — `sync_diary_from_supabase.py` is
working), but the column sets don't.

**Lesson from prompt 131:** the audit's 0% non-NULL count does NOT
guarantee a column is unreferenced. `return_email` was 0% non-NULL but
read by a live edge function. **This prompt assumes the same risk
applies to several of the 15 "dead" columns below**, and asks you to
verify per-column rather than drop them in a blanket transaction.

---

## Pre-flight check — comprehensive

Run this grep first:

```bash
grep -rIn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
     -E "\b(rod_weight|rod_length_ft|line_profile|leader_id|tippet_length_ft|tippet_strength|tippet_unit|dropper_count|keep_limit|spot_name|size_mode|size_units|reported_at|reported_to_email|reported_body_snapshot|reported_include_gps|gps_start_lat|gps_start_lon|submission_status|submission_due)\b" \
     src/ supabase/functions/
```

Tabulate the result by column name. For each of the 15 columns this
prompt proposes to drop, classify the references as:

- **Generated types only** (`src/integrations/supabase/types.ts`) — safe to ignore; auto-regenerates.
- **Read-only / display** — column is selected and shown in UI but never written. Probably safe to drop after the reader is updated to either omit or render `null`.
- **Live writer** — code calls `from('fishing_sessions').update({...col: ...})` or `.insert({...col: ...})` with non-null values. **Do not drop — defer.**
- **Dead-after-prompt** — only references are in admin forms / dropdowns that ALSO need editing as part of this prompt. Acceptable; drop the column AND remove the form field.

Report the classification before applying any DROPs.

---

## Required changes

### Phase A — Add 4 master-only columns to Supabase (safe, no readers to break)

Master writes these via `Database/upload_passport_*.py` and the diary
session sync. Without them on Supabase, master→Supabase pushes silently
drop the values.

```sql
BEGIN;

ALTER TABLE public.fishing_sessions
    ADD COLUMN IF NOT EXISTS gps_start_lat     double precision,
    ADD COLUMN IF NOT EXISTS gps_start_lon     double precision,
    ADD COLUMN IF NOT EXISTS submission_status text,
    ADD COLUMN IF NOT EXISTS submission_due    timestamptz;

COMMIT;
```

Type mapping rationale:
- `gps_start_lat` / `gps_start_lon` — REAL on master → `double precision` on Postgres.
- `submission_status` — TEXT → `text`.
- `submission_due` — TEXT (ISO 8601) on master → `timestamptz` on Postgres
  (better Postgres-native handling; sync will pass the same ISO string
  through).

Apply Phase A unconditionally. Then `NOTIFY pgrst, 'reload schema'`.

### Phase B — Drop dead Supabase-only columns (per-column, conditional on grep)

The 15 columns identified by the 2026-05-03 NULL-count audit:

```
rod_weight              tippet_unit             reported_to_email
rod_length_ft           dropper_count           reported_body_snapshot
line_profile            keep_limit
leader_id               spot_name
tippet_length_ft        size_mode
tippet_strength         size_units              reported_at
```

For **each** column above, if the pre-flight grep found:

- **Only generated-types references** → drop it.
- **A reader/writer in `src/` or `supabase/functions/`** → DO NOT drop.
  Add to a "deferred" list in the response file with the file:line
  references and a one-sentence assessment of whether it's a half-built
  feature (like `return_email` was) or live-and-functional code.

For the columns cleared to drop, build a single migration:

```sql
BEGIN;

ALTER TABLE public.fishing_sessions
    DROP COLUMN IF EXISTS <each_clear_column>;
-- (one DROP per cleared column — leave deferred ones in place)

COMMIT;
```

If **all 15** clear: that's the lucky case. If **some** are deferred:
that's expected — applying a partial drop is fine, and the deferred
columns get their own follow-up prompt later.

After the DROPs, `NOTIFY pgrst, 'reload schema'`.

### Phase C — Migrate `reported_include_gps` to master (NOT part of this prompt)

`reported_include_gps` is the one Supabase-only column with real data —
100% non-NULL across all 45,092 rows. It needs to land on master, then
its sync direction reversed (master canonical, push to Supabase).

This is a master-side action:

```sql
-- Run on master SQLite locally (NOT via Lovable)
ALTER TABLE fishing_sessions ADD COLUMN reported_include_gps INTEGER NOT NULL DEFAULT 1;
```

…plus a one-shot pull in `Database/sync_diary_from_supabase.py` to
backfill the existing 45,092 master rows from Supabase. The pipeline
agent will handle this side independently — for this prompt, simply
**leave `reported_include_gps` alone on Supabase**.

### Phase D — Form / page cleanup (depends on grep results)

If any of the dropped columns appeared in admin forms (e.g.
`SessionEdit.tsx`, the diary settings page), remove the corresponding
form field as part of this prompt. Don't leave UI controls bound to
columns that no longer exist.

---

## Verification

1. **Phase A schema check**:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fishing_sessions'
      AND column_name IN ('gps_start_lat','gps_start_lon','submission_status','submission_due');
   ```
   Expect 4 rows.

2. **Phase B per-column**:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fishing_sessions'
      AND column_name = ANY (ARRAY[<dropped column names>]);
   ```
   Expect 0 rows.

3. **App build**: `npm run build` succeeds with regenerated types.

4. **End-to-end diary write**: log a session via the PWA. Confirm the
   row lands with the existing 36 + 4-new common columns populated, no
   "column does not exist" errors in either app code or edge functions.

5. **Master sync probe** (pipeline agent action): after the additive
   half lands, `python Database/upload_passport_*.py` should push
   master rows with non-NULL `gps_start_lat`/`gps_start_lon` — confirm
   those columns now contain the master values on the Supabase side.

---

## Why this prompt is split into phases

The original `PHASE1_DRIFT_AUDIT` plan called for a single transaction
that did the full drop. Prompt 131 demonstrated why that's risky: a 0%
non-NULL count audit underestimates real coupling. By splitting:

- Phase A is **guaranteed safe** — adding nullable columns can't break
  any reader.
- Phase B is **safe per-column** because each drop is gated on its own
  grep result.
- Phase C is master-side, deliberately out of Lovable's scope.

Worst case: Phase A applies, Phase B finds 14 of 15 deferred (similar
to 131), the table still gets cleaner by 4-and-1 columns, and the
remaining drops become individual follow-up prompts. That's still
progress.

---

## Response capture

Per protocol prompt 128, log the outcome to
`lovable instructions/responses/132_response.md`. Include:

- Pre-flight grep tabulation (per-column).
- Which columns were dropped vs deferred.
- For deferred columns, a one-line note on whether they look like a
  half-built feature or live code.
- Migration SQL applied verbatim.

This response file is what the pipeline agent (Claude Code) reads next.
