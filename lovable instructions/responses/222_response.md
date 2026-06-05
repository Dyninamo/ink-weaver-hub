# 222 — PWA polish: 4 fixes

## A — Settings panels (replace toasts)
`src/pages/Settings.tsx`:
- Added `storageOpen` / `howOpen` state, wired the two `NavRow` `onClick`s to open Dialogs.
- **What we store**: itemised list of what is and isn't stored, plus contact line.
- **How this works**: 4-step ordered list (start → log → review → smarter advice). Both dialogs use the existing `Dialog` primitives.

## B — Diary header global fish count
`src/pages/Diary.tsx`:
- The prompt referenced a `stats.totalFish` that doesn't exist (the per-session `stats` object only lives on each `SessionCard`). Instead, added a `globalFishCount` state populated by a head-count query against `session_events` filtered to `event_type='catch'` joined to `fishing_sessions.user_id = user.id`. Refetched when `user` or `sessions.length` changes (so adding/removing a session updates the header).
- Removed the page-local `totalFishAcrossLoaded` reduce; header now reads `{totalCount} sessions · {globalFishCount} fish` — identical across pages.

## C — Dialog/Sheet a11y
- `src/components/map/VenuePeekSheet.tsx`: imported `SheetTitle` + `SheetDescription`, added both as `sr-only` (venue name as title, "Venue details and quick actions" as description). Keeps current visual layout, satisfies Radix.
- `src/pages/DiaryEntry.tsx`: imported `DialogDescription`. Added `sr-only` descriptions to both the catch add/edit dialog (line ~914) and the delete-session confirm dialog (line ~857).

## D — ShareView refetch loop on 404
`src/pages/ShareView.tsx`:
- Added a `resolved` gate. The `useEffect` now returns early when `resolved` is true, so auth-state ticks no longer re-fire the request once a definitive outcome (success, 404/expired, or 401/403) has been reached.
- Definitive errors set `resolved = true`; only transient/unknown errors leave it false so the next auth tick can retry.
- Downgraded the 404/expired log path from `console.error` to `console.info` (normal user condition). 401/403 logs at `warn`. Genuine errors still `console.error`.

## Verify
- TypeScript: `bunx tsc --noEmit` clean.
