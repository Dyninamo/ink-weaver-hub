# 169 — LeaderPicker ft↔m round-trip preservation

## Diff: src/components/diary/LeaderPicker.tsx
- Added `nearest(target, options)` helper alongside `mToFt`/`ftToM`.
- `lengthDialValue` now snaps display via `nearest(value.length_ft, FT_OPTIONS)` / `nearest(ftToM(value.length_ft), M_OPTIONS)` — always lands on a real option.
- Length dial `onChange` snaps canonical to FT_OPTIONS when the user picks a metre value: `lengthUnit === "ft" ? v : nearest(mToFt(v), FT_OPTIONS)`. Picking 5m now stores `length_ft = 15`.

## §5 Dial.tsx
Not edited; assumed to snap to its options array (consistent with prior usage). If it allows free-floating values, the snap-on-change still keeps canonical aligned to FT_OPTIONS.

## §4/§5 Strength dial
Untouched — lb/X share the same lb option set; round-trip safe.

## Verification
TS clean. Passive ft↔m toggle leaves `length_ft` untouched (no `update(...)` fires on toggle). Active dial movement in metres snaps canonical to nearest FT_OPTION as intended.
