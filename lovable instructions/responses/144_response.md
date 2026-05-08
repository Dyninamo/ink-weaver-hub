# 144 — PWA Home pseudo-venue

## Pre-flight
- `venueWaterType` consumed only by SetupWizard (prop) and SavedRigsBanner (already null-tolerant). No other consumers.
- Post-commit `ilike("name", venue)` uses `maybeSingle()` — null-safe for "Home".

## Changes
1. **DiaryNew.tsx**
   - Added `HOME_OPTION` and prepended it to `venues` after load.
   - Split `filteredRealVenues` from `realVenues`; rendered dropdown with `<optgroup label="Practice">` (Home) and `<optgroup label="Venues">` (filtered real venues). Home is always visible regardless of filter text.
   - Auto-resolve effect short-circuits when `venue === "Home"`: sets `venueTypeResolved=false` so toggle shows warning state.
   - Added `canBuildRig = !!venue.trim() && (venue !== "Home" || venueTypeManual)` and wired CTA + toast.
   - Pass `null` to wizard when Home + not yet manually picked (defensive — gate prevents this in practice).
2. **SetupWizard.tsx** — widened `venueWaterType` prop to `"stillwater" | "river" | null`. Defaults effect already null-safe (falls to stillwater branch).
3. **SavedRigsBanner.tsx** — verified, already accepts `string | null` and shows all presets when null.

## Out of scope (untouched)
- No `venues_new` row for Home.
- Post-commit venue_id lookup unchanged: returns null for Home → no `on-session-logged`, no email lookup.
- No timeline/map badge changes.
