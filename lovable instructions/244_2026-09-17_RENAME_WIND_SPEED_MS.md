# 244 — Rename `wind_speed_ms` to `wind_speed_mps`

**Date:** 2026-09-17
**Depends on:** prompt 243 being applied first. Do not run this before it.
**Origin:** the column held km/h in 366,190 rows and m/s in the rest. The data is
fixed; this closes the naming half of it.

---

## Why rename at all

`ms` reads as milliseconds as easily as metres per second, and this column spent
months holding neither consistently. Renaming is cheap insurance: a reader that
has not been updated fails loudly on a missing column instead of silently
reading numbers whose meaning has changed.

It is only worth doing because it turns out to be nearly free. **No edge function
selects this column.** The `wind_speed_ms` occurrences in
`get-ai-advice-v2/index.ts` belong to its own `Forecast` interface, fed from
OpenWeather (which returns m/s), not from the database. The only other references
are in the generated `src/integrations/supabase/types.ts`, which regenerates.

## Scope — two columns, two tables

```sql
ALTER TABLE public.weather_daily     RENAME COLUMN wind_speed_ms TO wind_speed_mps;
ALTER TABLE public.reports_enriched  RENAME COLUMN wind_speed_ms TO wind_speed_mps;
```

Then regenerate `src/integrations/supabase/types.ts`.

## Deliberately NOT renamed

`wind_speed_mean_week`, `wind_speed_max_week`, `wind_speed_std` and
`wind_speed_change` keep their names. They state no unit either, and in a vacuum
they deserve the same treatment — but they are read by **four** edge functions
(`get-ai-advice-v2`, `get-fishing-advice`, `upload-fishing-reports`, and the
report upload path), and renaming them trades a real breakage risk for a cosmetic
gain. They are m/s, they are now correct, and that is recorded in
`WIND_UNIT_BLAST_RADIUS.md`.

If they are ever renamed, it should be its own prompt with those four functions
changed in the same commit.

## Verification

```sql
-- 1. the new column exists and the old one does not
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('weather_daily','reports_enriched')
  AND column_name LIKE 'wind_speed%'
ORDER BY table_name, column_name;
```

Expect `wind_speed_mps` on both tables, `wind_speed_ms` on neither, and the four
weekly columns unchanged on `reports_enriched`.

```sql
-- 2. the data survived the rename intact
SELECT ROUND(AVG(wind_speed_mps)::numeric,2) FROM public.weather_daily
WHERE wind_speed_mps IS NOT NULL;
```

Expect **~5.29**. If it reads ~17.9, prompt 243 was never applied and this rename
has just given a wrong number a more confident name — revert and run 243 first.

```sql
-- 3. nothing broke: the advice path reads the weekly columns, not this one
SELECT COUNT(*) FROM public.reports_enriched WHERE wind_speed_mean_week IS NOT NULL;
```

Expect **6,391**, unchanged.

## Master side

Renamed in the same session, immediately after this lands:

```
ALTER TABLE weather_daily    RENAME COLUMN wind_speed_ms TO wind_speed_mps;
ALTER TABLE reports_enriched RENAME COLUMN wind_speed_ms TO wind_speed_mps;
```

plus the readers in `scripts/daily_update/`, `scripts/passport/`,
`Database/sync/push_weather.py` and the staging schema in `staging_db.py`. Those
are a single sweep and are not your concern — but the two sides must not sit
renamed-and-not-renamed across a scheduled run, so the master sweep happens the
same day.
