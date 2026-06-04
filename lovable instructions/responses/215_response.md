# 215 — session_trails RLS + upload-diary-trail

## Part A — Migration
RLS was already ON for `session_trails`, with public-read for diary trails and
owner-SELECT for authed users. Findings + changes:
- **Dropped** `"Anon can insert session_trails"` (`TO anon WITH CHECK (true)`),
  which would have let any visitor write arbitrary trail rows.
- Added owner-scoped INSERT + DELETE policies (`authenticated`), keyed via
  `EXISTS (SELECT 1 FROM fishing_sessions s WHERE s.id = session_trails.session_id
  AND s.user_id = auth.uid())`, mirroring `session_events`.
- Added `"Service role can manage all trails"` (`TO service_role`) for the edge
  function path.
- No UPDATE policy (replace-semantics).

Linter returned only pre-existing project-wide findings (security-definer views,
mutable search_path warnings, permissive INSERT/UPDATE policies elsewhere); none
introduced here.

## Part B — Edge function `upload-diary-trail`
New `supabase/functions/upload-diary-trail/index.ts`:
- Dual-path gate (admin secret OR any signed-in user JWT) identical to
  214's pattern.
- Ownership guard via `fishing_sessions` (404 / 403 as spec).
- Input validation: `session_id` required; `points` array required (empty
  allowed); `MAX_POINTS=5000` → 400 if exceeded; per-point coercion (finite
  lat/lon + parseable timestamp); accuracy/altitude optional → null.
- Sorts by `timestamp` ASC, assigns `sort_order = index`.
- Replace semantics: `DELETE WHERE session_id` then INSERT cleaned points;
  empty input → 200 `{inserted:0}` with the delete still applied.
- Service-role client, CORS + OPTIONS, `requireEnv` only.

Edge function deployed.
