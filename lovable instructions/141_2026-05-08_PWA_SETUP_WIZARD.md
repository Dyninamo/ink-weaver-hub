# Lovable Prompt 141 — PWA setup wizard rewrite

**Date:** 2026-05-08
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Companion docs:**
- `project_documentation/code_opus/PWA_RN_UX_PARITY_AUDIT_2026-05-08.md` (UX audit)
- `project_documentation/code_opus/PWA_RN_PARITY_AUDIT_2026-05-08.md` (data audit, already closed by 138/139/140)

**Context:** the 2026-05-08 UX audit identified five P0 gaps between the PWA and the canonical RN app (`FishingDiary/`). The biggest is **session start: PWA captures venue + leader + maybe weather, then sends the angler fishing with no rod weight, rod length, line, fishing style, dropper count, or fly identity recorded.** Every catch event lands with `style: null, rig: null, line_type: null` until a Change event fires after the first cast. RN demands all of this in a 7-phase wizard before the angler can fish.

This prompt **replaces `DiaryNew.tsx`** with a 7-step wizard that mirrors RN's `SetupScreen.tsx`. It also surfaces saved rigs (`user_presets` table — already used by RN) at the top of step 1 with one-tap apply.

**No master / Supabase schema changes are needed.** `fishing_sessions`, `session_rods`, `user_presets`, and `user_profiles` already carry every field we'll write.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/141_response.md`. Pre-flight greps required on each section before code lands.

---

## What this prompt is NOT

- It is not adding voice (PWA stays text/tap; voice is RN-only — the audit accepts this).
- It is not rewriting the Catch flow — that's prompt 142 (separate).
- It is not introducing the persistent end-session pill or collapsing the Change modals — that's prompt 143 (separate).
- It is not migrating data from `user_rod_setups` (the legacy PWA preset table) into `user_presets`. Leave the legacy table alone with a TODO; new presets go into `user_presets` so RN and PWA share preset storage.

---

## File targets (verify with pre-flight greps)

- **Replace:** `src/pages/DiaryNew.tsx` (current single-page form, 353 lines)
- **New components, suggested location `src/components/diary/setup/`:**
  - `SetupWizard.tsx` — top-level container, holds step state, wraps the 7 phases
  - `SavedRigsBanner.tsx` — top-of-step-1 chip strip
  - `RodWeightStep.tsx`, `RodLengthStep.tsx`, `LineStep.tsx`, `StyleStep.tsx`, `DroppersStep.tsx`, `FliesStep.tsx`, `SpotStep.tsx`
  - `Dial.tsx` — new primitive: a horizontal scroll-snap dial component for length / dropper count (mirrors RN's `FishingDiary/src/components/Dial.tsx`, 239 lines — read it for the reference UX)
- **Reuse:** `src/components/diary/LeaderPicker.tsx` (already lands the leader step; mount it inline as step 3 — see Section 3 of this prompt)
- **Reuse:** `src/components/diary/FlyPicker.tsx` (mount inside FliesStep)
- **Hook into:** `src/services/diaryService.ts` for the `createSession` write, **plus a new `createSessionRods` writer** (see Section 8)

---

## Pre-flight greps

Before changing anything, confirm:

```bash
# Confirm DiaryNew is the current new-session entry
grep -rIn "Route.*DiaryNew\|component={DiaryNew}\|<DiaryNew" src/

# Confirm user_presets is read by nothing on PWA today (RN-only writer)
grep -rIn "user_presets" src/

# Confirm user_rod_setups is the PWA's legacy preset table
grep -rIn "user_rod_setups" src/

# Confirm session_rods is the right per-rod table
grep -rIn "session_rods" src/

# Confirm user_profiles has the defaults we'll pre-fill from
grep -n "default_rod_weight\|default_rod_length_ft\|default_line\|default_keep_limit" src/integrations/supabase/types.ts
# Expect: row + insert + update entries on user_profiles
```

If any of these turn up something the prompt didn't anticipate (a third user-presets writer, a different session-rods schema, a half-built setup wizard hiding elsewhere), **stop and report back** — we've drifted further than the audit caught.

---

## Architecture

```
SetupWizard (state machine, holds session + activeRod state)
├─ phase: 'rod' | 'line' | 'leader' | 'style' | 'droppers' | 'flies' | 'spot'
├─ Top: WizardProgress (← / 1/7 Rod / step icon)
├─ Below progress: RigSoFarSummary (renders only filled fields; ink/cream paper card)
├─ Per-phase content:
│   rod      → SavedRigsBanner + RodWeightStep + RodLengthStep (sub-step 1b)
│   line     → LineStep
│   leader   → LeaderPicker (existing, prompt 139/140)
│   style    → StyleStep
│   droppers → DroppersStep
│   flies    → FliesStep
│   spot     → SpotStep (spot text + plan multiline + keep_limit + save-as-preset toggle)
└─ Footer: Cancel + huge primary "Next" / "Start fishing" CTA
```

**Phase transitions:** linear forward unless a saved rig is applied (jumps directly to ready, OR to `flies` if the preset has no flies — see Section 7).

**State shape** (mirrors RN's `RodSetup`, with PWA naming where reasonable):

```ts
interface RodSetupState {
  rodWeight: number | null;            // 1..12
  rodLengthFt: number | null;          // canonical feet, decimal e.g. 9.5
  lineProfile: string | null;          // 'Floating' | 'Midge tip' | 'Di-3' | etc.
  // Leader fields come from LeaderPicker (already shipped):
  leaderId: number | null;
  leaderMaterial: 'nylon' | 'copolymer' | 'mono' | 'fluoro' | 'furled' | null;
  leaderLengthFt: number | null;
  leaderStrengthLb: number | null;
  style: string | null;                // 'Dry' | 'Buzzer' | 'Lure' | etc.
  flyCount: 1 | 2 | 3 | 4 | 5 | 6;     // 1 = single fly, no droppers
  flies: Partial<Record<FlyPosition, { name: string; size?: number }>>;
}

type FlyPosition = 'point' | 'middle' | 'top' | 'd1' | 'd2' | 'd3' | 'd4';
```

Position keys depend on `flyCount` — same convention as RN (`FishingDiary/src/state/sessionState.ts:104-114`):

```
flyCount=1 → ['point']
flyCount=2 → ['point', 'top']
flyCount=3 → ['point', 'middle', 'top']      (legacy 3-fly)
flyCount=4 → ['point', 'd1', 'd2', 'top']
flyCount=5 → ['point', 'd1', 'd2', 'd3', 'top']
flyCount=6 → ['point', 'd1', 'd2', 'd3', 'd4', 'top']
```

---

## 1. SavedRigsBanner — top of step 1 (`rod`)

**Mount above the wizard's first step only.** Once the user is past step 1, the saved rigs are out of scope.

**Data source:** `user_presets` table on Supabase. Already used by the RN app — column shape is `{ id, user_id, name, rod (JSON), water_type, include_flies, created_at, last_used_at }`. The `rod` blob is the full `RodSetup` (matches the state shape above).

```sql
SELECT id, name, rod, water_type, include_flies, last_used_at
FROM public.user_presets
WHERE user_id = auth.uid()
ORDER BY last_used_at DESC
LIMIT 8;
```

**Filter rule:** if the venue has a `water_type` (read from the venue selected in venue picker, falls back to `venues_new.water_type`), keep only presets with `water_type = venue.water_type` OR `water_type IS NULL`. Null-water-type presets are legacy and shown everywhere.

**UI:** horizontal-scroll chip strip. Each chip = `{name} · {flyCount}-fly {style}` (e.g. "Bewl boat · 3-fly Buzzer"). Tap = applyPreset.

**applyPreset** logic (mirrors RN's `SetupScreen.tsx:86-119`):
1. Slot the preset's `rod` blob into the wizard's local state.
2. Best-effort `markUsed`: `UPDATE user_presets SET last_used_at = now() WHERE id = $1`.
3. **If `Object.values(preset.rod.flies).some(f => !!f?.name)` (preset carries flies)** → jump to `spot` phase (skip rod / line / leader / style / droppers / flies). The rig is fully resolved.
4. **Else (fly-less preset, the default)** → jump to `flies` phase. Pre-fill rod / line / leader / style / droppers / flyCount; the angler picks flies, then continues to spot. This mirrors RN's FSM action `SETUP_FLIES_NEEDED`.

**No banner if there are zero presets.** Don't render an empty card.

---

## 2. RodWeightStep + RodLengthStep (combined as the "Rod" phase)

This is the biggest new primitive on the PWA. RN renders rod weight + rod length as **two sub-steps in one phase** with a shared `RigSoFarSummary` card.

### 2a. Rod weight chip grid

Vocabulary (mirrors RN's `FishingDiary/src/data/vocabulary.ts:ROD_WEIGHTS`): `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12` (lined as "1#", "2#", … or just "1", "2", … — pick whichever reads cleaner in the PWA's chip style).

Default selection: `user_profiles.default_rod_weight` if set, otherwise `7` (UK trout default).

After selection: the next button advances to 2b (length) within the same phase.

### 2b. Rod length picker

Length is **a function of rod weight** — heavier rods have longer ranges. Reuse RN's range table (read `FishingDiary/src/data/vocabulary.ts:rodInchRangeForWeight` for the canonical mapping). For each weight, the dial offers length values in 6-inch increments inside the weight's range.

**Primitive:** a horizontal scroll-snap `Dial` with a `ft / m` unit toggle. Default unit: ft. Default value: `user_profiles.default_rod_length_ft` if set, otherwise the weight's median (e.g. weight 7 → 9'6").

**`Dial` component** — new primitive needed. Reference: `FishingDiary/src/components/Dial.tsx` (239 lines). On the PWA, build it as a horizontal-scroll chip rail with `scroll-snap-type: x mandatory` and `scroll-snap-align: center` per chip. The currently-snapped chip is highlighted with the rose accent. Two visible neighbours either side, faded.

The unit toggle is a small ft / m segmented control above the dial. Switching unit re-renders the dial values:
- ft mode: weight 7 → `7'0", 7'6", 8'0", 8'6", 9'0", 9'6", 10'0", 10'6", 11'0"` (range from the lookup)
- m mode: convert each ft value to metres (rounded to 0.05 m) and label as `2.13 m, 2.29 m, …`. Storage canonical stays feet (`rodLengthFt = lengthInches / 12`).

Sensible default fires on phase open so Next is enabled before the angler swipes. RN does this at `SetupScreen.tsx:551-696`.

---

## 3. LeaderStep — reuse existing `LeaderPicker`

The leader picker landed in prompts 139/140 with material chips + length picker (ft/m) + strain picker (lb/X). Mount the existing `LeaderPicker` component as the body of the leader phase. **Don't re-implement.** If the existing component renders chip grids rather than scroll-snap dials, leave it for now — the audit flagged that as a P1 cosmetic; this prompt closes the structural P0 first.

The wizard's local `RodSetupState` already has `leaderId / leaderMaterial / leaderLengthFt / leaderStrengthLb` — wire `LeaderPicker`'s onChange into those fields.

---

## 4. LineStep

Vocabulary: derive from rod weight using `linesForWeight(weight)` (mirror RN's `FishingDiary/src/data/vocabulary.ts`). Typical UK reservoir loadout for weight 7: `Floating, Midge tip, Slow glass, Di-3, Di-5, Di-7, Booby basher`. For lighter weights (3-5), substitute a smaller list (`Floating, Sink-tip`).

**Primitive:** vertical chip column. Each chip is one line profile. Tap to select.

Default: `user_profiles.default_line_profile` if set and present in `linesForWeight`. Otherwise `Floating` (the UK trout reservoir default).

---

## 5. StyleStep

Vocabulary (mirrors RN's `FishingDiary/src/data/vocabulary.ts:STYLE_OPTIONS`):
```
'Dry', 'Dry-Dropper', 'Buzzer', 'Wet', 'Nymph', 'Nymph/Buzzer',
'Euro Nymph', 'Lure', 'Lure+Nymph'
```

**Primitive:** chip grid (3 columns × 3 rows). No default — the angler must pick a style. Add a small **Skip** text button below the grid in case the angler doesn't want to commit (`style` is nullable).

---

## 6. DroppersStep

**Primitive:** scroll-snap `Dial` with values `1, 2, 3, 4, 5, 6`. Labels:
- `1` → "Single fly"
- `2..6` → "n flies" (e.g. "3 flies")

Default: last-used per (rodWeight, line) — mirror RN's `setupHistory.getLastDropperCount(rodWeight, line)`. PWA equivalent: query `user_presets` for the most recent preset with matching rod_weight and line_profile, read its `flyCount`. If none, default `2`.

After selection: advance to FliesStep.

---

## 7. FliesStep

**Primitive:** vertical list of position rows. Position labels follow the keys table above:
- `flyCount=1` → 1 row: "Point fly"
- `flyCount=2` → 2 rows: "Point fly", "Top / bob"
- `flyCount=3` → 3 rows: "Point fly", "Middle dropper", "Top / bob"
- `flyCount=4` → 4 rows: "Point fly", "1st dropper", "2nd dropper", "Top / bob"
- `flyCount=5` → 5 rows: "Point fly", "1st dropper", "2nd dropper", "3rd dropper", "Top / bob"
- `flyCount=6` → 6 rows: "Point fly", "1st dropper", "2nd dropper", "3rd dropper", "4th dropper", "Top / bob"

Each row shows the position label + the currently-assigned fly name (or italic "Tap to pick a fly"). Tap opens existing `FlyPicker` (`src/components/diary/FlyPicker.tsx`) in a sheet/modal. On pick, write to `state.flies[position] = { name, size? }`.

**All positions must be filled** before Next is enabled. Single-fly rigs (flyCount=1) only need the point.

---

## 8. SpotStep + commit

Final step. Three controls vertically:
1. **Spot** (free-text input, max 80 chars, label "Where on the venue?", placeholder "Boat 7 / South bank / Dam wall …")
2. **Plan** (multiline `<textarea>`, label "Today's plan", placeholder "Static buzzers under indicator until risers")
3. **Keep limit** (number input, label "Keep limit", helper text "0 = catch & release"). Default: `user_profiles.default_keep_limit`, fall back to `2`.

Below the controls: a **"Save this rig as a preset?"** sub-card with:
- Toggle: off (default) / on
- If on, two radio options: `Rig only` / `Rig + flies`
- Name input (auto-fills with `${style} · ${flyCount}-fly · ${lineProfile}`)

Big rose primary CTA at the bottom: **"Start fishing"**.

### Commit logic

On Start fishing click, **write three rows in this order**, all in one transaction shape (sequential awaits, fail loud — no silent fallbacks):

#### 8a. `fishing_sessions` row

```ts
const { data: session, error } = await supabase
  .from('fishing_sessions')
  .insert({
    user_id: user.id,
    source: 'diary',
    venue_name,
    venue_type,        // 'stillwater' | 'river'
    session_date,
    start_time,
    fishing_type,      // 'Bank' | 'Boat' | 'Both'
    plan,
    rods: 1,           // wizard captures one rod for now; multi-rod is a follow-up
    keep_limit,
    rod_weight,        // from RodSetupState
    rod_length_ft,
    line_profile,
    fishing_style: style,    // confirm column name with pre-flight grep
    leader_id,
    leader_material,
    leader_length_ft,
    leader_strength_lb,
    spot_name,
    weather_temp,      // from optional weather block (carry forward if present)
    weather_wind_speed,
    weather_wind_dir,
    weather_pressure,
    weather_conditions,
    is_active: true,
  })
  .select()
  .single();
if (error) throw error;
```

#### 8b. `session_rods` row (rod_index = 0)

```ts
const { error: rodError } = await supabase
  .from('session_rods')
  .insert({
    session_id: session.id,
    rod_index: 0,
    name: 'Rod 1',
    rod_weight,
    rod_length_ft,
    line_profile,
    line_name: line_profile,   // legacy mirror
    leader_id,
    style,
    dropper_count: flyCount - 1,   // RN convention: dropper_count = flyCount - 1 (point isn't a dropper)
    flies_on_cast: flies,           // JSON: { point: {name,size?}, top: {name,size?}, ... }
    started_at: now,
    is_active: true,
  });
if (rodError) throw rodError;
```

This row is what the catch flow (prompt 142) will read to populate `fly_pattern` based on position.

#### 8c. (optional) `user_presets` row — only if "Save as preset" toggle was on

```ts
const presetId = crypto.randomUUID();
const rodBlob = {
  id: presetId,
  name,
  rodWeight, rodLength: `${rodLengthFt}ft`, line: line_profile,
  leaderLength: leader_length_ft ? `${leader_length_ft}ft` : null,
  leaderId: leader_id,
  leaderMaterial: leader_material,
  leaderStrengthLb: leader_strength_lb,
  style, retrieve: null, depth: null,
  flyCount,
  flies: includeFlies ? flies : {},
};
await supabase.from('user_presets').insert({
  id: presetId,
  user_id: user.id,
  name: presetName,
  rod: rodBlob,
  water_type: venue.water_type ?? null,
  include_flies: includeFlies,
});
```

The `rod` blob shape mirrors RN's `RodSetup` so RN reads PWA-saved presets and vice versa.

After all three writes succeed, navigate to `/diary/${session.id}` (the active-session page).

If any write fails, **roll back what's written** (delete the session row if 8b/8c failed; delete the rod row if 8c failed). Don't leave orphan rows. Surface the error via `toast.error`.

---

## 9. Defaults that pre-fill on first load

Read `user_profiles` once on wizard mount and pre-fill where present:

| State field | Source |
|---|---|
| `rodWeight` | `default_rod_weight` |
| `rodLengthFt` | `default_rod_length_ft` |
| `lineProfile` | `default_line_profile` |
| `leaderId` | `default_leader_id` (already used by LeaderPicker) |
| `keepLimit` | `default_keep_limit` |

Wizard primitives still let the angler tap-override on each step. Defaults exist so Next is lit on phase open.

---

## 10. Cancel / abandon behaviour

A small text-button **Cancel** in the wizard header (top-left, next to the back arrow). Tapping it shows a confirm dialog: "Discard this rig?". If confirmed, navigate back to `/diary` without creating any rows.

If the user navigates away mid-wizard (browser back, route change), no rows are written — the wizard's state is local until the final commit.

---

## 11. Accessibility notes

- Each chip / dial is `<button type="button">` with proper `aria-pressed` / `aria-label`.
- The progress indicator uses `aria-current="step"` on the active phase label.
- The "Start fishing" CTA disables until all required fields on the current phase are valid (each step's "Next" enables only when the step is satisfiable per its rules).
- Dial controls have `role="slider"` with `aria-valuenow / aria-valuemin / aria-valuemax / aria-valuetext` (the human-readable label like "9'6"").

---

## Verification

After landing, walk through:

1. **Build clean:** `npm run build`. No TS errors.
2. **Empty-state**: brand-new user with no presets, no profile defaults. Wizard should:
   - Open on `rod` phase with no banner.
   - Show rod weight chips with no default selected. Picking 7 advances to length sub-step.
   - Length dial defaults to 9'6". Next advances to leader.
   - Leader picker (existing) defaults to nylon-15ft-6lb? Confirm.
   - Style: no default. Pick `Buzzer`.
   - Droppers: defaults to 2.
   - Flies: 2 rows ("Point", "Top"). Pick a fly for each. Next.
   - Spot: type "South bank", plan "Static buzzers", keep_limit 2. Toggle "Save as preset" off. Tap Start.
3. **DB row check:**
   ```sql
   SELECT
     fs.rod_weight, fs.rod_length_ft, fs.line_profile, fs.fishing_style,
     fs.leader_material, fs.leader_length_ft, fs.leader_strength_lb,
     fs.spot_name, fs.plan, fs.keep_limit
   FROM public.fishing_sessions fs
   WHERE fs.user_id = auth.uid()
   ORDER BY fs.created_at DESC LIMIT 1;

   SELECT rod_index, rod_weight, rod_length_ft, line_profile, style, dropper_count, flies_on_cast
   FROM public.session_rods
   WHERE session_id = '<session id from above>';
   ```
   All columns populated. `flies_on_cast` is a JSON object with `point` and `top` keys.
4. **Preset save**: repeat the flow with "Save as preset" on, name "Bewl boat buzzer". Confirm a row lands in `user_presets` with `include_flies = false` (rig-only) or `true` (rig + flies). The `rod` blob's `flies` is `{}` if rig-only.
5. **Preset apply**: start a third session at a stillwater venue. Confirm the SavedRigsBanner shows "Bewl boat buzzer" at the top of step 1. Tap it. Wizard jumps to:
   - **`spot`** if the saved preset had flies (Rig + flies).
   - **`flies`** if the saved preset was rig-only. Pre-fills rod / line / leader / style / droppers / flyCount; angler picks flies; advances to spot.
6. **Water-type filter**: save a preset on a stillwater venue. Start a session at a river venue. Confirm the stillwater preset is **not** in the banner.
7. **Cancel**: start the wizard, advance to leader step, tap Cancel → confirm → back at `/diary`. No `fishing_sessions` row exists (`SELECT count(*) ...` should be unchanged).

---

## Out of scope

- **Multi-rod sessions.** RN supports up to 4 rods; this prompt captures one. Multi-rod is a follow-up — `session_rods.rod_index` is already in the schema, the wizard just doesn't surface a "Add another rod" affordance yet.
- **Voice.** PWA stays text/tap. Voice is RN-only.
- **Migrating `user_rod_setups` data into `user_presets`.** Leave the legacy table alone with a code-comment TODO; new presets go into `user_presets`. A separate housekeeping prompt can dedupe later.
- **The Catch flow rewrite.** Prompt 142 will pick up where this leaves off — reading `session_rods.flies_on_cast` to pre-fill catch events.
- **Persistent end-session pill / Change-flow collapse.** Prompt 143.
- **Tab bar, mid-session ghillie, BlankModal phase-1 strip, LineCascadePrompt strip.** Later P1 cleanup.

---

## Coordination with RN

The RN app already writes `user_presets` with the same `rod` blob shape — when both apps share a Nick or Alun account, presets created on one app should appear in the other's banner. **Do not change the `user_presets` schema** in this prompt; if you find a column the prompt didn't anticipate, stop and report back.

The `session_rods.flies_on_cast` JSON shape (`{ point: {...}, top: {...}, ... }`) must match the RN catch-flow reader. If RN reads a different shape, we'll need to align — flag this in the response.

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/141_response.md`:

- Pre-flight grep findings + any deviations from this prompt's expected files.
- Diff summary per section (1–10).
- Screenshots:
  - SavedRigsBanner with at least one preset chip.
  - Rod-weight step with chip grid.
  - Rod-length dial in ft mode and in m mode (toggle visible).
  - Style step (chip grid).
  - Droppers dial.
  - Flies step with all positions filled.
  - Spot step with "Save as preset" toggle on.
- DB verification rows from §3 of Verification, redacted on user_id.
- Anywhere the PWA's existing patterns made strict mirroring of RN clunky — propose alternatives, don't force a bad fit.
- Any column you found on Supabase that this prompt didn't reference but should have (we're working off post-Session-28 schema; report drift).
