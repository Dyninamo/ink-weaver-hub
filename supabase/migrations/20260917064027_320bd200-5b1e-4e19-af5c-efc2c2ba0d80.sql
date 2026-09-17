DELETE FROM public.reports_enriched WHERE id IN ('97c0a4b1-eef8-4e95-90e1-b3be4ba4e57b','3689528c-7f45-4df0-b758-8e63d967f6d5');

CREATE OR REPLACE FUNCTION public.reject_future_report_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date > CURRENT_DATE + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'reports_enriched.date % is in the future', NEW.date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_future_report_date ON public.reports_enriched;
CREATE TRIGGER trg_reject_future_report_date
  BEFORE INSERT OR UPDATE ON public.reports_enriched
  FOR EACH ROW EXECUTE FUNCTION public.reject_future_report_date();