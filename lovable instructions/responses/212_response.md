# 212 — get-river-conditions edge function

## Diff
- **Created**: `supabase/functions/get-river-conditions/index.ts`
  - Auth: `requireUser` (Bearer JWT, 401 on miss) + standard `corsHeaders` + OPTIONS.
  - All outbound fetches wrapped in `fetchWithTimeout` (AbortController, 15s) and try/catch with `console.warn` of the reason (no silent swallows).
  - Gauge resolution: 1a) `venue_station_map(venue_name, data_type='level_flow')`. 1b) Otherwise rank `station_registry` (has_level OR has_flow, status≠closed, lat/lon non-null, ≤30 km) by same-river first (`river_name ILIKE %hint%`) then equirectangular distance (×111). Picks up to 3 candidates total (mapped + fallbacks). 1c) Iterates candidates; first to yield any series wins. Persists the new mapping (`match_type='same_river_auto'|'nearest_auto'`) via service-role upsert with `onConflict: 'venue_name,data_type'`.
  - EA hydrology: `/measures.json` → filter param=level (exclude `gw|dipped|borehole|tidal`) / flow; prefer `-m-86400-`, then period=86400, then first. Readings query `_limit=2000&min-date=today-14`. Buckets to daily means.
  - NRW: `rivers-and-seas.naturalresources.wales/graph/getdata?parameterId=…&from=…&to=…` with `X-Requested-With: XMLHttpRequest`. Defensively reads `dateTime|x|date|timestamp` + `value|y|val`, aggregates 15-min to daily means.
  - Per-series summary: `{ latest_value, latest_date, delta_7d = latest − value 7 entries back (null <8), n_days }`.
  - Open-Meteo: precip_sum, start=today-7, end=max(today,date), Europe/London. Computes `recent_rain_mm_7d` (≤today), `days_since_rain` (last day ≥2 mm), `forecast_rain_mm_ahead` (>today).
  - Inference is the exact port: `trend()` thresholds (delta>0.02 & rel>0.10, etc.), `project()` (≥25 spate / ≥10 rising / <3 falling-or-steady / else current), `state_label` band + motion (+ "no significant rain in 5+ days" suffix), `advice` four-branch copy.
  - Response shape matches spec; `level`/`flow` omitted if absent. `{river_conditions:null}` (HTTP 200) when no gauge yields data.

## Service-role usage
Single `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` for both the registry/map read and the `venue_station_map` upsert. The function is JWT-gated for the user, but the DB ops bypass RLS deliberately (registry has public read; map needs the service path to write).

## Bounding
- ≤3 candidate gauges
- ≤2 measures per gauge (level + flow)
- 15s timeout on every fetch
- `_limit=2000` on EA readings
- 30 km cap

## Out of scope
- No client wiring (PWA advice card change is a separate prompt).
- `supabase/config.toml` not edited — default `verify_jwt = false` is fine because we validate in code via `requireUser`.

## Verify (per spec §"After deploy")
1. File path: `supabase/functions/get-river-conditions/index.ts` (greps for `requireUser`, `venue_station_map`, `hydrology`, `naturalresources.wales` all hit).
2. No-JWT probe → 401 ("Missing bearer token").
3. JWT + River Itchen (51.063, -1.318, today+7) → expect Itchen station + level/flow.
4. Welsh river → NRW path.
5. Brand-new river venue → returns data AND creates `venue_station_map` row.

Steps 2–5 are runtime probes for you to execute against the deployed function; the function auto-deploys on save.
