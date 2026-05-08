# Lovable response — Prompt 142

**Prompt file:** `lovable instructions/142_2026-05-08_PWA_CATCH_FULLSCREEN.md`
**Applied:** 2026-05-08
**Status:** applied (with two prompt-vs-codebase deviations called out — see below)

## Pre-flight greps

- `CatchModal`: only mounted from `src/pages/DiaryEntry.tsx:969` (one site). Component file kept on disk per prompt §"What this prompt is NOT".
- `session_rods`: used by `RodPickerSheet.tsx`, `DiaryNew.tsx`, generated types. No second writer.
- styleRules helpers: `retrievesForStyle` ✓, **`depthsForStyle`** (not `depthZonesForStyle` as the prompt called it). Used the existing name — see deviation 1.
- Species lists: `SPECIES_LIST` / `DEFAULT_SPECIES` exist in `diaryService.ts` but use short canonical names (`Brown`, `Rainbow`, `Brook`, `Tiger`, `Blue`). The prompt requires venue-typed lists with `Brown Trout`, `Brook Trout`, etc. Defined a fresh `SPECIES_BY_VENUE` map locally in CatchFlow — see deviation 2.
- `kept_released`: confirmed `text` column on `session_events` (writes `'released' | 'kept'`).
- `session_events.weight_lb` / `weight_oz` are **integer**; CatchFlow splits the decimal lb input (e.g. 2.5 → lb=2, oz=8).

## Deviations from the prompt

1. **Helper name:** prompt §6 calls the depth-zone helper `depthZonesForStyle`. The existing export (landed in prompt 138) is `depthsForStyle`. Used the existing name; no rename.
2. **Species vocabulary location:** prompt §3 implies extending the existing species lists. The existing `SPECIES_LIST` is a flat short-name array shared with `CatchModal`; touching it would risk rewriting historic catch rows downstream (the canonical capital-T expansion the prompt mentions is in fact one-way — old `'Brown'` rows would still mismatch). Kept the existing list untouched and defined `SPECIES_BY_VENUE` locally in `CatchFlow.tsx` with the two prompt-specified vocabularies. The `defaultSpecies` value coming from `user_profiles` (potentially "brown trout" lowercase) is normalised via `canonicaliseSpecies()` and only honoured if it appears in the venue's allowed list — otherwise we fall back to the venue's first option.

## Diff summary

### New: `src/components/diary/CatchFlow.tsx`

Single-screen full-page overlay (NOT a `Dialog`). Sections in order:

1. **Position picker** — only renders when `flyCount > 1`. Vertical radio rows with assigned-fly italics and chevron. Default selection = `'point'` if present.
2. **AssignedFlyCard / missing-fly recovery** — tap opens FlyPicker in a Sheet. Missing-fly card uses `role="alert"` + amber styling. Save is disabled while the active position has no fly.
3. **Species chip row** — `SPECIES_BY_VENUE[venueType]` + Other free-text. Default species canonicalised from `user_profiles` value.
4. **Measure-by toggle + numeric input** — segmented Weight | Length. Switching mode wipes the other field. Decimal lb input split into `weight_lb` (int) + `weight_oz` (int) on save.
5. **Retrieve chip row** — pruned via `retrievesForStyle(rod.style)`. Hidden when single-option AND already matches carried value.
6. **Depth chip row** — pruned via `depthsForStyle(rod.style)`. Same hide rule.
7. **Outcome toggle** — segmented Released | Kept → `kept_released` text column.
8. **Notes** — collapsed `<details>`-style toggle.
9. **Sticky footer** — Cancel + morphing Save CTA: "Save catch" → `Save · <species> <size> · <outcome>`.

### Save logic

1. For each fly correction recorded during the session, write a `change` event to `session_events` with `change_from / change_to` JSON (`{ fly: ... }`), `change_reason = 'catch correction'` (or `'recovered missing fly assignment'` for the null→fly case), and `rig_position`.
2. If any corrections happened, update `session_rods.flies_on_cast` with the local map.
3. Write the catch event with all form values + the live weather snapshot.

Corrections are kept in local state until Save, so Cancel/Discard cleanly reverts (no rollback queries needed).

### Cancel / Discard

Back arrow tracks `dirty` state (any fly correction, species, size, or notes typed). Dirty → AlertDialog "Discard this catch?". Clean → immediate dismiss.

### `src/pages/DiaryEntry.tsx`

- Swapped `import CatchModal` for `import CatchFlow` (kept a comment noting CatchModal stays on disk per prompt).
- Replaced the `<CatchModal>` JSX block (lines 969–982) with a conditional `{catchOpen && <CatchFlow … />}` mount.
- Mapped existing DiaryEntry props onto CatchFlow's API: `rodIndex = activeRodIndex - 1`, `defaultSpecies = lastSpecies`, `carryRetrieve / carryDepth` from `currentSetup`. The wider implicit-line-change cascade is **not** triggered here because line is no longer in the catch flow (per prompt — line lives on the rod, not the catch).

### Files changed

- **Created:** `src/components/diary/CatchFlow.tsx`
- **Edited:** `src/pages/DiaryEntry.tsx` (swap mount; one import line + one JSX block)
- **Untouched (kept on disk per prompt):** `src/components/diary/CatchModal.tsx`
- **Created (instruction archive):** `lovable instructions/142_2026-05-08_PWA_CATCH_FULLSCREEN.md`

## Out of scope (not changed, per prompt)

- Voice / mic, photo upload (`photo_url`).
- Blank / Lost / Change flow rewrites.
- Deleting `CatchModal.tsx`.
- Modifying the canonical `SPECIES_LIST` constant.

## Notes for follow-up

- The prompt's RN-mapper alignment check (`FishingDiary/src/network/sessionMapper.ts`) wasn't runnable from the PWA repo. The column shape used in CatchFlow's writer matches `session_events`'s actual schema (verified against live information_schema), so any RN drift will show up the next time both writers land catch rows on the same session — flag for prompt 143 if observed.
- `currentSetup.retrieve / depth_zone` come from session_event derivation in DiaryEntry, not from `session_rods` directly. If those columns ever migrate onto `session_rods`, switch CatchFlow's carry-forward props to read from the rod row it already loads.
