# 217 — getSessionTrail + deriveFixFromTrail

## Part A — `getSessionTrail` in `diaryService`
New `TrailPoint` type + `getSessionTrail(sessionId)` selecting
`timestamp, latitude, longitude, accuracy, sort_order` ordered by `sort_order`
then `timestamp` ascending. Owner RLS (prompt 215) gates reads. Returns `[]` on
no trail or on error (logs to console — never throws to the caller).

## Part B — `src/lib/deriveFix.ts`
Pure, deterministic port of the RN helper. Implements the spec exactly:
- Invalid time → `{none, "Invalid time."}`.
- 0 / 1 / before-span / after-span edge cases → `confidence:'edge'` with the
  spec'd notes.
- Interior: binary search for the bracket, interpolate lat/lon by fractional
  time, widen accuracy by `max(a.acc, b.acc) + bracketDistanceM/2` (null point
  accuracies treated as 0 for the `max`).
- Confidence by **bracket distance**: ≤15m → high, ≤75m → approx, else low,
  with the spec'd notes.
- Local Haversine (the existing `utils/distance.ts` returns miles); kept local
  to avoid an unwanted unit conversion.

## Part C — tests
The project has **no test runner configured** (no `vitest`/`jest` in
`package.json`, no `__tests__` convention in the repo). Skipped writing tests
to avoid introducing a runner mid-stream; flagged for a follow-up if you'd
like vitest + the RN-port test cases wired in.
