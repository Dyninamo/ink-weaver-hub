# 160 — Replace DiaryNew venue filter+select with DiaryAutocomplete

## Pre-flight
- `venueFilter` state: line 77; `filteredRealVenues`: lines 152-154; filter `<Input>`: line 340; `<select>` block: lines 345-360. Matches prompt.
- `DiaryAutocomplete` imported + used 4× in `SetupCascade.tsx` — reference pattern reused.

## Changes (`src/pages/DiaryNew.tsx`)
- Added `import DiaryAutocomplete, { type AutocompleteOption } from "@/components/diary/DiaryAutocomplete"`.
- Removed `venueFilter` state and `filteredRealVenues` derivation.
- Built `venueOptions: AutocompleteOption[]` — Home pinned (category "Practice"), real venues (category "Venues", `meta = waterType`).
- Replaced the Label + filter Input + native `<select>` block with a single `<DiaryAutocomplete>` (`required`, `showAllLabel="Show all venues"`, `onChange` resets `venueTypeManual`).
- `Input` import retained — still used for date / arrival time fields.

## §4 — Category grouping
`DiaryAutocomplete` does **not** visually group by `category`; it splits on the `matched` flag and renders `category` as a small chip on each row. Per prompt §4 we leave the visual flat: Home appears at the top of the list because it's first in the options array, and the "Practice" chip distinguishes it from "Venues" rows. No scope expansion.

## Verification
TypeScript edits clean (no new errors introduced; harness build will confirm). Live device verification (steps 2-5: phone "graf" search, Home pick, `?venue=` querystring pre-fill, desktop styling) deferred to user smoke per prior prompts.
