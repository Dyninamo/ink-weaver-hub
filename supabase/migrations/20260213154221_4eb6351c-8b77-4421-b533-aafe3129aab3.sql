
CREATE TABLE IF NOT EXISTS basic_advice (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue TEXT NOT NULL,
  season TEXT NOT NULL CHECK (season IN ('Winter', 'Spring', 'Summer', 'Autumn')),
  weather_category TEXT NOT NULL CHECK (weather_category IN ('COLD', 'MILD', 'WARM')),
  temp_range_min DOUBLE PRECISION,
  temp_range_max DOUBLE PRECISION,
  temp_label TEXT,
  report_count INTEGER,
  expected_rod_average DOUBLE PRECISION,
  rod_average_range TEXT,
  avg_temp DOUBLE PRECISION,
  avg_wind_mph DOUBLE PRECISION,
  avg_precip_mm DOUBLE PRECISION,
  methods_ranked JSONB,
  flies_ranked JSONB,
  spots_ranked JSONB,
  latest_similar JSONB,
  advice_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue, season, weather_category)
);

ALTER TABLE basic_advice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read basic advice" ON basic_advice
FOR SELECT USING (true);

CREATE INDEX idx_basic_advice_lookup ON basic_advice(venue, season, weather_category);
