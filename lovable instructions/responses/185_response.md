# 185 — Robustness bundle

## §1 Periodic weather repoll
- `src/components/diary/ActiveSessionShell.tsx`: added 10-min `setInterval` after wake-lock effect, calls `pollSessionWeather(sessionId)` while `document.visibilityState === "visible"`.

## §2 `??` for numeric/string weather fields
- `src/components/social/ShareSessionDialog.tsx` lines 115-121: `||` → `??` for top_fly_1, top_fly_2, method, conditions_temp_c, conditions_wind, conditions_weather. `personal_note` kept on `||` (intentional empty-string-as-null).

## §3 SW SPA fallback + cache version bump
- `public/sw.js`: bumped `CACHE_NAME` to `fishing-intel-v2`. Fetch handler now distinguishes navigation requests, falls back to cached `/` for offline navigations, returns synthetic 503 last-resort.

## §4 Independent setup-rollback try/catch
- `src/pages/DiaryNew.tsx` lines 361-377: each rollback wrapped in its own try/catch with `logEvent("error", { context: "session_start_rollback_*" })`.

## §5 useShareLink unwraps FunctionsHttpError
- `src/hooks/useShareLink.ts`: both `shareSession` and `shareGroupInvite` now inspect `error.context.status` for 404 / 401 / 403 with friendly toasts; clipboard fallback wrapped in try/catch with manual-copy toast.

## Out of scope (per prompt)
- Satisfaction-score UI, multi-rod is_active filter risk, legacy --event-* CSS sweep — deferred.
