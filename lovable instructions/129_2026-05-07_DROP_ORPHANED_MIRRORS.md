# Lovable Prompt 129 — Drop the 6 truly-orphaned master-mirror tables

**Context:** Successor to **prompt 126** (`DROP_OBSOLETE_MIRRORS`), which
aborted at pre-flight after finding live readers for two of the eight
proposed drops:

- `harvested_events` is read by `src/pages/VenueDetail.tsx:175` (recent
  report excerpts on the venue detail page).
- `venue_profiles` is read by `supabase/functions/_shared/prediction-params.ts:92`
  (`getVenueProfile`) and listed in `supabase/functions/upload-prediction-config/index.ts`.

Both need their readers refactored before the table can be dropped — see
parked follow-ups at the bottom.

The other six in 126's drop list — `fisheries`, `url_patterns`,
`crawl_audit`, `crawl_intelligence`, `discovered_urls`, `discovery_hubs` —
appeared only in admin-page / `db-audit` references (the allowed list).
This prompt drops just those six.

These were originally created by prompt 25 (`25_2026-02-25_REMAINING_TABLES.txt`)
as defensive mirrors of master tables. The crawl-* family belong to a
desktop crawler that writes to a local `crawler.db`, not to Supabase, so
the Supabase copies have always been empty schema. `fisheries` was a
five-row pre-master ghost. None feed any live frontend or edge-function.
All six were also dropped from master in Session 27 Phase 3 (2026-05-07).

---

## Pre-flight check (do this first, abort if it returns hits)

Confirm no readers crept in since prompt 126's pre-flight (a few hours ago):

```bash
grep -rIn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
     -E "\b(crawl_audit|crawl_intelligence|discovered_urls|discovery_hubs|url_patterns)\b|\bfrom\(['\"]fisheries['\"]\)" \
     src/ supabase/functions/
```

**Expected hits — these are the only acceptable references** (each one is
removed by this prompt):

1. `supabase/functions/db-audit/index.ts` — any of the six names in the
   `knownTables` array.
2. The admin upload page (likely `src/pages/admin/Upload.tsx`) — any of
   the six names in `allowedTables`, the `pkCol` map, or
   `SERIAL_ID_TABLES`.
3. `src/pages/AdminDbStatus.tsx` — categorisation lists.

The grep deliberately excludes the bare word `fisheries` matched by the
`from(...)` pattern only, because the English word "fisheries" appears
in user-facing copy throughout the app and isn't a table reference.

If grep returns **anything outside that list**, **stop and report back**.

---

## Required changes

### 1. Drop the six tables in a single transaction

```sql
BEGIN;

DROP TABLE IF EXISTS public.fisheries           CASCADE;
DROP TABLE IF EXISTS public.url_patterns        CASCADE;
DROP TABLE IF EXISTS public.crawl_audit         CASCADE;
DROP TABLE IF EXISTS public.crawl_intelligence  CASCADE;
DROP TABLE IF EXISTS public.discovered_urls     CASCADE;
DROP TABLE IF EXISTS public.discovery_hubs      CASCADE;

COMMIT;
```

CASCADE handles any FKs between the crawl-* tables (`crawl_intelligence.url_pattern_id`
→ `url_patterns`, etc., per prompt 25). RLS, policies, and indexes are
dropped automatically.

### 2. Remove from `db-audit` edge function

In `supabase/functions/db-audit/index.ts`, delete each of the six names
from the `knownTables` array (and any related counts/checks). Re-deploy.

### 3. Remove from the admin pages

Find the admin upload page and `AdminDbStatus.tsx`. Remove the six names
from:

- `allowedTables` (the dropdown / menu)
- `pkCol` map (primary-key column lookups)
- `SERIAL_ID_TABLES` (auto-increment marker set)
- Any model-table categorisation list in `AdminDbStatus.tsx`

If any of the names appear in a typed `Database.public.Tables.X` reference,
those resolve themselves once the types are regenerated (step 5).

### 4. Reload PostgREST schema cache

```sql
NOTIFY pgrst, 'reload schema';
```

### 5. Regenerate Supabase TypeScript types

If the project uses generated types (`src/integrations/supabase/types.ts`),
regenerate so the six tables disappear from the `Database` type. Build
will surface any straggler references at compile time.

---

## Verification

1. **Schema check**: `\dt public.*` should no longer list any of the six
   names. Spot-check `\dt public.crawl_audit` returns "Did not find any
   relation."

2. **PostgREST**: `curl <project>.supabase.co/rest/v1/crawl_audit?limit=1`
   returns a `42P01` ("relation does not exist") error.

3. **App build**: `npm run build` succeeds.

4. **Frontend smoke**: load the admin upload page and confirm the dropdown
   no longer offers any of the six.

5. **db-audit**: invoke the audit edge function and confirm it returns
   without errors and no longer reports the six tables.

---

## What this leaves behind (parked, separate prompts)

Two of the original 126 list are deferred until their readers are
refactored:

### `harvested_events` — defer until `VenueDetail.tsx` is migrated

`src/pages/VenueDetail.tsx:175` reads recent report excerpts from this
table. The canonical source for that data is `reports_enriched` (4,415
rows, fully synced from master). Likely refactor: change the query from
`from('harvested_events')` to `from('reports_enriched').filter(venue_name)`
with appropriate column mapping. Then a future prompt drops
`harvested_events` from Supabase.

Note: `harvested_events` was already dropped from master in Session 27
(13 stale Wales-harvester rows). The Supabase copy may have its own data
volume — worth checking row count before deciding whether the data needs
preserving.

### `venue_profiles` — defer until prediction pipeline is audited

`supabase/functions/_shared/prediction-params.ts:92` (`getVenueProfile`)
and `supabase/functions/upload-prediction-config/index.ts` reference
this. Coupled with `prediction_params` (which Claude Code held on master
because `scripts/advice_card.py:569` reads it). The whole prediction
pipeline needs an audit to decide:

- Is this prediction code still in active use?
- Should `venue_profiles` be replaced by `report_venue_profiles` or
  `stillwater_venue_profiles` (both legitimately live)?
- Or kept and re-synced from master? (Master copy was 5 rows; dropped
  Session 27.)

A future prompt addresses this after the audit.

---

## Response capture

Per prompt 128, log the outcome to `lovable instructions/responses/129_response.md`
in the same commit as any migrations.
