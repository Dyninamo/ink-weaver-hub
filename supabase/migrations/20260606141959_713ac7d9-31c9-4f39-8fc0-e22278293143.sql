DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.user_profiles;

CREATE POLICY "Users can read their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles
  WITH (security_invoker = false) AS
  SELECT profile_id, display_name, avatar_url
  FROM public.user_profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;