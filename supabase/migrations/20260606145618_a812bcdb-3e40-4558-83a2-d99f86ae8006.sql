
-- #2 fishing_sessions
DROP POLICY IF EXISTS "Public can read diary sessions" ON public.fishing_sessions;
DROP POLICY IF EXISTS "Public can read passport sessions" ON public.fishing_sessions;
-- owner SELECT "Users can view own sessions" already exists.

-- #3 session_events
DROP POLICY IF EXISTS "Public can read diary session events" ON public.session_events;
DROP POLICY IF EXISTS "Public can read passport session events" ON public.session_events;
-- owner SELECT "Users can view own session events" already exists.

-- #4 session_trails
DROP POLICY IF EXISTS "Public can read diary session trails" ON public.session_trails;
-- owner SELECT "Users can read own session trails" already exists.

-- session_weather_log (same family)
DROP POLICY IF EXISTS "Public can read diary session weather log" ON public.session_weather_log;
-- owner SELECT "Users can read own session weather log" already exists.

-- #1 angler_profiles — no client reads found; restrict to service_role only.
DROP POLICY IF EXISTS "Angler profiles readable by all" ON public.angler_profiles;
REVOKE SELECT ON public.angler_profiles FROM anon;
REVOKE SELECT ON public.angler_profiles FROM authenticated;

-- #5 notable_fish — owner-only
DROP POLICY IF EXISTS "Authenticated users can read active notable fish" ON public.notable_fish;
DROP POLICY IF EXISTS "Authenticated users can read notable fish" ON public.notable_fish;
CREATE POLICY "Users can read own notable fish"
  ON public.notable_fish
  FOR SELECT
  TO authenticated
  USING (profile_id = public.get_my_profile_id());
