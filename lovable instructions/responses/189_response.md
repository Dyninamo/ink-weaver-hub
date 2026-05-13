# 189 — get-ai-advice-v2: venues_new lookup + river/stillwater AI prompt

## §1 — Venue lookup (lines 525-541)
- Switched from `venue_metadata` (`%${venue_name}%`, `.single()`) to `venues_new` exact ilike `.maybeSingle()`.
- Now selects `venue_id, name, latitude, longitude, water_type_id, level, river_name`.
- Captures `venueWaterTypeId`, `venueLevel`, `venueRiverName` for §2.
- Note: `venueId` is now TEXT not UUID — downstream `session_summaries.venue_id` join may need separate alignment (out of scope).

## §2 — AI prompt branching (lines 953-963 + line 1016)
- Added `isRiver` derivation from `venueLevel ∈ {river, beat, section}` or `venueWaterTypeId ∈ {3,4,5,6,9}`.
- `venueDescriptor` now reads "UK river fly fishing (River X)" or "UK stillwater fly fishing".
- `terminologyHint` swaps stillwater (buzzer/blob/washing line) ↔ river (upstream nymph, French leader, duo, Klink-and-dink) terminology.
- Home/archetype branch (line 390-417) untouched per spec.

## §3 — Smoke test
Deferred to runtime — function deploys automatically. River Wye Aramstone & Bewl Water can be exercised from PWA pre-session flow to verify.
