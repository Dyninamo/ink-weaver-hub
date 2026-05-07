ALTER TABLE public.venues_new
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS report_submission_form_url text;

NOTIFY pgrst, 'reload schema';