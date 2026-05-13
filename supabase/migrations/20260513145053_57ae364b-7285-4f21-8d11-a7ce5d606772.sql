-- Pre-cleanup: end older duplicate-active sessions, keeping the newest per user.
WITH ranked AS (
  SELECT id, user_id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
  FROM public.fishing_sessions
  WHERE is_active = true AND source = 'diary'
)
UPDATE public.fishing_sessions
SET is_active = false,
    end_time = COALESCE(end_time, now()),
    duration_minutes = COALESCE(duration_minutes, EXTRACT(EPOCH FROM (now() - start_time))/60)::integer
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Enforce one active diary session per user at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_active_diary_session
  ON public.fishing_sessions(user_id)
  WHERE is_active = true AND source = 'diary';