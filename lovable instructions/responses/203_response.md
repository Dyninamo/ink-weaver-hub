# 203 — Preset schema canonicalisation + ref-based commit/dialog locks

## §1 — Canonical rod-blob schema

### §1.2 DiaryNew rewrite (`src/pages/DiaryNew.tsx` ~L306-321)

Old keys (`rodLength: "8.5ft"`, `line`, `leaderLength: "...ft"`, `retrieve`, `depth`) replaced with canonical `rodLengthFt: number`, `lineProfile`, `leaderLengthFt: number`. Block now mirrors `RodSetupState` exactly.

### §1.3 Migration applied + verified

```
 legacy_rod_length | legacy_leader_length | legacy_line | canonical_rod_length | canonical_line | total
-------------------+----------------------+-------------+----------------------+----------------+-------
                 0 |                    0 |           0 |                    3 |              3 |     3
```

All three legacy counts = 0. Canonical = total = 3. ✅

### §1.4 Reader-side fallback

`readPresetRod(blob): RodSetupState` added in `SetupWizard.tsx` Helpers section. Tolerates pre-203 keys (`rodLength`/`leaderLength` strings, `line`). Used in `ChooserView` subtitle + `onPickExisting`.

## §2 — Ref-based locks

- `commitInFlightRef = useRef(false)` — synchronous double-fire guard inside `doCommit` and chooser-with-flies fork.
- `dialogDispositionRef = useRef<null | "save" | "skip">(null)` — stamped by Save/Skip onClick; `onOpenChange` triggers skip-commit only when ref is still null.
- `setCommitting` retained (drives "Starting…" label) but never branched on.
- Same fix applied to chooser-with-flies fork in `onPickExisting`.

## §3 — Dead state + verification greps

### §3.1 dead state

```
  spotName: string | null;        ← WizardCommit interface field (out of scope per spec)
        spotName: null,           ← onComplete() call in doCommit (intentional, interface unchanged)
                  spotName: null, ← onComplete() call in chooser-with-flies fork (intentional)
```

`spotName`/`setSpotName`/`plan`/`setPlan`/`presetIncludeFlies`/`presetName` local state declarations: **removed**. `keepLimit` retained (read from `user_profiles`). Only the WizardCommit interface field + the two intentional `onComplete` calls remain (documented exceptions).

### §3.2 chooser/save events grep

```
        logEvent("wizard.chooser_skipped", { reason: "no_presets" });
        logEvent("wizard.chooser_shown", { count: filtered.length });
    logEvent("wizard.save_prompt_shown", {
            logEvent("wizard.chooser_picked_existing", {
            logEvent("wizard.chooser_picked_new", { existing_count: presets.length });
                logEvent("wizard.save_prompt_dismissed", { reason: "outside_click" });
                    logEvent("wizard.save_prompt_dismissed", { reason: "skip" });
                    logEvent("wizard.save_prompt_accepted", {
```

All 7 markers present.

### wizard.commit grep (-A 12)

Two callsites: `doCommit` (path/state-driven, `skipped_wizard: false`) + chooser-with-flies fork (`path: "existing"`, `skipped_wizard: true`). Both pasted verbatim above.

### readPresetRod grep (3 hits)

```
            const rod = readPresetRod(p.rod);   ← ChooserView subtitle
            const rod = readPresetRod(p.rod);   ← onPickExisting
function readPresetRod(blob: any): RodSetupState {   ← definition
```

### refs grep

Definitions + 4 use-sites (doCommit, handleStart guard, chooser-with-flies, onOpenChange + 2 buttons). See full output above.

### state-guard grep

```
(empty — zero hits)
```

`if (committing) return` removed everywhere. ✅

## Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | DiaryNew canonical keys, no `rodLength`/`line`/`leaderLength` writes | ✅ |
| 2 | Migration zeroed legacy keys (3/3 rows canonical) | ✅ |
| 3 | `readPresetRod` defined + ≥3 hits | ✅ (3 hits) |
| 4 | Refs declared + used in all close paths | ✅ |
| 5 | Zero `if (committing) return` hits | ✅ |
| 6 | Manual dialog-path repro (Save / Skip / outside-click) | ⚠️ **NOT RUN** — cannot drive the deployed PWA from this side. User to verify in browser. |
| 7 | Dead state cleared except documented exceptions | ✅ |
| 8 | Verification greps pasted verbatim | ✅ |

## Out of scope (handled in 204)

Per prompt §"Out of scope": preset structural validation, duplicate-rig spam on existing-no-flies path, fetch-error vs no-presets, loading skeleton, telemetry hygiene, Zod schema, accessibility.

## Action required (user)

Drive the dialog three ways in the deployed PWA and confirm exactly one `wizard.save_prompt_*` + one `wizard.commit` per close path (criterion #6).
