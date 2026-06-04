# 216 — PWA in-session GPS trail capture

## New `src/lib/useSessionTrailRecorder.ts`
- `useSessionTrailRecorder(sessionId)` opens `navigator.geolocation.watchPosition`
  with `{ enableHighAccuracy: true, maximumAge: 10s, timeout: 30s }`.
- Throttle (matches RN): keep a point only if `≥30s` since last kept OR `≥5m`
  moved (Haversine). Stationary anglers stay sparse, as intended.
- Buffer capped at `MAX_POINTS=5000`.
- Permission-denied / unavailable / timeout errors are swallowed
  (`console.info`) — never blocks logging.
- Returns `{ flush }`: invokes `upload-diary-trail` with the buffer, clears on
  success, keeps the buffer (warns) on failure for next flush attempt. Skips
  the call entirely on an empty buffer so we don't wipe an RN-pushed trail for
  the same session.
- Unmount: `clearWatch` then fire-and-forget `flush()`.

## `ActiveSessionShell.tsx`
- Imports the hook; calls it with `sessionId`.
- `handleConfirmEnd` awaits `trailRecorder.flush()` *before* `endSession` —
  best-effort, wrapped in try/catch so a flush failure can't block end-session.

## Notes
- No UI for permission rationale yet — relying on the native browser prompt
  triggered by `watchPosition`. The strings in the prompt spec
  ("Records your track so catches you add later…") would require a custom
  pre-permission sheet; flagged for a follow-up if you want one.
- LiveSessionLayer untouched.
