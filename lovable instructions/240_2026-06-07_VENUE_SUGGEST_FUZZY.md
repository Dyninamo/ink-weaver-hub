# 240 — Make unknown-venue "did you mean…?" typo-tolerant (237 follow-up)

Minor polish on prompt 237. The `venue_not_found` path correctly refuses to fabricate
advice, but its suggestions are **substring-based** (`ilike '%<term>%'` on the submitted
string + its first 1–2 words). That misses the common case — a real typo that isn't a
substring. Live example (2026-06-07): advice for **"Grafam Water"** returned
`venue_not_found` with **`suggestions: []`**, even though "Grafham Water" exists (missing
letter ⇒ "Grafam" is not a substring of "Grafham").

This is non-blocking (the important protection works); it just makes the suggestion
genuinely useful.

## Fix — rank suggestions by trigram similarity (pg_trgm)
1. **Enable the extension + index** (migration):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX IF NOT EXISTS venues_new_name_trgm
     ON public.venues_new USING gin (name gin_trgm_ops);
   ```
2. **Add a small RPC** so PostgREST can order by similarity (SECURITY DEFINER; read-only;
   only returns `venue_id, name` from the public catalog — no PII):
   ```sql
   CREATE OR REPLACE FUNCTION public.suggest_venues(q text, lim int DEFAULT 5)
   RETURNS TABLE (venue_id uuid, name text)
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
     SELECT venue_id, name
     FROM venues_new
     WHERE q IS NOT NULL AND length(btrim(q)) >= 3
       AND similarity(name, q) > 0.25      -- tune threshold
     ORDER BY similarity(name, q) DESC
     LIMIT LEAST(COALESCE(lim,5), 10);
   $$;
   GRANT EXECUTE ON FUNCTION public.suggest_venues(text,int) TO authenticated;
   ```
3. **In `get-ai-advice-v2`**, on the `venue_not_found` branch, replace the `ilike '%…%'`
   block with a single `supabase.rpc('suggest_venues', { q: venue_name, lim: 5 })`. Keep
   everything else identical (still 422, still **no Anthropic call** on this path).
   - Keep a cheap fallback: if the RPC errors, fall back to the existing `ilike` so we
     never regress to throwing.

## Verify
- [ ] Advice for **"Grafam Water"** → `venue_not_found` with **"Grafham Water"** in
      `suggestions` (the case that returned `[]` before).
- [ ] Other near-misses ("Pitsord", "Rutand Water", "Bewl Watr") surface the right venue.
- [ ] A real venue ("Grafham Water") still returns normal advice (unchanged).
- [ ] Gibberish ("zzzzzz") → `venue_not_found` with empty suggestions (no error).
- [ ] The not-found path still makes **no** Anthropic/paid call.
- [ ] RPC is read-only and returns only `venue_id, name` (no PII leakage via SECURITY DEFINER).

## Note
`similarity > 0.25` is a starting threshold — tune against a few real typos so it's
permissive enough to catch single-letter errors but not so loose it returns noise.
