# Lovable Prompt 203 — Fix preset rod-blob schema + dialog/commit double-fire (202 ship-blockers)

**Date:** 2026-05-14
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** 202 (chooser-first wizard + drop spot + save-prompt dialog).

**Why this prompt exists:**

The antagonistic review of 202's implementation (response log `202_code_review.md`) surfaced two ship-blockers and one stale-state regression that the response log misreported as fixed. All three must land before any user creates a new preset via the new save-prompt dialog — otherwise the chooser-with-flies fork starts writing garbage to `session_rods` and every dialog click can fire `onComplete` twice.

**Out of scope:** All other findings from the antagonistic review (preset structural validation, duplicate-rig spam, fetch-error vs no-presets disambiguation, blank loading state, telemetry hygiene, accessibility). Those go to prompt 204 — a follow-up that is being drafted alongside this one.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/203_response.md`.

---

## What this prompt does

1. **§1** — Schema fix: `DiaryNew.tsx` is currently saving preset blobs with keys (`rodLength: "8.5ft"`, `line: "..."`, `leaderLength: "..."`) that the wizard never reads (it reads `rodLengthFt: number`, `lineProfile: string`, `leaderLengthFt: number`). Fix the write side to use canonical keys, plus a migration to rewrite every existing `user_presets.rod` blob.
2. **§2** — Replace the state-based commit/dialog locks with a single `useRef` flag. Eliminates the double-fire of `doCommit` triggered by Radix calling `onOpenChange(false)` synchronously after the button's `onClick`.
3. **§3** — Remove dead state (`spotName`, `plan`, and any other leftovers from the old spot-step) and **actually run** the verification greps the 202 response log claimed but never executed.

No new tables. No new edge functions. No telemetry changes.

---

## File targets

- **New migration** (Lovable migration system) — `UPDATE user_presets SET rod = ...` to canonicalise the keys
- **Edit:** `src/pages/DiaryNew.tsx` — write canonical keys when inserting `user_presets`
- **Edit:** `src/components/diary/setup/SetupWizard.tsx` — ref-based locks, dead-state removal
- **Edit:** `src/components/diary/setup/SetupWizard.tsx` (continued) — fix the chooser-with-flies fork to read both old & new key shapes during a brief grace period (safety net for the migration)

---

## §1 — Canonical rod-blob schema

### §1.1 — Why this happened

`DiaryNew.tsx:305–322` saves the preset blob with these keys:

```ts
const rodBlob = {
  id: presetId,
  name: commit.savePreset.name,
  rodWeight: rod.rodWeight,
  rodLength:    rod.rodLengthFt ? `${rod.rodLengthFt}ft` : null,  // STRING "8.5ft"
  line:         rod.lineProfile,                                  // NOT lineProfile
  leaderId:     rod.leaderId,
  leaderMaterial: rod.leaderMaterial,
  leaderLength: rod.leaderLengthFt ? `${rod.leaderLengthFt}ft` : null,
  leaderStrengthLb: rod.leaderStrengthLb,
  style: rod.style,
  flyCount: rod.flyCount,
  flies: commit.savePreset.includeFlies ? validFlies : {},
};
```

`SetupWizard.tsx` reads `rod.rodLengthFt`, `rod.lineProfile`, `rod.leaderLengthFt`. These keys never match. Pre-202 this was a cosmetic bug in `SavedRigsBanner` subtitles. Post-202 the chooser-with-flies fork commits the preset blob directly via `onComplete(rod, ...)`, so `session_rods.rod_length_ft = undefined` and `line_profile = undefined` get written to the DB silently.

### §1.2 — DiaryNew rewrite

In `src/pages/DiaryNew.tsx` at the `user_presets.insert` site (around line 305), replace the `rodBlob` declaration with:

```ts
// Canonical rod-blob shape — matches RodSetupState exactly so the chooser
// can deserialise without translation. See prompt 203 §1 for context.
const rodBlob = {
  id: presetId,
  name: commit.savePreset.name,
  rodWeight: rod.rodWeight,
  rodLengthFt: rod.rodLengthFt,                      // was rodLength: "8.5ft"
  lineProfile: rod.lineProfile,                      // was line
  leaderId: rod.leaderId,
  leaderMaterial: rod.leaderMaterial,
  leaderLengthFt: rod.leaderLengthFt,                // was leaderLength: "...ft"
  leaderStrengthLb: rod.leaderStrengthLb,
  style: rod.style,
  flyCount: rod.flyCount,
  flies: commit.savePreset.includeFlies ? validFlies : {},
};
```

The interface `RodSetupState` already uses these names — there is no transformation layer. Just stop adding "ft" suffixes and stop renaming on write.

### §1.3 — Migration: rewrite existing rows

Apply via the Lovable migration tool. The migration must be idempotent (re-running is safe) and tolerate rows that already have the canonical keys (e.g. rows that were saved AFTER 203 deploys but BEFORE the migration ran):

```sql
-- Canonicalise user_presets.rod JSONB keys.
-- Pre-203, DiaryNew wrote `rodLength: "8.5ft"`, `line`, `leaderLength: "8ft"`.
-- The wizard reads `rodLengthFt: number`, `lineProfile`, `leaderLengthFt: number`.
-- This migration moves any old-style keys to the canonical names and drops the
-- old keys. Rows already in canonical form are unchanged.

UPDATE public.user_presets
SET rod =
    (rod
      -- Add canonical keys, parsed from the old string form when present.
      || jsonb_build_object(
           'rodLengthFt',
             COALESCE(
               (rod ->> 'rodLengthFt')::numeric,
               CASE WHEN rod ->> 'rodLength' ~ '^[0-9]+(\.[0-9]+)?ft$'
                    THEN (regexp_replace(rod ->> 'rodLength', 'ft$', ''))::numeric
                    ELSE NULL END
             ),
           'leaderLengthFt',
             COALESCE(
               (rod ->> 'leaderLengthFt')::numeric,
               CASE WHEN rod ->> 'leaderLength' ~ '^[0-9]+(\.[0-9]+)?ft$'
                    THEN (regexp_replace(rod ->> 'leaderLength', 'ft$', ''))::numeric
                    ELSE NULL END
             ),
           'lineProfile',
             COALESCE(rod ->> 'lineProfile', rod ->> 'line')
         )
    )
    -- Drop the legacy keys so the blob is unambiguous.
    - 'rodLength' - 'leaderLength' - 'line'
WHERE
  -- Only touch rows that still have a legacy key OR a NULL canonical key
  -- recoverable from the legacy one. Avoids no-op rewrites.
  rod ? 'rodLength' OR rod ? 'leaderLength' OR rod ? 'line';
```

Verify post-migration with:

```sql
SELECT
  COUNT(*) FILTER (WHERE rod ? 'rodLength') AS legacy_rod_length_count,
  COUNT(*) FILTER (WHERE rod ? 'leaderLength') AS legacy_leader_length_count,
  COUNT(*) FILTER (WHERE rod ? 'line') AS legacy_line_count,
  COUNT(*) FILTER (WHERE rod ? 'rodLengthFt') AS canonical_rod_length_count,
  COUNT(*) FILTER (WHERE rod ? 'lineProfile') AS canonical_line_count,
  COUNT(*) AS total
FROM public.user_presets;
```

All three "legacy_*" counts must be **0**. Both canonical counts should equal `total` (or `total` minus any rows that genuinely had no rod data). Paste the result into the response log.

### §1.4 — Reader-side belt-and-braces (transitional)

Even with the migration, there is a brief window where the `DiaryNew.tsx` edit deploys before the migration runs (or vice versa). Add a single defensive read helper inside `SetupWizard.tsx` and use it everywhere the chooser deserialises a preset blob:

```ts
// Defensive reader for user_presets.rod — tolerates pre-203 legacy keys.
// Once the §1.3 migration is verified clean, this can be removed (prompt 205-ish).
function readPresetRod(blob: any): RodSetupState {
  const rodLengthFt =
    typeof blob?.rodLengthFt === "number"
      ? blob.rodLengthFt
      : typeof blob?.rodLength === "string"
      ? parseFloat(blob.rodLength.replace(/ft$/, ""))
      : null;
  const leaderLengthFt =
    typeof blob?.leaderLengthFt === "number"
      ? blob.leaderLengthFt
      : typeof blob?.leaderLength === "string"
      ? parseFloat(blob.leaderLength.replace(/ft$/, ""))
      : null;
  return {
    rodWeight: blob?.rodWeight ?? null,
    rodLengthFt: Number.isFinite(rodLengthFt) ? rodLengthFt : null,
    lineProfile: blob?.lineProfile ?? blob?.line ?? null,
    leaderId: blob?.leaderId ?? null,
    leaderMaterial: blob?.leaderMaterial ?? null,
    leaderLengthFt: Number.isFinite(leaderLengthFt) ? leaderLengthFt : null,
    leaderStrengthLb: blob?.leaderStrengthLb ?? null,
    style: blob?.style ?? null,
    flyCount: (blob?.flyCount ?? 2) as RodSetupState["flyCount"],
    flies: blob?.flies ?? {},
  };
}
```

Use this in:

- The chooser-card subtitle render: `const rod = readPresetRod(p.rod);`
- `onPickExisting`: `const rod = readPresetRod(p.rod);`
- `applyPreset` callers from the chooser.

Anywhere `rod as RodSetupState` or `rod: any` currently appears in the chooser code path, route through `readPresetRod` instead.

---

## §2 — Replace state-based commit/dialog locks with refs

### §2.1 — Why the current locks don't work

`SetupWizard.tsx` has two places that try to prevent double-commits:

```ts
if (committing) return;   // in handleStart / chooser-with-flies handler
setCommitting(true);
```

```tsx
<AlertDialog open={savePromptOpen} onOpenChange={(open) => {
  if (!open && savePromptOpen) {  // reads stale state from closure
    void doCommit(null);
  }
  ...
}}>
```

Both fail for the same reason: React batches `setState` updates within an event tick. When the user clicks `AlertDialogAction`, the button's `onClick` runs `setSavePromptOpen(false)` + `doCommit(...)`. Then Radix's internal close-handler synchronously calls `onOpenChange(false)` in the same batch, where `savePromptOpen` is still its previous value (`true`). The guard passes, `doCommit(null)` fires a second time, and `if (committing) return` is also defeated by the same batching (the first call's `setCommitting(true)` hasn't flushed yet).

Worst-case observed: two `fishing_sessions` inserts, two `session_rods` inserts, two `user_presets` inserts per click.

### §2.2 — Ref-based commit lock

At the top of the wizard component, add:

```ts
// Synchronous double-fire guard. Replaces the state-based `committing` flag,
// which was racy because React batches setState within an event tick and two
// callers in the same tick could both observe `committing === false`.
const commitInFlightRef = useRef(false);
// Records which path closed the dialog so onOpenChange's outside-click branch
// only fires when neither button was clicked.
const dialogDispositionRef = useRef<null | "save" | "skip">(null);
```

Keep the `committing` state (it drives the Start button's loading text), but never branch on it. Branch on the ref instead.

Replace `handleStart`, `doCommit`, and the chooser-with-flies handler so every entry-point checks and sets the ref:

```ts
async function handleStart() {
  if (commitInFlightRef.current) return;
  const defaultName = `${state.style ?? "Rig"} · ${state.flyCount}-fly · ${state.lineProfile ?? ""}`.trim();
  setSavePromptName(defaultName);
  setSavePromptIncludeFlies(false);
  dialogDispositionRef.current = null;
  setSavePromptOpen(true);
  logEvent("wizard.save_prompt_shown", {
    rod_weight: state.rodWeight,
    fly_count: state.flyCount,
    style: state.style,
    line: state.lineProfile,
    existing_preset_count: presets.length,
    path,
  });
}

async function doCommit(savePreset: { name: string; includeFlies: boolean } | null) {
  if (commitInFlightRef.current) return;   // ref-checked, synchronous
  commitInFlightRef.current = true;
  setCommitting(true);
  try {
    logEvent("wizard.commit", {
      rod_weight: state.rodWeight,
      rod_length_ft: state.rodLengthFt,
      line: state.lineProfile,
      style: state.style,
      fly_count: state.flyCount,
      saved_preset: !!savePreset,
      path,
      skipped_wizard: false,
    });
    await onComplete({
      rod: state,
      spotName: null,
      plan: null,
      keepLimit: keepLimit ? parseInt(keepLimit, 10) : null,
      savePreset,
    });
  } finally {
    setCommitting(false);
    // Intentionally do NOT clear commitInFlightRef — once a session commits, the
    // wizard unmounts. If you ever add a non-unmounting commit path, clear it
    // explicitly there.
  }
}
```

### §2.3 — Ref-based dialog disposition

Update the dialog's open/close handlers so each button stamps the ref before calling `doCommit`, and `onOpenChange` only triggers the skip path when the ref is still `null`:

```tsx
<AlertDialog
  open={savePromptOpen}
  onOpenChange={(open) => {
    setSavePromptOpen(open);
    if (open) return;
    // Closed. If neither button stamped the ref, the user dismissed via
    // outside-click or escape — treat as skip.
    if (dialogDispositionRef.current === null) {
      dialogDispositionRef.current = "skip";
      logEvent("wizard.save_prompt_dismissed", { reason: "outside_click" });
      void doCommit(null);
    }
  }}
>
  <AlertDialogContent>
    {/* … existing header / inputs unchanged … */}
    <AlertDialogFooter>
      <AlertDialogCancel
        onClick={() => {
          if (dialogDispositionRef.current !== null) return;
          dialogDispositionRef.current = "skip";
          setSavePromptOpen(false);
          logEvent("wizard.save_prompt_dismissed", { reason: "skip" });
          void doCommit(null);
        }}
      >
        Skip — just start
      </AlertDialogCancel>
      <AlertDialogAction
        onClick={() => {
          if (dialogDispositionRef.current !== null) return;
          dialogDispositionRef.current = "save";
          const name = savePromptName.trim() || `${state.style ?? "Rig"} · ${state.flyCount}-fly · ${state.lineProfile ?? ""}`.trim();
          setSavePromptOpen(false);
          logEvent("wizard.save_prompt_accepted", {
            name,
            include_flies: savePromptIncludeFlies,
          });
          void doCommit({ name, includeFlies: savePromptIncludeFlies });
        }}
      >
        Save it
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Two converging guards now protect each commit path:
- `commitInFlightRef` inside `doCommit` — synchronous, defeats all batching races.
- `dialogDispositionRef` inside each button + `onOpenChange` — ensures each dialog-close path produces at most one event + one doCommit.

### §2.4 — Same fix for the chooser-with-flies handler

The chooser-with-flies fork in `onPickExisting` also calls `setCommitting(true)` and reads `if (committing) return`. Replace with the ref:

```ts
if (commitInFlightRef.current) return;
commitInFlightRef.current = true;
setCommitting(true);
try {
  // … existing logEvent("wizard.commit", {...}) + await onComplete(...) …
} finally {
  setCommitting(false);
}
```

---

## §3 — Remove dead state + actually run the verification greps

### §3.1 — Dead state

The 202 response log §V.4 claimed `spotName`, `setSpotName`, `plan`, `setPlan`, `savePreset` (the in-wizard toggle), `presetIncludeFlies`, `presetName` were removed. The antagonistic review found them still declared. Verify and delete every unreferenced one.

Run **these greps** and paste the literal output into the 203 response log:

```
rg "spotName|setSpotName|^\\s*const \\[plan|^\\s*const \\[savePreset\\b|presetIncludeFlies|^\\s*const \\[presetName" src/components/diary/setup/SetupWizard.tsx
```

Expected after the fix: zero hits, EXCEPT possibly `spotName: null` inside the two `onComplete({...})` calls (intentional, `WizardCommit` interface unchanged).

### §3.2 — Actually run the 202 verification greps now

The 202 response log claimed but did not run the verification greps. Run them now as part of 203's response log:

```
rg "wizard.chooser_shown|wizard.chooser_skipped|wizard.chooser_picked_existing|wizard.chooser_picked_new|wizard.save_prompt_shown|wizard.save_prompt_accepted|wizard.save_prompt_dismissed" src/components/diary/setup/SetupWizard.tsx
```

```
rg 'logEvent\("wizard.commit"' src/components/diary/setup/SetupWizard.tsx -A 12
```

Paste literal output. If any expected marker is missing, fix and re-paste.

---

## Acceptance criteria

1. **DiaryNew writes canonical keys.** A `git diff` of `src/pages/DiaryNew.tsx` shows `rodLengthFt`, `lineProfile`, `leaderLengthFt` and no `rodLength: \`${...}ft\``, no `line:`, no `leaderLength: \`${...}ft\``.

2. **Migration zeroed legacy keys.** The §1.3 verification query returns `legacy_rod_length_count = 0`, `legacy_leader_length_count = 0`, `legacy_line_count = 0`. Paste the row.

3. **Reader-side fallback present.** `readPresetRod` exists in `SetupWizard.tsx` and every chooser-side preset deserialisation site goes through it. Grep:
   ```
   rg "readPresetRod" src/components/diary/setup/SetupWizard.tsx
   ```
   Should show at least 3 hits (definition + at least 2 usages in `ChooserView` / `onPickExisting`).

4. **Ref-based locks.** `commitInFlightRef` and `dialogDispositionRef` exist:
   ```
   rg "commitInFlightRef|dialogDispositionRef" src/components/diary/setup/SetupWizard.tsx
   ```
   Should show definitions + uses in `doCommit`, the chooser-with-flies handler, and all three dialog close paths.

5. **No state-based commit guard remains.** Grep:
   ```
   rg "if \(committing\) return" src/components/diary/setup/SetupWizard.tsx
   ```
   Should return **zero hits**.

6. **Outside-click does not double-commit.** Drive the dialog three ways manually:
   - Click Save it → exactly one `wizard.save_prompt_accepted` + one `wizard.commit` in the console.
   - Click Skip → exactly one `wizard.save_prompt_dismissed` (reason: skip) + one `wizard.commit`.
   - Outside-click → exactly one `wizard.save_prompt_dismissed` (reason: outside_click) + one `wizard.commit`.
   In **React StrictMode**, the same — no doubled events (StrictMode double-invokes effects but not callbacks; the ref-based guard handles it regardless).

7. **Dead state cleared.** The §3.1 grep returns zero hits other than the documented exceptions.

8. **Verification greps actually run.** The §3.2 grep outputs appear verbatim in `responses/203_response.md`. If they're paraphrased or summarised instead of pasted, **the response log is incomplete**.

---

## Verification (response log §V)

Paste into `lovable instructions/responses/203_response.md`:

1. `git diff src/pages/DiaryNew.tsx` for the rod-blob block.
2. Full migration SQL + the row returned by the §1.3 verification query.
3. `git diff src/components/diary/setup/SetupWizard.tsx` showing: `readPresetRod` defined and used, refs declared, state guard removed, dialog handlers updated, dead state removed.
4. Literal output of every grep in §3.1, §3.2, and the §"Acceptance criteria" §3, §4, §5.
5. Manual reproduction notes for §"Acceptance criteria" §6 — the three dialog paths driven in the deployed PWA, with console-event counts.

I cannot drive the UI from this side. If the response log claims an acceptance criterion was met without an actual repro or grep output, **it is not met**. The 202 response log already made this mistake — don't make it again.

---

## Out of scope (handled in prompt 204)

- Preset structural validation (#5 from the review): a saved rig with mismatched `flyCount` vs `flies` keys shouldn't bypass the wizard.
- Duplicate-rig spam (#6): save-prompt firing on the existing-no-flies fork creates near-duplicate presets.
- Fetch error vs no-presets disambiguation (#7).
- Loading skeleton for the blank-render window (#8).
- Telemetry hygiene: path nullability, wizard.mounted semantics, effect re-run guard, cancel-from-chooser event, etc. (#10–#16).
- Type-guard / Zod schema for the preset blob (#17).
- Extract `wizard.commit` payload to a helper (#18).
- Accessibility: autoFocus, aria-label, list semantics (#19, #20, #21).
- File extraction (#22), parallel fetches (#23).
