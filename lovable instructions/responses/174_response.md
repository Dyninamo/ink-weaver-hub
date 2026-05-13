# 174 — Resolve and persist venue_id at session creation

## §1+§2 — DiaryNew.tsx
- Added placeholder-name guard at top of `handleCommit` (rejects `"", unknown, n/a, na, tbd"`; "Home" allowed). Toast: "Pick a venue before starting the session".
- Moved the `venues_new.ilike(name)` lookup into `proceedWithCreate` **before** the `createSession` call. Skipped for `"Home"` (case-insensitive) since Home is intentionally venue_id=null.
- `createSession` payload now includes `venue_id: matchedVenue?.venue_id ?? null` and `venue_name: trimmedVenue`.
- Removed the duplicate post-insert lookup at old L333-339; `on-session-logged` / `find-venue-email` now reuse the pre-resolved `matchedVenue`.

## §3 — Backfill migration
Applied `UPDATE fishing_sessions SET venue_id = v.venue_id FROM venues_new v WHERE venue_id IS NULL AND source='diary' AND lower(trim(venue_name)) = lower(v.name)`. Idempotent.

## §4 — Smoke (post-backfill)
`SELECT venue_name, count(*), count(venue_id) FROM fishing_sessions WHERE source='diary' GROUP BY venue_name`:

| venue_name | rows | with_venue_id |
|---|---:|---:|
| Unknown | 11 | 0 |
| Grafham Water | 4 | 4 |
| Home | 4 | 0 |
| Abbots Worthy | 2 | 2 |
| [TEST] Grafham Water | 1 | 1 |
| [TEST] River Usk | 1 | 0 |

All real venue rows resolved. Remaining NULLs: Home (intentional), Unknown (legacy — new sessions blocked by §2), `[TEST] River Usk` (no matching venues_new row).

## Out of scope
Fuzzy matching, session_venue_map population, server-side venue_name constraint — per §5.
