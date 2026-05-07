# Lovable response — Prompt 134

**Prompt file:** `lovable instructions/134_2026-05-07_INVESTIGATE_DIARYNEW.md`
**Applied:** 2026-05-07
**Status:** investigation only

## Changes applied

**None — investigation only, no migrations or code edits.**

## Pre-flight check

n/a (investigation prompt).

## Findings

### A. The actual write path

`DiaryNew.tsx:106-134` → `createSession()` → `diaryService.ts:149` →
`supabase.from('fishing_sessions').insert(session as any)`. **No
sessionMapper, no `omitNulls`, no field stripping.** Whatever the wizard
hands over goes straight into the insert payload as-is.

DiaryNew explicitly forwards all 12 wizard columns (lines 122-133):

```ts
rod_weight, rod_length_ft, leader_id, line_profile,
tippet_length_ft, tippet_strength, tippet_unit, dropper_count,
spot_name, keep_limit, size_mode, size_units
```

### B. Setup presets — competing data location

```bash
grep -rIn -E "setup_preset|diary_setup|preset_id|setup_id" \
     src/pages/DiaryNew.tsx src/components/diary/SetupWizard.tsx \
     src/services/diaryService.ts src/pages/DiarySetups.tsx
```

→ **zero hits.** No `setup_presets` / `diary_setups` table is in the
write path. Hypothesis 2 refuted at the source level.

### C. Live insert payload

Reading `DiaryNew.tsx:106-134` literally: the payload **always**
includes all 12 wizard fields — they are not behind a conditional.
Their values come from `WizardResult w`, which `SetupWizard.tsx:163-180`
populates from `useState` slots whose initial values are:

| Field | Initial state |
|---|---|
| `rod_weight` | `null` |
| `rod_length_ft` | `9` (default!) |
| `line_profile` | `"WF"` (only emitted on river venues) |
| `leader_id` | `null` |
| `tippet_length_ft` | `null` |
| `tippet_strength` | `null` |
| `tippet_unit` | `"lb"` (only emitted if strength != null) |
| `dropper_count` | `2` (default!) |
| `spot_name` | `""` → emitted as `null` |
| `keep_limit` | `0` (default!) |
| `size_mode` | `"weight"` (default!) |
| `size_units` | `"lb"` (default!) |

So if a real DiaryNew session ran end-to-end with the user only entering
a venue and clicking through the wizard, you would expect AT MINIMUM:
`rod_length_ft=9`, `dropper_count=2`, `keep_limit=0`,
`size_mode="weight"`, `size_units="lb"` — all five defaulted.

### D. Live data — the reveal

Counts by source:

| source | rows | rod_weight non-NULL | spot_name non-NULL | dropper_count non-NULL |
|---|---|---|---|---|
| passport | 45,084 | 0 | 0 | 0 |
| diary | 17 | 0 | 0 | 0 |

The 17 "diary"-source rows include 2 obvious test fixtures
(`[TEST] Grafham Water`, `[TEST] River Usk`) and a wave of
`venue_name="Unknown"` rows (Apr-May 2026), all from one `user_id`,
none with weather, plan, or any wizard field.

Critical detail: **DiaryNew refuses to create a session with an empty
venue** (`if (!user || !venue.trim()) return;`). So the
`venue_name="Unknown"` rows did **not** come from DiaryNew. There is no
other `createSession` caller in `src/`, and no `.insert` to
`fishing_sessions` outside `diaryService.ts`. The Unknowns must be
synthetic — either seeded via `upload-diary-sessions` (the admin batch
upserter) or a manual DB insert.

In other words: **DiaryNew has produced zero observable rows in the
production dataset.** The 0% non-NULL audit isn't telling us "DiaryNew
writes nulls" — it's telling us "DiaryNew has not been used end-to-end".

## Verification

- Read `DiaryNew.tsx:1-200`, `SetupWizard.tsx:1-180`,
  `diaryService.ts:145-260`.
- `grep -rIn createSession src/` → 1 caller (DiaryNew).
- `grep -rIn "fishing_sessions" src/ supabase/functions/ | grep -E "\.insert|\.upsert"` →
  only `upload-diary-sessions` (admin bulk) and the
  `diaryService.ts:createSession` path.
- DB: counts by source/column above; per-row inspection of the 17
  diary-source rows.

## Errors / warnings

None — read-only.

## Anything else Claude Code should know

**Verdict per hypothesis:**

- **Hypothesis 1 (optional, users skip):** *Partially supported but
  insufficient.* The wizard does have nullable fields, but it also has
  five non-null defaults (`rod_length_ft=9`, `dropper_count=2`,
  `keep_limit=0`, `size_mode="weight"`, `size_units="lb"`). If real
  DiaryNew traffic existed, those five would not all be 0% non-NULL.

- **Hypothesis 2 (lives in `setup_presets`):** *Refuted.* No such table
  is referenced anywhere in DiaryNew, SetupWizard, diaryService, or
  DiarySetups. The 12 columns are the canonical home for this data in
  the current code.

- **Hypothesis 3 (broken refactor):** *Refuted at the writer level
  (insert payload is correct), but the underlying truth is more
  embarrassing — **DiaryNew has produced zero real sessions.* All 17
  diary-source rows have `venue_name="Unknown"` or `[TEST]` markers,
  none of which DiaryNew can produce. The route is wired in App.tsx,
  9 CTAs point to it, but no end-user has actually completed a session
  through it (or every completion is being blanked by a bug we haven't
  isolated yet).

**Recommendation:** **Do NOT drop the 12 columns yet.** The 0% non-NULL
result is a *usage* signal, not a *schema* signal. Before any drop,
either:
1. Confirm DiaryNew is dead in practice (analytics: zero `/diary/new`
   completions in the last 30 days) → then delete DiaryNew + drop the
   columns together as one feature retirement.
2. Or fix whatever is preventing DiaryNew from producing rows (the
   "Unknown" rows hint at a legacy or test path competing for the
   `source='diary'` namespace), then re-audit in 30 days.

The right next prompt is "find me all session-create traffic by route
and user in the last 30 days" — not another schema drop.
