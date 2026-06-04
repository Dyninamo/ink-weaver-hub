# 216 — PWA: capture a GPS trail during a live in-session recording

When a session is recorded **in the PWA** (phone browser, at the water), capture
a passive GPS trail so that catches added/edited later can be auto-placed from it
(prompt 217). This mirrors the RN app, which records a background trail and is the
data source for GPS-derived catch locations. Without this, PWA-native sessions
have no trail and derivation can't work for them.

## What to build
While a diary session is **active** (the live-session shell — see
`src/components/diary/ActiveSessionShell.tsx` and how `LiveSessionLayer` already
reads live position), run a throttled `navigator.geolocation.watchPosition` and
persist points to `session_trails`.

- **Permission:** request browser location on session start with a clear,
  one-line rationale ("Records your track so catches you add later land in the
  right spot"). If the user declines, the session still works — just no trail
  (derivation falls back to manual/blank, exactly like RN). Never block logging
  on location.
- **Throttle (match RN):** keep a point only if **≥30s** since the last kept
  point **OR ≥5m** moved (Haversine). This keeps the trail sparse when the angler
  is stationary — which is fine, because interpolation is *most* accurate when
  they didn't move.
- **Persist:** buffer points in memory and flush to `session_trails` via the
  Supabase client (RLS, owner-scoped — prompt 215). Either insert incrementally
  in small batches during the session, **or** push the whole buffer once on
  session end via the `upload-diary-trail` edge function — pick whichever fits the
  existing end-session flow (`endSession` in `diaryService`) with least risk.
  Each row: `session_id`, `timestamp` (ISO), `latitude`, `longitude`, `accuracy`,
  `altitude` (if available), `sort_order` (chronological index).
- **Cleanup:** stop the `watchPosition` watcher on session end / unmount. Don't
  leak watchers across sessions.

## Constraints
- Do not regress the existing live-session map (`LiveSessionLayer` still draws
  from event coords). The trail is additive background data.
- Bound it: never store more than ~5000 points/session (the edge fn caps this
  too); a 30s cadence over a long day is well under that.

## Verify
- On a phone, start a PWA session, grant location, walk ~50m, log a catch, end
  the session. Confirm `session_trails` has multiple rows for that `session_id`
  with sane lat/lon and ascending `sort_order`.
- Decline location on a fresh session → session records normally, zero trail
  rows, no errors.
- Confirm the watcher is removed after the session ends (no console geolocation
  callbacks firing post-session).

## Context
Pairs with 215 (table/RLS/edge fn) and 217 (derive-from-trail consumer). The RN
side pushes its own trail separately (`network/uploadTrail.ts`), so both surfaces
populate the same table.
