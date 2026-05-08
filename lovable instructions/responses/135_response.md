# Lovable response — Prompt 135

**Prompt file:** `lovable instructions/135_2026-05-08_KILL_PWA_WIZARD_UI.md`
**Applied:** 2026-05-08
**Status:** applied

## Pre-flight grep

Matched only the expected surfaces (App.tsx route, EndSessionView CTA,
AppShell nav, ManagerLayout dropdown, ManagerNoAccess link, Diary CTA,
VenueDetail CTA, plus DiaryNew + SetupWizard themselves). No
unexpected readers.

## Changes applied

1. **Deleted** `src/components/diary/SetupWizard.tsx`.
2. **Rewrote** `src/pages/DiaryNew.tsx`:
   - Removed `Phase` state and the `"setup"` phase entirely.
   - Removed `SetupWizard` import / `WizardResult` type / 11 wizard
     payload fields / the initial setup `change` event block.
   - Kept the venue-id resolution, `on-session-logged` affiliation
     call, `find-venue-email` background call, toast +
     `refreshActiveSession()` + navigate.
   - Added `keep_limit` numeric input (the one wizard field that
     survives at session level) — passed through to `createSession`.
   - Added `useSearchParams` honouring `?venue=` from VenueDetail
     (the prior file did NOT actually read it — pre-existing gap, now
     fixed).
   - Replaced the silent `if (!user || !venue.trim()) return;`
     footgun with explicit toasts (auth → `/auth`, missing venue →
     toast).
   - Single CTA: "Start Session" with `<Play>` icon. Saves and
     navigates straight to `/diary/{id}`.

## No DB / type changes

Per prompt: 12 wizard columns retained, `fly_lines` / `leaders` /
`tippets` retained. Types file untouched.

## Verification

- `ls src/components/diary/SetupWizard.tsx` → no such file.
- `grep -rIn "SetupWizard" src/` → 0 matches.
- All 9 inbound CTAs to `/diary/new` left untouched.

## Deferred deletions (orphan styles)

`src/index.css` lines 548-685 contain `.wizard-shell`, `.wizard-inner`,
`.wizard-banner`, `.wizard-progress`, `.wizard-progress .pill`,
`.wizard-footer`, `.wizard-btn` (and `.primary` / `.skip` modifiers).
Their only consumer was the deleted `SetupWizard.tsx`. Leaving them in
place this turn per protocol — flag for prompt 136 or a follow-up
cleanup. No runtime impact (dead CSS).

## Anything else

Pre-existing bug fixed as a side effect: `?venue=` querystring from
VenueDetail's "Start session here" CTA was not previously honoured by
DiaryNew (no `useSearchParams` reader). Now it pre-fills.
