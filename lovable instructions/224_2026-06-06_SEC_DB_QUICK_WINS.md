# 224 — Security: DB/policy quick wins (no product impact)

From the 223 security review. These are clear bugs with no intended-behaviour
risk. **Create a SEPARATE migration per finding** so each reverts independently.
This Supabase is shared by the RN app (reads as the authenticated user) and
master-side Python (writes via **service_role / admin secret**) — none of these
fixes may block service_role, and none should touch user-owned read paths.

## #12 `query_cache_anon_delete`
Policy `anon_delete_cache` lets any anon DELETE all rows. **Drop it** (or restrict
to `service_role`). Verify the app/edge fns that write the cache use service_role.

## #13 `session_weather_log_anon_insert`
`Anon can insert into session_weather_log` with `WITH CHECK (true)` → anyone can
poison weather for any `session_id`. **First confirm what writes this table**
(grep edge fns + RN for `session_weather_log`). If it's an edge fn (service_role),
drop the anon-insert policy. If RN inserts directly as the user, replace with a
`WITH CHECK` that verifies the session belongs to `auth.uid()`. Do NOT silently
break weather logging — state which path you found.

## #18 `SUPA_anon_security_definer_function_executable`
SECURITY DEFINER function(s) EXECUTE-able by `anon`. **Audit each**; `REVOKE
EXECUTE ... FROM anon` unless intentionally public. **Keep `increment_share_view`
public** (intentional per project memory). List every function you touch.

## #19 `SUPA_authenticated_security_definer_function_executable`
Same for `authenticated`. Audit each SECURITY DEFINER function; revoke EXECUTE
from `authenticated` for any not meant to be user-callable. List them; don't
revoke ones the PWA/RN actually call (e.g. `get_my_profile_id`-style helpers) —
check usage first.

## #20 `SUPA_function_search_path_mutable`
Functions missing `SET search_path`. Add `SET search_path = public` (or `= ''`
with schema-qualified refs) to every flagged function. Pure hardening.

## #8 `SUPA_security_definer_view`
A view uses SECURITY DEFINER (enforces creator's RLS, not caller's) — likely
`diary_as_reports`. Recreate it `WITH (security_invoker = true)` so it respects
the querying user's RLS. Confirm nothing relied on the definer bypass.

## #23 `auth_leaked_password_protection`
Enable HIBP pwned-password check (`supabase--configure_auth`
`password_hibp_enabled: true`). No UX change beyond rejecting breached passwords
at signup/reset.

## Verify (don't trust the apply log)
- Pull the repo; confirm one migration file per finding and that
  `increment_share_view` is still anon-EXECUTE-able.
- Runtime: anon DELETE on the query-cache table → denied; anon insert into
  `session_weather_log` → denied (or owner-gated). service_role paths unaffected.
- List, per finding, exactly which policies/functions changed.
