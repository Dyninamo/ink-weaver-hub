# 234 — Catch weight/length bounds + unified input

## Fix A + B — shared validator, unified input type
- New `src/lib/parseSize.ts` exports `parseWeight(raw)` / `parseLength(raw)` with strict numeric regex `^\d+(\.\d+)?$` (rejects `1e9`, multi-dot, signs, whitespace), bounds `0 < lb ≤ 50`, `0 < in ≤ 60`. Returns `{ ok, lb, oz, decimal, display, error }`.
- `CatchFlow.tsx` (in-session): inputs flipped from `type="number"` → `type="text" inputMode="decimal"`. `sizeLabel` / save payload now drive off the shared parser. Save disabled with inline destructive helper when value is non-empty and invalid.
- `CatchEditForm.tsx`: same parser wired in; inputs already used `Input` + `inputMode="decimal"`, now explicit `type="text"`. Inline error mirrored. Bespoke parseFloat logic removed.

## Fix C — server CHECK constraints
Pre-flight (`max(weight_lb)=20`, `max(length_inches)=11`, 0 bad rows) confirmed no existing violators. Migration added two NOT NULL-tolerant CHECKs to `public.session_events`:
- `session_events_weight_lb_bounds`: `weight_lb IS NULL OR (weight_lb > 0 AND weight_lb <= 50)`
- `session_events_length_inches_bounds`: `length_inches IS NULL OR (length_inches > 0 AND length_inches <= 60)`

A crafted/RN write of `999999 lb` will now be rejected at the data layer (23514).

## Verify
- Typing `999999`, `1e9`, `-1`, `0`, `0.0`, `abc`, ` 5 . 5 ` → Save disabled, helper text shown.
- `5.5` lb → splits to `5 lb 8 oz`, display `"5 lb 8 oz"`, persists.
- Edit form and in-session form use the same helper — no drift.
