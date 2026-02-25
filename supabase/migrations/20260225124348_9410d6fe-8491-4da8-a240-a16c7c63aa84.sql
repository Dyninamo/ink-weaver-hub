
-- =====================================================
-- P4: STILLWATER ANALYSIS TABLES (6 tables)
-- =====================================================

CREATE TABLE IF NOT EXISTS stillwater_venue_profiles (
  venue_id TEXT PRIMARY KEY,
  venue_name TEXT NOT NULL,
  venue_type TEXT,
  area TEXT,
  n_sessions INTEGER,
  n_anglers INTEGER,
  mean_fish REAL,
  blank_rate REAL,
  peak_month INTEGER,
  date_min TEXT,
  date_max TEXT,
  lat REAL,
  lng REAL,
  weather_coverage_pct REAL
);

CREATE TABLE IF NOT EXISTS stillwater_seasonal_baselines (
  venue_id TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  n_sessions INTEGER,
  mean_fish REAL,
  blank_rate REAL,
  PRIMARY KEY (venue_id, month)
);

CREATE TABLE IF NOT EXISTS stillwater_fly_recommendations (
  venue_id TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  fly_1 TEXT,
  fly_2 TEXT,
  fly_3 TEXT,
  recommended_style TEXT,
  confidence_n INTEGER,
  source TEXT,
  PRIMARY KEY (venue_id, month)
);

CREATE TABLE IF NOT EXISTS stillwater_fly_rankings (
  id SERIAL PRIMARY KEY,
  fly_canonical TEXT NOT NULL,
  n_events INTEGER,
  total_fish INTEGER,
  catch_per_event REAL,
  rank INTEGER,
  venue_id TEXT NOT NULL,
  venue_name TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS stillwater_condition_modifiers (
  venue_id TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_type TEXT,
  condition TEXT NOT NULL,
  n_sessions INTEGER,
  catch_rate REAL,
  baseline REAL,
  modifier REAL,
  source TEXT,
  PRIMARY KEY (venue_id, condition)
);

CREATE TABLE IF NOT EXISTS stillwater_advice_confidence (
  venue_id TEXT PRIMARY KEY,
  venue_name TEXT NOT NULL,
  n_sessions INTEGER,
  data_volume_score REAL,
  weather_coverage_score REAL,
  fly_coverage_score REAL,
  temporal_coverage_score REAL,
  seasonal_spread_score REAL,
  overall_confidence REAL,
  confidence_tier TEXT
);

-- =====================================================
-- P5: RIVER ANALYSIS TABLES (9 tables)
-- =====================================================

CREATE TABLE IF NOT EXISTS river_section_profiles (
  section_id TEXT PRIMARY KEY,
  section_name TEXT,
  region_id TEXT,
  region_name TEXT,
  river_name TEXT,
  catchment_group TEXT,
  n_sessions INTEGER,
  mean_fish REAL,
  blank_rate REAL,
  dominant_species TEXT,
  grayling_pct REAL,
  salmon_pct REAL,
  peak_month INTEGER,
  trend_direction TEXT,
  trend_significance TEXT,
  pct_weather_coverage REAL,
  pct_water_coverage REAL,
  pct_fly_coverage REAL,
  nearest_weather_station TEXT,
  weather_station_dist_km REAL,
  nearest_water_station TEXT,
  water_station_dist_km REAL
);

CREATE TABLE IF NOT EXISTS river_seasonal_baselines (
  section_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  fishing_type_norm TEXT NOT NULL,
  n_sessions INTEGER,
  total_fish INTEGER,
  n_catch INTEGER,
  catch_rate REAL,
  blank_rate REAL,
  section_name TEXT,
  region_id TEXT,
  PRIMARY KEY (section_id, month, fishing_type_norm)
);

CREATE TABLE IF NOT EXISTS river_fly_recommendations (
  id SERIAL PRIMARY KEY,
  section_id TEXT,
  scope TEXT,
  scope_id TEXT,
  month INTEGER,
  species TEXT,
  temp_band TEXT,
  fly_1 TEXT,
  fly_2 TEXT,
  fly_3 TEXT,
  style TEXT,
  confidence_n INTEGER,
  heavy_rain_flies TEXT,
  high_water_style TEXT,
  method_detail TEXT
);

CREATE TABLE IF NOT EXISTS river_recommendation_lookup (
  id SERIAL PRIMARY KEY,
  scope TEXT,
  scope_id TEXT,
  month INTEGER,
  temp_band TEXT,
  fly_1 TEXT,
  fly_2 TEXT,
  fly_3 TEXT,
  recommended_style TEXT,
  confidence_n INTEGER,
  rainfall_modifier TEXT,
  species TEXT
);

CREATE TABLE IF NOT EXISTS river_regional_defaults (
  region_id TEXT NOT NULL,
  region_name TEXT,
  species TEXT NOT NULL,
  month INTEGER NOT NULL,
  fly_1 TEXT,
  fly_2 TEXT,
  fly_3 TEXT,
  default_style TEXT,
  style_pct_dry REAL,
  style_pct_nymph REAL,
  style_pct_wet REAL,
  style_pct_spider REAL,
  style_pct_streamer REAL,
  baseline_catch_rate REAL,
  cold_modifier REAL,
  warm_modifier REAL,
  heavy_rain_modifier REAL,
  strong_wind_modifier REAL,
  high_water_modifier REAL,
  low_water_modifier REAL,
  n_events INTEGER,
  method_detail TEXT,
  PRIMARY KEY (region_id, species, month)
);

CREATE TABLE IF NOT EXISTS river_seasonal_flies (
  region_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  fly_canonical TEXT,
  catch_count INTEGER,
  pct_of_month REAL,
  PRIMARY KEY (region_id, month, rank)
);

CREATE TABLE IF NOT EXISTS river_condition_modifiers (
  section_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  catch_rate_modifier REAL,
  confidence INTEGER,
  source TEXT,
  PRIMARY KEY (section_id, condition)
);

CREATE TABLE IF NOT EXISTS river_species_composition (
  section_id TEXT NOT NULL,
  species_group TEXT NOT NULL,
  catch_count INTEGER,
  total_catches INTEGER,
  pct REAL,
  section_name TEXT,
  region_id TEXT,
  PRIMARY KEY (section_id, species_group)
);

CREATE TABLE IF NOT EXISTS river_advice_confidence (
  section_id TEXT PRIMARY KEY,
  section_name TEXT,
  n_sessions INTEGER,
  data_volume_score REAL,
  weather_coverage_score REAL,
  fly_coverage_score REAL,
  temporal_coverage_score REAL,
  species_coverage_score REAL,
  overall_confidence REAL,
  confidence_tier TEXT
);

-- =====================================================
-- RLS: Public read, service write (all 15 tables)
-- =====================================================

ALTER TABLE stillwater_venue_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stillwater_seasonal_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stillwater_fly_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stillwater_fly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stillwater_condition_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stillwater_advice_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_section_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_seasonal_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_fly_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_recommendation_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_regional_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_seasonal_flies ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_condition_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_species_composition ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_advice_confidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stillwater_venue_profiles" ON stillwater_venue_profiles FOR SELECT USING (true);
CREATE POLICY "Public read stillwater_seasonal_baselines" ON stillwater_seasonal_baselines FOR SELECT USING (true);
CREATE POLICY "Public read stillwater_fly_recommendations" ON stillwater_fly_recommendations FOR SELECT USING (true);
CREATE POLICY "Public read stillwater_fly_rankings" ON stillwater_fly_rankings FOR SELECT USING (true);
CREATE POLICY "Public read stillwater_condition_modifiers" ON stillwater_condition_modifiers FOR SELECT USING (true);
CREATE POLICY "Public read stillwater_advice_confidence" ON stillwater_advice_confidence FOR SELECT USING (true);
CREATE POLICY "Public read river_section_profiles" ON river_section_profiles FOR SELECT USING (true);
CREATE POLICY "Public read river_seasonal_baselines" ON river_seasonal_baselines FOR SELECT USING (true);
CREATE POLICY "Public read river_fly_recommendations" ON river_fly_recommendations FOR SELECT USING (true);
CREATE POLICY "Public read river_recommendation_lookup" ON river_recommendation_lookup FOR SELECT USING (true);
CREATE POLICY "Public read river_regional_defaults" ON river_regional_defaults FOR SELECT USING (true);
CREATE POLICY "Public read river_seasonal_flies" ON river_seasonal_flies FOR SELECT USING (true);
CREATE POLICY "Public read river_condition_modifiers" ON river_condition_modifiers FOR SELECT USING (true);
CREATE POLICY "Public read river_species_composition" ON river_species_composition FOR SELECT USING (true);
CREATE POLICY "Public read river_advice_confidence" ON river_advice_confidence FOR SELECT USING (true);

CREATE POLICY "Service write stillwater_venue_profiles" ON stillwater_venue_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write stillwater_seasonal_baselines" ON stillwater_seasonal_baselines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write stillwater_fly_recommendations" ON stillwater_fly_recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write stillwater_fly_rankings" ON stillwater_fly_rankings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write stillwater_condition_modifiers" ON stillwater_condition_modifiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write stillwater_advice_confidence" ON stillwater_advice_confidence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_section_profiles" ON river_section_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_seasonal_baselines" ON river_seasonal_baselines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_fly_recommendations" ON river_fly_recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_recommendation_lookup" ON river_recommendation_lookup FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_regional_defaults" ON river_regional_defaults FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_seasonal_flies" ON river_seasonal_flies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_condition_modifiers" ON river_condition_modifiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_species_composition" ON river_species_composition FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write river_advice_confidence" ON river_advice_confidence FOR ALL USING (true) WITH CHECK (true);
