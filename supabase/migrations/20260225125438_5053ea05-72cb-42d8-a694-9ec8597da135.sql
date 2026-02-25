
-- Station registry: EA, NRW, and WQ monitoring stations
CREATE TABLE IF NOT EXISTS station_registry (
  station_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  raw_id TEXT NOT NULL,
  station_name TEXT,
  river_name TEXT,
  latitude REAL,
  longitude REAL,
  flood_mon_id TEXT,
  hydrology_id TEXT,
  nrw_station_id TEXT,
  nrw_parameter_ids JSONB,
  has_level BOOLEAN DEFAULT false,
  has_flow BOOLEAN DEFAULT false,
  has_wq BOOLEAN DEFAULT false,
  data_start_date TEXT,
  data_end_date TEXT,
  status TEXT,
  last_fetched TIMESTAMPTZ
);

-- Maps venues to their nearest monitoring stations by data type
CREATE TABLE IF NOT EXISTS venue_station_map (
  venue_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  station_id TEXT NOT NULL,
  distance_km REAL,
  match_type TEXT,
  PRIMARY KEY (venue_name, data_type)
);

-- Daily weather observations (293K+ rows)
CREATE TABLE IF NOT EXISTS weather_daily (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  t_min_day REAL,
  t_max_day REAL,
  t_avg_day REAL,
  precip_mm REAL,
  wind_speed_ms REAL,
  wind_dir_deg REAL,
  wind_dir_compass TEXT,
  granularity TEXT,
  location TEXT NOT NULL,
  UNIQUE (date, location)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_location ON weather_daily(location);
CREATE INDEX IF NOT EXISTS idx_weather_daily_date ON weather_daily(date);

-- Daily water level/flow readings
CREATE TABLE IF NOT EXISTS water_level_daily (
  station_id TEXT NOT NULL,
  source TEXT NOT NULL,
  date DATE NOT NULL,
  station_name TEXT,
  level_min_m REAL,
  level_max_m REAL,
  level_mean_m REAL,
  flow_min_m3s REAL,
  flow_max_m3s REAL,
  flow_mean_m3s REAL,
  reading_count INTEGER,
  PRIMARY KEY (station_id, date)
);

-- Daily water quality readings
CREATE TABLE IF NOT EXISTS water_quality_daily (
  station_id TEXT NOT NULL,
  date DATE NOT NULL,
  station_name TEXT,
  temp_min_c REAL,
  temp_max_c REAL,
  temp_mean_c REAL,
  do_min_pct REAL,
  do_max_pct REAL,
  do_mean_pct REAL,
  turbidity_min_ntu REAL,
  turbidity_max_ntu REAL,
  turbidity_mean_ntu REAL,
  ph_min REAL,
  ph_max REAL,
  ph_mean REAL,
  reading_count INTEGER,
  PRIMARY KEY (station_id, date)
);

-- RLS: Public read, service write (all 5 tables)
ALTER TABLE station_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_station_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_level_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_quality_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read station_registry" ON station_registry FOR SELECT USING (true);
CREATE POLICY "Public read venue_station_map" ON venue_station_map FOR SELECT USING (true);
CREATE POLICY "Public read weather_daily" ON weather_daily FOR SELECT USING (true);
CREATE POLICY "Public read water_level_daily" ON water_level_daily FOR SELECT USING (true);
CREATE POLICY "Public read water_quality_daily" ON water_quality_daily FOR SELECT USING (true);

CREATE POLICY "Service write station_registry" ON station_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write venue_station_map" ON venue_station_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write weather_daily" ON weather_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write water_level_daily" ON water_level_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write water_quality_daily" ON water_quality_daily FOR ALL USING (true) WITH CHECK (true);
