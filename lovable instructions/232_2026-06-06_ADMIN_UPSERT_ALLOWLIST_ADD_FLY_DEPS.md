# 232 — `admin-upsert`: add the missing fly-dependent tables to the allowlist

Found while converting `push_fly_dependents.py` off the anon key (live test):
the `admin-upsert` allowlist (229) is missing 5 of the 9 fly-dependent tables
the master pipeline clear-and-reloads, so those writes are rejected with
`table '...' not in allowlist` (400 — correctly, before any delete).

## Change — extend `ALLOWED_TABLES` in `admin-upsert`
Add these 5 entries (the other 4 fly-dependent tables — `fly_water_types`,
`fly_water_type_monthly`, `report_seasonal_fly_rankings`,
`report_condition_fly_rankings` — are already present):
- `fly_monthly_availability`
- `fly_species_link`
- `fly_thumbnails`
- `pattern_fly_conditions`
- `wt_monthly_fly_advice`

No other change — `requireAdmin`, `MAX_ROWS`, `delete_where_not_null` (231),
service_role all stay as-is.

## Note for 230 (anon-write lockdown)
These 5 tables must also be covered by 230's audit — if they currently have
permissive `USING(true)` write policies, lock them to service_role too (their
writes now go through `admin-upsert`).

## Verify
- Pull repo; `ALLOWED_TABLES` now contains all 9 fly-dependent tables.
- `admin-upsert` with `X-Admin-Secret`, `table=pattern_fly_conditions`,
  `delete_where_not_null=fly_name`, 1 row → 200 (not 400).
