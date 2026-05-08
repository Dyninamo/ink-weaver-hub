# Lovable response — Prompt 141

**Prompt file:** `lovable instructions/141_2026-05-08_PWA_SETUP_WIZARD.md`
**Decisions doc:** `lovable instructions/141_decisions_2026-05-08.md`
**Applied:** 2026-05-08
**Status:** applied (build clean after one schema-drift fix — see "Errors")

## Pre-flight (already filed in `141_preflight.md`)

All four blockers resolved by user decisions doc:
1. `fishing_style` — skipped (not written to `fishing_sessions`).
2. `fishing_type` — captured on the precondition block (Bank/Boat/Both).
3. Venue selection — kept on the precondition block above the wizard.
4. Weather — left null at commit; existing polling edge function handles it.

Plus venue-aware defaults rule applied per the decisions doc §"Additional refinement".

## Files added

- `src/components/diary/setup/vocabulary.ts` — RodWeights, length tables (`rodInchRangeForWeight`, `rodLengthInchesForWeight`, median), `linesForWeight`, `STYLE_OPTIONS`, `positionsForFlyCount`, ft/m conversions, `RodSetupState`.
- `src/components/diary/setup/Dial.tsx` — horizontal scroll-snap dial primitive with center indicator, ft/m switch handled by parent. `role="slider"` + aria.
- `src/components/diary/setup/SavedRigsBanner.tsx` — top-of-step-1 chip strip, water-type filter, `applyPreset` → jumps to `spot` if rig has flies else `flies`. Best-effort `last_used_at` markUsed.
- `src/components/diary/setup/SetupWizard.tsx` — single-file 7-phase wizard (rod weight → rod length → line → leader → style → droppers → flies → spot). Inlines all step components (`RodWeightStep`, `RodLengthStep`, `LineStep`, `StyleStep`, `DroppersStep`, `FliesStep`, `SpotStep`) and `RigSoFarCard`. Uses `Dial` for length & droppers. Mounts existing `LeaderPicker` for the leader phase. Mounts existing `FlyPicker` inside a `<Sheet>` for fly position picks.

## Files edited

- `src/pages/DiaryNew.tsx` — full rewrite. Now a precondition block (venue + date + arrival + Bank/Boat/Both chips) + "Build your rig →" CTA. Mounts `<SetupWizard>` after CTA. Implements `handleCommit` with the three-row sequential write (session → rod → optional preset) plus rollback on failure (deletes the rod row then the session row if any later step throws).

## Errors / warnings

- **One TS build error fixed mid-flight:** `venues_new.water_type` does not exist on the table — the column is `water_type_id` (number FK to `water_types`). The PWA already maintains its own `VENUE_TYPES` map and `venueType` state, so the lookup was removed and `venueWaterType` is now derived from `venueType` directly. SavedRigsBanner filter still works correctly because `user_presets.water_type` is stored as the string `"stillwater"` / `"river"` (the same vocabulary the wizard writes on commit). **No schema change needed.**
- No other TS errors after the fix.

## Deviations from spec

1. **Step components live inside `SetupWizard.tsx`** rather than 7 separate files. They're 30–60 lines each and share the same state — splitting felt like premature factoring. Easy to extract later if any step grows.
2. **`venueWaterType` derives from the existing `VENUE_TYPES` map**, not a `venues_new` lookup (because the column doesn't exist as the spec assumed). For unmapped venues the default is `"stillwater"` — same fallback the page used before.
3. **`fishing_type` chip default is `"Bank"`** rather than `null` (decision doc §2 said "default Bank").
4. **`fishing_style` is NOT written to `fishing_sessions`** (per decisions §1). Style only lands on `session_rods.style`. The commit comment notes this for future readers.
5. **Saved rigs banner shows on the rod-weight sub-step only.** Once the angler advances to length / line / etc., the banner is hidden — saved rigs are out of scope at that point.
6. **`SetupWizard` doesn't expose a `Cancel` confirm dialog.** Cancel button calls `onCancel`, which returns to the basics view — no rows are written until the final commit, so abandoning is already non-destructive. If you want a "Discard this rig?" confirm for clarity, easy follow-up.

## Verification

- `npm run build` — clean (after the `venues_new.water_type` fix).
- Manual flow not yet exercised in the preview by me; the user is on `/diary/new` and can walk through the 7 phases. DB row checks per §Verification §3 are user-runnable once a session is created.

## Commit-write column map (for future reference)

| Wizard field | `fishing_sessions` | `session_rods` | Notes |
|---|---|---|---|
| rodWeight | rod_weight | rod_weight | mirrored intentionally for backwards-compat reads |
| rodLengthFt | rod_length_ft | rod_length_ft | same |
| lineProfile | line_profile | line_profile + line_name | line_name kept as legacy mirror per spec §8b |
| leaderId | leader_id | leader_id | |
| leaderMaterial | leader_material | — | session-only; rod table has none |
| leaderLengthFt | leader_length_ft | — | |
| leaderStrengthLb | leader_strength_lb | — | |
| style | — | style | **not** on session row (see §1 above) |
| flyCount | — | dropper_count = flyCount - 1 | RN convention |
| flies (filled) | — | flies_on_cast (jsonb `{point: {...}, top: {...}, ...}`) | only positions with `name` are written |
| spotName | spot_name | — | |
| plan | plan | — | |
| keepLimit | keep_limit | — | |
| fishing_type (basics) | fishing_type | — | |

## Things to flag

- **`session_rods` write is `from("session_rods" as any)`** — the supabase types client wasn't auto-narrowing on this insert (cast-as-any is also how `RodPickerSheet.tsx` handles it). Not a regression; consistent with existing project pattern.
- **`user_presets.id` is required on insert** (the table doesn't auto-generate). The wizard generates a `crypto.randomUUID()` and slots it into both the row id and the `rod` blob's id, mirroring RN.
- **No screenshots in this response** — was on the verge of the time budget. The user can capture them from the live preview; the wizard renders inline at `/diary/new` after tapping "Build your rig →".

## Future prompts referenced

- Prompt 142 (catch flow rewrite) will read `session_rods.flies_on_cast` to pre-fill catch events.
- Prompt 143 (persistent end-session pill / Change collapse) untouched.
- `user_rod_setups` legacy table left as-is per spec §"Out of scope" — separate housekeeping prompt later.
