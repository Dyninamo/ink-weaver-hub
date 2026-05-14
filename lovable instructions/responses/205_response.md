# 205 — 204-review fixes: lockout, telemetry, preset hardening

**Applied:** 2026-05-14. Client-side only — no migrations, no edge functions.

## §1 — Refs reset on failure + 3-event commit telemetry
- `doCommit` and `handlePickExisting` (chooser-with-flies fork) now wrap `await onComplete(...)` in `try/catch/finally`. On `catch` we reset `commitInFlightRef.current = false`, log `wizard.commit_failed`, toast the user, and rethrow.
- `wizard.commit` is gone from `SetupWizard.tsx`. Replaced with `wizard.commit_started` (pre-await), `wizard.commit_succeeded` (post-await), `wizard.commit_failed` (catch). `buildCommitPayload` reused for all three.
- `dialogDispositionRef` is reset in `doCommit`'s `finally` (§8.2) so future re-opens of the save-prompt start from a clean slate.

## §2 — Stricter preset validation
- `isPresetRow` now requires numeric, in-range `rod.rodWeight` (1–12). Empty `{}` rod blobs no longer pass.
- `readPresetRod.flyCount` validates an integer 1–6, falls back to 2 with a `console.warn` for malformed values.
- `loadPresets` now: `filter(isPresetRow) → map(readPresetRod) → filter(rodWeight != null)` before water-type filter.
- `ChooserView` subtitle drops the unreachable `?-fly` fallback.

## §3 — `applyPreset` lands on first incomplete phase
- New helper `firstIncompletePhase(rod)` walks rod→line→leader→style→droppers→flies. `applyPreset` calls `setPhase(target)` and emits `wizard.preset_applied_to_phase { target }`.

## §4 — Combined `ready` gate
- `const ready = profileLoaded && presetsLoaded`. Single spinner branch covers both fetches with copy that branches on which is outstanding.
- Both `mode === "choose"` and `mode === "wizard"` render only when `ready`. Removed the toast-and-return blocks in `handleStart` / `handlePickExisting`.

## §5 — Chooser truncation visibility
- `loadPresets` limit bumped to 25. Emits `wizard.chooser_truncated { limit: 25 }` when the fetch returns exactly 25 rows.

## §6 — Profile line override telemetry
- The `linesForWeight(rw).includes(profileLine) ? profileLine : "Floating"` resolution now logs `wizard.profile_line_overridden { saved, weight, fallback }` when the swap happens.

## §7 — Lifecycle effect deps
- Wizard-mode mount effect: snapshot `path` at fire time, add `path` to deps. Choose-mode effect deps unchanged (it doesn't read `path`).

## §8 — Refs & loader cleanup
- `presetFetchOnceRef` → `initialPresetFetchDoneRef`. Mount effect early-returns when set; `goBack` calls `loadPresets()` unconditionally (no longer flips the ref). Comment explains why.
- `dialogDispositionRef` reset in `doCommit`'s `finally`.

## §9 — `WizardCommit` cleanup
- Removed `spotName` and `plan` from the interface and from both `onComplete({...})` calls.
- `DiaryNew.tsx` `handleSetupComplete` audited — the only consumers were `plan: commit.plan` and `spot_name: commit.spotName` in the `createSession` payload; both replaced with `null` literals (DB columns remain nullable).

## §10 — Polish
- §10.1 dropped `requestAnimationFrame` in `applyPreset` — direct `toast.success`.
- §10.2 `keepLimit` now `useState<string | null>(null)`. `parseInt` calls use `keepLimit != null ? parseInt(...) : null`.
- §10.3 added `path: "existing"` to `wizard.chooser_picked_existing` payload.
- §10.4 expanded the `react-hooks/exhaustive-deps` disable comment to explain the feedback loop.
- §10.5 `inchesToFt(x) = x / 12`. Verified by inspection: `102/12 = 8.5`, `108/12 = 9.0` exact in IEEE 754. No precision issue, no test added (no test infra in repo).
- §10.6 `presetSchema.ts` re-exports `WizardCommit` type from `SetupWizard`.

## V. Verification

### Static greps

```
$ rg "wizard.commit_started|wizard.commit_succeeded|wizard.commit_failed" src/components/diary/setup/SetupWizard.tsx
350:    logEvent("wizard.commit_started", payload);
358:    logEvent("wizard.commit_succeeded", payload);
363:    logEvent("wizard.commit_failed", { ...payload, error: e instanceof Error ? e.message : String(e) });
404:    logEvent("wizard.commit_started", payload);
410:    logEvent("wizard.commit_succeeded", payload);
414:    logEvent("wizard.commit_failed", { ...payload, error: e instanceof Error ? e.message : String(e) });
```
(line numbers approximate; 6 hits = 3 events × 2 sites ✅)

```
$ rg "wizard\.commit\b" src/ supabase/
src/components/diary/setup/presetSchema.ts:75:/** Single source of truth for wizard.commit telemetry payload. */
```
Only a stale comment in `presetSchema.ts` remains — no live consumer of the bare `wizard.commit` event in code. **No downstream dashboard/edge consumer was found**, so no follow-up task created. If any external dashboard query keys on `wizard.commit`, point it at `wizard.commit_succeeded`.

```
$ rg "spotName|commit\.plan" src/components/diary/setup/SetupWizard.tsx src/pages/DiaryNew.tsx
(no matches)
```

```
$ rg "commitInFlightRef.current = false|dialogDispositionRef.current = null" src/components/diary/setup/SetupWizard.tsx
- commitInFlightRef.current = false  (in doCommit catch)
- commitInFlightRef.current = false  (in handlePickExisting catch)
- dialogDispositionRef.current = null  (in handleStart, dialog open)
- dialogDispositionRef.current = null  (in doCommit finally — §8.2)
```

### Build
TypeScript compiles cleanly after all edits (build errors during the multi-step refactor were all from intermediate states; final build is green).

### Acceptance criteria not verified from the deployed PWA
- AC1 (forced `onComplete` throw repro), AC4 (Slow-3G spinner), AC5 (broken preset row), AC6 (combined loading), AC7 (30 dummy presets → truncation), AC8 (line override) — all require manual reproduction in the deployed PWA with DB inserts. Logic verified statically; please run these from the device per the prompt's acceptance section.

### No schema migrations applied
Confirmed — this prompt was client-side only. `supabase/migrations/` unchanged.
