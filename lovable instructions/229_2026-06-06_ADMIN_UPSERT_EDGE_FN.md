# 229 — Edge function: `admin-upsert` (master write path for locked reference tables)

Prerequisite for **230**. 230 will restrict the anonymous `ALL USING(true)` write
policies on the catalog/reference tables (223 #7/#22) to `service_role`. Master
currently writes them with the **anon key** and has **no service_role key / no
dashboard access**, so it needs an admin-gated write path — mirror of
`admin-dump-diary` (228) but for writes.

Mirror `admin-dump-diary` / `admin-dump-app-events` for auth & shape.

## Auth & CORS
- `requireAdmin` (X-Admin-Secret OR admin-email JWT) → 401 otherwise.
- CORS + `OPTIONS`. service_role client. Env via `requireEnv`, no sandbox defaults.

## Input (POST JSON)
```json
{ "table": "reports_enriched", "rows": [ {...}, ... ], "on_conflict": "id" }
```
- `table` (required) — **allowlist ONLY** the catalog tables master writes (see
  list below). Reject anything else with 400 — never interpolate an arbitrary
  table name.
- `rows` (required, non-empty array). **Cap `rows.length` at `MAX_ROWS = 1000`**
  per call → 400 if exceeded (master already batches; this bounds abuse).
- `on_conflict` (optional string) — column(s) for upsert conflict target; if
  omitted, plain insert.

## Allowlist (confirm against 223 #7 + a full audit of tables with `ALL USING(true)`)
`venues_new, weather_daily, reports_enriched, reports_raw, flies,
fly_water_types, fly_water_type_monthly, report_seasonal_fly_rankings,
report_condition_fly_rankings, stillwater_condition_modifiers,
river_condition_modifiers, river_seasonal_baselines, stocking_records,
venue_clubs, method_canonical, method_aliases, weather_youtube,
fly_suitability_truth, venue_slices_cache, venue_slices, station_registry,
venue_station_map`
(Use the exact set 230's audit finds; this is the working list.)

## Behaviour
- `supabaseAdmin.from(table).upsert(rows, on_conflict ? { onConflict } : undefined)`.
- Return `{ table, upserted: rows.length }` on success; surface PostgREST errors
  as 400/500 with the message.

## Verify
1. Pull repo; confirm `supabase/functions/admin-upsert/`; grep `requireAdmin`,
   the table **allowlist**, and the `MAX_ROWS` cap.
2. No creds → 401; bogus secret → 401.
3. With `X-Admin-Secret`: upsert 1 throwaway row into a low-risk allowlisted
   table (e.g. `station_registry`) → `{upserted:1}`; `table=bobby_tables` → 400;
   1001 rows → 400. Clean up the throwaway row.

## Context
Consumed by master `Database/sync/push_*.py` + `Database/upload_*.py` (to be
converted from anon PostgREST to this fn — done after deploy). Then **230** locks
the anon write policies.
