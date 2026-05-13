CREATE OR REPLACE FUNCTION public.increment_notable_fish_witnesses(p_fish_id UUID)
RETURNS TABLE (
  n_witnesses        INTEGER,
  confidence_score   INTEGER,
  verification_tier  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_count INTEGER;
  v_new_count INTEGER;
  v_old_score INTEGER;
  v_new_score INTEGER;
  v_new_tier  INTEGER;
BEGIN
  SELECT nf.n_witnesses, nf.confidence_score
    INTO v_old_count, v_old_score
    FROM public.notable_fish nf
   WHERE nf.fish_id = p_fish_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'notable_fish not found: %', p_fish_id;
  END IF;

  v_new_count := v_old_count + 1;

  IF v_old_count = 0 THEN
    v_new_score := LEAST(100, v_old_score + 5);
    UPDATE public.verification_scores
       SET pts_peer_witness = 5,
           total_score      = v_new_score
     WHERE fish_id = p_fish_id;
  ELSE
    v_new_score := v_old_score;
  END IF;

  v_new_tier := CASE
                  WHEN v_new_score >= 85 THEN 4
                  WHEN v_new_score >= 60 THEN 3
                  WHEN v_new_score >= 35 THEN 2
                  ELSE 1
                END;

  UPDATE public.notable_fish
     SET n_witnesses       = v_new_count,
         confidence_score  = v_new_score,
         verification_tier = v_new_tier
   WHERE fish_id = p_fish_id;

  RETURN QUERY SELECT v_new_count, v_new_score, v_new_tier;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_notable_fish_witnesses(UUID)
   TO authenticated, service_role;