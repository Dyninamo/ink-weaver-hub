
-- =====================================================
-- REPORTS
-- =====================================================

CREATE TABLE IF NOT EXISTS reports_raw (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venue TEXT,
  date DATE,
  report_url TEXT,
  headers TEXT,
  content TEXT,
  rod_averages REAL,
  fishery_id INTEGER,
  region TEXT,
  sha256_hash TEXT,
  platform_source TEXT,
  extraction_confidence REAL,
  UNIQUE (venue, date)
);

CREATE INDEX IF NOT EXISTS idx_reports_raw_hash ON reports_raw(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_reports_raw_region ON reports_raw(region);

CREATE TABLE IF NOT EXISTS harvested_events (
  id SERIAL PRIMARY KEY,
  venue_name TEXT NOT NULL,
  venue_name_raw TEXT,
  report_date TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  conditions_json JSONB,
  tactics_json JSONB,
  flies_json JSONB,
  flies_raw_json JSONB,
  areas_json JSONB,
  catch_form_json JSONB,
  raw_text_segment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (venue_name, report_date, source_url)
);

-- =====================================================
-- GEOGRAPHY
-- =====================================================

CREATE TABLE IF NOT EXISTS venues (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location TEXT,
  latitude REAL,
  longitude REAL
);

CREATE TABLE IF NOT EXISTS counties (
  county_id INTEGER PRIMARY KEY,
  county_name TEXT NOT NULL,
  region_id INTEGER NOT NULL REFERENCES regions(region_id),
  country TEXT NOT NULL,
  UNIQUE (county_name, country)
);

-- =====================================================
-- CRAWL INFRASTRUCTURE (all created empty)
-- =====================================================

CREATE TABLE IF NOT EXISTS fisheries (
  fishery_id SERIAL PRIMARY KEY,
  fishery_name TEXT NOT NULL UNIQUE,
  root_url TEXT,
  region TEXT,
  country TEXT,
  fishery_type TEXT,
  platform_type TEXT,
  discovery_method TEXT,
  active BOOLEAN,
  latitude REAL,
  longitude REAL,
  created_at TIMESTAMPTZ,
  last_crawled TIMESTAMPTZ,
  last_successful_crawl TIMESTAMPTZ,
  total_reports_found INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS url_patterns (
  pattern_id SERIAL PRIMARY KEY,
  pattern_template TEXT NOT NULL,
  pattern_type TEXT,
  works_for_platforms TEXT,
  success_count INTEGER,
  failure_count INTEGER,
  confidence_score REAL,
  example_urls TEXT,
  discovered_at TIMESTAMPTZ,
  last_used TIMESTAMPTZ,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS crawl_audit (
  audit_id SERIAL PRIMARY KEY,
  fishery_id INTEGER REFERENCES fisheries(fishery_id),
  action TEXT,
  url TEXT,
  result TEXT,
  details TEXT,
  timestamp TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crawl_intelligence (
  intel_id SERIAL PRIMARY KEY,
  fishery_id INTEGER REFERENCES fisheries(fishery_id),
  pattern_id INTEGER REFERENCES url_patterns(pattern_id),
  finding_type TEXT,
  finding_data TEXT,
  confidence REAL,
  verified BOOLEAN,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS discovered_urls (
  url_id SERIAL PRIMARY KEY,
  fishery_id INTEGER REFERENCES fisheries(fishery_id),
  url TEXT NOT NULL UNIQUE,
  sha256_hash TEXT,
  discovered_from TEXT,
  discovery_method TEXT,
  discovered_at TIMESTAMPTZ,
  downloaded BOOLEAN,
  download_timestamp TIMESTAMPTZ,
  download_success BOOLEAN,
  http_status INTEGER
);

CREATE TABLE IF NOT EXISTS discovery_hubs (
  hub_id SERIAL PRIMARY KEY,
  fishery_id INTEGER REFERENCES fisheries(fishery_id),
  hub_url TEXT NOT NULL,
  hub_type TEXT,
  pattern_id INTEGER REFERENCES url_patterns(pattern_id),
  reports_found INTEGER,
  last_crawled TIMESTAMPTZ,
  still_active BOOLEAN
);

-- =====================================================
-- RLS: Public read, service write (all new tables)
-- =====================================================

ALTER TABLE reports_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvested_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE fisheries ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reports_raw" ON reports_raw FOR SELECT USING (true);
CREATE POLICY "Public read harvested_events" ON harvested_events FOR SELECT USING (true);
CREATE POLICY "Public read venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Public read counties" ON counties FOR SELECT USING (true);
CREATE POLICY "Public read fisheries" ON fisheries FOR SELECT USING (true);
CREATE POLICY "Public read url_patterns" ON url_patterns FOR SELECT USING (true);
CREATE POLICY "Public read crawl_audit" ON crawl_audit FOR SELECT USING (true);
CREATE POLICY "Public read crawl_intelligence" ON crawl_intelligence FOR SELECT USING (true);
CREATE POLICY "Public read discovered_urls" ON discovered_urls FOR SELECT USING (true);
CREATE POLICY "Public read discovery_hubs" ON discovery_hubs FOR SELECT USING (true);

CREATE POLICY "Service write reports_raw" ON reports_raw FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write harvested_events" ON harvested_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write venues" ON venues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write counties" ON counties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write fisheries" ON fisheries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write url_patterns" ON url_patterns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write crawl_audit" ON crawl_audit FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write crawl_intelligence" ON crawl_intelligence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write discovered_urls" ON discovered_urls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write discovery_hubs" ON discovery_hubs FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW model_inputs_ready AS
SELECT
  re.venue,
  re.date,
  re.year,
  re.rod_average,
  re.methods,
  re.flies,
  re.best_spots,
  re.t_mean_week,
  re.wind_speed_mean_week,
  re.precip_total_mm_week,
  re.pressure_mean_week,
  re.humidity_mean_week,
  re.water_temp_week
FROM reports_enriched re
WHERE re.rod_average IS NOT NULL;

CREATE OR REPLACE VIEW report_weather_summary AS
SELECT
  re.venue,
  re.date,
  re.year,
  re.rod_average,
  re.methods,
  re.flies,
  re.best_spots,
  re.summary,
  re.t_mean_week,
  re.wind_speed_mean_week,
  re.wind_dir_deg_week,
  re.precip_total_mm_week,
  re.pressure_mean_week,
  re.humidity_mean_week,
  re.water_temp_week,
  wd.t_avg_day,
  wd.precip_mm,
  wd.wind_speed_ms,
  wd.wind_dir_deg
FROM reports_enriched re
LEFT JOIN weather_daily wd ON re.venue = wd.location AND re.date = wd.date;
