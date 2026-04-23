ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS coach_stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS home_venue_id text REFERENCES public.venues_new(venue_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stillwater_default_species text,
  ADD COLUMN IF NOT EXISTS stillwater_default_rod_weight integer,
  ADD COLUMN IF NOT EXISTS stillwater_default_line text,
  ADD COLUMN IF NOT EXISTS river_default_species text,
  ADD COLUMN IF NOT EXISTS river_default_rod_weight integer,
  ADD COLUMN IF NOT EXISTS river_default_line text,
  ADD COLUMN IF NOT EXISTS confirm_delete_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coach_banner_dismissed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_coach_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.coach_stage NOT IN ('new', 'onboarding', 'done') THEN
    RAISE EXCEPTION 'Invalid coach_stage: %. Must be new, onboarding, or done.', NEW.coach_stage;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_user_profiles_coach_stage ON public.user_profiles;
CREATE TRIGGER validate_user_profiles_coach_stage
BEFORE INSERT OR UPDATE OF coach_stage ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_coach_stage();