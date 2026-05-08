# Lovable Prompt 138 — PWA-RN parity refresh

**Date:** 2026-05-08
**Context:** the RN-app rebuild (per `RN_REBUILD_BRIEF_2026-05-08.md`)
landed today and exposed several UX gaps where the PWA and the RN app
have drifted. We want both apps to capture the same data with the same
patterns so the master DB stays consistent.

This prompt is **PWA-only** — no master / Supabase schema changes
needed. Every column referenced already exists in the relevant table.

**Capture protocol:** per prompt 128, log to
`lovable instructions/responses/138_response.md`. Pre-flight greps
expected on each section before code lands.

---

## 1. Catch retrieve picker → chip row, style-pruned

**File:** `src/components/diary/CatchModal.tsx`

Today the retrieve field at step 4 is a `DiaryAutocomplete` with `options={[]}` — free-text. It should be a chip row pulled from the canonical retrieve set, **filtered by the active rod's `style`** so the angler doesn't see nonsense options.

**Canonical retrieves** (mirrors `FishingDiary/src/data/vocabulary.ts`):

```
'Slow retrieve', 'Fast retrieve', 'Figure of eight', 'Strip',
'Roly poly', 'Static', 'Dead drift'
```

Mention counts in the YouTube atom corpus (18k atoms): figure-of-eight 246, stripping 146, slow retrieve 141, static 117, drift forms ~210, fast retrieve 66, dead drift 59, roly-poly 32. All seven are real.

**Style-pruning rules** (mirrors `FishingDiary/src/lib/styleRules.ts`):

| Style | Retrieves shown |
|---|---|
| Dry | Static, Dead drift |
| Dry-Dropper | Static, Dead drift |
| Buzzer | Slow retrieve, Figure of eight, Static, Dead drift |
| Wet | Slow retrieve, Figure of eight, Static |
| Nymph | Slow retrieve, Figure of eight, Static, Dead drift |
| Nymph/Buzzer | Slow retrieve, Figure of eight, Static, Dead drift |
| Euro Nymph | Dead drift, Static |
| Lure | Slow retrieve, Fast retrieve, Strip, Roly poly, Figure of eight, Static |
| Lure+Nymph | Slow retrieve, Strip, Figure of eight, Static |
| (style unset / unknown) | all 7 |

If only one retrieve remains for a style, **hide the chip row entirely** and auto-emit that single value on save.

Suggested location for the helper: `src/services/styleRules.ts` (new) so the same lookup can be reused by `BlankModal` / `LostModal` if needed later.

---

## 2. Depth zone → editable per-catch, style-pruned

**File:** `src/components/diary/CatchModal.tsx`

Today depth_zone is a "CARRY FORWARD" field — it's set on rig setup and propagated to every catch unchanged. Per the RN parity audit, depth zone genuinely varies per catch (a fish on a buzzer might be at "Upper", another at "Mid"). Make it an editable chip row, style-pruned.

**Canonical depth zones** (mirrors `NORMALISED_DEPTH_ZONES` in `src/services/diaryService.ts`):

```
'Surface', 'Upper', 'Upper to mid', 'Mid', 'Mid to deep',
'Deep/Near bottom', 'Bottom', 'Variable/All depths'
```

**Style-pruning rules:**

| Style | Depths shown |
|---|---|
| Dry | Surface |
| Dry-Dropper | Surface, Upper |
| Buzzer | Upper, Upper to mid, Mid |
| Wet | Upper, Upper to mid, Mid |
| Nymph | Upper to mid, Mid, Mid to deep, Deep/Near bottom, Bottom |
| Nymph/Buzzer | Upper, Upper to mid, Mid, Mid to deep |
| Euro Nymph | Mid, Mid to deep, Deep/Near bottom, Bottom |
| Lure | all 8 (booby/popper through fast-sink + fly tight to bottom) |
| Lure+Nymph | Upper, Upper to mid, Mid, Mid to deep, Deep/Near bottom |
| (style unset) | all 8 |

Default the chip selection to the rig's existing `depth_zone` (the carry-forward value). Single-option styles (Dry → Surface) auto-emit and hide the row.

The catch row write at line ~180 already passes `depth_zone: currentSetup.depth_zone` — change to `depth_zone: depthZone` where `depthZone` is the locally edited state.

---

## 3. Leader picker → free-pick chip + dial flow

**File:** `src/components/diary/SetupCascade.tsx` (or wherever the
post-prompt-135 simplified leader picker lives — confirm via grep on
`leader_id` / `leaderMaterial` / `LEADER_MATERIALS`).

The RN app rebuilt the leader step on 2026-05-08 because the previous
catalog-driven chip flow dead-ended on materials with zero rows in the
Supabase `leaders` table (e.g. `mono`, `furled` were 0). New design:

**Material chips** (5, always present):
`nylon`, `copolymer`, `mono`, `fluoro`, `furled`

**Length picker** with `ft / m` unit toggle:
- ft mode: `6 / 9 / 12 / 15 / 18 / 21 / 24 / 27` (3-foot multiples from 6)
- m mode: `2 / 3 / 4 / 5 / 6 / 7 / 8 / 9` (1-metre multiples from 2)
- Storage canonical: feet (rounds m × 3.2808 to nearest 0.1ft for the rod state)

**Breaking-strain picker** with `lb / X` unit toggle:
- lb options: `2, 3, 4, 5, 6, 8, 10, 12, 15, 20`
- X labels (display only):

```
2 → 7X
3 → 6X
4 → 5X
5 → 5X
6 → 4X
8 → 3X
10 → 2X
12 → 1X
15 → 0X
20 → 0X+
```
- Storage canonical: lb (`leaders.breaking_strain_lb`)

**Defaults** (so the Next button is lit before any swipes):
- length: 15ft
- strain: 6lb
- material: null (must pick — 5 chips visible)

**Catalogue resolution:** on commit, do a best-effort exact match against the `leaders` Supabase table (filter by `material` + `length_ft` + `breaking_strain_lb`). If exactly one row matches, write `leader_id`. Otherwise `leader_id = null` and still record `leader_material` / `leader_length_ft` / `leader_strength_lb` on the `fishing_sessions` row.

Drop the previous "No leader matches — add new" greyed affordance entirely. The new model lets the angler proceed with their actual gear regardless of catalogue coverage; downstream analytics use the columns rather than `leader_id`.

---

## 4. Catch measurement mode (weight | length)

**File:** `src/components/diary/CatchModal.tsx`

Add a small **Weight | Length** toggle on the catch step. Default `weight`. If `length`, swap the existing weight input for an inches input.

Write to `session_events`:
- `measurement_mode`: `'weight'` or `'length'`
- `length_inches`: numeric in length mode, `null` in weight mode
- `weight_lb` / `weight_oz` / `weight_display`: as today in weight mode, `null` in length mode

These columns already exist on `session_events`.

The PWA already mostly supports this (`measureMode` is in scope at line 170 of CatchModal). Confirm the toggle is rendered prominently, not buried behind another tap.

---

## 5. Sensible defaults to enable Next/Save

Audit the simplified DiaryNew + SetupCascade screens for any "Next" or "Save" button that's disabled until the user explicitly picks a value, even when a sensible default exists. The RN-side feedback today was "Next won't light" because dials started null — the angler had to swipe each one just to enable the flow.

Where a sensible default exists (e.g. leader length 15ft, strain 6lb, depth zone = previous rig value), **pre-fill it**. The user can override by tapping; absence of a tap should mean "I'll take the default", not "I'm blocked".

Don't pre-fill species or weight — those genuinely have no useful default per catch.

---

## 6. Voice-flow biasing — out of scope

The PWA doesn't have a SpeechRecognizer biasing API like the RN app's `biasingProfiles.ts`. If the PWA grows a voice flow later, mirror RN's style-pruning then. No-op for this prompt.

---

## Pre-flight greps

Before changing anything, confirm:

```bash
grep -n "options=\\{\\[\\]\\}" src/components/diary/CatchModal.tsx
# expect 1+ hit on the retrieve autocomplete

grep -rIn "currentSetup.depth_zone" src/
# expect carry-forward refs in CatchModal + maybe BlankModal/LostModal

grep -rIn "leaderMaterial\\|LEADER_MATERIALS\\|leader_material" src/
# locate the current leader picker

grep -rIn "measurement_mode\\|measureMode" src/components/diary/
# confirm the toggle exists or is partial
```

Stop and report back if any pre-flight finds something the prompt didn't anticipate (renamed file, third place writing `depth_zone`, additional modal for events, etc.).

---

## Verification

1. **Build clean**: `npm run build` succeeds.
2. **No-mid-flow regressions**: open `/diary/new`, complete a stillwater session through to one catch, end session. Confirm `session_events` row has:
   - `retrieve` populated (one of the 7 canonical values)
   - `depth_zone` populated (one of the 8)
   - `measurement_mode` populated (`'weight'` or `'length'`)
   - `length_inches` set in length mode, null in weight mode
   - `leader_id` either matches a `leaders.id` row OR is null with `leader_material` / `leader_length_ft` / `leader_strength_lb` populated on the session row
3. **Style-pruning visual check**:
   - Set rig style to **Dry**: catch screen depth row is hidden, retrieve chips are just `Static`, `Dead drift`
   - Set rig style to **Lure**: all 7 retrieves + all 8 depths visible
4. **Defaults check**: pick **fluoro** material on a fresh leader step. Without swiping the length or strain picker, confirm Next is enabled with `15ft` and `6lb` ready to commit.

---

## Out of scope

- Master / Supabase schema changes (everything needed is already there)
- RN app changes (parallel work landed under `round3-redesign-wip` today)
- Voice biasing (PWA has none)
- Settings.tsx species casing flip (separate prompt later)
- The 109k 'Trout' umbrella in passport-imported data (ingestion-pipeline fix, not app-level)

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/138_response.md`:

- Pre-flight grep findings + any deviations from this prompt's expected files
- Diff summary per section (1–5)
- One screenshot of the Lure-style catch screen (all 7 retrieves + all 8 depths)
- One screenshot of the Dry-style catch screen (depth row hidden, 2 retrieves)
- One screenshot of the new leader picker (5 material chips + length picker with ft/m toggle + strain picker with lb/X toggle)
- Any places the PWA's existing patterns made strict mirroring of RN clunky — propose alternatives, don't force a bad fit
