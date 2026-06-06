# 224 — Security DB/policy quick wins

One migration per finding, per spec.

## #12 query_cache anon delete
- Dropped policy `anon_delete_cache` on `public.query_cache`.
- Writers verified: `supabase/functions/get-venue-advice/index.ts` is the only writer; runs with service_role (unaffected).

## #13 session_weather_log anon insert
- Dropped policy `Anon can insert session_weather_log` on `public.session_weather_log`.
- Path investigation: `rg "session_weather_log" supabase/functions` returned **no edge-fn writers** (only the types file). `poll-session-weather` writes weather to `fishing_sessions.i`, not this table. The anon-insert policy was unused — safe to drop. Existing SELECT policies (`Users can read own session weather log`, `Public can read diary session weather log`) left intact.

## #18 SECDEF anon EXECUTE
REVOKE EXECUTE FROM anon on:
- `handle_new_user()`, `auto_end_stale_diary_sessions(int)`, `clear_table(text)`, `increment_notable_fish_witnesses(uuid)`
- `get_my_profile_id()`, `get_my_group_ids()`, `is_group_admin(uuid)`, `current_user_managed_venue_ids()`, `current_user_writable_venue_ids()`

**Intentionally kept anon-EXECUTE**: `increment_share_view(text)` (per project memory — share-view counter for unauth share links).

## #19 SECDEF authenticated EXECUTE
REVOKE EXECUTE FROM authenticated on:
- `handle_new_user()` (auth trigger)
- `auto_end_stale_diary_sessions(int)` (cron / admin)
- `clear_table(text)` (admin upload edge fns, service_role)
- `increment_notable_fish_witnesses(uuid)` (`witness-notable-fish` edge fn, service_role)

**Kept callable by authenticated**: `get_my_profile_id`, `get_my_group_ids`, `is_group_admin`, `current_user_managed_venue_ids`, `current_user_writable_venue_ids` — referenced inside RLS policies (evaluated in caller's role); `increment_share_view` per memory. No client code in `src/` calls `.rpc(...)`, so no PWA path broken.

## #20 search_path mutable
`ALTER FUNCTION ... SET search_path = public` on the three non-SECDEF triggers that lacked it:
- `validate_contact_email_source()`
- `validate_ves_status()`
- `validate_vo_email_source()`

All SECDEF functions already had `search_path=public`.

## #8 SECURITY DEFINER view
Three views flagged (not just `diary_as_reports`). Recreated each with `security_invoker = true`:
- `diary_as_reports`
- `model_inputs_ready`
- `report_weather_summary`

`ALTER VIEW ... SET (security_invoker = true)` preserves view body; no callers relied on definer bypass (all are aggregations over RLS-protected base tables, queried by the owner).

## #23 HIBP
`supabase--configure_auth password_hibp_enabled: true`. Other auth flags left as-is (`auto_confirm_email=false`, `disable_signup=false`, `external_anonymous_users_enabled=false`).

## Verify (post-apply)
Linter delta: 91 → 88 → 85 issues. All 3 ERROR-level "Security Definer View" findings cleared. The 3 "Function Search Path Mutable" warns cleared. Remaining warnings are the policy-permissive (`USING (true)`) set tracked separately in 223 (#1–#7) and unrelated WARNs.

`increment_share_view` ACL unchanged (still anon EXECUTE) — confirmed via `pg_proc.proacl`.

## Service-role impact
None. All revokes target `anon` / `authenticated`; `service_role` retains EXECUTE on every function (default grant via `=X/postgres` ACL entry).
