# Lovable response — Prompt 132

**Prompt file:** `lovable instructions/132_2026-05-07_FISHING_SESSIONS_DRIFT.md`
**Applied:** 2026-05-07
**Status:** Phase A applied. Phase B fully deferred (all 15 candidates have live writers). Phase C out of scope.

## Pre-flight grep classification

| Column | Classification | Reference |
|---|---|---|
| `rod_weight` | **Live writer** | `SetupWizard.tsx:164`, `DiaryNew.tsx:122`, `RodPickerSheet.tsx:12,101`, read `DiaryEntry.tsx:433` |
| `rod_length_ft` | **Live writer** | `SetupWizard.tsx:165`, `DiaryNew.tsx:123`, read `DiaryEntry.tsx:434` |
| `line_profile` | **Live writer** | `SetupWizard.tsx:168`, `DiaryNew.tsx:125`, read `DiaryEntry.tsx:435` |
| `leader_id` | **Live writer** | `SetupWizard.tsx:169`, `DiaryNew.tsx:124` |
| `tippet_length_ft` | **Live writer** | `SetupWizard.tsx:170`, `DiaryNew.tsx:126` |
| `tippet_strength` | **Live writer** | `SetupWizard.tsx:171`, `DiaryNew.tsx:127` |
| `tippet_unit` | **Live writer** | `SetupWizard.tsx:172`, `DiaryNew.tsx:128` |
| `dropper_count` | **Live writer** | `SetupWizard.tsx:174`, `DiaryNew.tsx:129` |
| `keep_limit` | **Live writer** | `SetupWizard.tsx:177`, `DiaryNew.tsx:131` (also read `ReadyView.tsx:105` — chip hidden when 0) |
| `spot_name` | **Live writer** | `SetupWizard.tsx:176`, `DiaryNew.tsx:130,149`; reads in `EndSessionConfirm.tsx:37`, `Diary.tsx:296`. (`SpotPicker.tsx`/`diaryService.ts:497` and `upload-venue-spots` reference `venue_spots.spot_name`, not `fishing_sessions.spot_name` — different table.) |
| `size_mode` | **Live writer** | `SetupWizard.tsx:178`, `DiaryNew.tsx:132` |
| `size_units` | **Live writer** | `SetupWizard.tsx:179`, `DiaryNew.tsx:133` |
| `reported_at` | **Live writer** | `submit-venue-return/index.ts:81,246` (read + write) |
| `reported_to_email` | **Live writer** | `submit-venue-return/index.ts:247` |
| `reported_body_snapshot` | **Live writer** | `submit-venue-return/index.ts:248` |

**0 of 15 cleared to drop.** All have live writers in shipping code (diary setup wizard) or the `submit-venue-return` edge function (same half-built-but-deployed feature flagged in prompt 131 around `return_email`).

### Note on the audit's 0% non-NULL claim
The 12 setup-wizard columns are written via `DiaryNew.tsx`, but `DiaryNew` is the *legacy* new-session page — `DiaryEntry.tsx` is the current one and only **reads** `rod_weight` / `rod_length_ft` / `line_profile`, never writes them. So the audit's "0% non-NULL" finding likely reflects "current users go through `DiaryEntry`, not `DiaryNew`" rather than "no code touches these columns." Dropping them would break `DiaryNew` (still routed) and any session created via that path. This is a roadmap question (retire `DiaryNew`?) that should be resolved before any drop.

## Changes applied (Phase A only)

```sql
ALTER TABLE public.fishing_sessions
  ADD COLUMN IF NOT EXISTS gps_start_lat     double precision,
  ADD COLUMN IF NOT EXISTS gps_start_lon     double precision,
  ADD COLUMN IF NOT EXISTS submission_status text,
  ADD COLUMN IF NOT EXISTS submission_due    timestamptz;

NOTIFY pgrst, 'reload schema';
```

Migration succeeded. Linter returned the 90 pre-existing project-wide findings — none introduced.

## Deferred — all 15 Phase B columns

Two clusters, each needing a roadmap decision before drops can land:

1. **`reported_*` (3 cols)** — same half-built `submit-venue-return` feature surfaced by prompt 131's `return_email` decision. Resolve once with that one.
2. **Setup-wizard columns (12 cols)** — written by `src/pages/DiaryNew.tsx` (legacy new-session page). If `DiaryNew` is dead, retire the route + remove the writes, then drop. If it's still in use, the columns stay.

Phase D (form cleanup) skipped — no columns dropped, so no form fields to remove yet.

## Verification

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'fishing_sessions'
   AND column_name IN ('gps_start_lat','gps_start_lon','submission_status','submission_due');
```
Expect 4 rows — migration committed cleanly.
