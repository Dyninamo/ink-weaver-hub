# Lovable Prompt 134 — Investigate `DiaryNew` writes (no code changes)

**Context:** Phase 1 column-drift audit found 12 columns on
`fishing_sessions` are 0% non-NULL across all 45,092 rows:

```
rod_weight, rod_length_ft, line_profile, leader_id, tippet_length_ft,
tippet_strength, tippet_unit, dropper_count, keep_limit, spot_name,
size_mode, size_units
```

Prompt 132's pre-flight grep found these are written by `DiaryNew.tsx`
(specifically lines 122-133, called via `addEvent` / `createSession`
in `diaryService.ts`). Prompt 132's response called `DiaryNew` "the
legacy new-session page" — but a follow-up grep showed it's NOT
legacy:

- 9 active CTAs across the app point to `/diary/new`
  (App.tsx route, AppShell top-nav + footer, EndSessionView, ManagerLayout
  dropdown, ManagerNoAccess, Diary.tsx, VenueDetail.tsx)
- It's the active session-creation entry point, paired with `DiaryEntry.tsx`
  (the active session view — `/diary/:id`)

So the puzzle: **`DiaryNew` is live and writes 12 setup-wizard columns,
yet none of them have a non-NULL value across 45,092 rows.**

Three hypotheses to test:

1. **The fields are optional and users skip them** — wizard renders
   them but they default to empty / are non-required.
2. **The fields write to a different table** — e.g. `setup_presets`
   referenced by ID, with the `fishing_sessions` columns redundant /
   skipped at insert time.
3. **A recent refactor broke the writes** — the lines exist in source
   but are guarded by a condition that's now always false.

This prompt makes **NO code or DB changes**. It just answers:
"why are those 12 columns NULL despite DiaryNew being live?"

---

## Required investigation

For each of the 12 columns, answer with file:line evidence:

### A. The actual write path

Trace from `DiaryNew.tsx` (lines 122-133 per the prompt 132 grep) through
`diaryService.ts:createSession` (or whatever entry it calls) down to the
actual `supabase.from('fishing_sessions').insert(...)` call.

For each column:
- Is its value taken from form state (`useState`)?
- Is the form field actually rendered? (Or hidden behind a collapsed
  / advanced section?)
- Is the field required, or does it default to `null` / `undefined` /
  `""` if the user doesn't touch it?
- Is the value stripped before the insert (e.g. `omitNulls()` or a
  manual filter)?

### B. Setup presets — competing data location

Check if `setup_presets` (or `diary_setups`) is being used as the
canonical home for these values, with `fishing_sessions` only storing
a foreign key (`setup_preset_id` or similar):

```bash
grep -rIn -E "setup_preset|diary_setup|preset_id|setup_id" \
     src/pages/DiaryNew.tsx src/components/diary/SetupWizard.tsx \
     src/services/diaryService.ts src/pages/DiarySetups.tsx
```

If yes, that explains the NULLs — the data lives elsewhere, and the
12 columns on `fishing_sessions` are **redundant**.

### C. Live insert payload

If you can run a hypothetical session create end-to-end (or trace
through the code without actually inserting), what does the final
insert payload to `fishing_sessions` look like? List every column
that's set, every column that's omitted.

### D. Default form values

In `SetupWizard.tsx` (or wherever the wizard state lives), what are
the initial values for each of the 12 fields?

```bash
grep -A3 -E "useState\(.*(rod_weight|rod_length_ft|line_profile|leader_id|tippet_length_ft|tippet_strength|tippet_unit|dropper_count|keep_limit|spot_name|size_mode|size_units)" \
     src/components/diary/SetupWizard.tsx src/pages/DiaryNew.tsx
```

If they default to `null` / `""` / `undefined` and the user can advance
without changing them, hypothesis 1 is confirmed.

---

## Output format (for the response file)

Write `lovable instructions/responses/134_response.md` with the same
structure as prior responses. Make the "Changes applied" section
explicit: **"None — investigation only, no migrations or code edits."**

In the "Anything else Claude Code should know" section, give a
**one-paragraph verdict per hypothesis**:

- Hypothesis 1 (optional fields): supported / refuted, with evidence
- Hypothesis 2 (setup_presets owns the data): supported / refuted, with evidence
- Hypothesis 3 (broken refactor): supported / refuted, with evidence

Then a **one-sentence recommendation**: "drop the 12 columns" /
"keep them, fix the writer to be required" / "keep them, they live
in setup_presets and we should drop them from fishing_sessions" / etc.

---

## Why this matters

Once we know which hypothesis is right, the correct cleanup follows
mechanically:

| Hypothesis | Right cleanup |
|---|---|
| 1 (optional, users skip) | Drop the 12 cols — captured per-cast already, redundant per-session |
| 2 (lives in setup_presets) | Drop the 12 cols from fishing_sessions, keep setup_presets as canonical |
| 3 (broken refactor) | Fix the writer, then re-run the 0% non-NULL audit; columns may be legitimately needed |

Without this investigation, any drop is a guess. Spend 10 minutes
investigating now to save a half-built-feature drama later (which is
exactly what happened with `return_email`).

---

## Response capture

Per protocol prompt 128, log to
`lovable instructions/responses/134_response.md`. No migration,
so it's just the response file in this commit.
