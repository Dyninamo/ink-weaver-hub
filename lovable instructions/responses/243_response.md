# 243 — weather_daily wind unit correction

## Task 1 — guard
`Grafham Water` / `2026-02-24` returned `19.31` (pre-conversion). Safe to proceed.

## Task 2 — km/h → m/s
`UPDATE ... SET wind_speed_ms = ROUND((wind_speed_ms / 3.6)::numeric, 2)` applied
over the 230-location list, verbatim from the prompt.

## Task 3 — null the unclassifiable locations
`UPDATE ... SET wind_speed_ms = NULL` applied over the 15-location list.

## Verification
- Sentinel row: **5.36** (expected ~5.36).
- Overall avg of non-null `wind_speed_ms`: **5.26** (master 5.29 — within rounding
  of the per-row `ROUND(...,2)` applied here).
- Locations averaging ≥ 9 m/s: exactly one — `Wrackleford`, 8 rows, **11.29**, the
  known genuine-m/s outlier. No other location remains in km/h.
- Total NULL `wind_speed_ms` rows after task 3: 104,021.

## Out of scope
`reports_enriched` wind columns untouched — pushed from master as data.
