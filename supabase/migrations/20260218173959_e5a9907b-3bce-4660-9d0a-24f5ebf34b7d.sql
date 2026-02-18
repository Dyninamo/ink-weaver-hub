
-- ============================================================
-- FISHING DIARY SCHEMA MIGRATION
-- Date: 2026-02-18
-- Action: Replace old diary model with event-based state machine
-- ============================================================

-- ============================================================
-- STEP 1: DROP OLD DIARY TABLES
-- CASCADE removes: diary_fish (child), update_diary_totals() 
-- trigger, diary_as_reports view
-- ============================================================

DROP VIEW IF EXISTS diary_as_reports CASCADE;
DROP TRIGGER IF EXISTS diary_fish_changed ON diary_fish;
DROP FUNCTION IF EXISTS update_diary_totals();
DROP TABLE IF EXISTS diary_fish CASCADE;
DROP TABLE IF EXISTS diary_entries CASCADE;


-- ============================================================
-- STEP 2: CREATE fishing_sessions
-- One row per fishing trip/session
-- ============================================================

CREATE TABLE fishing_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  venue_type TEXT DEFAULT 'stillwater' CHECK (venue_type IN ('stillwater', 'river')),
  session_date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  fishing_type TEXT CHECK (fishing_type IN ('Bank', 'Boat', 'Both')),
  plan TEXT,
  rods INTEGER DEFAULT 1 CHECK (rods BETWEEN 1 AND 4),

  -- Weather at session start
  weather_temp REAL,
  weather_wind_speed REAL,
  weather_wind_dir TEXT,
  weather_pressure REAL,
  weather_conditions TEXT,

  -- Session wrap-up (filled on session end)
  satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
  would_return BOOLEAN,
  notes TEXT,

  -- State
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fs_user ON fishing_sessions(user_id);
CREATE INDEX idx_fs_date ON fishing_sessions(session_date);
CREATE INDEX idx_fs_venue ON fishing_sessions(venue_name);
CREATE INDEX idx_fs_active ON fishing_sessions(is_active) WHERE is_active = true;


-- ============================================================
-- STEP 3: CREATE session_events
-- Individual events within a session: catch, blank, change, got_away
-- ============================================================

CREATE TABLE session_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES fishing_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('catch', 'blank', 'change', 'got_away')),
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order INTEGER NOT NULL,

  -- === Catch fields ===
  species TEXT,
  weight_lb INTEGER,
  weight_oz INTEGER,
  weight_display TEXT,
  length_inches REAL,
  measurement_mode TEXT CHECK (measurement_mode IN ('weight', 'length')),
  fly_pattern TEXT,
  fly_size INTEGER,
  rig_position TEXT,

  -- === Setup snapshot (current state at time of event) ===
  style TEXT,
  rig TEXT,
  line_type TEXT,
  retrieve TEXT,
  flies_on_cast JSONB,
  spot TEXT,
  depth_zone TEXT,

  -- === Blank fields ===
  blank_confidence TEXT CHECK (blank_confidence IN ('Dead', 'Seeing fish', 'Had follows', 'Had pulls')),
  blank_reason TEXT,

  -- === Change fields ===
  change_from JSONB,
  change_to JSONB,
  change_reason TEXT,

  -- === Got Away fields ===
  got_away_stage TEXT CHECK (got_away_stage IN ('On the take', 'During the fight', 'At the net')),
  fly_known BOOLEAN,
  size_estimate TEXT,

  -- === Weather stamp per event ===
  event_temp REAL,
  event_wind_speed REAL,
  event_wind_dir TEXT,
  event_pressure REAL,
  event_conditions TEXT,

  -- === Meta ===
  is_best_fish BOOLEAN DEFAULT false,
  photo_url TEXT,
  notes TEXT,
  latitude REAL,
  longitude REAL
);

CREATE INDEX idx_se_session ON session_events(session_id);
CREATE INDEX idx_se_type ON session_events(event_type);
CREATE INDEX idx_se_time ON session_events(event_time);
CREATE INDEX idx_se_session_order ON session_events(session_id, sort_order);


-- ============================================================
-- STEP 4: CREATE user_rod_setups
-- Named preset rod/technique configurations
-- ============================================================

CREATE TABLE user_rod_setups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rod_name TEXT,
  style TEXT,
  rig TEXT,
  line_type TEXT,
  retrieve TEXT,
  depth_zone TEXT,
  default_flies JSONB,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_urs_user ON user_rod_setups(user_id);


-- ============================================================
-- STEP 5: ALTER ref_lines — add friendly_name column
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ref_lines' AND column_name = 'friendly_name'
  ) THEN
    ALTER TABLE ref_lines ADD COLUMN friendly_name TEXT;
  END IF;
END $$;


-- ============================================================
-- STEP 6: RLS POLICIES
-- ============================================================

ALTER TABLE fishing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rod_setups ENABLE ROW LEVEL SECURITY;

-- fishing_sessions
CREATE POLICY "Users can view own sessions"
  ON fishing_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON fishing_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON fishing_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON fishing_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- session_events (access via parent session)
CREATE POLICY "Users can view own session events"
  ON session_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions 
      WHERE fishing_sessions.id = session_events.session_id 
      AND fishing_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session events"
  ON session_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fishing_sessions 
      WHERE fishing_sessions.id = session_events.session_id 
      AND fishing_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own session events"
  ON session_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions 
      WHERE fishing_sessions.id = session_events.session_id 
      AND fishing_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session events"
  ON session_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions 
      WHERE fishing_sessions.id = session_events.session_id 
      AND fishing_sessions.user_id = auth.uid()
    )
  );

-- user_rod_setups
CREATE POLICY "Users can view own rod setups"
  ON user_rod_setups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rod setups"
  ON user_rod_setups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rod setups"
  ON user_rod_setups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rod setups"
  ON user_rod_setups FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- STEP 7: TRIGGER — auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION handle_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER session_updated_at
  BEFORE UPDATE ON fishing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION handle_session_updated_at();

CREATE TRIGGER rod_setup_updated_at
  BEFORE UPDATE ON user_rod_setups
  FOR EACH ROW
  EXECUTE FUNCTION handle_session_updated_at();


-- ============================================================
-- STEP 8: RECREATE diary_as_reports VIEW
-- ============================================================

CREATE OR REPLACE VIEW diary_as_reports AS
SELECT
  s.venue_name AS venue,
  s.session_date AS date,
  EXTRACT(WEEK FROM s.session_date)::INTEGER AS week_num,
  EXTRACT(YEAR FROM s.session_date)::INTEGER AS year,
  COUNT(e.id) FILTER (WHERE e.event_type = 'catch') AS rod_average,
  ARRAY_AGG(DISTINCT e.style) FILTER (WHERE e.event_type = 'catch' AND e.style IS NOT NULL) AS methods,
  ARRAY_AGG(DISTINCT e.fly_pattern) FILTER (WHERE e.event_type = 'catch' AND e.fly_pattern IS NOT NULL) AS flies,
  ARRAY_AGG(DISTINCT e.spot) FILTER (WHERE e.event_type IN ('catch', 'blank') AND e.spot IS NOT NULL) AS best_spots,
  s.notes AS summary,
  s.notes AS content,
  s.weather_temp AS t_mean_week,
  s.weather_wind_speed AS wind_speed_mean_week,
  NULL::REAL AS precip_total_mm_week,
  s.weather_pressure AS pressure_mean_week,
  NULL::REAL AS humidity_mean_week,
  s.user_id
FROM fishing_sessions s
LEFT JOIN session_events e ON e.session_id = s.id
WHERE s.is_active = false
GROUP BY s.id, s.venue_name, s.session_date, s.notes,
         s.weather_temp, s.weather_wind_speed, s.weather_pressure, s.user_id
HAVING COUNT(e.id) FILTER (WHERE e.event_type = 'catch') > 0;
