
-- Master venue directory (hierarchical: water > section > beat)
CREATE TABLE IF NOT EXISTS venues_new (
  venue_id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  level TEXT NOT NULL,
  water_type_id INTEGER NOT NULL REFERENCES water_types(water_type_id),
  region_id INTEGER NOT NULL REFERENCES regions(region_id),
  country TEXT NOT NULL DEFAULT 'England',
  county TEXT,
  river_name TEXT,
  latitude REAL,
  longitude REAL,
  aliases JSONB DEFAULT '[]',
  search_text TEXT NOT NULL DEFAULT '',
  is_searchable BOOLEAN NOT NULL DEFAULT true,
  display_context TEXT,
  has_reports BOOLEAN NOT NULL DEFAULT false,
  has_passport BOOLEAN NOT NULL DEFAULT false,
  has_diary BOOLEAN NOT NULL DEFAULT false,
  session_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  source_id TEXT,
  section_profile_id TEXT,
  stillwater_profile_id TEXT,
  root_url TEXT,
  platform_type TEXT,
  last_crawled TIMESTAMPTZ,
  last_successful_crawl TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venues_new_parent ON venues_new(parent_id);
CREATE INDEX IF NOT EXISTS idx_venues_new_level ON venues_new(level);
CREATE INDEX IF NOT EXISTS idx_venues_new_region ON venues_new(region_id);
CREATE INDEX IF NOT EXISTS idx_venues_new_water_type ON venues_new(water_type_id);
CREATE INDEX IF NOT EXISTS idx_venues_new_country ON venues_new(country);
CREATE INDEX IF NOT EXISTS idx_venues_new_county ON venues_new(county);
CREATE INDEX IF NOT EXISTS idx_venues_new_river ON venues_new(river_name);
CREATE INDEX IF NOT EXISTS idx_venues_new_coords ON venues_new(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_venues_new_source ON venues_new(source, source_id);
CREATE INDEX IF NOT EXISTS idx_venues_new_searchable ON venues_new(is_searchable);

-- RLS: public read, service write
ALTER TABLE venues_new ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read venues_new" ON venues_new FOR SELECT USING (true);
CREATE POLICY "Service write venues_new" ON venues_new FOR ALL USING (true) WITH CHECK (true);
