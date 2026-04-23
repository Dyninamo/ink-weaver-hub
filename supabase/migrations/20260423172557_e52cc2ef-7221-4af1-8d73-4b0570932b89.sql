CREATE OR REPLACE FUNCTION public.validate_coach_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.coach_stage NOT IN ('new', 'onboarding', 'started', 'done') THEN
    RAISE EXCEPTION 'Invalid coach_stage: %. Must be new, onboarding, started, or done.', NEW.coach_stage;
  END IF;
  RETURN NEW;
END;
$function$;