# 223 — Security findings for Claude Code review

Snapshot of the Lovable security scan on 2026-06-06. Each finding lists scanner, level, internal_id, and remediation hint. Review and propose migrations/policy changes; do not auto-apply — several items (e.g. notable_fish public visibility, diary session public reads) are intentional product behaviour and need product sign-off before tightening.

Scanners: `supabase` (Postgres linter), `supabase_lov` (Lovable deep scan), `connector_security_scan` (clean).

---

## ERROR level

### 1. `supabase_lov` / `angler_profiles_full_name_exposure`
`angler_profiles` is publicly readable with no auth. ~11,000 rows contain full unmasked names and town-level location, imported from passport source without explicit consent.
**Fix:** Restrict SELECT to authenticated, or to owning user (`user_id = auth.uid()`), or anonymise names before public exposure.

### 2. `supabase_lov` / `fishing_sessions_public_gps_exposure`
"Public can read diary sessions" + "Public can read passport sessions" policies expose GPS (`latitude`, `longitude`, `gps_start_lat`, `gps_start_lon`), angler names, locations, notes, movement data to anon.
**Fix:** Drop the public policies or replace with a view that strips location/personal columns. Confirm with product: share-link flow needs continued read via `get-shared-report` edge fn (service_role), not anon SELECT.

### 3. `supabase_lov` / `session_events_public_gps_exposure`
`session_events` allows anon SELECT for diary/passport sessions. Exposes per-cast lat/lon, `photo_url`, `voice_transcript`.
**Fix:** Same pattern as fishing_sessions — drop public policies, route share access via edge function.

### 4. `supabase_lov` / `session_trails_public_gps_tracking`
`session_trails` allows anon SELECT for diary sessions. Each row = timestamped lat/lon/altitude/bearing/pressure → full movement trace per angler.
**Fix:** Restrict SELECT to session owner; expose via share-link edge fn only.

### 5. `supabase_lov` / `notable_fish_cross_user_read`
Two SELECT policies: anon reads `is_active = true`; any authenticated user reads all rows. Includes `photo_url`, EXIF lat/lon, device, weight, profile_id.
**Fix:** Restrict to `profile_id = get_my_profile_id()` for private rows; keep a narrower public policy for leaderboard-visible entries only (likely needs a `is_leaderboard_visible` flag).
**Note:** Notable fish *are* a public/social feature — confirm product intent before restricting.

### 6. `supabase_lov` / `user_profiles_cross_user_mobile_exposure`
`Authenticated users can read profiles` exposes `mobile_number`, `two_factor_enabled`, `notification_push_token`, default config to every logged-in user.
**Fix:** Restrict SELECT to `auth.uid() = id`; create a public view exposing only `profile_id`, `display_name`, `avatar_url` for social features.

### 7. `supabase_lov` / `service_write_policies_allow_anonymous_writes`
Many tables have `ALL` policies with `USING (true)` granted to `public` (which `anon` inherits): `venues_new`, `weather_daily`, `reports_enriched`, `fly_water_type_monthly`, `fly_water_types`, `flies`, `report_seasonal_fly_rankings`, `report_condition_fly_rankings`, `stillwater_condition_modifiers`, `river_condition_modifiers`, `river_seasonal_baselines`, and more.
**Fix:** Restrict each to `service_role` only, or add `auth.role() = 'service_role'` guard. Audit the full list before migration.

### 8. `supabase` / `SUPA_security_definer_view`
A view is defined with SECURITY DEFINER and enforces the creator's permissions/RLS instead of the caller's. Identify which view (likely `diary_as_reports` per memory) — switch to `security_invoker = true` if not already.

---

## WARN level

### 9. `supabase_lov` / `diary_logs_bucket_missing_ownership_check`
`diary_logs_user_upload` / `diary_logs_user_update` only check `bucket_id`. Any authenticated user can overwrite any path.
**Fix:** Add `(storage.foldername(name))[1] = auth.uid()::text` like the avatars bucket.

### 10. `supabase_lov` / `diary_logs_bucket_missing_select_delete`
Private bucket has no SELECT/DELETE policies → owners cannot read/delete own files.
**Fix:** Add owner-scoped SELECT + DELETE policies with path-based ownership.

### 11. `supabase_lov` / `session_transcripts_bucket_missing_select_delete`
Private bucket: only INSERT/UPDATE exist, both anonymous and unrestricted. No SELECT/DELETE.
**Fix:** Remove anon writes, add owner-scoped INSERT/SELECT/DELETE.

### 12. `supabase_lov` / `query_cache_anon_delete`
`anon_delete_cache` lets any anon DELETE all rows.
**Fix:** Drop the policy or restrict to service_role.

### 13. `supabase_lov` / `session_weather_log_anon_insert`
`Anon can insert into session_weather_log` with `WITH CHECK (true)` → anyone can poison weather data for any session_id.
**Fix:** Verify session ownership in WITH CHECK, or remove anon insert; route through `poll-session-weather` edge fn instead.

### 14. `supabase_lov` / `share_views_ip_email_exposure`
`viewer_ip` and `viewer_email` stored for shared-report viewers without consent.
**Fix:** Drop those columns, or gate on explicit consent banner.

### 15. `supabase_lov` / `venue_email_searches_exposure`
`ves_read_authenticated` exposes scraped venue contact emails to any logged-in user.
**Fix:** Restrict SELECT to service_role; admin UI should call via edge fn.

### 16. `supabase_lov` / `venue_outreach_email_exposure`
`vo_read_authenticated` exposes outreach `email_to`, `user_id`, status to all authenticated users.
**Fix:** Restrict SELECT to `user_id = auth.uid()` or service_role.

### 17. `supabase_lov` / `verification_codes_sensitive_data`
SMS codes stored in plaintext; no DELETE policy → expired codes accumulate.
**Fix:** Hash codes before insert; add DELETE policy + periodic purge of expired rows.

### 18. `supabase` / `SUPA_anon_security_definer_function_executable`
One or more SECURITY DEFINER functions are EXECUTE-able by `anon`.
**Fix:** `REVOKE EXECUTE ... FROM anon` unless intentionally public (e.g. `increment_share_view`, which is intentional per memory).

### 19. `supabase` / `SUPA_authenticated_security_definer_function_executable`
SECURITY DEFINER functions EXECUTE-able by `authenticated`.
**Fix:** Audit each; revoke if not meant to be user-callable.

### 20. `supabase` / `SUPA_function_search_path_mutable`
At least one function does not set `search_path`. Audit `pg_proc` for functions missing `SET search_path = public` and amend.

### 21. `supabase` / `SUPA_public_bucket_allows_listing`
A public bucket has a broad SELECT policy on `storage.objects` enabling listing of all files. Likely `avatars`. Tighten SELECT to specific path prefixes or remove listing capability.

### 22. `supabase` / `SUPA_rls_policy_always_true`
Permissive `USING (true)` / `WITH CHECK (true)` on INSERT/UPDATE/DELETE policies. Overlaps with finding #7 — same audit.

### 23. `supabase` / `SUPA_auth_leaked_password_protection`
HIBP password check disabled. Enable via `supabase--configure_auth` with `password_hibp_enabled: true` (no UX change for users beyond rejection of pwned passwords at signup/reset).

---

## Suggested order for Claude Code

1. **Quick wins** (no product impact): #12, #13, #18, #20, #22, #23, #8.
2. **Storage hardening**: #9, #10, #11, #21.
3. **Sensitive data**: #6, #14, #15, #16, #17, #19.
4. **Public-data redesign** (needs product sign-off + edge-fn rewrites for share links): #1, #2, #3, #4, #5, #7.

## Out of scope
No code changes here — this file is for review. Migrations should be split per finding so each can be reverted independently.
