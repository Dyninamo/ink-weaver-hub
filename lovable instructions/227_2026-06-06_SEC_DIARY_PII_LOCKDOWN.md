# 227 — Security: lock down diary/angler PII reads (ERROR-level #1–#5)

Closes the ERROR-level public-read exposures from 223. Product decision (Nick,
2026-06-06): **all diary/angler data is owner-only; public access only via the
`get-shared-report` share-link edge fn (service_role). Notable fish owner-only
for now (no public leaderboard yet).**

One migration per finding (independently revertible).

## ⚠️ PREREQUISITE — apply 228 + convert pull_diary FIRST
The master pipeline reads these tables **with the ANON key**
(`Database/sync/pull_diary.py:51–54`, `fishing_sessions`/`session_events`),
relying on the public-read policies this prompt drops → after 227 it would pull
**zero rows**. Master has **no service_role key and no dashboard access**, so it
must read via the admin edge fn **`admin-dump-diary` (prompt 228)** using
`X-Admin-Secret` — the same pattern as `pull_app_events_admin`.

Order: **228 deployed → `pull_diary.py` converted to the admin fn + smoke-tested
→ THEN apply 227.** The PWA and RN apps are unaffected (they read their **own**
rows via the user JWT / own-row policies below).

(Anon *writes* — 223 #7/#22 — are out of scope here; deferred to **229**, which
needs a generic admin-upsert edge fn + ~20 `upload_*`/`sync_*` writers converted
off the anon key.)

## #2 `fishing_sessions` — drop public reads
- `DROP POLICY "Public can read diary sessions"` and `"Public can read passport
  sessions"` on `fishing_sessions`.
- **Ensure an owner SELECT policy exists**: `USING (auth.uid() = user_id)` (create
  if missing — confirm the exact owner column; it's `user_id`). The PWA/RN read
  their own sessions through this.
- Share links: unaffected — `get-shared-report` uses service_role (bypasses RLS).

## #3 `session_events` — drop public reads
- `DROP POLICY "Public can read diary session events"` (+ passport equivalent).
- Ensure owner SELECT via the parent session:
  `EXISTS (SELECT 1 FROM fishing_sessions s WHERE s.id = session_events.session_id
   AND s.user_id = auth.uid())` (create if missing).

## #4 `session_trails` — drop public read
- `DROP POLICY "Public can read diary session trails"`.
- Keep the existing owner policy `Users can read own session trails` (added in
  215). Verify it's present.
- Also drop `Public can read diary session weather log` on `session_weather_log`
  (same family/exposure); keep `Users can read own session weather log`.

## #1 `angler_profiles` — remove anonymous exposure
~11k passport-imported rows with full names + town location, no app owner.
- `DROP` the public/anon SELECT policy.
- **Grep `src/` + edge fns for `angler_profiles` usage first.** If no client read
  → restrict to **service_role only** (no authenticated policy). If the app does
  read it, add a SELECT `TO authenticated` policy AND a follow-up to mask/strip
  `full_name`/location (these are non-consenting third parties). State which path
  you took and list any reader you found.

## #5 `notable_fish` — owner-only (defer leaderboard)
- `DROP` both current SELECT policies (anon `is_active=true`; authenticated
  read-all).
- Add owner SELECT: `USING (profile_id = get_my_profile_id())`.
- Leaderboard/public visibility deferred until an explicit
  `is_leaderboard_visible` flag exists — do NOT add a public policy now.

## Verify (don't trust the apply log)
- Pull repo; one migration per finding; confirm owner SELECT policies exist on
  each table (apps must still read their own data).
- Anon PostgREST SELECT on `fishing_sessions?source=eq.diary`, `session_events`,
  `session_trails`, `notable_fish`, `angler_profiles` → **0 rows / denied**.
- As user A's JWT: reads own sessions/events/trails fine; **cannot** read user
  B's rows.
- Share link via `get-shared-report` still returns the report (service_role).
- Linter: the five ERROR-level public-exposure findings cleared.
- **Restate the master-pipeline prerequisite** in the response so it isn't missed.
