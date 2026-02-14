
-- ============================================================
-- TERMINOLOGY TABLES - Fishing Intelligence Platform
-- ============================================================

-- 1. FLIES (434 patterns)
DROP TABLE IF EXISTS ref_flies CASCADE;
CREATE TABLE ref_flies (
  id SERIAL PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  top_category TEXT NOT NULL,
  sub_category TEXT,
  imitation TEXT,
  life_stage TEXT,
  water_type TEXT,
  hook_size_min INTEGER,
  hook_size_max INTEGER,
  weight_buoyancy TEXT,
  primary_colours TEXT,
  materials_summary TEXT,
  season_notes TEXT,
  tactics_notes TEXT,
  confidence_rating TEXT,
  box_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern_name)
);

-- 2. LINES (35 types)
DROP TABLE IF EXISTS ref_lines CASCADE;
CREATE TABLE ref_lines (
  id SERIAL PRIMARY KEY,
  line_type_code TEXT NOT NULL,
  line_family TEXT,
  buoyancy TEXT,
  sink_rate_ips TEXT,
  rod_weight_min INTEGER,
  rod_weight_max INTEGER,
  typical_use TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(line_type_code)
);

-- 3. RETRIEVES (27 techniques)
DROP TABLE IF EXISTS ref_retrieves CASCADE;
CREATE TABLE ref_retrieves (
  id SERIAL PRIMARY KEY,
  retrieve_name TEXT NOT NULL,
  water_type TEXT,
  style TEXT,
  pace TEXT,
  depth_zone TEXT,
  typical_line TEXT,
  when_to_use TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(retrieve_name)
);

-- 4. RIGS (33 configurations)
DROP TABLE IF EXISTS ref_rigs CASCADE;
CREATE TABLE ref_rigs (
  id SERIAL PRIMARY KEY,
  rig_name TEXT NOT NULL,
  water_type TEXT,
  style TEXT,
  flies_on_rig INTEGER,
  depth_zone TEXT,
  typical_flies TEXT,
  typical_line TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rig_name)
);

-- 5. HOOK SIZES (11 sizes)
DROP TABLE IF EXISTS ref_hook_sizes CASCADE;
CREATE TABLE ref_hook_sizes (
  id SERIAL PRIMARY KEY,
  hook_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hook_size)
);

-- 6. COLOURS (15 colours)
DROP TABLE IF EXISTS ref_colours CASCADE;
CREATE TABLE ref_colours (
  id SERIAL PRIMARY KEY,
  colour TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(colour)
);

-- 7. DEPTHS (5 categories)
DROP TABLE IF EXISTS ref_depths CASCADE;
CREATE TABLE ref_depths (
  id SERIAL PRIMARY KEY,
  depth_label TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(depth_label)
);

-- 8. LINES FROM REPORTS (11 types - historical usage)
DROP TABLE IF EXISTS ref_lines_from_reports CASCADE;
CREATE TABLE ref_lines_from_reports (
  id SERIAL PRIMARY KEY,
  line_type TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(line_type)
);

-- ============================================================
-- ROW LEVEL SECURITY - Allow public read, service role write
-- ============================================================
ALTER TABLE ref_flies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_retrieves ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_rigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_hook_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_depths ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_lines_from_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ref_flies" ON ref_flies FOR SELECT USING (true);
CREATE POLICY "Public read ref_lines" ON ref_lines FOR SELECT USING (true);
CREATE POLICY "Public read ref_retrieves" ON ref_retrieves FOR SELECT USING (true);
CREATE POLICY "Public read ref_rigs" ON ref_rigs FOR SELECT USING (true);
CREATE POLICY "Public read ref_hook_sizes" ON ref_hook_sizes FOR SELECT USING (true);
CREATE POLICY "Public read ref_colours" ON ref_colours FOR SELECT USING (true);
CREATE POLICY "Public read ref_depths" ON ref_depths FOR SELECT USING (true);
CREATE POLICY "Public read ref_lines_from_reports" ON ref_lines_from_reports FOR SELECT USING (true);

CREATE POLICY "Service write ref_flies" ON ref_flies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_lines" ON ref_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_retrieves" ON ref_retrieves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_rigs" ON ref_rigs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_hook_sizes" ON ref_hook_sizes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_colours" ON ref_colours FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_depths" ON ref_depths FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write ref_lines_from_reports" ON ref_lines_from_reports FOR ALL USING (true) WITH CHECK (true);
