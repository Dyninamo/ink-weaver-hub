-- ============================================================
-- ROUND 4 SCHEMA — fly_lines, leader/tippet enrichment,
-- fishing_sessions extension for setup wizard,
-- user_profiles defaults, venue_preferences
-- ============================================================

-- 1. fly_lines reference table (line types: Floating, Midge Tip, Intermediate, Di-3, etc.)
CREATE TABLE IF NOT EXISTS public.fly_lines (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  density TEXT,                     -- 'Floating' | 'Intermediate' | 'Sinking'
  sink_rate_ips NUMERIC,
  min_rod_weight INT NOT NULL DEFAULT 3,
  max_rod_weight INT NOT NULL DEFAULT 10,
  water_types TEXT[] NOT NULL DEFAULT ARRAY['stillwater','river'],
  active BOOLEAN NOT NULL DEFAULT true,
  order_hint INT NOT NULL DEFAULT 100,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fly_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fly_lines" ON public.fly_lines FOR SELECT USING (true);

-- 2. Leader / tippet enrichment for the wizard
ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_hint INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS min_rod_weight INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_rod_weight INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS water_types TEXT[] NOT NULL DEFAULT ARRAY['stillwater','river'];

ALTER TABLE public.tippets
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_hint INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS min_rod_weight INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_rod_weight INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS strength NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT;          -- 'lb' or 'x'

-- 3. fishing_sessions: setup wizard fields
ALTER TABLE public.fishing_sessions
  ADD COLUMN IF NOT EXISTS rod_weight INT,
  ADD COLUMN IF NOT EXISTS rod_length_ft NUMERIC,
  ADD COLUMN IF NOT EXISTS line_profile TEXT,         -- 'WF' | 'DT'
  ADD COLUMN IF NOT EXISTS leader_id BIGINT REFERENCES public.leaders(id),
  ADD COLUMN IF NOT EXISTS tippet_length_ft NUMERIC,
  ADD COLUMN IF NOT EXISTS tippet_strength NUMERIC,
  ADD COLUMN IF NOT EXISTS tippet_unit TEXT,
  ADD COLUMN IF NOT EXISTS dropper_count INT,
  ADD COLUMN IF NOT EXISTS keep_limit INT,
  ADD COLUMN IF NOT EXISTS spot_name TEXT,
  ADD COLUMN IF NOT EXISTS size_mode TEXT,            -- 'weight' | 'length'
  ADD COLUMN IF NOT EXISTS size_units TEXT;           -- 'lb' | 'kg' | 'in' | 'cm'

-- 4. user_profiles: defaults for save-scope writes
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS default_tippet_strength_unit TEXT,
  ADD COLUMN IF NOT EXISTS default_rod_weight INT,
  ADD COLUMN IF NOT EXISTS default_rod_length_ft NUMERIC,
  ADD COLUMN IF NOT EXISTS default_line TEXT,
  ADD COLUMN IF NOT EXISTS default_line_profile TEXT,
  ADD COLUMN IF NOT EXISTS default_leader_id BIGINT,
  ADD COLUMN IF NOT EXISTS default_size_mode TEXT,
  ADD COLUMN IF NOT EXISTS default_size_units TEXT,
  ADD COLUMN IF NOT EXISTS default_keep_limit INT;

-- 5. venue_preferences: per-user-per-venue defaults
CREATE TABLE IF NOT EXISTS public.venue_preferences (
  pref_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID,
  venue_name TEXT,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, venue_id, venue_name)
);

ALTER TABLE public.venue_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own venue_prefs" ON public.venue_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own venue_prefs" ON public.venue_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own venue_prefs" ON public.venue_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own venue_prefs" ON public.venue_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_venue_prefs_user ON public.venue_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_venue_prefs_venue ON public.venue_preferences (venue_id);

-- 6. venues_new: return_email for end-of-session CTA
ALTER TABLE public.venues_new
  ADD COLUMN IF NOT EXISTS return_email TEXT;

-- 7. Seed fly_lines (idempotent)
INSERT INTO public.fly_lines (name, density, sink_rate_ips, min_rod_weight, max_rod_weight, water_types, order_hint, description) VALUES
  ('Floating',        'Floating',     0,    3, 10, ARRAY['stillwater','river'], 10, 'Standard floating line'),
  ('Midge Tip',       'Floating',     1,    4, 9,  ARRAY['stillwater','river'], 20, 'Floating with sinking tip'),
  ('Intermediate',    'Intermediate', 1.5,  5, 10, ARRAY['stillwater'],         30, 'Slow-sinking just sub-surface'),
  ('Di-3',            'Sinking',      3,    6, 10, ARRAY['stillwater'],         40, 'Density compensated, 3 ips'),
  ('Di-5',            'Sinking',      5,    7, 10, ARRAY['stillwater'],         50, 'Density compensated, 5 ips'),
  ('Di-7',            'Sinking',      7,    8, 10, ARRAY['stillwater'],         60, 'Density compensated, 7 ips'),
  ('Fast Sink',       'Sinking',      8,    7, 10, ARRAY['stillwater'],         70, 'Fast-sinking line'),
  ('Euro Mono',       'Floating',     0,    2, 5,  ARRAY['river'],              80, 'Mono leader for Euro nymphing')
ON CONFLICT (name) DO NOTHING;

-- 8. Seed tippet rows with strength/unit if blank
UPDATE public.tippets SET strength = breaking_strain_lb, unit = 'lb' WHERE strength IS NULL AND breaking_strain_lb IS NOT NULL;
UPDATE public.tippets SET strength = COALESCE(NULLIF(regexp_replace(x_rating, '[^0-9.]', '', 'g'), ''), '0')::numeric, unit = 'x' WHERE x_rating IS NOT NULL AND unit IS NULL;