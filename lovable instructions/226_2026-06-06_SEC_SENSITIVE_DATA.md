# 226 — Security: sensitive-data RLS (contact info, profile PII, SMS)

From the 223 review. Separate migration per finding. Master Python uses
service_role (unaffected). The social layer is currently disabled in the live UI
(/social and /leaderboard redirect to /diary), so tightening profile/email reads
has minimal live-UX risk today — but still create the public view in #6 so social
works when re-enabled.

## #6 `user_profiles_cross_user_mobile_exposure`
`Authenticated users can read profiles` exposes `mobile_number`,
`two_factor_enabled`, `notification_push_token`, default config to every logged-in
user. Fix:
- Replace the read-all SELECT with **own-row only**: `USING (auth.uid() = id)`.
- Create a **public-safe view** (e.g. `public_profiles`) exposing ONLY
  `profile_id, display_name, avatar_url`; grant SELECT to authenticated. Repoint
  any social/group/card queries that read *other* users' display name/avatar to
  the view (grep `from('user_profiles')` / `user_profiles` joins in src + edge
  fns). List what you repointed.

## #14 `share_views_ip_email_exposure`
`viewer_ip` / `viewer_email` are stored for shared-report viewers without consent.
Preferred: **drop both columns** (and stop writing them in the share-view path).
If analytics need them, gate behind an explicit consent flag — but default to
dropping. Update `increment_share_view` / share-view insert accordingly.

## #15 `venue_email_searches_exposure`
`ves_read_authenticated` exposes scraped venue contact emails to any logged-in
user. Restrict SELECT to **service_role** (admin tooling reads via edge fn /
admin secret). Confirm no PWA component reads this client-side (grep
`venue_email_searches`).

## #16 `venue_outreach_email_exposure`
`vo_read_authenticated` exposes outreach `email_to`, `user_id`, status to all
authenticated users. Restrict SELECT to `user_id = auth.uid()` OR service_role.

## #17 `verification_codes_sensitive_data`
SMS codes stored plaintext; no DELETE policy → expired codes accumulate. Fix:
- **Hash codes** before insert (compare hash on verify) — update the
  send/verify edge fns accordingly.
- Add a DELETE policy (service_role) + purge expired rows (cron or on-verify).
- Keep the existing own-row SELECT/INSERT policies.

## Verify
- Pull repo; one migration per finding.
- As user A: cannot read user B's `mobile_number`/push token; `public_profiles`
  returns only display_name/avatar. `venue_email_searches`/`venue_outreach`/
  `share_views` PII not readable by a normal authenticated user.
- Verification still works end-to-end with hashed codes; expired codes purge.
- List every app/edge-fn read you had to repoint (esp. #6 profile view).
