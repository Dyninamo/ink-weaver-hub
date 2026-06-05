# 220 — CatchEditForm decimal weight fix

## Diff: `src/components/diary/CatchEditForm.tsx`
- **Hydration**: `weightLb` initial state now seeded as `initial.weight_lb + (weight_oz ?? 0)/16` so an edit of "2 lb 8 oz" re-opens as `2.5`.
- **Save (weight mode)**: replicates `CatchFlow` — parseFloat → floor lb + round(frac×16) oz, carry when oz≥16, build `weight_display` ("N lb" / "N lb M oz"). Writes `weight_lb` (int), `weight_oz` (int), `weight_display`, nulls `length_inches`.
- **Save (length mode)**: parseFloat → `length_inches = f` (CatchFlow stores decimal as-is), `weight_display = "${f} in"`, nulls `weight_lb`/`weight_oz`.

No other changes; `CatchFlow` untouched.
