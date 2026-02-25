
-- Rename table
ALTER TABLE fishing_reports RENAME TO reports_enriched;

-- Rename columns to match master database
ALTER TABLE reports_enriched RENAME COLUMN report_date TO date;
ALTER TABLE reports_enriched RENAME COLUMN report_text TO text;

-- Add missing columns from master database
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS week_start TEXT;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS weather_venue TEXT;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_min_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_max_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_mean_std REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS wind_speed_std REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS wind_speed_max_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS pressure_mean_std REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS pressure_min_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS pressure_max_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS sunshine_hours_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS storm_days_week REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_mean_change REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS pressure_change REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS wind_speed_change REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_min_day REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_max_day REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS t_avg_day REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS precip_mm REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS wind_speed_ms REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS wind_dir_deg REAL;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS wind_dir_compass TEXT;
ALTER TABLE reports_enriched ADD COLUMN IF NOT EXISTS granularity TEXT;
