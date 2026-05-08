# Lovable Prompt 142 — PWA catch flow rewrite (single-screen, rod-owns-fly)

**Date:** 2026-05-08
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Companion docs:**
- `project_documentation/code_opus/PWA_RN_UX_PARITY_AUDIT_2026-05-08.md` (UX audit)
- Prompt 141 (`141_2026-05-08_PWA_SETUP_WIZARD.md`) — must land first; this prompt depends on `session_rods.flies_on_cast` being populated

**Context:** the 2026-05-08 UX audit identified the catch flow as the second-biggest divergence between PWA and RN. The PWA's `CatchModal.tsx` is a 6-step dialog (Weight/Length → Fly → Position → Retrieve → Depth → Line). RN's `CatchFlow` is a single full-screen form — even without voice, the angler logs a catch in 2-3 taps + Save because the rod's assigned fly pre-fills based on position.

This prompt replaces `CatchModal.tsx` with a new single-screen `CatchFlow.tsx` component that:
1. Treats fly identity as **rod-owned**, not catch-event-owned. Reads the position's assigned fly from `session_rods.flies_on_cast` (set in prompt 141).
2. Renders **all controls on one screen** so the angler can fill it in any order and save with one tap.
3. Adds a **missing-fly recovery affordance** when the rod's position has no fly assigned.
4. Emits a `change` event if the angler corrects the fly during catch entry — keeping the rod's fly history accurate.

**No master / Supabase schema changes are needed.** All required columns on `session_events` already exist.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/142_response.md`.

---

## What this prompt is NOT

- It does not delete `CatchModal.tsx` files until the new flow is wired and verified — keep the old component on disk during code review, then strip in a follow-up commit. Avoid the dead-route problem.
- It does not change the way species names are stored. Capital-T canonical (`'Brown Trout'`, `'Rainbow'`) is unchanged.
- It does not add voice (PWA stays tap/text).
- It does not touch the Blank or Lost flows — those are separate (prompt 143 will handle the Change flow collapse; the Blank phase-1 strip and Lost vocabulary alignment are P1 cleanup).

---

## File targets (verify with pre-flight greps)

- **Replace mounting:** `src/pages/DiaryEntry.tsx` (currently mounts `<CatchModal />` somewhere on the active branch)
- **New component:** `src/components/diary/CatchFlow.tsx` (single-screen form, NOT a Dialog)
- **Hook into:** `src/services/diaryService.ts` for `addEvent` (existing) + a new `emitChangeEvent` (or in-component logic) for the rod-fly-correction case
- **Read from:** `session_rods.flies_on_cast` to populate the position's pre-filled fly
- **Reuse:** `src/components/diary/FlyPicker.tsx` (mounted inline as a sheet for the missing-fly / correction case)
- **Reuse:** `src/services/styleRules.ts` (already lands `retrievesForStyle` + `depthZonesForStyle` per prompt 138)

---

## Pre-flight greps

```bash
# Confirm CatchModal is mounted from DiaryEntry
grep -rIn "CatchModal" src/

# Confirm session_rods is the rod-state source
grep -rIn "session_rods" src/

# Confirm styleRules helpers are in place (prompt 138)
grep -n "retrievesForStyle\|depthZonesForStyle" src/services/styleRules.ts

# Confirm species canonical list
grep -n "SPECIES_OPTIONS\|RIVER_SPECIES\|STILLWATER_SPECIES" src/

# Confirm there's no second catch writer hiding elsewhere
grep -rIn "from\\('session_events'\\).*insert\\|addEvent" src/
```

If a second writer exists or `CatchModal` is mounted from more than one place, **stop and report back**.

---

## CatchFlow architecture

```
CatchFlow (mounted as a route-level full-screen overlay on /diary/:id, NOT a Dialog)
├─ FlowHeader: ← back button | "Log a catch" title | catch-dark accent strip
├─ Body (single scrollable column, no step pagination):
│   1. Position picker          (only if flyCount > 1; auto-picks 'point' for single-fly rigs)
│   2. AssignedFlyCard           (shows the rod's fly for the picked position)
│   3. Species chip row          + "Other" → free text
│   4. Measure-by toggle         (Weight | Length) + numeric input
│   5. Retrieve chip row         (style-pruned)
│   6. Depth zone chip row       (style-pruned)
│   7. Outcome toggle            (Released | Kept)
│   (8. Notes textarea — optional, collapsed by default)
└─ Footer (sticky):
   Cancel  |  primary "Save · Rainbow 2.5lb · released"
```

The footer CTA shows a **live summary** of the catch as the angler fills the form (mirrors RN's `SessionScreen.tsx:1276-1316`). Empty species shows "Save catch"; once a species + size are picked, it morphs into the full summary.

**One screen, vertical scroll.** No step navigation. No "Next" buttons between sections. Save commits everything at once.

---

## 1. Position picker

**Skip this section entirely** if the active rod has `flyCount === 1`. The position is automatically `'point'`.

For multi-fly rigs, render a vertical list of position rows (same labels as the setup wizard — see prompt 141 §7). Each row shows:
- Position label (e.g. "Point fly")
- Currently-assigned fly name in italic (e.g. "Diawl Bach #14")
- Subtle right-chevron / radio dot to indicate select state

**Default selection:** `'point'` (the bottom fly is the most common catching fly on UK reservoirs).

If a position has no fly assigned (`flies_on_cast[position]` is null/missing), the row displays the italic "**No fly set — tap to assign**" and the row's tap action opens FlyPicker (see Section 2 — missing-fly recovery).

---

## 2. AssignedFlyCard + missing-fly recovery

Below the position picker (or at the top for single-fly rigs), render a card showing the rod's assigned fly for the active position:

```
┌─────────────────────────────────────────┐
│ Fly                                  ›  │
│ Diawl Bach #14                          │
└─────────────────────────────────────────┘
```

Tap → opens `FlyPicker` in a sheet for **correction**. If the angler picks a different fly:
1. Update the local catch state's fly (this is what gets written to `session_events.fly_pattern`).
2. **Emit a `change` event** to `session_events` with:
   - `event_type = 'change'`
   - `change_type = 'fly'`
   - `change_from = <old fly>`
   - `change_to = <new fly>`
   - `change_reason = 'catch correction'`
   - `event_time = now`
3. **Update `session_rods.flies_on_cast`** so the rod state reflects the correction:
   ```sql
   UPDATE public.session_rods
   SET flies_on_cast = jsonb_set(flies_on_cast, '{<position>}', '<new fly json>'::jsonb)
   WHERE session_id = $1 AND rod_index = 0;
   ```
   (Or read+rewrite the JSON if `jsonb_set` isn't trivial via PostgREST — fine to do in two queries.)

This matches RN's `SessionScreen.tsx:865-888` behaviour. The rod's fly history stays accurate; downstream analytics see a Change event between catches when the angler retroactively realises they had a different fly on.

### Missing-fly recovery

If the position has no assigned fly, the AssignedFlyCard shows:

```
┌─────────────────────────────────────────┐
│ ⚠  No fly assigned to this position     │
│ Tap to set the fly before saving        │
└─────────────────────────────────────────┘
```

Tap → opens FlyPicker. On pick:
1. Write to `session_rods.flies_on_cast[position]`.
2. **Emit a `change` event** with `change_type = 'fly'`, `change_from = null`, `change_to = <new fly>`, `change_reason = 'recovered missing fly assignment'`. This makes the gap visible in the session timeline.

The Save button is **disabled** while the position has no assigned fly.

---

## 3. Species chip row

Vocabulary depends on `venue_type`:
- **Stillwater:** `Rainbow, Brown Trout, Brook Trout, Tiger Trout, Blue Trout`
- **River:** `Brown Trout, Grayling, Sea Trout, Salmon, Rainbow`

Render as a horizontal scroll chip row + an **Other** chip at the end. Tapping Other reveals a free-text input below the row (`<input type="text">`, max 40 chars).

**Default selection:** `user_profiles.river_default_species` for river venues, `user_profiles.stillwater_default_species` for stillwater venues. Confirm casing — the audit flagged that `user_profiles.river_default_species` may store "Brown trout" (lowercase t) and the canonical catch value should be "Brown Trout" (capital T). Apply a one-line normalisation: `species.replace(/\b(\w)/g, (c) => c.toUpperCase())` or a hardcoded map.

---

## 4. Measure-by toggle + numeric input

Segmented control: **Weight | Length**. Default: `weight` (or `user_profiles.default_size_mode` if set).

- **Weight mode:** show a `<input type="number" step="0.1">` with "lb" suffix. Decimal lb (PWA stores `weight_lb` decimal — `weight_oz` is derived). Allow blank (some catches are unmeasured; `weight_lb = null`, `weight_display = null`).
- **Length mode:** show a `<input type="number" step="0.5">` with "in" suffix. Stored as `length_inches`.

Toggle behaviour: switching mode clears the other field. So if the angler enters 2.5 lb then toggles to Length, the lb value is wiped (no implicit conversion).

Write to `session_events`:
- `measurement_mode`: `'weight' | 'length'`
- `weight_lb`: numeric in weight mode, `null` in length mode
- `length_inches`: numeric in length mode, `null` in weight mode
- `weight_display`: e.g. `'2.5 lb'` or `'14 in'`, derived from the input

---

## 5. Retrieve chip row (style-pruned)

Use `retrievesForStyle(rodStyle)` from `src/services/styleRules.ts` (landed in prompt 138). Same canonical vocabulary the RN app uses:

```
'Slow retrieve', 'Fast retrieve', 'Figure of eight', 'Strip',
'Roly poly', 'Static', 'Dead drift'
```

If the function returns a single value for the rod's style (e.g. Dry style → only `Static, Dead drift` after pruning), **and the rod's existing `retrieve` is already set to that value, hide this row entirely** and auto-emit the carried-forward value on save. Otherwise render as a chip row.

**Default selection:** the rod's current `retrieve` (carried forward from setup or previous Change event). If null and the pruned set has only one option, auto-select it.

---

## 6. Depth zone chip row (style-pruned)

Use `depthZonesForStyle(rodStyle)`. Same prompt-138 canonical vocabulary:

```
'Surface', 'Upper', 'Upper to mid', 'Mid', 'Mid to deep',
'Deep/Near bottom', 'Bottom', 'Variable/All depths'
```

**Default selection:** the rod's current `depth_zone` (carried forward). Same hide-if-single-option rule as retrieve.

The catch row write **must use the locally-edited depth zone** (not the rod's static depth) — depth varies per catch on multi-fly rigs and is the whole reason prompt 138 made depth editable per-catch.

---

## 7. Outcome toggle

Segmented control: **Released | Kept**. Default: `Released` (UK trout fishery norm).

Write to `session_events.kept_released` (confirm the column name with a pre-flight grep — RN uses `keptReleased` in state but the DB column is `kept_released` per the data audit).

---

## 8. Notes (collapsed by default)

A small `<details>` element below the outcome toggle: "Add a note (optional)". Expanded → `<textarea>`. Stored as `session_events.notes`. Default empty.

---

## 9. Save button (sticky footer)

The CTA renders at the bottom of the viewport, sticky on scroll. Label morphs based on form state:

| State | Label |
|---|---|
| No species, no size | "Save catch" |
| Species + size in weight mode | "Save · Rainbow 2.5 lb · released" |
| Species + size in length mode | "Save · Brown Trout 14 in · kept" |

**Disabled** when:
- The active position has no assigned fly (missing-fly recovery not yet completed)
- No species selected

On tap:
1. Write the catch row to `session_events`:
   ```ts
   await supabase.from('session_events').insert({
     session_id, rod_index: 0,
     event_type: 'catch',
     event_time: now,
     species,
     fly_pattern: assignedFly.name,
     fly_size: assignedFly.size ?? null,
     rig_position: position,                    // 'point' | 'top' | etc.
     measurement_mode,
     weight_lb, length_inches, weight_display,
     retrieve, depth_zone,
     kept_released,
     notes,
     latitude, longitude,                       // browser GPS at save time
     event_temp, event_wind_speed, event_wind_dir, event_pressure, event_conditions,
                                                // weather snapshot — see Section 10
   });
   ```
2. If a fly correction was made earlier (Section 2), the Change event was already written when the FlyPicker closed — no extra write here.
3. Toast "Catch saved" + dismiss CatchFlow back to the active-session ready view.

Errors: surface via `toast.error`. Don't dismiss the form on error — the angler should see what they entered.

---

## 10. Per-event weather snapshot

`session_events` has `event_temp / event_wind_speed / event_wind_dir / event_pressure / event_conditions` columns (already populated by the existing PWA catch flow per the data audit).

If the active session has cached weather (from `fishing_sessions.weather_*` set by the wizard at session start), use those values. If the page has access to a fresher live weather poll, prefer the fresher poll. Don't make a new API call per catch — that'd hammer Open-Meteo.

---

## 11. Cancel behaviour

Top-left back arrow / Cancel button. Tapping while there's any unsaved input shows a confirm dialog: "Discard this catch?". Confirmed → navigate back to the active-session ready view, no rows written.

If the user opened FlyPicker for correction (Section 2) and then cancels the whole CatchFlow, **roll back** the `session_rods.flies_on_cast` update if it was committed. Easier path: don't commit the flies_on_cast update until Save is tapped — keep the correction in local state. Implementation choice; pick the simpler one.

---

## 12. Single-fly rigs — auto-skip position

When `flyCount === 1`, the position picker (Section 1) does NOT render. Position is `'point'`. The AssignedFlyCard still shows; missing-fly recovery still applies.

---

## 13. Accessibility

- Position picker is `role="radiogroup"` with each row `role="radio"` and `aria-checked`.
- Species chip row is `role="radiogroup"` with `aria-required="true"`.
- Measure-by toggle is a segmented `role="radiogroup"`.
- Outcome toggle is a segmented `role="radiogroup"`.
- The Save button has `aria-disabled` instead of `disabled` so screen readers announce why it's not actionable.
- The missing-fly recovery card has `role="alert"` (it's a blocker the angler must address).

---

## Verification

1. **Build clean:** `npm run build`. No TS errors.
2. **Single-fly catch path** (1 fly rig, all defaults):
   - Start a session via the new wizard (prompt 141), pick `flyCount=1`, assign a fly to point, set style `Buzzer`, retrieve `Slow retrieve`, depth `Mid`.
   - Open `/diary/:id`, tap "Log a catch".
   - Confirm:
     - No position picker renders.
     - AssignedFlyCard shows the point fly.
     - Species defaults to Rainbow (stillwater).
     - Measure-by defaults to weight.
     - Retrieve and depth chip rows are hidden (single-option after style pruning, matching the existing rod state).
   - Type 2.5 lb. Tap Save. Confirm `session_events` row has `fly_pattern = '<fly>'`, `rig_position = 'point'`, `weight_lb = 2.5`, `retrieve = 'Slow retrieve'`, `depth_zone = 'Mid'`.
3. **Multi-fly catch path** (3-fly rig):
   - Start a session with `flyCount=3`, assign Diawl Bach to point / Cruncher to middle / Bibio to top, style `Wet`.
   - Tap "Log a catch". Confirm position picker shows 3 rows. Pick `middle`. AssignedFlyCard shows Cruncher.
   - Pick species Brown Trout, weight 1.8 lb, retrieve `Figure of eight`, depth `Upper to mid`. Save.
   - Confirm row has `rig_position = 'middle'`, `fly_pattern = 'Cruncher'`.
4. **Missing-fly recovery**:
   - Manually `UPDATE session_rods SET flies_on_cast = '{}'::jsonb WHERE session_id = $1` (simulate a missing assignment).
   - Tap "Log a catch". Confirm Save is disabled and the warning card renders.
   - Tap the card. FlyPicker opens. Pick a fly. Save enables.
   - Save. Confirm `session_events` has TWO rows for this session: a `change` event (`change_from = null`, `change_to = <fly>`, `change_reason = 'recovered missing fly assignment'`) and the catch event with that fly.
5. **Fly correction**:
   - On a session where the rod has Diawl Bach assigned, tap "Log a catch", tap the AssignedFlyCard, pick Cruncher instead. Save the catch.
   - Confirm `session_events` has a `change` event (Diawl Bach → Cruncher, reason "catch correction") and the catch event with Cruncher.
   - Confirm `session_rods.flies_on_cast` now has Cruncher at the catch's position (so subsequent catches at the same position pre-fill Cruncher).
6. **Style pruning**:
   - Set rig style `Dry`. Tap "Log a catch". Confirm retrieve row is hidden (only Static + Dead drift remain after pruning, and one is auto-selected).
   - Set rig style `Lure`. Confirm all 7 retrieves + all 8 depths render.

---

## Out of scope

- Voice / mic / hotword. PWA stays tap/text.
- Voice readback card. RN-only.
- Photo upload (`photo_url`). Both apps still defer this — needs Supabase Storage pipeline.
- Blank / Lost / Change flow rewrites. Prompt 143 handles Change collapse; Blank phase-1 strip + Lost vocab alignment are P1 cleanup later.
- Tab bar, mid-session ghillie row. P1 cleanup later.
- Deleting `CatchModal.tsx` from the codebase. Leave it until 142 lands and is verified; strip in a follow-up.

---

## Coordination with RN

The catch row shape this prompt writes (column names + value forms) must match what RN writes. Verify by reading `FishingDiary/src/network/sessionMapper.ts:toSupabaseEvent()` and confirming column names + types align. If they diverge, **stop and report back**.

The Change-event-on-fly-correction pattern is exactly what RN does at `SessionScreen.tsx:865-888`. If RN's `change_reason` strings differ from this prompt's, align to RN's wording (RN is canonical).

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/142_response.md`:

- Pre-flight grep findings + any deviations.
- Diff summary per section (1–13).
- Screenshots:
  - CatchFlow on a single-fly rig (no position picker, AssignedFlyCard at top).
  - CatchFlow on a 3-fly rig (position picker showing 3 rows with assigned-fly italics).
  - Missing-fly recovery state (warning card visible, Save disabled).
  - Style pruning: Dry-style screen (retrieve row hidden) and Lure-style screen (all retrieves visible).
  - Live save-button label morph: empty → "Save catch", filled → "Save · Rainbow 2.5 lb · released".
- DB rows from §3, §4, §5 of Verification, redacted on user_id.
- Any place RN's `sessionMapper.ts` shape diverged from this prompt's writer — list the column names.
- Anything where the PWA's existing patterns made strict mirroring of RN clunky — propose alternatives.
