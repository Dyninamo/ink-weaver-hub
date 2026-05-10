# 147 — PWA housekeeping

## Pre-flight findings
- §1 CatchFlow: single hit on outer `fixed inset-0 z-50` (line 317).
- §2 DiaryEntry: confirmed `catchOpen/blankOpen/lostOpen/changeOpen/whatPickerOpen/lineCascadeOpen/rodPickerOpen/endPhase/implicitChangePrompt/isOnline/outreachOpen/justEnded` only consumed inside the now-unreachable `isActive`/`justEnded` JSX after the early `return <ActiveSessionShell />`.
- §3 Diary: existing resume path used `getActiveSession` which doesn't fetch rods — needed widening.
- §4 Results: tier read from `state.adviceV2.tier` / `confidence.tier`; no existing badge.
- §5 VenueSubmissionForm.tsx is the sole submission entry.

## §1 — CatchFlow
Replaced outer wrapper:
```diff
- <div className="fixed inset-0 z-50 bg-background overflow-y-auto pb-32">
+ <div className="pb-32">
```
Sticky save footer (`fixed bottom-0`) + EndPill (z-60) preserved.

## §2 — DiaryEntry strip
Removed:
- State: `catchOpen, blankOpen, lostOpen, changeOpen, changeFlyOpen, whatPickerOpen, lineCascadeOpen, rodPickerOpen, endPhase, implicitChangePrompt, isOnline + listener, outreachOpen, outreachEmail, outreachChecked, justEnded, lastRigPosition, lastFlySize`.
- Handlers: `handleCatchSaved, handleBlankSaved, handleChangeSaved, handleImplicitChangeAccept, handleConfirmEnd, handleSyncingComplete`.
- Effect: 15-min `pollSessionWeather` polling.
- JSX: dead End Session button + the active-only FAB cluster + `justEnded ? <EndSessionView/> : ...` ternary.
- Imports: `Input, Label, Textarea, Clock, StopCircle, EndSessionView, endSession, formatWeight, pollSessionWeather`.

Kept `activeRodIndex/setLatestWeather/isOnline=true` shims since the type for `ActiveSessionShell` props expects them and the shell still receives them (even though DiaryEntry early-returns to it before any of the dead branches render).

Line count: **1025 → 832** (-193 lines).

## §3 — Diary stale-resume guard
Replaced `getActiveSession` call with an inline supabase query that joins `session_rods!left(flies_on_cast, rod_index)`. Added `hasAtLeastOneFly` helper and `canResume` derived from `venue_name + hasAtLeastOneFly(rod[0])`.

Banner split:
- `canResume === true` → existing Resume card.
- otherwise → amber "Unfinished session — can't resume" card with **Discard** (flips `is_active=false`, refreshes context, toasts) and **Set up rod** (navigates to `/diary/:id`).

## §4 — Results archetype badge
Added `isArchetype` derived from `tier === "archetype" || confidence.tier === "archetype"` and an amber `Generic guidance` banner above the weather bar referencing `archetype.water_type`. Hid the prominent "Order Flies" CTA when archetype-tier and replaced it with a small text link "View suggested flies".

## §5 — Reserved venue names
Added `RESERVED_NAMES` set (`home, practice, office, garden, test, tbc, n/a, none, private, unknown, anywhere, everywhere`) + `<3 char` rejection. Validated in `handleSubmit` before insert with toast steering users to the Dashboard's built-in Home option.

## Notes
- Did not propose alternatives — every section fit the existing PWA patterns cleanly.
- Some lucide icons (`Circle, RefreshCw`) are still imported in DiaryEntry because they remain referenced in the timeline event-type rendering for completed sessions; not orphaned.
- Screenshots not captured (no preview run requested in this loop).
