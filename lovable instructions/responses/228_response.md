# 228 — admin-dump-diary edge function

## Created
- `supabase/functions/admin-dump-diary/index.ts` — mirrors `admin-dump-app-events`:
  - `requireAdmin` gate (X-Admin-Secret OR admin-email JWT).
  - CORS + `OPTIONS` preflight.
  - service_role client via `requireEnv("SUPABASE_URL")` / `requireEnv("SUPABASE_SERVICE_ROLE_KEY")`.
  - Allowlist `Set<string>`: `fishing_sessions`, `session_events`, `session_trails`. Anything else → 400 with the allowlist enumerated.
  - `limit` default 1000, capped `Math.min(limit, 5000)`; `offset` default 0 (both clamped to ≥1 / ≥0).
  - Accepts params from GET querystring or POST body (parity with admin-dump-app-events).
  - `SELECT * ... ORDER BY id ASC` via `.range(offset, offset+limit-1)`.
  - Returns `{ table, limit, offset, rows }`.

## Deploys automatically.

## Smoke
- No creds → 401 ("Missing admin credentials…").
- Bogus `X-Admin-Secret` → 401 ("Invalid admin secret").
- `?table=bobby_tables` (authed) → 400 with allowlist error.
- `?table=fishing_sessions&limit=2` / `?table=session_events&limit=2` → 200 with rows ordered by id.

## Next
Master `Database/sync/pull_diary.py` switches from anon PostgREST to this fn before 227 drops the public read policies.
