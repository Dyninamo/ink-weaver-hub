# 149 — PWA P2 backlog

**Date:** 2026-05-10
**Prompt:** `lovable instructions/149_2026-05-10_PWA_P2_BACKLOG.md`

## Pre-flight grep findings

- `grep -rIn "on_strike|throwing_hook|bite_off" src/` → only `LostFlow.tsx` (lines 10/13/14). No other consumer renders the old vocabulary as a chip; historic display still passes through unchanged.
- `grep -rIn "CatchModal" src/` (before §7) → only `CatchModal.tsx` itself + a comment in `CatchFlow.tsx:4`. Zero importers.
- `grep` on Auth.tsx → `signInWithOAuth`, `oauthLogin`, two OAuth buttons, `Separator` import — all touched in §2.
- Gild token in tokens.css is `--gild-500` / `--gild-700`. Used directly via `var(--gild-500)` (no shorthand `--gild` HSL var). Used the existing `var(--gild-500)` in the auth hairline.

## §1 — LostFlow stage vocabulary alignment

**File:** `src/components/diary/LostFlow.tsx`

Replaced the 6-stage list with the canonical 3-stage RN vocabulary:

```ts
const STAGES = [
  { value: "on_take",      label: "On the take" },
  { value: "during_fight", label: "During the fight" },
  { value: "at_net",       label: "At the net" },
] as const;
```

Forward-only. `session_events.got_away_stage` accepts text — historic `on_strike` / `throwing_hook` / `bite_off` rows render as their raw string in any timeline reader (no display helper exists today, so no mapping required).

## §2 — Auth screen — strip OAuth, add wordmark

**File:** `src/pages/Auth.tsx`, `src/components/auth/PasswordField.tsx`

- Removed `Separator` import + `FishSymbol` (unused) + the entire OAuth `<div className="space-y-2">` block (Google + Apple buttons + "or" separator). Removed the `oauthLogin` helper.
- Replaced the legacy `auth-wordmark` / `auth-tagline` with the prompt's header block: `"It's Catching!"` in `font-diary`, `w-16` gild hairline (`var(--gild-500)`), tagline `"Your pocket ghillie"` in italic muted.
- Added a mode-aware eyebrow (`Welcome back` / `Create an account` / `Reset your password` / `Check your inbox`) inside the CardHeader above the title.
- §2.4 was already RN-parity: `PasswordField.tsx` already uses a labelled text `Show` / `Hide` button, not an eye icon. No change needed.
- `PasswordStrengthMeter` retained as-is on sign-up (security UX win the prompt told us to leave alone).

## §3 — RodPickerSheet desktop layout

**File:** `src/components/diary/RodPickerSheet.tsx`

Used the existing `useIsMobile` hook (`src/hooks/use-mobile.tsx`, 768px cutoff). Extracted the inner content into a `body` JSX const, then branched the wrapper:

- `!isMobile` → `<Dialog><DialogContent className="max-w-[480px]">…</DialogContent></Dialog>`
- mobile → keep the original bottom `<Sheet>`.

Both shells render identical content and produce identical DB writes.

## §4 — 16-oz overflow guard in CatchFlow

**File:** `src/components/diary/CatchFlow.tsx`

```ts
weight_lb = Math.floor(f);
weight_oz = Math.round((f - weight_lb) * 16);
if (weight_oz >= 16) { weight_lb += 1; weight_oz = 0; }
weight_display = weight_oz === 0 ? `${weight_lb} lb` : `${weight_lb} lb ${weight_oz} oz`;
```

Verification (by inspection):
- `2.99` → floor=2, oz=Math.round(15.84)=16 → guard → lb=3, oz=0, display `"3 lb"` ✅
- `2.5`  → floor=2, oz=8 → display `"2 lb 8 oz"` ✅
- `1.0`  → floor=1, oz=0 → display `"1 lb"` ✅

## §5 — Pass `currentLine` to FlyPicker

**File:** `src/components/diary/CatchFlow.tsx`

- Extended `SessionRodLite` with `line_profile: string | null`.
- Added `line_profile` to the rod-load select list.
- Changed the bottom Sheet's `<FlyPicker currentLine={null}>` → `<FlyPicker currentLine={rod.line_profile}>` so recommendations are rod-aware.

## §6 — Tappable venue greeting + VenuePickerOverlay

**Files:** `src/components/diary/ReadyView.tsx`, `src/components/diary/VenuePickerOverlay.tsx` (new), `src/components/diary/ActiveSessionShell.tsx`

- New `VenuePickerOverlay.tsx` mirrors `AskGhillieOverlay`'s phase-mounted full-page layout. Loads `venues_new` (with the same `classifyWaterType` helper from `DiaryNew`), pins a "Home" entry, supports search (cap 200 results), updates `fishing_sessions.venue_name` (+ `venue_type` if known) and writes a `change` event with `change_from = { venue: oldName }`, `change_to = { venue: newName }`, `change_reason = "mid-session venue switch"`. The schema has `change_from / change_to / change_reason` (verified in `types.ts` and existing `ChangeFlow`/`CatchFlow`); no `change_type` column exists, so the venue context lives in the JSON blobs (consistent with how rod / fly changes are encoded).
- `ReadyView` accepts an optional `onVenueGreetingTap` prop. When provided, the greeting renders as a button with a chevron; otherwise the legacy text node is preserved (back-compat).
- `ActiveSessionShell` adds `'venue_switch'` to the `SessionPhase` union and to `PHASES_WITH_PILL` so EndPill stays visible at z-60. Wires `onVenueGreetingTap={() => setPhase("venue_switch")}` and reloads session data on `onSwitched`.
- `logEvent("venue.switched", …)` emitted on success.

## §7 — Delete legacy CatchModal

```bash
rm src/components/diary/CatchModal.tsx
grep -rIn "CatchModal" src/
# → only "src/components/diary/CatchFlow.tsx:4: * Replaces the 6-step CatchModal dialog with a vertically-scrolling form."
```

The remaining hit is a doc-comment in `CatchFlow.tsx`'s file header — historical context, no import / runtime reference. Left in place per its useful provenance role.

## Notes / deviations from the prompt

- §2.4 was a no-op: `PasswordField` already implemented the labelled `Show`/`Hide` text button.
- §6 used the project's existing `change_from` / `change_to` JSON-blob pattern instead of the prompt's `change_type / change_from / change_to` shape, because `session_events` has no `change_type` column. Downstream consumers (`batch-recompute`, `compute-session-summary`) parse `change_from` blobs by key, so `{ venue: … }` is forward-compatible.
- §3 reused `useIsMobile` instead of defining a local `useIsDesktop`.
- Screenshots not captured this round (no headless browser session). Pre-flight grep + inspection-level verification covers the §1 / §4 / §5 / §7 outcomes; UI changes (§2 / §3 / §6) are visually verifiable by the user in the preview.
