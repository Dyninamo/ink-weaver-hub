
CREATE OR REPLACE FUNCTION public.clear_table(target_table TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF target_table NOT IN (
    'stillwater_venue_profiles', 'stillwater_seasonal_baselines',
    'stillwater_fly_recommendations', 'stillwater_fly_rankings',
    'stillwater_condition_modifiers', 'stillwater_advice_confidence',
    'river_section_profiles', 'river_seasonal_baselines',
    'river_fly_recommendations', 'river_recommendation_lookup',
    'river_regional_defaults', 'river_seasonal_flies',
    'river_condition_modifiers', 'river_species_composition',
    'river_advice_confidence',
    'reports_raw', 'harvested_events', 'venues', 'counties', 'fisheries',
    'wt_advice_profiles', 'wt_monthly_fly_advice',
    'wt_monthly_method_advice', 'wt_condition_advice',
    'wt_seasonal_overview', 'wt_where_to_fish',
    'wt_narrative_advice', 'wt_advice_confidence',
    'report_venue_profiles', 'report_seasonal_fly_rankings',
    'report_method_rankings', 'report_condition_fly_rankings',
    'report_advice_confidence',
    'pattern_weather_effects', 'pattern_fly_conditions',
    'pattern_hatch_weather', 'pattern_discovery_meta',
    'report_sources', 'source_venue_map',
    'session_venue_map', 'venue_spots'
  ) THEN
    RAISE EXCEPTION 'Table % not in allow-list', target_table;
  END IF;
  EXECUTE format('DELETE FROM %I', target_table);
END;
$$;
