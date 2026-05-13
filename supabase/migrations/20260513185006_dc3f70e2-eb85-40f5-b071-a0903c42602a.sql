CREATE OR REPLACE FUNCTION public.fishing_sessions_enforce_passport_inactive()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source = 'passport' AND NEW.is_active = true THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fishing_sessions_passport_inactive ON public.fishing_sessions;
CREATE TRIGGER fishing_sessions_passport_inactive
  BEFORE INSERT OR UPDATE ON public.fishing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.fishing_sessions_enforce_passport_inactive();