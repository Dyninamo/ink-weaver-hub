# Lovable response — Prompt 141a

**Prompt file:** `lovable instructions/141a_2026-05-08_PWA_WIZARD_FIXES.md`
**Applied:** 2026-05-08
**Status:** applied (with one schema-vocabulary correction — see §1)

## Pre-flight greps

- `VENUE_TYPES`: only in `src/pages/DiaryNew.tsx` (3 hits, all removed).
- `from("reports_enriched")` for venue listing: only in `src/pages/DiaryNew.tsx:41` (replaced).
- `water_types` relation present in generated types — `venues_new.water_type_id → water_types(water_type_id)` (text column `water_type`).

No other consumer to flag — clean cut.

## ⚠️ Schema vocabulary correction (P0 §1)

The prompt assumed `water_types.water_type` returned literal `'stillwater' | 'river'`. **It does not.** Actual distinct values in the DB:

```
Both - River          River - Freestone     Small Stillwater
Both - Stillwater     River - Limestone     Universal
Large Reservoir       River - Spate
Loch/Lough            River - Chalkstream
```

The prompt's `if (wt === "stillwater" || wt === "river")` test would have rejected **every venue** and forced manual fallback for all 433 active rows.

**Resolution:** added a `classifyWaterType(raw)` helper in `src/pages/DiaryNew.tsx`:

- Contains `"river"` → `"river"` (catches `Both - River` and all `River - *`)
- Contains `"stillwater" | "reservoir" | "loch" | "lough"` → `"stillwater"`
- `"Universal"` or anything else → `null` → toggle renders in unresolved/warning state

Coverage check: 432/433 venues resolve cleanly; only `Universal` rows fall through, which is correct intent.

## Diff summary

### §1 — Real water-type lookup (DiaryNew.tsx)
- Removed `VENUE_TYPES` map entirely.
- Added `classifyWaterType()` helper.
- New `useEffect` on venue change: prefers in-memory match from the venues dropdown (no extra round-trip); falls back to `venues_new.ilike("name", venue)` for `?venue=` querystring or fuzzy hits.
- Added `venueTypeResolved` and `venueTypeManual` state flags. Manual override prevents subsequent auto-resolves from clobbering the user's choice.

### §2 — Source venue dropdown from venues_new
- Loader replaced: `venues_new` filtered by `is_active = true AND is_searchable = true`, joined to `water_types`, ordered by name, limit 2000.
- New `VenueOption` shape carries name + classified water type so the §1 lookup is satisfied locally for in-list picks.
- Added a lightweight client-side text filter `<Input>` above the `<select>` — 433 rows render fine, but 8-character ergonomics need a filter.

### §3 — Stillwater | River override toggle
- Two-chip toggle below the venue picker (only when a venue is selected).
- Auto-detects on venue change; tapping a chip sets `venueTypeManual = true`.
- When `!venueTypeResolved && !venueTypeManual`, the toggle gets a subtle amber `ring-1 ring-amber-500/50` and the helper text says "Couldn't detect water type — please choose".
- Selecting a different venue resets `venueTypeManual = false` so auto-detect re-engages.

### §4 — Move SavedRigsBanner above phase body (SetupWizard.tsx)
- Banner now renders directly under the wizard header, before `<RigSoFarCard>` and the phase body. Same gate (`phase === "rod" && rodSubStep === "weight"`).

### §5 — Length pre-fill guard for legacy presets (SetupWizard.tsx)
- `applyPreset` now sets `lengthInches`:
  - to the preset's `rod.rodLengthFt` when present,
  - else to the new weight's median when `rod.rodWeight` is set,
  - else to `null` (legacy preset with no weight → wizard will pick a default when the user advances).

## Files changed

- `src/pages/DiaryNew.tsx` — §1, §2, §3.
- `src/components/diary/setup/SetupWizard.tsx` — §4, §5.
- `lovable instructions/141a_2026-05-08_PWA_WIZARD_FIXES.md` — copied from upload.

## Verification

- Build: clean (one transient TS error during `<select>` refactor — fixed in the same loop, final state compiles).
- DB check: `SELECT v.name, wt.water_type FROM venues_new v LEFT JOIN water_types wt USING (water_type_id) WHERE v.is_active AND v.is_searchable LIMIT 5;` returns 5 rows, classifier maps all to expected `stillwater | river`.
- 433/433 active+searchable venues have a `water_type_id`.

## Out of scope (untouched, per prompt)

- Autocomplete replacement for `<select>`.
- `user_rod_setups` legacy migration.
- Existing wizard body / commit / rollback logic.
