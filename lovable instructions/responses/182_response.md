# 182 — currentSetup hydrated from session_rods

## Changes

- **`src/services/diaryService.ts`** — Added `dropper_count` to `CurrentSetup`. Added `getCurrentSetup(sessionId, rodIndex, prefetchedEvents?)` helper that reads from `session_rods` (truth) and overlays event-only fields (rig/retrieve/spot/depth_zone).
- **`src/pages/DiaryEntry.tsx`** — Imports `getCurrentSetup`. Initial state includes `dropper_count: null`. Replaced lines 107-122 event-only hydration with a single `getCurrentSetup` call. `loadData` deps now `[id, activeRodIndex]`.
- **`src/components/diary/ActiveSessionShell.tsx`** — Imports `getCurrentSetup`. Rod-switch handler hydrates via helper. New effect fetches active `session_rods` row when `phase === "end_confirm"` and feeds `EndSessionConfirm.activeRod` so post-change line/rod weight is shown.
- **`src/components/diary/RodPickerSheet.tsx`** — Extended `SessionRod` interface with `rod_length_ft`, `line_profile`, `dropper_count`, `flies_on_cast`.
- **`src/components/diary/ChangeFlow.tsx`** — Replaced silent `console.warn` rod-sync failure with `toast.warning` (6s) on both branches.
