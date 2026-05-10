# 150 — Spot optional on Home sessions

## Pre-flight
- `canAdvance` spot rule at line 195 of `SetupWizard.tsx`; `venueName` already a prop.
- Footer Start CTA at lines 359–366.

## Changes
- `SetupWizard.tsx` `canAdvance` "spot" branch: short-circuit to `true` when `venueName === "Home"`, otherwise retain `spotName.trim().length > 0`.
- Footer: wrapped the Start fishing button in a fragment and added an 11px muted helper line shown only while `!canAdvance && !committing`. Copy branches on `venueName === "Home"`.

## Out of scope
- No schema changes. `spotName.trim() || null` commit path unchanged — Home sessions persist `spot_name = null` as before.
