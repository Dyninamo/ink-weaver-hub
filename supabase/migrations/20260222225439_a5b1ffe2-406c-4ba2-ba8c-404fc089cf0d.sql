
-- Part 1: fish_types reference table
CREATE TABLE IF NOT EXISTS fish_types (
  fish_type_id INTEGER PRIMARY KEY,
  fish_type TEXT UNIQUE NOT NULL
);

INSERT INTO fish_types VALUES
  (1, 'Trout'),
  (2, 'Salmon'),
  (3, 'Grayling'),
  (4, 'Sea Trout')
ON CONFLICT DO NOTHING;

ALTER TABLE fish_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fish_types readable by all"
  ON fish_types FOR SELECT
  USING (true);

CREATE POLICY "fish_types writable by service role"
  ON fish_types FOR ALL
  TO service_role
  USING (true);

-- Part 2: fish_species_game reference table
CREATE TABLE IF NOT EXISTS fish_species_game (
  species_id INTEGER PRIMARY KEY,
  fish_type_id INTEGER NOT NULL REFERENCES fish_types(fish_type_id),
  species_name TEXT NOT NULL,
  UNIQUE(fish_type_id, species_name)
);

INSERT INTO fish_species_game VALUES
  (1, 1, 'Rainbow'),
  (2, 1, 'Brown'),
  (3, 1, 'Brook'),
  (4, 1, 'Tiger'),
  (5, 1, 'Blue'),
  (6, 2, 'Atlantic'),
  (7, 2, 'Pacific'),
  (8, 3, 'Grayling'),
  (9, 4, 'Sea Trout')
ON CONFLICT DO NOTHING;

ALTER TABLE fish_species_game ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fish_species_game readable by all"
  ON fish_species_game FOR SELECT
  USING (true);

CREATE POLICY "fish_species_game writable by service role"
  ON fish_species_game FOR ALL
  TO service_role
  USING (true);

-- Part 3: angler_profiles table
CREATE TABLE IF NOT EXISTS angler_profiles (
  id UUID PRIMARY KEY,
  angler_name TEXT NOT NULL,
  angler_location TEXT,
  user_id UUID REFERENCES auth.users(id),
  total_trips INTEGER DEFAULT 0,
  total_fish INTEGER DEFAULT 0,
  avg_catch REAL,
  catch_rate REAL,
  venues_fished INTEGER DEFAULT 0,
  source TEXT DEFAULT 'passport',
  first_session DATE,
  last_session DATE,
  weight_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_angler_name_loc ON angler_profiles(angler_name, angler_location);
CREATE INDEX idx_angler_user ON angler_profiles(user_id);

ALTER TABLE angler_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Angler profiles readable by all"
  ON angler_profiles FOR SELECT
  USING (true);

CREATE POLICY "Angler profiles writable by service role"
  ON angler_profiles FOR ALL
  TO service_role
  USING (true);

-- Part 4: angler_type_weights table
CREATE TABLE IF NOT EXISTS angler_type_weights (
  id UUID PRIMARY KEY,
  angler_id UUID NOT NULL REFERENCES angler_profiles(id) ON DELETE CASCADE,
  fishing_type TEXT NOT NULL,
  skill_weight REAL DEFAULT 1.0,
  trips INTEGER DEFAULT 0,
  avg_catch REAL,
  catch_rate REAL,
  UNIQUE(angler_id, fishing_type)
);

CREATE INDEX idx_atw_angler ON angler_type_weights(angler_id);
CREATE INDEX idx_atw_type ON angler_type_weights(fishing_type);
CREATE INDEX idx_atw_weight ON angler_type_weights(skill_weight DESC);

ALTER TABLE angler_type_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Type weights readable by all"
  ON angler_type_weights FOR SELECT
  USING (true);

CREATE POLICY "Type weights writable by service role"
  ON angler_type_weights FOR ALL
  TO service_role
  USING (true);

-- Part 5: Alter existing fishing_sessions table
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'diary';
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS beat TEXT;
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS fishing_type_raw TEXT;
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS angler_name TEXT;
ALTER TABLE fishing_sessions ADD COLUMN IF NOT EXISTS angler_location TEXT;

-- Make user_id nullable (passport sessions have no Supabase user)
ALTER TABLE fishing_sessions ALTER COLUMN user_id DROP NOT NULL;

-- Set source for existing diary rows
UPDATE fishing_sessions SET source = 'diary' WHERE source IS NULL;

-- Add indexes for passport queries
CREATE INDEX IF NOT EXISTS idx_sessions_source ON fishing_sessions(source);
CREATE INDEX IF NOT EXISTS idx_sessions_area ON fishing_sessions(area);
CREATE INDEX IF NOT EXISTS idx_sessions_angler ON fishing_sessions(angler_name, angler_location);

-- Add RLS policy so passport sessions are publicly readable
CREATE POLICY "Public can read passport sessions"
  ON fishing_sessions FOR SELECT
  USING (source = 'passport');

-- Allow service role to insert passport data
CREATE POLICY "Service role can manage all sessions"
  ON fishing_sessions FOR ALL
  TO service_role
  USING (true);

-- Part 6: Update session_events RLS
CREATE POLICY "Public can read passport session events"
  ON session_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions
      WHERE fishing_sessions.id = session_events.session_id
      AND fishing_sessions.source = 'passport'
    )
  );

CREATE POLICY "Service role can manage all events"
  ON session_events FOR ALL
  TO service_role
  USING (true);
