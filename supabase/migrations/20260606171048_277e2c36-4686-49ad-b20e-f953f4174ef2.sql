
-- 230: Drop permissive anon/public write policies on catalog/reference tables.
-- service_role bypasses RLS, so master writers via admin-upsert (229) keep working.
-- Public SELECT policies are preserved (verified separately).

DROP POLICY IF EXISTS "Service write ref_colours" ON public.colours;
DROP POLICY IF EXISTS "Service write counties" ON public.counties;
DROP POLICY IF EXISTS "Service write ref_depths" ON public.depths;
DROP POLICY IF EXISTS "flies_anon_upsert" ON public.flies;
DROP POLICY IF EXISTS "Service write ref_flies" ON public.flies_legacy_20260423;
DROP POLICY IF EXISTS "Service write fly_monthly_availability" ON public.fly_monthly_availability;
DROP POLICY IF EXISTS "Service write fly_species" ON public.fly_species;
DROP POLICY IF EXISTS "Service write fly_species_link" ON public.fly_species_link;
DROP POLICY IF EXISTS "thumb_anon_upsert" ON public.fly_thumbnails;
DROP POLICY IF EXISTS "Service write fly_types" ON public.fly_types;
DROP POLICY IF EXISTS "fwtm_anon_upsert" ON public.fly_water_type_monthly;
DROP POLICY IF EXISTS "fly_water_types_anon_upsert" ON public.fly_water_types;
DROP POLICY IF EXISTS "Service write harvested_events" ON public.harvested_events;
DROP POLICY IF EXISTS "Service write ref_hook_sizes" ON public.hook_sizes;
DROP POLICY IF EXISTS "Service write ref_leaders" ON public.leaders;
DROP POLICY IF EXISTS "Service write ref_lines" ON public.lines;
DROP POLICY IF EXISTS "Service write ref_lines_from_reports" ON public.lines_from_reports;
DROP POLICY IF EXISTS "pattern_fly_conditions_anon_upsert" ON public.pattern_fly_conditions;
DROP POLICY IF EXISTS "Service write prediction_params" ON public.prediction_params;
DROP POLICY IF EXISTS "Service write regions" ON public.regions;
DROP POLICY IF EXISTS "report_condition_fly_rankings_anon_upsert" ON public.report_condition_fly_rankings;
DROP POLICY IF EXISTS "report_seasonal_fly_rankings_anon_upsert" ON public.report_seasonal_fly_rankings;
DROP POLICY IF EXISTS "Allow insert fishing reports" ON public.reports_enriched;
DROP POLICY IF EXISTS "Allow update fishing reports" ON public.reports_enriched;
DROP POLICY IF EXISTS "Service write ref_retrieves" ON public.retrieves;
DROP POLICY IF EXISTS "Service write ref_rigs" ON public.rigs;
DROP POLICY IF EXISTS "Service write river_advice_confidence" ON public.river_advice_confidence;
DROP POLICY IF EXISTS "Service write river_condition_modifiers" ON public.river_condition_modifiers;
DROP POLICY IF EXISTS "Service write river_fly_recommendations" ON public.river_fly_recommendations;
DROP POLICY IF EXISTS "Service write river_recommendation_lookup" ON public.river_recommendation_lookup;
DROP POLICY IF EXISTS "Service write river_regional_defaults" ON public.river_regional_defaults;
DROP POLICY IF EXISTS "Service write river_seasonal_baselines" ON public.river_seasonal_baselines;
DROP POLICY IF EXISTS "Service write river_seasonal_flies" ON public.river_seasonal_flies;
DROP POLICY IF EXISTS "Service write river_section_profiles" ON public.river_section_profiles;
DROP POLICY IF EXISTS "Service write river_species_composition" ON public.river_species_composition;
DROP POLICY IF EXISTS "Service write ref_rods" ON public.rods;
DROP POLICY IF EXISTS "Service write species_hatch_calendar" ON public.species_hatch_calendar;
DROP POLICY IF EXISTS "Service write station_registry" ON public.station_registry;
DROP POLICY IF EXISTS "Service write stillwater_advice_confidence" ON public.stillwater_advice_confidence;
DROP POLICY IF EXISTS "Service write stillwater_condition_modifiers" ON public.stillwater_condition_modifiers;
DROP POLICY IF EXISTS "Service write stillwater_fly_rankings" ON public.stillwater_fly_rankings;
DROP POLICY IF EXISTS "Service write stillwater_fly_recommendations" ON public.stillwater_fly_recommendations;
DROP POLICY IF EXISTS "Service write stillwater_seasonal_baselines" ON public.stillwater_seasonal_baselines;
DROP POLICY IF EXISTS "Service write stillwater_venue_profiles" ON public.stillwater_venue_profiles;
DROP POLICY IF EXISTS "Service write ref_tippets" ON public.tippets;
DROP POLICY IF EXISTS "Service write venue_correlations" ON public.venue_correlations;
DROP POLICY IF EXISTS "Allow insert venue metadata" ON public.venue_metadata;
DROP POLICY IF EXISTS "Allow update venue metadata" ON public.venue_metadata;
DROP POLICY IF EXISTS "Service write venue_profiles" ON public.venue_profiles;
DROP POLICY IF EXISTS "Service write venue_spots" ON public.venue_spots;
DROP POLICY IF EXISTS "Service write venue_station_map" ON public.venue_station_map;
DROP POLICY IF EXISTS "Service write venues" ON public.venues;
DROP POLICY IF EXISTS "Service write venues_new" ON public.venues_new;
DROP POLICY IF EXISTS "Service write water_level_daily" ON public.water_level_daily;
DROP POLICY IF EXISTS "Service write water_quality_daily" ON public.water_quality_daily;
DROP POLICY IF EXISTS "Service write water_types" ON public.water_types;
DROP POLICY IF EXISTS "Service write weather_daily" ON public.weather_daily;
DROP POLICY IF EXISTS "wt_monthly_fly_advice_anon_upsert" ON public.wt_monthly_fly_advice;

-- Intentionally NOT touched:
--   share_views: anonymous INSERT is the documented share-view counter (policy exception memory).
--   All owner-scoped policies (auth.uid()/profile_id checks) on user-owned tables.
--   PII/diary tables already owner-locked in 227.
