# Lovable Prompt 143 — PWA ActiveSessionShell + persistent end pill + collapsed Change flow

**Date:** 2026-05-08
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Companion docs:**
- `project_documentation/code_opus/PWA_RN_UX_PARITY_AUDIT_2026-05-08.md` (UX audit)
- Prompts 141 (`141_2026-05-08_PWA_SETUP_WIZARD.md`) and 142 (`142_2026-05-08_PWA_CATCH_FULLSCREEN.md`) — must land first; this prompt restructures the page they hook into

**Context:** the 2026-05-08 UX audit identified two structural issues this prompt closes:

1. **Persistent end-session pill is missing.** PWA renders the pill on `ReadyView.tsx` only — the moment a modal opens (CatchModal, BlankModal, ChangeWhatPicker, etc.) the pill disappears behind the dialog overlay. RN renders the pill at the SessionScreen level so it survives every phase transition (`SessionScreen.tsx:142-156`).
2. **Change flow is fragmented across 5 components.** PWA splits one RN concept into `ChangeWhatPicker` + `ChangeFlyFlow` + `ChangeSetupModal` + `RodPickerSheet` + `LineCascadePrompt`. RN does the whole thing in one full-screen `ChangeFlow` with an internal field router (`SessionScreen.tsx:1829-3221`).

This prompt restructures `DiaryEntry.tsx`'s `isActive` branch into a single `ActiveSessionShell` component that:
- Mounts each flow as a phase **inside the shell**, not as a modal overlay.
- Renders the end-session pill at shell level so it persists across every phase except the end-session sub-states.
- Replaces the 5 Change components with a single `ChangeFlow` component with an internal `field` router.
- Strips `BlankModal`'s phase-1 "same setup or changed?" gate (it's a PWA-only EXTRA — RN trusts the angler to fire a Change first).
- Strips `LineCascadePrompt` (PWA-only EXTRA — RN has no parallel).

**No master / Supabase schema changes are needed.** The data writes are unchanged from 141/142.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/143_response.md`.

---

## What this prompt is NOT

- Not adding voice. PWA stays tap/text.
- Not changing the end-session ceremony itself (`EndSessionConfirm` / `EndSessionSyncing` / `EndSessionView` stay as they are — the PWA's editorial wrap-up is a feature, not a bug). The only change is **where** they mount and **when** the pill hides.
- Not touching the Catch flow (handled in 142).
- Not adding a tab bar (separate P1 cleanup).
- Not adding the mid-session "Ask the ghillie" overlay (separate P1 cleanup).
- Not aligning Lost stage vocabularies (separate P2 cleanup).

---

## File targets (verify with pre-flight greps)

- **Restructure:** `src/pages/DiaryEntry.tsx` (currently dual-rendered active vs completed; ~963 lines)
- **New component:** `src/components/diary/ActiveSessionShell.tsx`
- **New component:** `src/components/diary/ChangeFlow.tsx` (replaces ChangeWhatPicker + ChangeSetupModal + LineCascadePrompt for non-fly changes; reuses existing position-picker + FlyPicker for fly changes)
- **Mount existing as phases (not modals):** `ReadyView`, `BlankModal` (modify, see Section 4), `LostModal`, `RodPickerSheet`, the new `CatchFlow` from 142
- **Delete (after verification):** `src/components/diary/ChangeWhatPicker.tsx`, `src/components/diary/ChangeSetupModal.tsx`, `src/components/diary/ChangeFlyFlow.tsx` (collapse into ChangeFlow), `src/components/diary/LineCascadePrompt.tsx` (strip — see Section 6)

---

## Pre-flight greps

```bash
# Map current modal mounting in DiaryEntry
grep -n "CatchModal\|BlankModal\|LostModal\|ChangeWhatPicker\|ChangeFlyFlow\|ChangeSetupModal\|RodPickerSheet\|LineCascadePrompt\|EndSessionConfirm\|EndSessionSyncing\|EndSessionView" src/pages/DiaryEntry.tsx

# Confirm the end-session pill is currently inside ReadyView
grep -rIn "End session\|end-session\|endSession" src/components/diary/ReadyView.tsx

# Confirm there's no third caller of the Change components
grep -rIn "ChangeWhatPicker\|ChangeSetupModal\|ChangeFlyFlow\|LineCascadePrompt" src/

# Confirm BlankModal phase-1 is the "same setup or changed?" gate
grep -n "phase\|sameSetup\|changedSetup" src/components/diary/BlankModal.tsx
```

If any pre-flight finds something the prompt didn't anticipate (a third Change-flow consumer, a ChangeFlyFlow that does something more than the audit captured, a different end-session phase chain), **stop and report back**.

---

## ActiveSessionShell architecture

```
DiaryEntry.tsx (route /diary/:id)
├─ Loading state
├─ if (!session) → NotFound
├─ if (session.is_active === false) → CompletedSessionView (existing tabbed view, unchanged)
└─ else → ActiveSessionShell

ActiveSessionShell
├─ phase: 'ready' | 'catch' | 'blank' | 'lost' | 'change' | 'rod_change'
│         | 'end_confirm' | 'end_syncing' | 'end_done'
├─ subState (per phase, e.g. ChangeFlow.field): handed down via shared context
├─ Header: venue greeting + tally summary + CoachBanner if applicable
├─ Body (single full-viewport region):
│   phase==='ready'        → <ReadyView ...onLogCatch={...}, onBlank={...}, onLost={...}, onChange={...} />
│   phase==='catch'        → <CatchFlow ... />                  (from prompt 142)
│   phase==='blank'        → <BlankFlow ... />                  (was BlankModal — see Section 4)
│   phase==='lost'         → <LostFlow ... />                   (was LostModal — see Section 5)
│   phase==='change'       → <ChangeFlow ... />                 (new, see Section 3)
│   phase==='rod_change'   → <RodPickerSheet ... />             (existing, mount as phase not modal)
│   phase==='end_confirm'  → <EndSessionConfirm ... />          (existing, mount as phase)
│   phase==='end_syncing'  → <EndSessionSyncing ... />          (existing, mount as phase)
│   phase==='end_done'     → <EndSessionView ... />             (existing, mount as phase)
└─ EndPill (sticky floating bottom-right):
    visible when phase ∈ { 'ready', 'catch', 'blank', 'lost', 'change', 'rod_change' }
    hidden when phase ∈ { 'end_confirm', 'end_syncing', 'end_done' }
    tap → setPhase('end_confirm')
```

**Phase transitions:**
- From `ready`, the four event-coloured ledger rows + the ChangeWhatPicker entry transition to the four flow phases (`catch`, `blank`, `lost`, `change`).
- From any flow phase, a successful Save returns to `ready`. Cancel returns to `ready`.
- The EndPill from `ready / catch / blank / lost / change / rod_change` jumps to `end_confirm`.
- `end_confirm` → `end_syncing` (on confirm) → `end_done` (on sync complete).
- `end_done` → navigate back to `/diary` via existing `EndSessionView` CTA.

**State hand-off:** the shell holds the session row + active-rod state. Each phase component receives session + active rod as props and a `setPhase` callback. No internal phase state on the children — the shell is the single source of truth.

---

## 1. EndPill component

A small floating pill at the bottom-right of the shell, positioned `fixed` with `inset-block-end: 16px; inset-inline-end: 16px`. Style: rose accent, ink text, pill shape, slight shadow, "End session" label. On tap, calls `onEndSession()` (which sets phase to `end_confirm`).

**Visibility logic** (in `ActiveSessionShell.tsx`):

```tsx
const PHASES_WITH_PILL = new Set(['ready', 'catch', 'blank', 'lost', 'change', 'rod_change']);
{PHASES_WITH_PILL.has(phase) && <EndPill onEndSession={() => setPhase('end_confirm')} />}
```

**Important:** because phases now mount as full-page content (not as `<Dialog>` overlays), the pill is **always above the page content** since it's the same z-index sibling. There's no dialog-backdrop layer to hide it. This is the core architectural fix.

For phases that themselves render a sticky footer (CatchFlow's "Save" CTA, etc.), give the EndPill a higher `z-index` and make sure the phase content has bottom padding equal to the pill's height + spacing so nothing overlaps. RN solves this with absolute positioning inside the SessionScreen — same pattern works here.

---

## 2. ReadyView wiring

`ReadyView` already exists. Two wiring changes:

1. The four event-coloured ledger rows currently set per-modal `open` state. Change them to call `setPhase('catch' | 'blank' | 'lost' | 'change')`.
2. The current "End session" affordance inside ReadyView (if any — confirm via pre-flight grep) **is removed** — the pill at shell level owns this. ReadyView no longer renders an end button.

ReadyView still owns:
- Venue greeting + tally hero
- RodSummary card
- "Ask the ghillie" gild ledger row (P1 cleanup adds it later — leave the existing entry alone)
- Recent journal list

---

## 3. ChangeFlow — collapsed Change components

**New component** `src/components/diary/ChangeFlow.tsx` replaces the ChangeWhatPicker → ChangeFlyFlow / ChangeSetupModal / RodPickerSheet / LineCascadePrompt chain.

### Internal state

```ts
interface ChangeFlowState {
  field: 'pick' | 'fly' | 'line' | 'leader' | 'style' | 'depth' | 'retrieve' | 'spot' | 'droppers' | 'rod';
  // 'pick' = the field-picker landing; the other values are per-field editors
  oldValue: any | null;
  newValue: any | null;
  reason: string | null;
  // For fly changes:
  position: FlyPosition | null;
}
```

### UI shape

```
ChangeFlow (full-screen, single component)
├─ FlowHeader: ← back | "Change something" | change-accent
├─ if field === 'pick':
│   Body: 8 cards in 2-column grid + 1 full-width "Set up a new rod" gild card
│       Fly · Line · Leader · Style · Droppers · Retrieve · Depth · Spot
│       (full-width: Set up a new rod — opens RodPickerSheet as phase 'rod_change')
├─ else (a field is picked):
│   Body shows the field's editor inline:
│     fly      → position picker (if multi-fly) + FlyPicker
│     line     → chip column (`linesForWeight(rod.rodWeight)`)
│     leader   → mounted LeaderPicker (existing)
│     style    → STYLE_OPTIONS chip grid
│     depth    → 8 NORMALISED_DEPTH_ZONES chips, style-pruned
│     retrieve → 7 retrieves, style-pruned
│     spot     → free-text input
│     droppers → 1..6 dial
│     rod      → RodPickerSheet inline (or transition to phase 'rod_change' — pick whichever lands cleaner)
│   plus an optional reason input (single-line text, "Why? — optional")
└─ Footer: Cancel  |  primary "Save change · {oldValue} → {newValue}"
```

**Field-picker → editor transition** is internal to ChangeFlow — same component, just the body swaps. Back-arrow returns from editor to picker (still inside ChangeFlow). Back-arrow from picker exits to phase `ready`.

### Save logic

On Save:
1. Write a `change` event to `session_events`:
   ```ts
   await supabase.from('session_events').insert({
     session_id, rod_index: 0,
     event_type: 'change',
     event_time: now,
     change_type: field,      // 'fly' | 'line' | etc.
     change_from: oldValue,
     change_to: newValue,
     change_reason: reason,
     // For fly changes:
     rig_position: position,
     fly_pattern: newValue.name,    // for downstream analytics
   });
   ```
2. Update the rod state on `session_rods`:
   - `fly` change → `flies_on_cast[position]` rewrite
   - `line` change → `line_profile` (and `line_id` if resolvable from `fly_lines` catalogue)
   - `leader` change → `leader_id` / `leader_material` / etc.
   - `style` / `retrieve` / `depth` / `spot` / `dropper_count` → corresponding column
   - `rod` change → handled by RodPickerSheet's existing logic
3. Toast "Change saved", set phase to `ready`.

### LineCascadePrompt — STRIPPED

Today's PWA opens `LineCascadePrompt` after a line change, asking if leader/flies should also be re-prompted. **Remove this entirely.** RN trusts the angler to fire separate Change events for each field they want to update. If the angler wants to change leader after line, they tap Change → Leader.

Delete `src/components/diary/LineCascadePrompt.tsx` after verification confirms no functional regression.

---

## 4. BlankFlow — strip the phase-1 gate

`BlankModal` currently has a phase-1 "Same setup, or changed something?" gate that bounces to `ChangeSetupModal` if the angler picks "Changed setup". **Strip this gate entirely.**

Rename `BlankModal` to `BlankFlow` (matching the other Flow naming) and mount as a phase, not a Dialog. The body becomes only the existing phase-2 content:
- Confidence chip row (4 colour-coded buttons: `Dead / Seeing fish / Had follows / Had pulls`)
- Reason chip row + free-text input
- Save button

If the angler changed something before logging the blank, they tap the EndPill out, fire a Change first, then come back. Same as RN's flow. Don't gate every blank entry on "did you change anything?".

Schema unchanged — `session_events` blank rows stay the same.

---

## 5. LostFlow — rename only

`LostModal` works fine functionally. Rename to `LostFlow`, mount as a phase, not a Dialog. No content changes (P2 stage-vocabulary alignment is a separate cleanup later).

---

## 6. RodPickerSheet — mount as phase

The bottom-sheet pattern works on mobile but not on desktop where there's no bottom-sheet convention. Mount it as a full-page phase (`'rod_change'`) with the existing internal layout. On mobile viewport widths, the layout still feels bottom-sheet-y because the existing component is full-width with content anchored to the bottom.

If the rod picker has a "save and return" action, it transitions back to `ready`. If it has a "go to setup-style change" follow-up, it transitions to `change` with `field='style'` pre-selected.

---

## 7. End-session phases

`EndSessionConfirm` / `EndSessionSyncing` / `EndSessionView` are already full-screen takeovers. They become phases on the shell:
- `end_confirm` → renders `<EndSessionConfirm session={...} onCancel={() => setPhase('ready')} onConfirm={() => setPhase('end_syncing')} />`
- `end_syncing` → renders `<EndSessionSyncing session={...} onSyncComplete={() => setPhase('end_done')} />`
- `end_done` → renders `<EndSessionView session={...} onClose={() => navigate('/diary')} />`

The `VenueOutreachDialog` interjection between syncing and done stays — mount it inside `EndSessionView`'s render as it is today, no change.

The pill **does not render** during these three phases (per the visibility set in Section 1).

---

## 8. CompletedSessionView — unchanged

The `!session.is_active` branch of DiaryEntry stays as it is today (tabbed timeline / fish / stats view). It's outside the active-session shell. Don't change it in this prompt — separate question whether the PWA should match RN's "no in-session tabs on the completed view" pattern, parked as P1 cleanup.

---

## 9. Accessibility

- `ActiveSessionShell` uses `<main role="main" aria-live="polite">` so phase transitions are announced.
- The EndPill is `<button type="button" aria-label="End session">`.
- ChangeFlow's field picker is `role="radiogroup"` with `aria-required="true"`.
- Phase transitions should focus the new phase's heading on mount (`useRef + .focus()` on the H2 inside each Flow).

---

## Verification

1. **Build clean:** `npm run build`. No TS errors.
2. **Pill persistence**:
   - Open `/diary/:id` for an active session. Confirm EndPill is visible at bottom-right.
   - Tap "Log a catch". Confirm EndPill is **still visible** above the CatchFlow content. (This is the core fix — today the pill disappears.)
   - Tap "Mark a blank". Confirm EndPill visible above BlankFlow.
   - Tap "Change". Confirm EndPill visible above ChangeFlow's field picker, AND above each field editor.
   - Tap EndPill. Confirm transition to `end_confirm`. Pill is now hidden.
   - Cancel from `end_confirm`. Pill returns.
3. **Change flow collapse**:
   - From ready, tap "Change". Confirm field picker shows 8 cards + 1 full-width gild.
   - Tap "Style". Confirm the same screen swaps to a chip grid + reason input + Save. No new dialog opened.
   - Back-arrow returns to the picker. Tap "Fly", pick a position, pick a fly, save. Confirm `change` event written + `session_rods.flies_on_cast` updated.
   - Tap "Line", pick a new line, save. Confirm **NO LineCascadePrompt** opens (it was stripped).
4. **Blank flow strip**:
   - Tap "Mark a blank". Confirm the phase-1 "Same setup or changed?" gate is **gone** — the screen opens directly on confidence + reason.
   - Save a blank. Confirm `session_events` row has the same shape as before (just without the gate-skip path).
5. **End session ceremony**:
   - Tap EndPill, confirm, watch syncing → done. Confirm `EndSessionView` renders. Tap close, confirm navigate to `/diary`.
   - Repeat with offline mode (DevTools → Network → Offline). Confirm `EndSessionSyncing` waits, then completes when online.
6. **No orphan modals**:
   - In DevTools → Components, confirm there's no Dialog / Sheet / Drawer rendered during catch / blank / lost / change phases. The new shell uses pages, not overlays.
   - Confirm no `ChangeWhatPicker` or `ChangeSetupModal` or `ChangeFlyFlow` or `LineCascadePrompt` references remain in `src/` after deletion (post-verification commit).

---

## Out of scope (still)

- Tab bar (separate P1 cleanup).
- Mid-session "Ask the ghillie" overlay row (separate P1 cleanup).
- Tappable venue greeting (separate P1 cleanup).
- LeaderPicker dial port (separate P1 cleanup — `LeaderPicker` stays as chip grid for now).
- Stale-session boot guard on `Diary.tsx` resume banner (separate P1 cleanup).
- Lost stage vocabulary alignment (separate P2 cleanup).
- OAuth strip + auth screen wordmark (separate P2 cleanup).
- CompletedSessionView tabbed-vs-flat structure decision (parked).

---

## Coordination with RN

RN's phase routing lives in `FishingDiary/src/AppRouter.tsx` + `state/flowController.ts`. The shape of phases this prompt establishes (`'ready' | 'catch' | 'blank' | 'lost' | 'change' | 'rod_change' | 'end_confirm' | 'end_syncing' | 'end_done'`) maps onto RN's `SessionPhase` type — verify the values align so analytics consumers (`session_events.event_type`, change reasons, etc.) see consistent strings from both apps.

Specifically:
- Change events: `change_reason` strings should match RN's vocabulary. RN uses things like `'angler change'`, `'cascade from line change'`, `'catch correction'`. The PWA after this prompt should use the same reasons so the data is queryable across apps.

If you find a divergence in `session_events.event_type` values or `change_reason` strings between RN and this prompt, **align to RN** (it's canonical).

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/143_response.md`:

- Pre-flight grep findings + any deviations.
- Diff summary per section (1–8).
- Screenshots:
  - ActiveSessionShell on `ready` phase with EndPill visible.
  - CatchFlow phase with EndPill **still visible** at bottom-right (the headline fix).
  - ChangeFlow on `pick` (field picker grid).
  - ChangeFlow on `style` field editor (with EndPill still visible).
  - BlankFlow with no phase-1 gate (opens straight on confidence row).
  - End-session phases — confirm pill hidden during all three.
- Confirmation that `LineCascadePrompt`, `ChangeWhatPicker`, `ChangeSetupModal`, `ChangeFlyFlow` files are removed after verification (or kept with a TODO if you'd rather strip in a follow-up commit).
- Any place the phase-routed pattern made something clunkier than the modal pattern — propose alternatives, don't force a bad fit.
