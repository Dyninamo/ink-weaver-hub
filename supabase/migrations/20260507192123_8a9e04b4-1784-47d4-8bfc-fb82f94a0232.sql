ALTER TABLE public.fishing_sessions
  ADD COLUMN IF NOT EXISTS gps_start_lat     double precision,
  ADD COLUMN IF NOT EXISTS gps_start_lon     double precision,
  ADD COLUMN IF NOT EXISTS submission_status text,
  ADD COLUMN IF NOT EXISTS submission_due    timestamptz;

NOTIFY pgrst, 'reload schema';