# 219 — PWA: unit tests for `deriveFixFromTrail` (+ Vitest harness)

Prompt 217 shipped `src/lib/deriveFix.ts` but **without the unit tests it asked
for** — and the repo currently has **no test runner at all** (no vitest/jest, no
config, no `test` script). This adds a minimal Vitest harness and the missing
tests. `deriveFix` is pure and deterministic, so this is fast, no mocks.

## Part A — add a Vitest harness (minimal, don't over-engineer)
- Add **`vitest`** as a devDependency.
- Add a `test` script to `package.json`: `"test": "vitest run"` (and optionally
  `"test:watch": "vitest"`).
- Add a tiny `vitest.config.ts` if needed so the `@/` path alias resolves the
  same way Vite does (reuse the alias from `vite.config.ts` —
  `@` → `./src`). No jsdom needed; this is a pure-logic test (default `node`
  environment is fine).
- Don't touch the existing `build`/`lint` scripts or app code.

## Part B — the tests: `src/lib/deriveFix.test.ts`
Port the RN test suite at `FishingDiary/__tests__/deriveFix.test.ts`, **adapted to
the PWA's API** (this is the key difference — don't copy verbatim):
- The PWA's `deriveFixFromTrail(trail, timestampISO)` takes `TrailPoint[]`
  (`{ timestamp, latitude, longitude, accuracy }`) and returns
  `{ latitude, longitude, accuracy, confidence, bracketDistanceM, note }`.
- So assert on **`latitude` / `longitude`** (not `fix.lat`/`fix.lon`), and **drop
  the RN `fix.timestamp === <t>` assertions** — the PWA `DerivedFix` has no
  timestamp field.
- Empty/null/undefined trail → `latitude === null`, `confidence === 'none'`.

Cover these cases (mirror the RN file):
1. Empty / null / undefined trail → `confidence: 'none'`, `latitude: null`.
2. Unparseable time → `confidence: 'none'`, `latitude: null`.
3. Single point → `confidence: 'edge'`, placed at that point's lat/lon.
4. Time before track start → `'edge'`, clamped to first point's lat.
5. Time after track end → `'edge'`, clamped to last point's lat.
6. Interior midpoint (two fixes 30s apart, query +15s) → lat/lon interpolated to
   the halfway point.
7. **High confidence over a long time gap when fixes are close** (~5.5m apart, 1h
   gap, query mid) → `'high'`, `bracketDistanceM < 15`.
8. **Low confidence when fixes are far apart** (~1.1km apart, query mid) →
   `'low'`, `bracketDistanceM > 75`.
9. Out-of-order trail is sorted before interpolating → correct midpoint.
10. **Accuracy widening**: two fixes ~1.1km apart, point accuracy 8 → result
    `accuracy` much greater than 8 (≈ max(8,8) + bracketDistanceM/2).

## Verify
- `npm test` (or the repo runner) runs and **all deriveFix tests pass**.
- Confirm the `@/` alias resolves in the test (the import of `TrailPoint` from
  `@/services/diaryService` must work, or import the type locally if pulling in
  the whole service is awkward in the test env).

## Context
Closes the test gap from 217. Pure-logic only — no app/runtime behaviour changes.
