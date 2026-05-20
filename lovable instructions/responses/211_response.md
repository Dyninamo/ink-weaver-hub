# 211 — Methods, truth, and stranded masters added to upload-analysis

## Part A — fly_suitability_truth table
Migration created `public.fly_suitability_truth` (composite PK fly_name+water_type_id+month, fields: suitability text, generated_at text). Indexes on `fly_name` and `(water_type_id, month)`. RLS enabled with public SELECT policy ("Public can read fly suitability truth"). No write policy → service-role-only writes (matches upload-analysis pattern).

## Part B — upload-analysis whitelist
`supabase/functions/upload-analysis/index.ts`:
- `ALLOWED_TABLES` appended in three commented groups: `method_canonical`, `method_aliases`; `fly_suitability_truth`; `weather_youtube`, `stocking_records`, `venue_clubs`.
- `SERIAL_ID_TABLES` extended with `weather_youtube`, `stocking_records`, `venue_clubs`. Methods + truth tables intentionally NOT added (TEXT / composite PKs).

Edge function auto-deploys on save.

## Linter
Migration produced only pre-existing project-wide findings (security definer views, mutable search_path warnings, permissive SELECT policies). None introduced by this migration — the new `USING (true)` SELECT on reference data is the intended public-read pattern and excluded from the always-true warning per linter rules.

## Out of scope
- Master-side backfill scripts (`upload_methods.py`, `upload_fly_suitability_truth.py`, `upload_misc_master.py`) — run from operator machine.
- `clear_table` RPC allow-list NOT extended; callers must pass `clear_first: false` for these six tables, or a follow-up prompt can widen the RPC.
