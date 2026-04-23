-- Flow 03 finish: Lost "Unsure" + Change cascade + Rod picker

-- 1) Lost form: explicit "Unsure" fly position
ALTER TABLE public.session_events
  ADD COLUMN IF NOT EXISTS fly_position_unknown boolean NOT NULL DEFAULT false;

-- 2) Multi-rod tracking — every event belongs to a rod (default rod_index 1)
ALTER TABLE public.session_events
  ADD COLUMN IF NOT EXISTS rod_index integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_session_events_session_rod
  ON public.session_events (session_id, rod_index);

-- 3) session_rods: one row per rod set up in a session
CREATE TABLE IF NOT EXISTS public.session_rods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.fishing_sessions(id) ON DELETE CASCADE,
  rod_index integer NOT NULL,
  name text,                       -- e.g. "Rod 1 · Floater"
  rod_weight integer,
  rod_length_ft numeric,
  line_id integer,
  line_name text,
  line_profile text,
  leader_id integer,
  tippet_length_ft numeric,
  tippet_strength numeric,
  tippet_unit text,
  style text,
  dropper_count integer DEFAULT 1,
  flies_on_cast jsonb,
  is_active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, rod_index)
);

CREATE INDEX IF NOT EXISTS idx_session_rods_session ON public.session_rods (session_id);

ALTER TABLE public.session_rods ENABLE ROW LEVEL SECURITY;

-- RLS: owner of the parent session can do everything
CREATE POLICY "Owners can read their session rods"
  ON public.session_rods FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.fishing_sessions fs
    WHERE fs.id = session_rods.session_id AND fs.user_id = auth.uid()
  ));

CREATE POLICY "Owners can insert their session rods"
  ON public.session_rods FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fishing_sessions fs
    WHERE fs.id = session_rods.session_id AND fs.user_id = auth.uid()
  ));

CREATE POLICY "Owners can update their session rods"
  ON public.session_rods FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.fishing_sessions fs
    WHERE fs.id = session_rods.session_id AND fs.user_id = auth.uid()
  ));

CREATE POLICY "Owners can delete their session rods"
  ON public.session_rods FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.fishing_sessions fs
    WHERE fs.id = session_rods.session_id AND fs.user_id = auth.uid()
  ));