# 204 — Wizard hardening & polish

## Files

**New:** `src/components/diary/setup/presetSchema.ts`, `ChooserView.tsx`, `SaveRigPromptDialog.tsx`, `wizardSteps.tsx`
**Edited:** `src/components/diary/setup/SetupWizard.tsx` (938 → **611 lines**)

## §-by-§ summary

- **§1 (#5)** — `isPresetComplete()` in presetSchema.ts; `handlePickExisting` only bypasses wizard when `include_flies && isPresetComplete(rod)`. New event fields `preset_complete`, `include_flies_flag`.
- **§2 (#6)** — `handleStart` short-circuits with `wizard.save_prompt_skipped { reason: "existing_path" }` and direct `doCommit(null)` when `path === "existing"`.
- **§3.1 (#7)** — Distinct `wizard.chooser_skipped { reason: "fetch_error" }` + toast on Supabase error.
- **§3.2 (#8)** — Spinner branch shown while `mode === "choose" && !presetsLoaded`.
- **§4.1 (#10)** — `path: "existing" | "new"` (non-null), default `"new"`. Grep verified zero hits for old shape.
- **§4.2 (#11)** — Two effects: `wizard.mounted/unmounted` only when `mode === "wizard"`; `wizard.chooser_mounted/unmounted` only when `mode === "choose"`. **Breaking change** for prompt-201 consumers — documented.
- **§4.3 (#12)** — `presetFetchOnceRef` flips after first successful load; effect short-circuits afterward.
- **§4.4 (#14)** — `handleChooserCancel` logs `wizard.chooser_cancelled { existing_count }`.
- **§5.1 (#9)** — Dead `setState({...rod})` and `setLengthInches` calls removed from chooser-with-flies branch.
- **§5.2 (#13)** — `applyPreset` toast wrapped in `requestAnimationFrame`.
- **§5.3 (#15)** — `profileLoaded` flag; `handleStart` and `handlePickExisting` early-return with "Loading profile…" toast if not loaded.
- **§5.4 (#16)** — `goBack` → chooser clears `presetFetchOnceRef` and calls `loadPresets()`.
- **§6.1 (#17)** — `presetSchema.ts` houses `PresetRow`, `readPresetRod`, `isPresetComplete`, `isPresetRow` type guard. No more `as unknown as PresetRow[]`.
- **§6.2 (#18)** — `buildCommitPayload()` used at both `wizard.commit` emit sites.
- **§7.1 (#19)** — `autoFocus` on Rig name input in SaveRigPromptDialog.
- **§7.2 (#20)** — `aria-label="Apply saved rig "${name}", ${subtitle}"` on chooser buttons.
- **§7.3 (#21)** — Chooser cards wrapped in `<ul role="list"><li>…`.
- **§8.1 (#22)** — ChooserView, SaveRigPromptDialog extracted to siblings; step components moved to `wizardSteps.tsx`. SetupWizard.tsx now **611 lines** (target was <700).
- **§8.2 (#23)** — Single startup `useEffect` runs `Promise.all([profile, loadPresets()])`.

## Acceptance grep output

```
=== wc ===
611 src/components/diary/setup/SetupWizard.tsx

=== ls setup ===
ChooserView.tsx
Dial.tsx
SaveRigPromptDialog.tsx
SetupWizard.tsx
presetSchema.ts
vocabulary.ts
wizardSteps.tsx

=== path nullable check (§4.1, expect zero) ===
(empty)

=== dead writes in chooser-with-flies (§5.1, expect zero) ===
(empty)

=== events ===
      logEvent("wizard.chooser_skipped", { reason: "fetch_error", error: error.message });
      logEvent("wizard.chooser_skipped", { reason: "no_presets" });
      logEvent("wizard.mounted", { path });
      logEvent("wizard.chooser_mounted", null);
      logEvent("wizard.save_prompt_skipped", { reason: "existing_path" });
    logEvent("wizard.chooser_picked_existing", { ..., preset_complete, include_flies_flag });
    logEvent("wizard.chooser_cancelled", { existing_count: presets.length });
```

## Could not verify (requires deployed PWA)

Acceptance criteria #2, #3, #4, #6, #7, #8, #9, #13 (manual reproductions + Network panel inspection + Slow 3G + StrictMode) — cannot be driven from this side. Code paths inspected & traced statically; user to validate console-event traces in the deployed PWA.

## Notes

- `presetFetchOnceRef` retained (§4.3) AND `loadPresets` callback (§5.4) — they coexist by clearing the ref before manual refetch.
- `keepLimit` state remains; `profileLoaded` is the gate (not `keepLimit !== "2"`) so a user with explicit `default_keep_limit = 2` still passes immediately.
- Step components export from `wizardSteps.tsx` to keep `SetupWizard.tsx` under 700 lines per §8.1 acceptance criterion #12.
