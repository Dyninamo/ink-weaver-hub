ALTER TABLE public.fishing_sessions
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_to_email text,
  ADD COLUMN IF NOT EXISTS reported_body_snapshot text,
  ADD COLUMN IF NOT EXISTS reported_include_gps boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_fishing_sessions_reported_at
  ON public.fishing_sessions (reported_at);

CREATE INDEX IF NOT EXISTS idx_fishing_sessions_user_reported
  ON public.fishing_sessions (user_id, reported_at);