# Lovable Prompt 139 — PWA leader picker

**Date:** 2026-05-08
**Context:** prompt 138's response noted that the PWA never grew a
leader picker UI — only the `leaders` table type and the
`fishing_sessions.leader_id` / `leader_length_ft` / `leader_strength_lb`
columns exist. The RN-app rebuilt the leader step on 2026-05-08 and we
want PWA parity so both apps capture the same data shape.

This prompt adds the missing step to `SetupCascade` and wires the new
state through to the session-create write. **No master / Supabase
schema changes needed** — every column already exists.

**Capture protocol:** per prompt 128, log to
`lovable instructions/responses/139_response.md`.

---

## What to build

A **Leader** step in `SetupCascade.tsx`, slotted **between Rig and
Line** (so the order becomes Style → Rig → Leader → Line → Retrieve →
Depth). Three sub-controls in this order:

### 1. Material (chip row, 5 options, must pick)

`nylon`, `copolymer`, `mono`, `fluoro`, `furled`

These match the Supabase `leaders.material` CHECK constraint added in
prompt 136. No catalogue filtering — show all 5 regardless of which
have rows in the `leaders` table.

Default: nothing selected (must tap to pick). Until a material is
picked, the rest of the leader sub-step can be hidden or just rendered
greyed-out — pick whichever is less janky.

### 2. Length picker with ft / m unit toggle

**ft mode (default):** `6, 9, 12, 15, 18, 21, 24, 27` (3-foot multiples from 6)
**m mode:** `2, 3, 4, 5, 6, 7, 8, 9` (1-metre multiples from 2)

Storage canonical: feet on `fishing_sessions.leader_length_ft`. When
the angler picks a metre value, convert: `lengthFt = round(m * 3.2808 * 10) / 10`.

Default value: **15 ft** (median of the ft set; sensible UK trout default).

UI shape: any picker that's tap-friendly — a chip row, a horizontal
scroll-snap dial, or a dropdown is fine. The RN app uses a horizontal
scroll-snap dial (`Dial.tsx`); the PWA can use whatever pattern fits
its existing design language. Whatever you pick, the unit toggle
(`ft` / `m`) must visibly swap the option set.

### 3. Breaking-strain picker with lb / X unit toggle

**lb options (10):** `2, 3, 4, 5, 6, 8, 10, 12, 15, 20`
**X labels** (display only — diameter rating, not strain):

```
2  → 7X
3  → 6X
4  → 5X
5  → 5X
6  → 4X
8  → 3X
10 → 2X
12 → 1X
15 → 0X
20 → 0X+
```

Storage canonical: lb on `fishing_sessions.leader_strength_lb`. The X
toggle is **display only** — picking 4X stores 6 (lb).

Default value: **6 lb** (sensible UK trout default; 4X equivalent).

---

## Catalogue resolution

On step commit, do a **best-effort lookup** against the `leaders`
Supabase table:

```sql
SELECT id FROM public.leaders
WHERE active = true
  AND material = $material
  AND length_ft = $length_ft
  AND breaking_strain_lb = $breaking_strain_lb
LIMIT 2;
```

- Exactly one match → write that `id` to `fishing_sessions.leader_id`.
- Zero or multiple matches → `leader_id = null`.

Always write `leader_material`, `leader_length_ft`, `leader_strength_lb`
to the `fishing_sessions` row regardless of whether `leader_id`
resolved. Downstream analytics use the columns directly; `leader_id`
is just the FK convenience link when the catalogue happens to cover
the angler's actual gear.

**Don't** show a "no leader matches" greyed affordance — the previous
RN flow had one and it dead-ended users whose gear wasn't in the
catalogue. The new model lets the angler proceed with their actual
gear, and the analytics pipeline doesn't care whether `leader_id` is
set. If the picker resolves no row, just commit and continue.

---

## Pre-fill from prior session

If the user has any prior session for the same angler+venue (or the
last completed session, whichever is easier), pre-fill all three
fields from that session's `leader_material` / `leader_length_ft` /
`leader_strength_lb` so common-case repeat-rigs need zero taps.

Fall back to defaults (null / 15 / 6) if no prior session exists.

---

## State + writes

Add three fields to whatever local state object `SetupCascade` builds
and hands off to `DiaryNew`'s session-create call:

```ts
leader_material: 'nylon' | 'copolymer' | 'mono' | 'fluoro' | 'furled' | null;
leader_length_ft: number | null;          // canonical feet
leader_strength_lb: number | null;        // canonical lb
leader_id: string | null;                 // best-effort catalogue match
```

The `fishing_sessions` insert in `DiaryNew.tsx` should map these onto
the Supabase columns of the same name. They're already in the
generated types per the 138 response.

---

## Pre-flight greps

Before changing anything, confirm:

```bash
grep -rIn "leader_id\\|leader_length_ft\\|leader_strength_lb" src/
# expect hits in types.ts + sessionMapper-equivalent + nowhere else

grep -rIn "SetupCascade" src/
# locate where it's mounted and what state it produces

grep -rIn "FRIENDLY_LINE_NAMES\\|RIG_OPTIONS\\|FISHING_STYLES" src/
# find the existing chip-row patterns to mirror

grep -n "from.*leaders" src/services/diaryService.ts || true
# check if a leader-catalogue loader already exists
```

If any of these turn up something the prompt didn't anticipate (e.g. a
half-built leader picker hiding in another file), stop and report
back.

---

## Verification

1. **Build clean:** `npm run build`.
2. **Walk a fresh session through SetupCascade:**
   - Step order Style → Rig → **Leader** → Line → Retrieve → Depth.
   - Confirm 5 material chips render; tapping one un-greys the rest.
   - Confirm length picker defaults to **15ft**; toggle ft↔m; pick **5m**, confirm dial reads "5m" and stored canonical is `5 * 3.2808 ≈ 16.4ft`.
   - Confirm strain picker defaults to **6lb**; toggle lb↔X; confirm 6 lb shows as **4X** when toggled.
3. **DB write check:**
   ```sql
   SELECT leader_material, leader_length_ft, leader_strength_lb, leader_id
   FROM public.fishing_sessions
   WHERE user_id = auth.uid()
   ORDER BY created_at DESC LIMIT 1;
   ```
   Confirm all four columns populated. If the (material, length, strain) tuple matches a `leaders` row, `leader_id` should be the matching UUID; otherwise null.
4. **Pre-fill check:** start a second session at the same venue without changing the picker. Confirm material/length/strain reflect the previous session's values.

---

## Out of scope

- Master DB / Supabase schema changes (everything's there).
- RN app changes (parity already landed today).
- Adding arbitrary materials beyond the 5 (user-extensibility was
  rejected on 2026-05-08; the 5-value CHECK constraint stays).
- A "browse the leaders catalogue" UI — the catalogue is a backend
  detail, not user-facing.

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/139_response.md`:

- Pre-flight grep findings + any deviations.
- Diff summary per sub-step (1 / 2 / 3 / catalogue resolution / pre-fill / state-and-writes).
- One screenshot of the leader step on a fresh session (5 chips + length picker showing 15ft + strain picker showing 6lb).
- One screenshot after toggling **m** + **X** so the labels visibly swap.
- DB row from §3 of Verification, redacted on user_id.
- Anything where the PWA's existing patterns made strict mirroring of RN clunky — propose alternatives, don't force a bad fit.
