# Prompt 148 — PWA UX shell additions — response

**Date:** 2026-05-10
**Branch:** `Dyninamo/ink-weaver-hub`
**Status:** §1, §2, §3 landed in one batch.

## Pre-flight

- `src/components/diary/setup/Dial.tsx` — exists (verified). Reused by §3.
- `supabase/functions/ask-ghillie/index.ts` — exists. Returns `{ narrative, chips, confidence }`. No new edge function created.
- `src/layouts/AppShell.tsx` — already mounts a tab bar; updated tabs in-place rather than spawning a duplicate `TabBar.tsx`.
- `LeaderPicker.tsx` — constants `FT_OPTIONS`, `M_OPTIONS`, `LB_OPTIONS`, `LB_TO_X` already present (the spec referenced `FT_LENGTHS`/`LB_STRENGTHS`/`X_FROM_LB`; reused the existing names).

## §1 — Persistent bottom tab bar

**File: `src/layouts/AppShell.tsx`**

The PWA already had `AppShellTabBar` mounted via the `Shelled` wrapper in `App.tsx` on every protected route. The fix was tab-set + visibility:

- **Tabs** — replaced `Session / Map / Timeline / Queries` with the spec's `Diary / Map / Queries / Settings`. Settings is now a first-class tab in addition to the header avatar.
- **Hide rule** — `shouldHideTabBar(pathname)` returns `true` for `/^\/diary\/(?!new$|settings(\/|$))[^/]+$/` so any active-session detail page (`/diary/:id`) hides the bar. `/diary/new` and `/diary/settings/...` keep the bar.
- Auth, share, manager, and landing routes already bypass `AppShell` (they don't use the `Shelled` wrapper), so no extra `HIDE_PATTERNS` were needed.

**TabBar visibility choice during active sessions:** **Hide.** Rationale (per spec's "easiest"): the EndPill at `z-60` already crowds the bottom, and tab-hopping mid-session is intentionally suppressed. Lifting the EndPill above the bar would have required cross-component z-bookkeeping for marginal benefit.

## §2 — "Ask the ghillie" mid-session overlay

- **New file**: `src/components/diary/AskGhillieOverlay.tsx`
  - Renders a context banner (venue, rod, style, line, tally, elapsed).
  - Posts to `ask-ghillie` with `surface: "mid_session"`, the current `latestWeather` snapshot, and a context-prefixed question (so the existing prompt template gets the mid-session bits inline without an edge-function change).
  - Displays the returned `narrative`, `chips`, and `confidence` tier.
  - Fires `logEvent("ghillie.asked", { surface: "mid_session", session_id, length })` on success.
- **`src/components/diary/ReadyView.tsx`** — added a gild "Ask the ghillie" ledger row above the four event-coloured rows. New required prop `onAskGhillie`.
- **`src/components/diary/ActiveSessionShell.tsx`**
  - Added `"ask_ghillie"` to the `SessionPhase` union and to `PHASES_WITH_PILL` (EndPill stays visible while the overlay is open).
  - New `phase === "ask_ghillie"` branch renders the overlay; back-arrow returns to `ready`.

## §3 — LeaderPicker chip-grid → scroll-snap dial

- **`src/components/diary/LeaderPicker.tsx`** — replaced both length and breaking-strain chip grids with the existing `Dial` primitive.
  - Length: dial value carries the unit-local integer (ft or m); on change it converts back to canonical `length_ft` (rounded to 0.1 ft when entering via metres). Toggling ft↔m swaps the options array; selected value is preserved by canonical conversion.
  - Strength: dial value is the canonical `lb`. Toggling lb↔X only swaps the labels; the underlying numeric stays intact.
  - Material chips left as-is (5 chips fit fine).
- Catalogue `resolveLeaderId` lookup unchanged — same DB write path as the prior chip-grid.

## Files changed

- created `src/components/diary/AskGhillieOverlay.tsx`
- edited `src/layouts/AppShell.tsx`
- edited `src/components/diary/ReadyView.tsx`
- edited `src/components/diary/ActiveSessionShell.tsx`
- edited `src/components/diary/LeaderPicker.tsx`
- created `lovable instructions/responses/148_response.md`

## Out of scope (per spec)

Voice, venue greeting cleanup, LostFlow vocabulary, OAuth strip, manager nav, schema, edge endpoints.
