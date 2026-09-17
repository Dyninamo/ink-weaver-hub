# 244 — Rename `wind_speed_ms` → `wind_speed_mps`

Applied immediately after 243 in the same session.

## Migration
```sql
ALTER TABLE public.weather_daily     RENAME COLUMN wind_speed_ms TO wind_speed_mps;
ALTER TABLE public.reports_enriched  RENAME COLUMN wind_speed_ms TO wind_speed_mps;
NOTIFY pgrst, 'reload schema';
```

## Verification
1. Columns matching `wind_speed%`:
   - `reports_enriched`: `wind_speed_change`, `wind_speed_max_week`,
     `wind_speed_mean_week`, `wind_speed_mps`, `wind_speed_std`
   - `weather_daily`: `wind_speed_mps`
   No `wind_speed_ms` on either table; the four weekly columns unchanged.
2. `AVG(wind_speed_mps)` on `weather_daily` = **5.26** (243 confirmed applied).
3. `reports_enriched WHERE wind_speed_mean_week IS NOT NULL` = **6,391**, unchanged.

## Code
- `src/integrations/supabase/types.ts` regenerated — now `wind_speed_mps`.
- Remaining `wind_speed_ms` occurrences in `get-ai-advice-v2/index.ts` are its own
  OpenWeather-fed `Forecast` interface, not a DB column. Left alone as specified.
- Historical migration files still contain the old name; expected.

## Pending on master
`weather_daily` / `reports_enriched` rename plus the readers in
`scripts/daily_update/`, `scripts/passport/`, `Database/sync/push_weather.py`,
`staging_db.py` — must land the same day.
