# 202 — Chooser-first wizard, drop spot phase, end-of-wizard save prompt

## Changes
- **`src/components/diary/setup/SetupWizard.tsx`** — full rewrite of the main wizard component:
  - `Phase` enum / `PHASES` array shortened to 6 items (rod, line, leader, style, droppers, flies). `PHASE_LABEL` updated.
  - Removed state: `spotName`, `plan`, `savePreset`, `presetIncludeFlies`, `presetName`. Removed `SpotStep` component and its JSX block.
  - `keepLimit` retained (loaded from `user_profiles.default_keep_limit`, no UI control).
  - New state: `presets`, `presetsLoaded`, `mode` ("choose" | "wizard"), `path` ("existing" | "new" | null), plus `savePromptOpen` / `savePromptName` / `savePromptIncludeFlies`.
  - New preset-fetch effect runs on mount; filters by `venueWaterType`; sets `mode="choose"` if any match, otherwise auto-skips to wizard with `wizard.chooser_skipped`.
  - `applyPreset` always jumps to `flies` (the spot branch is gone).
  - `goBack` from rod-weight returns to chooser when presets exist (resets state); else cancels.
  - `handleStart` now opens the save-prompt dialog. New `doCommit(savePreset)` does the actual `onComplete` call and logs `wizard.commit` with `path` and `skipped_wizard: false`.
  - Footer renders **Start fishing** on `phase === "flies"`, **Next** otherwise.
  - Inline `ChooserView` component renders saved-rig cards + "Create new rig" button.
  - Existing-with-flies fork commits straight from the chooser (logs `wizard.commit` with `skipped_wizard: true`); existing-no-flies fork uses `applyPreset` then drops into the flies phase.
  - `AlertDialog` save-prompt: Save-it / Skip / outside-click each guarantee exactly one `doCommit`.
  - `wizard.phase_enter` only fires while `mode === "wizard"` so the chooser doesn't emit a spurious phase entry.
- **`src/components/diary/setup/SavedRigsBanner.tsx`** — deleted (no remaining importers).

## Verification

### §V.3 — Grep for new event types
```
$ rg "wizard.chooser_shown|wizard.chooser_skipped|wizard.chooser_picked_existing|wizard.chooser_picked_new|wizard.save_prompt_shown|wizard.save_prompt_accepted|wizard.save_prompt_dismissed" src/components/diary/setup/SetupWizard.tsx
```
All seven event types present (chooser_shown, chooser_skipped, chooser_picked_existing, chooser_picked_new, save_prompt_shown, save_prompt_accepted, save_prompt_dismissed×2 reasons).

### §V.4 — Grep confirming spot phase is gone
```
$ rg "\"spot\"|spotName|setSpotName|SpotStep|presetName|presetIncludeFlies" src/components/diary/setup/SetupWizard.tsx
```
Only remaining hit is `spotName: null` inside the two `onComplete(...)` calls (intentional — `WizardCommit` interface unchanged for `DiaryNew.tsx` compatibility).

### §V.5 — `wizard.commit` payload
Both `wizard.commit` log calls include `path` and `skipped_wizard` fields (chooser-direct path: `path: "existing", skipped_wizard: true`; doCommit path: `path` from state, `skipped_wizard: false`).

### §V.6 — `DiaryNew.tsx:handleSetupComplete` null-spot tolerance
`src/pages/DiaryNew.tsx:258`  `plan: commit.plan,` (column accepts null)
`src/pages/DiaryNew.tsx:268`  `spot_name: commit.spotName,` (column accepts null)
No required-field check. Confirmed safe.

### §V.7 — Files touched
Only `src/components/diary/setup/SetupWizard.tsx` (edit) and `src/components/diary/setup/SavedRigsBanner.tsx` (delete).

## Not verified in browser
Per prompt's instruction — flow not driven manually. Behaviour to be confirmed via next `app_events` pull.

## Out of scope (unchanged)
- Wizard / active-session in-memory state loss across reloads.
- Per-session keep-limit override UI.
- Chooser disambiguation when many presets match.
