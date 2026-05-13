# 191 — batch-recompute: venues_new venue resolution

## §1 — Drop `venue_metadata` upfront fetch (lines 623-630)
Replaced the bulk `from('venue_metadata').select('id,name')` + early-400 with a comment. Resolution now happens per-session in `computeOneSession` (mirrors `compute-session-summary`).

## §2 — Per-session venue chain in computeOneSession (lines 463-516)
New chain (matches compute-session-summary lines 573-607):
1. `session_venue_map.venue_id` for `session_venue_name = session.venue_name`.
2. `venues_new.venue_id` ilike exact `name`.
3. `user_profiles.home_venue_id` for `session.user_id`.

Soft-skip (`return { venueId: '', ... }`) when none resolves — no longer throws.

Signature: dropped the `venues: any[]` param; `venue` const preserved as `{ id: venueId }` so downstream `venue.id` reads unchanged.

## §3 — Batch loop (lines 633-660)
- Removed `venues` arg at call site.
- New `skippedNoVenue` counter increments when `result.venueId === ''`; pair/venue Sets unchanged.
- Response payload adds `skipped_no_venue` and subtracts skips from `processed`.

## §4 — Smoke test
Deferred to runtime — fire `/admin/recompute` → expect `processed` ≈ batch.length, `failed` near zero, `skipped_no_venue` only for genuinely venue-less rows. Passport backfill of session_summaries unblocked once 192 is in place (already applied).

## Out of scope
- `venue_metadata` table teardown.
- Schema alignment of `session_summaries.venue_id` (TEXT vs UUID).
- `Run-until-empty` UI button.
