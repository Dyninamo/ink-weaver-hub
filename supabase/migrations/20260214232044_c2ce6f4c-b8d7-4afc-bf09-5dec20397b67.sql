
DROP TABLE IF EXISTS ref_flies CASCADE;
CREATE TABLE ref_flies (
  id SERIAL PRIMARY KEY,
  pattern_name TEXT,
  top_category TEXT,
  sub_category TEXT,
  imitation TEXT,
  life_stage TEXT,
  water_type TEXT,
  hook_size_min TEXT,
  hook_size_max TEXT,
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

DROP TABLE IF EXISTS ref_lines CASCADE;
CREATE TABLE ref_lines (
  id SERIAL PRIMARY KEY,
  line_type_code TEXT,
  line_family TEXT,
  buoyancy TEXT,
  sink_rate_ips TEXT,
  line_weight_label TEXT,
  typical_weight_min_wt TEXT,
  typical_weight_max_wt TEXT,
  typical_usage TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(line_type_code)
);

DROP TABLE IF EXISTS ref_retrieves CASCADE;
CREATE TABLE ref_retrieves (
  id SERIAL PRIMARY KEY,
  retrieve_name TEXT,
  water_type TEXT,
  style TEXT,
  typical_line TEXT,
  rod_position TEXT,
  pace TEXT,
  depth_zone TEXT,
  when_to_use TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(retrieve_name)
);

DROP TABLE IF EXISTS ref_rigs CASCADE;
CREATE TABLE ref_rigs (
  id SERIAL PRIMARY KEY,
  rig_name TEXT,
  water_type TEXT,
  style TEXT,
  flies_on_rig TEXT,
  dropper_count TEXT,
  leader_length_ft TEXT,
  tippet_strength_lb TEXT,
  point_fly_role TEXT,
  typical_point_flies TEXT,
  typical_dropper_flies TEXT,
  depth_zone TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rig_name)
);

DROP TABLE IF EXISTS ref_hook_sizes CASCADE;
CREATE TABLE ref_hook_sizes (
  id SERIAL PRIMARY KEY,
  hook_size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hook_size)
);

DROP TABLE IF EXISTS ref_colours CASCADE;
CREATE TABLE ref_colours (
  id SERIAL PRIMARY KEY,
  colour TEXT,
  mentions_in_671_reports TEXT,
  your_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(colour)
);

DROP TABLE IF EXISTS ref_depths CASCADE;
CREATE TABLE ref_depths (
  id SERIAL PRIMARY KEY,
  depth TEXT,
  mentions_in_671_reports TEXT,
  your_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(depth)
);

DROP TABLE IF EXISTS ref_lines_from_reports CASCADE;
CREATE TABLE ref_lines_from_reports (
  id SERIAL PRIMARY KEY,
  line_type TEXT,
  mentions_in_671_reports TEXT,
  sink_rate TEXT,
  your_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(line_type)
);

ALTER TABLE ref_flies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_retrieves ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_rigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_hook_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_depths ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_lines_from_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ref_flies" ON ref_flies FOR SELECT USING (true);
CREATE POLICY "Service write ref_flies" ON ref_flies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_lines" ON ref_lines FOR SELECT USING (true);
CREATE POLICY "Service write ref_lines" ON ref_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_retrieves" ON ref_retrieves FOR SELECT USING (true);
CREATE POLICY "Service write ref_retrieves" ON ref_retrieves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_rigs" ON ref_rigs FOR SELECT USING (true);
CREATE POLICY "Service write ref_rigs" ON ref_rigs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_hook_sizes" ON ref_hook_sizes FOR SELECT USING (true);
CREATE POLICY "Service write ref_hook_sizes" ON ref_hook_sizes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_colours" ON ref_colours FOR SELECT USING (true);
CREATE POLICY "Service write ref_colours" ON ref_colours FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_depths" ON ref_depths FOR SELECT USING (true);
CREATE POLICY "Service write ref_depths" ON ref_depths FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read ref_lines_from_reports" ON ref_lines_from_reports FOR SELECT USING (true);
CREATE POLICY "Service write ref_lines_from_reports" ON ref_lines_from_reports FOR ALL USING (true) WITH CHECK (true);
