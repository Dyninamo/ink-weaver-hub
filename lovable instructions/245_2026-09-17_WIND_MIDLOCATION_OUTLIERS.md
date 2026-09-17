# 245 — 11 weather_daily rows that changed unit mid-location

**Date:** 2026-09-17
**Depends on:** 243 and 244, both already applied.
**Size:** 11 rows. This is a correction to 243, not a repeat of it.

---

## Background

243 converted `weather_daily` per location, which assumed each location is
internally consistent in its units. Two are not. `Fernworthy Reservoir` has a
daily median of 3.67 m/s, but ten rows sit at 13–26 across consecutive days of
late July 2019 and June 2021 — a heatwave, not a storm. Open-Meteo gives 7.2 m/s
for 2019-07-30 against a stored 26.1: ratio 3.62, i.e. a block of that location's
dates was written in km/h by a different path.

Both locations were classified `ms` overall, so 243 correctly left them alone —
and that is exactly why these rows survived. Only locations 243 did **not**
convert can still hold km/h; anything it already divided is a data question, not
a unit one.

Each of the 11 was verified individually against the Open-Meteo archive for its
own date, at ratios 3.40–3.75. One further candidate at ratio 2.31 was left alone
as ambiguous rather than converted on a guess.

Master is already corrected. There is no unique constraint on
`(location, date, granularity)` and `id` is `GENERATED ALWAYS`, so neither upsert
path works from the sync scripts — hence SQL.

## Task — set the 11 rows to their corrected values

These are absolute SET values, not arithmetic, so running this twice is harmless.

```sql
UPDATE public.weather_daily SET wind_speed_mps = 3.79
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-24' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 4.8
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-25' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 3.91
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-26' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 4.94
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-27' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 4.12
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-28' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 4.87
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-29' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 7.25
 WHERE location = 'Fernworthy Reservoir' AND date = '2019-07-30' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 3.46
 WHERE location = 'Fernworthy Reservoir' AND date = '2021-06-05' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 4.47
 WHERE location = 'Fernworthy Reservoir' AND date = '2021-06-09' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 4.33
 WHERE location = 'Fernworthy Reservoir' AND date = '2021-06-10' AND granularity = 'daily';
UPDATE public.weather_daily SET wind_speed_mps = 7.42
 WHERE location = 'Roadford Lake' AND date = '2025-04-18' AND granularity = 'daily';
```

## Verification

```sql
SELECT location, ROUND(MAX(wind_speed_mps)::numeric,2) AS max_ms, COUNT(*) n
FROM public.weather_daily
WHERE location IN ('Fernworthy Reservoir','Roadford Lake')
  AND wind_speed_mps IS NOT NULL
GROUP BY location;
```

Expect `Fernworthy Reservoir` max **15.71** (was 26.1) and `Roadford Lake` max
**20.93** (was 26.7). Master matches those exactly.

`reports_enriched` for both venues has already been recomputed and pushed from
master — 284 rows — so nothing is needed there.

## Known remainder

Rows above 12 m/s that are more than 3x their own location's median, in locations
243 already converted, are **not** unit problems and are deliberately untouched.
Some are genuine storms; any that are not are a source-data question for another
day. Detection method and reasoning are in `WIND_UNIT_BLAST_RADIUS.md` §10.
