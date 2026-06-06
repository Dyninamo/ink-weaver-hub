# 226 — Sensitive-data RLS hardening

One migration per finding. Service-role paths untouched throughout.

## #6 user_profiles own-row + public_profiles view
- Dropped `Authenticated users can read profiles` (was `USING (auth.role()='authenticated')` → exposed `mobile_number`, `notification_push_token`, `two_factor_enabled`, all defaults across users).
- Added `Users can read their own profile` `USING (auth.uid() = id)`.
- Created view `public.public_profiles(profile_id, display_name, avatar_url)` with `security_invoker = false` so it bypasses the new own-row RLS — the only way to expose those three "public" columns to other users.
- `GRANT SELECT ON public.public_profiles TO authenticated, anon`.

### Live-UX impact
- PWA `useProfile`, `AuthContext`, `Settings`, `DisplayNameGate`, `CoachBanner`, `OnboardingWizard`, `ActiveSessionShell`, `SetupWizard`, `DebugPanel` all read `user_profiles` with `id = auth.uid()` → unaffected.
- Social components read **other** users' display_name/avatar via FK joins (`GroupDetail`, `GroupsFeedTab`, `ThreadView`, `InviteDialog`, `VenueFeedTab`). These currently render in `/social` & `/leaderboard`, both of which redirect to `/diary` (prompt 186) — so no live page breaks. When social is re-enabled, repoint those queries from `user_profiles(...)` joins to `public_profiles` (PostgREST can't auto-resolve the relationship via a view, so the join syntax will need to be rewritten as separate fetches keyed by `profile_id`). **Not repointed in this prompt** — flagging explicitly.

### Linter note
The view re-introduces 1 ERROR for `0010_security_definer_view`. Intentional — required to expose the public columns past own-row RLS.

## #14 share_views PII drop
- `ALTER TABLE public.share_views DROP COLUMN viewer_ip, viewer_email`.
- Patched `supabase/functions/get-shared-report/index.ts` (~L125): removed the `x-forwarded-for` parse, the `auth.admin.getUserById` lookup for the viewer's email, and the `viewer_ip` / `viewer_email` payload fields. Insert now records only `shared_report_id`. View-owner analytics still see the row count via the existing `View own share analytics` SELECT.

## #15 venue_email_searches restrict to service_role
- Dropped `ves_read_authenticated`. No other SELECT policy → only `service_role` (and admin tooling using it) can read. `rg "venue_email_searches" src` confirmed zero PWA reads — only edge fn `find-venue-email` writes it via service_role.
- Linter now reports INFO `rls_enabled_no_policy` for this table; intentional (admin-only).

## #16 venue_outreach own-rows
- Dropped `vo_read_authenticated`.
- Added `vo_read_own` (`SELECT TO authenticated USING (user_id = auth.uid())`). Service-role unaffected.

## #17 verification_codes hardening
- Added nullable `code_hash text` column; dropped `NOT NULL` on `code` so future SMS edge functions can store a hash instead of the plaintext code.
- Added `service_role_delete_verification_codes` DELETE policy.
- Added `public.purge_expired_verification_codes()` SECURITY DEFINER helper (deletes rows >1h past expiry). `EXECUTE` revoked from `anon` / `authenticated`; callable only by service_role / cron.
- **No SMS send/verify edge function exists** in `supabase/functions/` — nothing to update today. When one is added, it MUST:
  1. Hash the SMS code (e.g. `sha256(code+user_id)`) and write `code_hash` instead of `code`.
  2. Verify by hashing the user-supplied code and comparing against `code_hash`.
  3. Call `purge_expired_verification_codes()` on successful verify (or schedule via cron).

## Repointed reads (per spec ask)
- `supabase/functions/get-shared-report/index.ts` — share-view insert no longer writes viewer PII (only field needed).
- **No user_profiles cross-user reads repointed** — see #6 social note.

## Verify
- Linter delta: 83 → 87 issues. New entries: 1 ERROR (intentional `public_profiles` view), 2 WARNs (RLS-no-policy on `venue_email_searches` after dropping its only SELECT, already restrictive), plus the unrelated `verification_codes` policy count shift.
- As user A: cannot select user B from `user_profiles`; can select B from `public_profiles` (display_name/avatar only).
- `share_views` columns: `id, shared_report_id, viewed_at` only — `\d share_views` confirms.
- `venue_email_searches` / `venue_outreach` no longer readable by a normal authenticated session.
