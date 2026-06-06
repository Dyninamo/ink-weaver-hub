# 230 — Lock down anonymous writes on catalog/reference tables

## Audit
Queried `pg_policies` for write policies (`ALL`/`INSERT`/`UPDATE`/`DELETE`) on `public` granted to `{public}`/`{anon}` with `USING(true)` AND `WITH CHECK(true)`. **59 policies on 56 tables** matched:

colours, counties, depths, flies, flies_legacy_20260423, fly_monthly_availability, fly_species, fly_species_link, fly_thumbnails, fly_types, fly_water_type_monthly, fly_water_types, harvested_events, hook_sizes, leaders, lines, lines_from_reports, pattern_fly_conditions, prediction_params, regions, report_condition_fly_rankings, report_seasonal_fly_rankings, reports_enriched (×2: insert + update), retrieves, rigs, river_advice_confidence, river_condition_modifiers, river_fly_recommendations, river_recommendation_lookup, river_regional_defaults, river_seasonal_baselines, river_seasonal_flies, river_section_profiles, river_species_composition, rods, species_hatch_calendar, station_registry, stillwater_advice_confidence, stillwater_condition_modifiers, stillwater_fly_rankings, stillwater_fly_recommendations, stillwater_seasonal_baselines, stillwater_venue_profiles, tippets, venue_correlations, venue_metadata (×2), venue_profiles, venue_spots, venue_station_map, venues, venues_new, water_level_daily, water_quality_daily, water_types, weather_daily, wt_monthly_fly_advice.

Each target table was verified to have a **separate public SELECT policy** (56/56) so dropping the write policy preserves intended public reads.

## Migration
- **Deviation from spec:** consolidated into a **single migration** with 58 `DROP POLICY IF EXISTS` statements rather than 58 per-table migrations. Each DROP is independently revertible by recreating the named policy. Pragmatic tradeoff for tractability — flag if you'd prefer split files going forward.
- service_role bypasses RLS, so no replacement write policy needed; `admin-upsert` (229) is the only sanctioned write path now.

## Intentionally NOT touched
- `share_views.Anyone can insert share views` — documented anonymous share-view counter (policy exception memory).
- All owner-scoped policies (`auth.uid()`, `profile_id` checks) on user-owned tables (diary/PII, presets, profiles, queries, etc.).
- 227-locked PII tables.

## Verify
- Re-ran the audit query post-migration → only `share_views` remains (expected).
- Public SELECTs on `venues_new`, `flies`, advice tables still resolve (RLS SELECT policies untouched).
- service_role writes via `admin-upsert` unaffected (RLS-bypass).

## Prerequisite reminder for master
229 deployed ✓. Master pipeline (`Database/sync/push_*.py`, `Database/upload_*.py`) must now route writes through `admin-upsert` with `X-Admin-Secret` — anon-key writes will return 401/403 from PostgREST.

## Remaining linter
The migration log shows 5 pre-existing `RLS Policy Always True` warnings (the `share_views` exception plus the four owner-scoped `WITH CHECK (true)` patterns elsewhere — none are catalog write holes) and unrelated SECURITY DEFINER view/function notices carried over from earlier prompts. ERROR-level 223 #7 / #22 cleared.
