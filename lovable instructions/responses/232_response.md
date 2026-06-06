# 232 — admin-upsert allowlist: added 5 missing fly-dependent tables

## Change
`supabase/functions/admin-upsert/index.ts`: extended `ALLOWED_TABLES` set with:
- `fly_monthly_availability`
- `fly_species_link`
- `fly_thumbnails`
- `pattern_fly_conditions`
- `wt_monthly_fly_advice`

All other logic (`requireAdmin`, `MAX_ROWS`, `delete_where_not_null`, service_role client) unchanged.

## Verify
- `ALLOWED_TABLES` now contains all 9 fly-dependent tables (4 were already present, 5 added).
- Edge function auto-deploys on save.

Waiting for go-ahead on 230.
