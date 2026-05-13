CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.auto_end_stale_diary_sessions(p_max_age_hours integer DEFAULT 12)
RETURNS TABLE(ended_id uuid, user_id uuid, venue_name text, duration_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH targets AS (
    SELECT id, user_id AS uid, venue_name AS vname,
           COALESCE(start_time, created_at) AS started
    FROM public.fishing_sessions
    WHERE is_active = true
      AND source = 'diary'
      AND COALESCE(start_time, created_at) < now() - (p_max_age_hours || ' hours')::interval
  ),
  updated AS (
    UPDATE public.fishing_sessions s
    SET is_active = false,
        end_time = COALESCE(s.end_time, now()),
        duration_minutes = COALESCE(s.duration_minutes,
                                    EXTRACT(EPOCH FROM (now() - t.started))::integer / 60)
    FROM targets t
    WHERE s.id = t.id
    RETURNING s.id AS ended_id, t.uid, t.vname, s.duration_minutes
  )
  SELECT ended_id, uid, vname, duration_minutes FROM updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_end_stale_diary_sessions(integer) TO service_role;

-- Unschedule first if present (idempotent re-runs)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-end-stale-diary-sessions');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-end-stale-diary-sessions',
  '*/30 * * * *',
  $cron$ SELECT count(*) FROM public.auto_end_stale_diary_sessions(12) $cron$
);