# 162 — rod-index 0-based unification

## Diff
- `src/pages/DiaryEntry.tsx:66` — `useState<number>(1)` → `useState<number>(0)`
- `src/components/diary/ActiveSessionShell.tsx:186` — `rodIndex={Math.max(0, activeRodIndex - 1)}` → `rodIndex={activeRodIndex}`
- `src/components/diary/RodPickerSheet.tsx:70` — `(e as any).rod_index ?? 1` → `(e as any).rod_index ?? 0`

Display labels left as-is per §4. No backfill triggered; flag if production tally rows for old single-rod sessions are bucketed under non-existent rod_index=1.
