DROP FUNCTION IF EXISTS public.auto_end_stale_diary_sessions(integer);

CREATE OR REPLACE FUNCTION public.auto_end_stale_diary_sessions(p_max_age_hours integer DEFAULT 12)
RETURNS TABLE(ended_id uuid, ended_user_id uuid, ended_venue_name text, ended_duration_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH targets AS (
    SELECT fs.id AS sid, fs.user_id AS uid, fs.venue_name AS vname,
           COALESCE(fs.start_time, fs.created_at) AS started
    FROM public.fishing_sessions fs
    WHERE fs.is_active = true
      AND fs.source = 'diary'
      AND COALESCE(fs.start_time, fs.created_at) < now() - (p_max_age_hours || ' hours')::interval
  ),
  updated AS (
    UPDATE public.fishing_sessions s
    SET is_active = false,
        end_time = COALESCE(s.end_time, now()),
        duration_minutes = COALESCE(s.duration_minutes,
                                    EXTRACT(EPOCH FROM (now() - t.started))::integer / 60)
    FROM targets t
    WHERE s.id = t.sid
    RETURNING s.id AS xid, t.uid AS xuid, t.vname AS xvname, s.duration_minutes AS xdur
  )
  SELECT xid, xuid, xvname, xdur FROM updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_end_stale_diary_sessions(integer) TO service_role;