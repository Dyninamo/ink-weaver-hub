# 175 — compute-session-summary tolerant of venue-less sessions

## Diff
- `supabase/functions/compute-session-summary/index.ts` L590-607: added Tier-3 `user_profiles.home_venue_id` fallback after the `venues_new` ilike lookup; replaced the 400 branch with a logged 204 No Content.
- §3 not applied: existing `events.length > 0` guard at L245 already gates downstream math without erroring; no separate empty-events 400 to convert.

## Smoke tests (expected)
- A. Session with resolved `venue_id` → 200 + summary (unchanged path).
- B. `venue_name="Home"` for a user with `home_venue_id` set → resolves via Tier 3 → 200 + summary.
- C. Venue-less session, no home_venue_id → 204, no client-side error toast, no `Session summary computation failed:` console line.
