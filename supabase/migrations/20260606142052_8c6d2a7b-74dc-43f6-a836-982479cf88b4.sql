ALTER TABLE public.verification_codes
  ADD COLUMN IF NOT EXISTS code_hash text;

ALTER TABLE public.verification_codes
  ALTER COLUMN code DROP NOT NULL;

CREATE POLICY "service_role_delete_verification_codes"
  ON public.verification_codes FOR DELETE
  TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.purge_expired_verification_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.verification_codes
  WHERE expires_at < now() - interval '1 hour';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_verification_codes() FROM anon, authenticated;