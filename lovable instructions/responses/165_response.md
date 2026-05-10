# 165 — Home visibility (DiaryAutocomplete + VenuePickerOverlay)

## Diff
- **`src/components/diary/DiaryAutocomplete.tsx`**: Added optional `pinned?: boolean` to `AutocompleteOption`. The useMemo now splits `pinned` first (bypassing the search filter), then matched/unmatched on the rest. `flatList` orders pinned → divider → matched → "show all" divider → unmatched. Render block adds the pinned section + its divider, and recomputes `highlightIndex` offsets to account for the pinned count.
- **`src/pages/DiaryNew.tsx`**: Home venue option now carries `pinned: true`.
- **`src/components/diary/VenuePickerOverlay.tsx`**:
  - `filteredVenues` extracts Home and prepends it unconditionally; only real venues are filtered/limited.
  - `handlePick` now builds a payload that sets `venue_id = null` when switching to Home (clearing the stale FK), and only writes `venue_type` for non-Home picks.

§4 (clear venue_id when switching between two real venues) **scoped out** — needs a `venues_new` lookup; tracked separately if needed.
