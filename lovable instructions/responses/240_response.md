# 240 — Trigram-based venue suggestions

## Migration
- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- `CREATE INDEX venues_new_name_trgm ON venues_new USING gin (name gin_trgm_ops)`
- `suggest_venues(q text, lim int)` — SECURITY DEFINER, STABLE, returns `(venue_id text, name text)` (venues_new.venue_id is text, not uuid — adjusted from spec). Threshold `similarity > 0.25`, `LIMIT LEAST(lim,10)`, `length(btrim(q)) >= 3` guard. EXECUTE granted to `authenticated` + `service_role`.

## Edge function
`supabase/functions/get-ai-advice-v2/index.ts` `venue_not_found` branch now calls `supabase.rpc('suggest_venues', { q: trimmed, lim: 5 })` first; on any RPC error logs `console.warn` and falls back to the previous `ilike '%term%'` loop. 422 response shape (`error`, `message`, `submitted`, `suggestions`) unchanged. No Anthropic call on this path.

## Verify (DB-level)
- `suggest_venues('Grafam Water', 5)` → top hit `AW-GRAFHAM Grafham Water` ✓
- `suggest_venues('Rutand Water', 5)` → includes `Rutland Water` ✓
- `suggest_venues('zzzzzz', 5)` → 0 rows ✓

## Linter
32 pre-existing project-wide findings; none introduced by this migration. The new function inherits the same "Public Can Execute SECURITY DEFINER Function" pattern already used across the project (e.g. `has_role`, `get_my_profile_id`) — accepted.
