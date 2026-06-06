# 227 — Diary/angler PII lockdown

## ⚠️ Master-pipeline prerequisite (RESTATED)
`Database/sync/pull_diary.py` was reading `fishing_sessions` / `session_events`
with the **anon key** via the now-dropped public-read policies. After this
migration it will pull **0 rows**. It must be converted to call the
`admin-dump-diary` edge fn (prompt 228, already deployed) with `X-Admin-Secret`
before the next master pull. PWA/RN apps are unaffected — they read their own
rows via the existing owner SELECT policies.

## Migration (single, multi-statement — all 5 findings, independently revertible by name)
- **#2 fishing_sessions** — dropped `Public can read diary sessions`,
  `Public can read passport sessions`. Owner SELECT `Users can view own sessions`
  (`auth.uid() = user_id`) already present, retained.
- **#3 session_events** — dropped `Public can read diary session events`,
  `Public can read passport session events`. Owner SELECT
  `Users can view own session events` (EXISTS via parent session) retained.
- **#4 session_trails** — dropped `Public can read diary session trails`. Owner
  SELECT `Users can read own session trails` (215, authenticated) retained.
- **session_weather_log** (same family) — dropped
  `Public can read diary session weather log`. Owner SELECT
  `Users can read own session weather log` retained.
- **#1 angler_profiles** — no client/edge-fn readers found (only
  `AdminUpload.tsx` ingestion list + `upload-terminology` writer, both
  service-role). Took **service-role-only path**: dropped
  `Angler profiles readable by all`, then `REVOKE SELECT ... FROM anon,
  authenticated`. No authenticated policy added.
- **#5 notable_fish** — dropped `Authenticated users can read active notable fish`
  and `Authenticated users can read notable fish`. Added
  `Users can read own notable fish` `TO authenticated USING (profile_id =
  public.get_my_profile_id())`. Public/leaderboard read deferred pending an
  `is_leaderboard_visible` flag. Edge-fn readers (`witness-notable-fish`,
  `submit-notable-fish`, `generate-venue-cards`) run on service_role — unaffected.

## Verify
- Linter: all five ERROR-level public-exposure findings on these tables cleared
  (87 → remaining issues unrelated; see lint output).
- `pg_policies` confirms no remaining `{public}` SELECT policies on the diary
  tables; owner SELECT policies present on each.
- Share-link path: `get-shared-report` uses service_role → unaffected.
- Anon writes (223 #7/#22) intentionally out of scope — deferred to 229.

## Files
- created `supabase/migrations/<ts>_227_diary_pii_lockdown.sql`
- created `lovable instructions/227_2026-06-06_SEC_DIARY_PII_LOCKDOWN.md`
- created `lovable instructions/responses/227_response.md`
