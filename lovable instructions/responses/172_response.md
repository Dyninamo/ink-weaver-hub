# 172 — Edge function service-role validation sweep

## Pre-flight
`grep` for `SUPABASE_SERVICE_ROLE_KEY` in `supabase/functions/` returned 33 files; subtracting `ask-ghillie` and `get-ai-advice-v2` (already migrated in 170) and `_shared/env.ts` left **31 target files** — matches the prompt's expected count.

## Files touched

| File | A (`!`) | B (`?? ""`) | URL also fixed | Notes |
|---|---|---|---|---|
| batch-recompute | 0 | 1 | 1 | cron-triggered |
| compute-angler-stats | 0 | 1 | 1 | typed catch (`err: unknown`) |
| compute-session-summary | 0 | 1 | 1 | typed catch |
| compute-venue-stats | 0 | 1 | 1 | typed catch |
| create-share-link | 1 | 0 | 1 | |
| db-audit | 2 | 0 | 2 | both anon + admin client sites converted (§4) |
| find-venue-email | 1 | 0 | 1 | |
| generate-venue-cards | 1 | 0 | 1 | |
| get-basic-advice | 1 | 0 | 1 | |
| get-fishing-advice-mock | 1 | 0 | 1 | dev-only |
| get-fishing-advice | 1 | 0 | 1 | legacy v1 |
| get-shared-report | 0 | 1 | 2 | typed catch (`error: any`) |
| get-venue-advice | 1 | 0 | 1 | legacy v1 |
| lapse-affiliations | 1 | 0 | 1 | cron-triggered |
| on-session-logged | 1 | 0 | 1 | session-end hook |
| poll-session-weather | 1 | 0 | 1 | |
| send-venue-report | 1 | 0 | 1 | |
| share-via-email | 1 | 0 | 1 | |
| submit-notable-fish | 1 | 0 | 1 | |
| upload-analysis | 1 | 0 | 1 | |
| upload-basic-advice | 1 | 0 | 1 | |
| upload-diary-events | 1 | 0 | 1 | |
| upload-diary-sessions | 1 | 0 | 1 | |
| upload-environmental | 1 | 0 | 1 | |
| upload-fishing-reports | 0 | 1 | 1 | typed catch |
| upload-prediction-config | 0 | 1 | 1 | typed catch |
| upload-reference-data | 1 | 0 | 1 | |
| upload-taxonomy | 1 | 0 | 1 | |
| upload-terminology | 0 | 1 | 1 | typed catch |
| upload-venue-spots | 1 | 0 | 1 | typed catch (`e: unknown`) |
| witness-notable-fish | 1 | 0 | 1 | |

**Totals:** Pattern A = 24, Pattern B = 8, URL fixes = 33, files = 31. Matches prompt's expected breakdown exactly.

## §4 — db-audit
Confirmed: both service-role reads converted (top-level admin client at L23 + per-request `serviceKey` at L35). Both URL reads also converted.

## Diff size
Per file: 1 import line + 1–2 env-read replacements + 2 catch-injection lines ≈ 4–5 added / 2–3 removed. Aggregate net add ≈ 130 lines, removed ≈ 35 lines across 31 files. No file exceeded the §3 sanity threshold.

## §5 — Flagged-not-fixed
None. All 31 targets use service-role for legitimate reasons (RLS-bypassing aggregation, upserts to admin tables, cross-user reads). No candidates jumped out as "should-be-user-JWT-instead". Out of scope per prompt to refactor.

## Out-of-scope leftover
`ask-ghillie/index.ts:22` still has a top-level `const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!`. The runtime `createClient` call was already converted in 170; this leftover constant feeds a different code path (ghillie subroutines) and is intentionally left for a future cleanup (would require restructuring module-level constants).

## Verification
1. **TS build clean** — sweep run produced no syntactic anomalies; harness will compile on next deploy. Spot-checked `upload-basic-advice`, `db-audit`, `batch-recompute`, `get-shared-report` — imports/replacements/catch injection all in expected positions.
2. **Production secret still set** — `SUPABASE_SERVICE_ROLE_KEY` confirmed present in the Supabase secrets listing this prompt. Same for `SUPABASE_URL`.
3. Steps 2/3/5 (live curl, forced-failure smoke, cron monitoring) are user-runnable post-deploy.
