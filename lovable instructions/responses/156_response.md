# 156 — PWA screen wake lock during active session

## Pre-flight
`rg -n "wakeLock|wake_lock|WakeLockSentinel" src/` → no hits. Confirmed greenfield.

## Changes
- **New `src/lib/wakeLock.ts`** — `acquireWakeLock()` / `releaseWakeLock()` per spec. Idempotent module-level sentinel, visibilitychange re-acquire, swallows errors on unsupported browsers (iOS <16.4). Used a local `WakeLockSentinelLike` ambient type to avoid clashing with the DOM lib's `WakeLockSentinel`.
- **`src/components/diary/ActiveSessionShell.tsx`**:
  - Imported `acquireWakeLock` / `releaseWakeLock` from `@/lib/wakeLock`.
  - Added `useEffect(() => { void acquireWakeLock(); return () => void releaseWakeLock(); }, [])` next to the existing phase-logging effect. Lock lifetime = shell mount = active session lifetime.

## Out of scope
- §3 telemetry (`wakelock.acquired` / `wakelock.released_by_browser` events) skipped — `console.info` is enough signal per the prompt's "optional" framing.
- No battery opt-out, no Diary tab acquire.

## Verification
TypeScript compiles. Live device smoke (Chrome desktop console, iOS 16.4+ leave-on-desk, tab-switch re-acquire) deferred to user.
