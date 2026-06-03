# 212 — Edge function: `get-river-conditions`

Create a new Supabase Edge Function **`get-river-conditions`** that returns live
river level/flow conditions + a fishing-advice projection for a river venue.
This is the server-side port of the master `_river_advice_engine.py` (Wensum
methodology). The mobile/PWA advice card calls it for river venues.

## Auth & CORS (do NOT skip)

- **`requireUser`** — same JWT pattern as the existing `get-ai-advice-v2` /
  prompt-190 functions. Reject with 401 if there is no valid user JWT. This is a
  PWA-callable function, not a back-office one — do not use the admin gate.
- Standard CORS headers + `OPTIONS` preflict handling, identical to the other
  PWA functions in this project.
- All external HTTP calls go through `fetch` with a hard timeout (use
  `AbortController`, 15s) and are wrapped so one failure degrades gracefully
  (return the partial result) rather than 500-ing the whole request. Do **not**
  use bare `.catch(() => null)` that swallows the reason — log it.

## Input (POST JSON)

```json
{ "venue_name": "River Itchen", "lat": 51.063, "lon": -1.318,
  "date": "2026-06-10", "river_hint": "Itchen" }
```
- `date` is the target day (YYYY-MM-DD). `river_hint` optional (defaults to
  venue_name with a leading "River " stripped).

## Algorithm

### 1. Resolve the gauge from OUR registry (not a live EA search)

a. Look up `venue_station_map` where `venue_name = <venue_name>` and
   `data_type = 'level_flow'`. If a row exists, take its `station_id`.

b. **If no mapping (new river):** select the nearest suitable gauge from
   `station_registry`:
   - candidates: `has_level = true OR has_flow = true`, `status` not closed,
     `latitude/longitude not null`.
   - rank: **same-river first** (`river_name ILIKE '%' || <river_hint> || '%'`),
     then by distance. Distance = equirectangular approx
     `sqrt(dLat^2 + (dLon*cos(lat))^2) * 111` km. Cap at 30 km; if nothing
     within 30 km, return `{ river_conditions: null }` (no error).
   - **Persist** the new mapping: upsert into `venue_station_map`
     `{ venue_name, data_type: 'level_flow', station_id, distance_km,
        match_type: same_river ? 'same_river_auto' : 'nearest_auto' }`
     using the service-role client (this is the "discover then store" step).
   Pick this `station_id`.

c. Load the chosen `station_registry` row: `source` (EA/NRW), `hydrology_id`,
   `nrw_station_id`, `nrw_parameter_ids`, `river_name`, `latitude`, `longitude`,
   `has_level`, `has_flow`, `station_name`, `distance_km` (recompute to venue).
   If the first gauge yields no readings in step 2, fall through to the next
   candidate (try up to 3) — real gauges are often dormant.

### 2. Fetch live readings (last 14 days)

- **EA gauges (`source = 'EA'`, has `hydrology_id`):** EA Hydrology API
  `https://environment.data.gov.uk/hydrology/id/stations/{hydrology_id}/measures.json`,
  then for the chosen level/flow measure
  `.../measures/{measureId}/readings.json?_limit=2000&min-date={today-14}`.
  - Prefer a **river level** measure (parameter `level`, measure id WITHOUT
    `gw`/`dipped`/`borehole`/`tidal` — those are groundwater) and a **flow**
    measure (parameter `flow`). For each, prefer the daily-mean variant
    (measure id contains `-m-86400-`), else period 86400, else first.
- **NRW gauges (`source = 'NRW'`):** NRW API
  `https://rivers-and-seas.naturalresources.wales/graph/getdata?parameterId={pid}&from={today-14}&to={today}`
  with header `X-Requested-With: XMLHttpRequest`. `pid` from
  `nrw_parameter_ids` (e.g. `{"level": 10}` → use the `level` id). NRW gives
  15-min readings — aggregate to daily mean.
- Summarise each series to `{ latest_value, latest_date, delta_7d, n_days }`
  (Δ7d = latest minus the daily value 7 entries back; null if < 7 days).

### 3. Open-Meteo precip window (recent + forecast-ahead)

`https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum&start_date={today-7}&end_date={max(today,date)}&timezone=Europe/London`
- `recent_rain_mm_7d` = sum of precip for days ≤ today.
- `days_since_rain` = days since the last day with ≥ 2.0 mm (≤ today), else null.
- `forecast_rain_mm_ahead` = sum of precip for days in (today, date].

### 4. Inference (exact thresholds — port of riverInference.ts)

- `trend(delta7d, latest)`: scale = max(|latest|, 0.05); rel = delta7d/scale.
  `rising` if delta7d > 0.02 AND rel > 0.10; `falling` if delta7d < -0.02 AND
  rel < -0.10; else `steady`. (null delta → steady.)
- Pick the **driver** series = flow if present else level. `current = trend(driver)`.
- `projected`:
  - forecast_rain_ahead ≥ 25 → `'spate risk'`
  - ≥ 10 → `'rising'`
  - < 3 → if current is `falling` OR recent_rain_7d < 5 → `'falling'`, else `'steady'`
  - else → keep `current`
- `state_label`: band by recent rain (<5 `low and clear`; <20
  `normal, carrying some colour`; else `up and coloured`) + motion
  (`spate risk`→"heavy rain forecast — spate likely"; `rising`→"rising over the
  period"; `falling`→"continued recession"; `steady`→"holding steady"). Append
  " (no significant rain in 5+ days)" when falling and days_since_rain ≥ 5.
- `advice`: spate → heavier/weighted nymphs + bright streamers tight to margins
  & slacker water, hold off the main flow; rising → up a hook size/add weight,
  bigger/darker patterns, inside of bends & crease lines; falling/low → drop
  tippet, longer leaders, smaller dries/nymphs, careful upstream approach,
  dawn/dusk & broken water; steady → standard tactics, match the hatch.

### 5. Response

```json
{ "river_conditions": {
    "station": { "label": "...", "river": "River Itchen", "distance_km": 1.2, "source": "EA" },
    "level": { "latest": 0.42, "unit": "m", "delta_7d": -0.05, "trend": "falling" },
    "flow":  { "latest": 0.31, "unit": "m³/s", "delta_7d": -0.06, "trend": "falling" },
    "recent_rain_mm_7d": 2.1, "days_since_rain": 6, "forecast_rain_mm_ahead": 1.3,
    "projected_trend": "falling",
    "state_label": "low and clear, continued recession (no significant rain in 5+ days)",
    "advice": "Low, clear, dropping water — fish will be spooky. Drop tippet ..."
  } }
```
- `level`/`flow` omitted if that series is unavailable. Return
  `{ "river_conditions": null }` (HTTP 200) when there is no usable gauge — the
  card simply hides the section.

## Bounding / safety

- No paid APIs here (EA, NRW, Open-Meteo are all free, no key) — but still cap
  work: probe at most **3** candidate gauges, at most **2** measures each, 15s
  fetch timeout, and the readings query is capped at `_limit=2000`.
- No sandbox defaults / hard-coded localhost. Read the Supabase URL + service
  key from env (`Deno.env.get`) as the other functions do.
- Cache is the client's job (the app caches per venue+date); the function stays
  stateless apart from the `venue_station_map` upsert.

## After deploy — verify (do this, don't trust the response log)

1. Pull `ink-weaver-hub`, confirm `supabase/functions/get-river-conditions/`
   exists and grep for `requireUser`, `venue_station_map`, `hydrology`, `naturalresources.wales`.
2. Runtime probe **no-JWT → must 401**.
3. With a JWT, call for a known EA river (River Itchen, lat 51.063 lon -1.318,
   date = today+7): expect a `river_conditions` with a station on the Itchen and
   a level/flow series. Then a Welsh river (NRW) to exercise that path.
4. Confirm a brand-new river venue (not in `venue_station_map`) returns data AND
   creates a new `venue_station_map` row (the discover-then-store step).
