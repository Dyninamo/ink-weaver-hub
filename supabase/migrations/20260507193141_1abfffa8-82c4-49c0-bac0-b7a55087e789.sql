BEGIN;
ALTER TABLE public.venues_new DROP COLUMN IF EXISTS return_email;
ALTER TABLE public.fishing_sessions
  DROP COLUMN IF EXISTS reported_at,
  DROP COLUMN IF EXISTS reported_to_email,
  DROP COLUMN IF EXISTS reported_body_snapshot,
  DROP COLUMN IF EXISTS reported_include_gps;
COMMIT;
NOTIFY pgrst, 'reload schema';