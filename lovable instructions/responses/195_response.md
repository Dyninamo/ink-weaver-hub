# 195 — Edge function auth phase 3 (upload-* family)

## §1 — Gates applied to 11 functions
For each: added `import { requireAdmin } from "../_shared/admin_auth.ts";` after `env.ts` import, inserted the gate block right after the OPTIONS preflight.

| Function | import L | gate L |
|---|---|---|
| upload-analysis | 4 | 63 |
| upload-basic-advice | 4 | 31 |
| upload-diary-events | 4 | 11 |
| upload-diary-sessions | 4 | 11 |
| upload-environmental | 4 | 35 |
| upload-fishing-reports | 4 | 16 |
| upload-prediction-config | 4 | 22 |
| upload-reference-data | 4 | 23 |
| upload-taxonomy | 4 | 24 |
| upload-terminology | 4 | 27 |
| upload-venue-spots | 4 | 16 |

## §2 — verification
`grep -c requireAdmin` returns 2 hits per file (import + call). Pre-edit returned 0.

## §3 — `/admin/upload` UI
Unchanged. `supabase.functions.invoke()` auto-attaches the user JWT; `requireAdmin` accepts Nick's JWT via path 2.

## §4 — Python snippet (master-side; not applied here)
See `194_response.md` §4. Apply to:
- `Database/upload_reports.py`, `upload_diary_sessions.py`, `upload_diary_events.py`,
  `upload_taxonomy.py`, `upload_terminology.py`, `upload_environmental.py`,
  `upload_analysis.py`, `upload_reference.py`, `upload_venue_spots.py`,
  `sync_flies_v2.py`, `sync_flies_dependent_tables.py`.

## Deployment safety
Coordinate the deploy with a quiet window in Nick's pipeline (`pipelines/weekly_scheduled_run.bat`). Pipeline calls without `X-Admin-Secret` will return 401 until the Python sweep lands.

## Smoke tests
Pending live curl after deploy + secret set.
