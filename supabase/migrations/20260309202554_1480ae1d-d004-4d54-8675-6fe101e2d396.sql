
-- 1. ALTER venues_new — add season columns
ALTER TABLE venues_new ADD COLUMN IF NOT EXISTS season_start_month INTEGER DEFAULT 1;
ALTER TABLE venues_new ADD COLUMN IF NOT EXISTS season_end_month INTEGER DEFAULT 12;

-- 2. session_venue_map
CREATE TABLE IF NOT EXISTS session_venue_map (
  session_venue_name TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES venues_new(venue_id),
  match_method TEXT NOT NULL,
  session_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE session_venue_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read session_venue_map" ON session_venue_map FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_svm_venue ON session_venue_map(venue_id);

-- 3a. wt_advice_profiles
CREATE TABLE IF NOT EXISTS wt_advice_profiles (
  water_type_id INTEGER PRIMARY KEY,
  water_type_name TEXT NOT NULL,
  n_venues INTEGER,
  n_reports INTEGER,
  n_sessions INTEGER,
  web_sources INTEGER,
  confidence_score REAL,
  generated_at TIMESTAMPTZ NOT NULL,
  last_db_refresh TIMESTAMPTZ
);
ALTER TABLE wt_advice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_advice_profiles" ON wt_advice_profiles FOR SELECT USING (true);

-- 3b. wt_monthly_fly_advice
CREATE TABLE IF NOT EXISTS wt_monthly_fly_advice (
  water_type_id INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  fly_name TEXT NOT NULL,
  fly_style TEXT,
  rank INTEGER,
  importance TEXT,
  mention_count INTEGER,
  source TEXT NOT NULL,
  confidence REAL,
  notes TEXT,
  PRIMARY KEY (water_type_id, month, fly_name)
);
ALTER TABLE wt_monthly_fly_advice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_monthly_fly_advice" ON wt_monthly_fly_advice FOR SELECT USING (true);

-- 3c. wt_monthly_method_advice
CREATE TABLE IF NOT EXISTS wt_monthly_method_advice (
  water_type_id INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  method_name TEXT NOT NULL,
  rank INTEGER,
  importance TEXT,
  mention_count INTEGER,
  source TEXT NOT NULL,
  confidence REAL,
  notes TEXT,
  PRIMARY KEY (water_type_id, month, method_name)
);
ALTER TABLE wt_monthly_method_advice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_monthly_method_advice" ON wt_monthly_method_advice FOR SELECT USING (true);

-- 3d. wt_condition_advice
CREATE TABLE IF NOT EXISTS wt_condition_advice (
  water_type_id INTEGER NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  fly_adjustments TEXT,
  method_adjustments TEXT,
  catch_modifier REAL,
  notes TEXT,
  source TEXT NOT NULL,
  n_observations INTEGER,
  PRIMARY KEY (water_type_id, condition_type, condition_value)
);
ALTER TABLE wt_condition_advice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_condition_advice" ON wt_condition_advice FOR SELECT USING (true);

-- 3e. wt_seasonal_overview
CREATE TABLE IF NOT EXISTS wt_seasonal_overview (
  water_type_id INTEGER NOT NULL,
  season TEXT NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  overview_text TEXT,
  peak_months TEXT,
  key_hatches TEXT,
  key_flies TEXT,
  key_methods TEXT,
  avg_rod_average REAL,
  source TEXT NOT NULL,
  PRIMARY KEY (water_type_id, season)
);
ALTER TABLE wt_seasonal_overview ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_seasonal_overview" ON wt_seasonal_overview FOR SELECT USING (true);

-- 3f. wt_where_to_fish
CREATE TABLE IF NOT EXISTS wt_where_to_fish (
  water_type_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  advice_text TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (water_type_id, topic)
);
ALTER TABLE wt_where_to_fish ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_where_to_fish" ON wt_where_to_fish FOR SELECT USING (true);

-- 3g. wt_narrative_advice
CREATE TABLE IF NOT EXISTS wt_narrative_advice (
  water_type_id INTEGER NOT NULL,
  month INTEGER,
  narrative_text TEXT NOT NULL,
  word_count INTEGER,
  source TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (water_type_id, month)
);
ALTER TABLE wt_narrative_advice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_narrative_advice" ON wt_narrative_advice FOR SELECT USING (true);

-- 3h. wt_advice_confidence
CREATE TABLE IF NOT EXISTS wt_advice_confidence (
  water_type_id INTEGER PRIMARY KEY,
  confidence_score REAL,
  web_coverage_score REAL,
  db_data_score REAL,
  fly_diversity_score REAL,
  method_coverage_score REAL,
  cross_validation_score REAL,
  n_venues INTEGER,
  n_reports INTEGER,
  n_web_sources INTEGER,
  months_with_data INTEGER
);
ALTER TABLE wt_advice_confidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read wt_advice_confidence" ON wt_advice_confidence FOR SELECT USING (true);

-- 4a. report_venue_profiles
CREATE TABLE IF NOT EXISTS report_venue_profiles (
  venue_name TEXT PRIMARY KEY,
  n_reports INTEGER,
  mean_rod_avg REAL,
  date_start TEXT,
  date_end TEXT,
  latitude REAL,
  longitude REAL,
  pct_weather REAL,
  pct_flies REAL,
  pct_methods REAL
);
ALTER TABLE report_venue_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read report_venue_profiles" ON report_venue_profiles FOR SELECT USING (true);

-- 4b. report_seasonal_fly_rankings
CREATE TABLE IF NOT EXISTS report_seasonal_fly_rankings (
  venue_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  fly_name TEXT NOT NULL,
  mention_count INTEGER,
  rank INTEGER,
  PRIMARY KEY (venue_name, month, fly_name)
);
ALTER TABLE report_seasonal_fly_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read report_seasonal_fly_rankings" ON report_seasonal_fly_rankings FOR SELECT USING (true);

-- 4c. report_method_rankings
CREATE TABLE IF NOT EXISTS report_method_rankings (
  venue_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  method TEXT NOT NULL,
  mention_count INTEGER,
  rank INTEGER,
  PRIMARY KEY (venue_name, month, method)
);
ALTER TABLE report_method_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read report_method_rankings" ON report_method_rankings FOR SELECT USING (true);

-- 4d. report_condition_fly_rankings
CREATE TABLE IF NOT EXISTS report_condition_fly_rankings (
  venue_name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  fly_name TEXT NOT NULL,
  mention_count INTEGER,
  rank INTEGER,
  PRIMARY KEY (venue_name, condition_type, condition_value, fly_name)
);
ALTER TABLE report_condition_fly_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read report_condition_fly_rankings" ON report_condition_fly_rankings FOR SELECT USING (true);

-- 4e. report_advice_confidence
CREATE TABLE IF NOT EXISTS report_advice_confidence (
  venue_name TEXT PRIMARY KEY,
  confidence_score REAL,
  n_reports INTEGER,
  pct_flies REAL,
  pct_weather REAL,
  date_span_years REAL
);
ALTER TABLE report_advice_confidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read report_advice_confidence" ON report_advice_confidence FOR SELECT USING (true);
