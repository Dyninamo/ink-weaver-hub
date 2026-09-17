# 245 — 11 mid-location wind unit outliers

## Applied
Absolute SET updates run verbatim via SQL (10 × `Fernworthy Reservoir`, 1 × `Roadford Lake`, all `granularity = 'daily'`). Idempotent — safe to re-run.

## Verification
```
 location             | max_ms | n
----------------------+--------+------
 Fernworthy Reservoir |  15.71 | 1725
 Roadford Lake        |  20.93 |  382
```
Matches master exactly (was 26.1 / 26.7).

## Out of scope
- `reports_enriched` — already recomputed and pushed from master (284 rows).
- Known remainder per §Known remainder: >12 m/s rows in already-converted locations left untouched.
