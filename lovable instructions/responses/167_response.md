# 167 — End-session syncing tied to actual completion

## EndSessionSyncing.tsx
- Props extended: `serverDone: boolean`, `serverError: string | null`, `onRetry: () => void`.
- Animation final timer now sets `animDone` instead of calling `onComplete` directly. A second effect fires `onComplete` only when `animDone && serverDone && !serverError`.
- Error state renders inline with a "Try again" button calling `onRetry`. "Still syncing… one moment." caption shown when animation finishes ahead of server.

## ActiveSessionShell.tsx
- Added `endSaveDone` and `endSaveError` state; `handleConfirmEnd` resets them, awaits `endSession`, sets `endSaveDone=true` on success or `endSaveError` on failure (no toast — surfaced in syncing screen).
- `<EndSessionSyncing>` now receives `serverDone`, `serverError`, `onRetry={handleConfirmEnd}`.

## Verification
- TS clean. Logic walked: fast-path (server resolves before anim) waits for anim; slow-path waits for server; failure shows retry; retry resets flags.
