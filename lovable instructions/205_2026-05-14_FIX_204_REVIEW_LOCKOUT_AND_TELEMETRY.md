# Lovable Prompt 205 — Fix 204-review findings: permanent lockout, commit-telemetry blindness, and preset-shape regressions

**Date:** 2026-05-14
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** 202 (chooser-first wizard), 203 (preset schema + commit locks), 204 (wizard hardening + extraction).

**Why this prompt exists:**

The antagonistic review of 204's implementation (`204_code_review.md`) surfaced two 🔴 ship-blockers and a long tail of legitimate issues. The 🔴 items are direct regressions introduced by 203's ref-based locking refactor — they need to land before any user can hit a transient `onComplete` failure (network blip, RLS deny, edge-function 500):

1. **`commitInFlightRef` is never reset on failure.** Today's `finally` block resets the React state (`setCommitting(false)`) but never touches the ref. If `onComplete` throws, the ref stays `true` forever, and every subsequent `handleStart` / `handlePickExisting` / `doCommit` silently short-circuits. The user sees an interactive wizard with a "Start fishing" button that does nothing. Only a page refresh recovers.
2. **`wizard.commit` is logged before `await onComplete` resolves.** Telemetry will show 100% commit success even when commits fail. The lockout in #1 will be invisible in dashboards — we won't know users are stuck.

The rest of the review (🟠/🟡/🔵 — eighteen findings) covers preset-shape robustness, telemetry hygiene, race-window UX, and small cleanups. All fold in here as separate sections. Item 17 from the review (AlertDialog footer ordering) was self-resolved by the review itself; not included.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/205_response.md`. Run every grep / verification command before pasting — 202's response log was caught faking these once already.

---

## What this prompt does

| § | Review item | What it fixes |
|---|---|---|
| 1 | #1, #2 | Reset `commitInFlightRef` in `catch`; emit `wizard.commit_failed`. Split `wizard.commit` into `commit_started` + `commit_succeeded` + `commit_failed`. |
| 2 | #3, #11, #22, #23 | Tighten `isPresetRow` to require numeric `rodWeight`. Tighten `readPresetRod` `flyCount` to a validated integer 1–6. Drop the `?-fly` fallback in ChooserView subtitle (unreachable). |
| 3 | #4 | `applyPreset` lands on the **first incomplete phase**, not always `flies`. Partial presets stop being silently skipped past leader/style. |
| 4 | #5 | Gate chooser entirely on `profileLoaded && presetsLoaded`. Spinner branch covers both. Drop the "tap, see toast, tap again" pattern. |
| 5 | #6 | Bump `limit(8)` → `limit(25)`. Emit `wizard.chooser_truncated` when the fetch hits the limit. No scroll-UI changes yet. |
| 6 | #7 | When the `user_profiles` default `lineProfile` is incompatible with the chosen rod weight and silently falls back to `"Floating"`, log `wizard.profile_line_overridden`. |
| 7 | #8 | Add `path` to the wizard-lifecycle effect deps; snapshot `path` at fire-time. Add a one-line comment about the choose→wizard mode-transition double-fire. |
| 8 | #9, #18 | Rename `presetFetchOnceRef` → `initialPresetFetchDone`; consult it only from the mount effect; have `goBack` call `loadPresets()` unconditionally. Reset `dialogDispositionRef` in `doCommit`'s finally block as well. |
| 9 | #10 | Remove `spotName` / `plan` from `WizardCommit` interface. Audit `DiaryNew.tsx`'s `handleSetupComplete` for any consumer; remove. |
| 10 | #12, #13, #19, #20, #21, #24 | Drop the `requestAnimationFrame` toast wrapper in `applyPreset`. Initialise `keepLimit` to `null`. Add `path` to `wizard.chooser_picked_existing` payload. Document the `lengthInches` `eslint-disable`. Verify `inchesToFt` precision. Re-export `WizardCommit` from `presetSchema.ts`. |

No DB changes. No edge functions. No migrations.

---

## File targets

- **Edit:** `src/components/diary/setup/SetupWizard.tsx`
- **Edit:** `src/components/diary/setup/presetSchema.ts`
- **Edit:** `src/components/diary/setup/ChooserView.tsx`
- **Edit:** `src/pages/DiaryNew.tsx` — if and only if `WizardCommit.spotName`/`plan` removal in §9 forces it

---

## §1 — Reset refs on failure + split `wizard.commit` telemetry

### §1.1 — Why this is critical

`SetupWizard.tsx` has two commit paths:

- `doCommit(savePreset)` — called from the dialog and from `handleStart` (existing fork).
- The chooser-with-flies branch inside `handlePickExisting` — commits straight from the chooser.

Both today follow this pattern:

```ts
if (commitInFlightRef.current) return;
commitInFlightRef.current = true;
setCommitting(true);
try {
  logEvent("wizard.commit", {...});      // ← fires before the await
  await onComplete({...});
} finally {
  setCommitting(false);
  // commitInFlightRef.current is NOT reset.
}
```

If `onComplete` throws — and there are at least six things in `DiaryNew.handleSetupComplete` that can throw (RLS deny on `rod_setups`, `session_rods`, `fishing_sessions`, `user_presets`; edge-function 500 from `on-session-logged`; abort on tab switch) — the ref stays `true` forever. Every subsequent guard short-circuits silently. The user must refresh. The telemetry will report success.

### §1.2 — Reset the ref on failure

Wrap the `onComplete` call in `try/catch/finally`. Reset the ref **only on the failure path** — keep the success-path ref `true` because the wizard unmounts immediately after a successful commit and we want to prevent any final double-fire on the way out.

```ts
async function doCommit(savePreset: { name: string; includeFlies: boolean } | null) {
  if (commitInFlightRef.current) return;
  commitInFlightRef.current = true;
  setCommitting(true);

  const payload = buildCommitPayload({
    state, path, skipped_wizard: false, saved_preset: !!savePreset,
  });
  logEvent("wizard.commit_started", payload);

  try {
    await onComplete({
      rod: state,
      keepLimit: keepLimit != null ? parseInt(keepLimit, 10) : null,
      savePreset,
    });
    logEvent("wizard.commit_succeeded", payload);
  } catch (e) {
    commitInFlightRef.current = false;            // ← critical: allow retry
    dialogDispositionRef.current = null;          // ← per §8, allow re-prompt
    logEvent("wizard.commit_failed", {
      ...payload,
      error: e instanceof Error ? e.message : String(e),
    });
    toast.error("Couldn't start session — please try again");
    throw e;                                       // surface to error boundary if present
  } finally {
    setCommitting(false);
  }
}
```

Apply the same pattern to the chooser-with-flies fork in `handlePickExisting`:

```ts
if (hasFlies) {
  if (commitInFlightRef.current) return;
  commitInFlightRef.current = true;
  setCommitting(true);

  const payload = buildCommitPayload({
    state: rod, path: "existing", skipped_wizard: true, saved_preset: false,
  });
  logEvent("wizard.commit_started", payload);

  try {
    await onComplete({
      rod,
      keepLimit: keepLimit != null ? parseInt(keepLimit, 10) : null,
      savePreset: null,
    });
    logEvent("wizard.commit_succeeded", payload);
  } catch (e) {
    commitInFlightRef.current = false;
    logEvent("wizard.commit_failed", {
      ...payload,
      error: e instanceof Error ? e.message : String(e),
    });
    toast.error("Couldn't start session — please try again");
    throw e;
  } finally {
    setCommitting(false);
  }
  return;
}
```

### §1.3 — Replace the single `wizard.commit` event with the three-event sequence

**Delete** every `logEvent("wizard.commit", ...)` call. Replace with the `wizard.commit_started` / `wizard.commit_succeeded` / `wizard.commit_failed` sequence above.

`buildCommitPayload` (defined in 204 §6.2) stays as the single source of payload shape — both call sites use it for all three events. The next field added to commits is still a one-line change.

**Downstream consequence:** anything counting `wizard.commit` events as "session starts" must move to `wizard.commit_succeeded`. Search the codebase before deploying:

```
rg "wizard.commit\b" src/ supabase/
```

Any hit other than the ones inside `SetupWizard.tsx` we're about to delete is a downstream consumer. Update them or break their dashboards knowingly. Document the breaking change in the response log.

`app_events` rows from the deprecated `wizard.commit` keep existing — this is purely a forward-looking event-name change.

---

## §2 — Stricter preset validation

### §2.1 — `isPresetRow` requires a numeric `rodWeight`

`presetSchema.ts` (currently around line 56):

```ts
export function isPresetRow(x: unknown): x is PresetRow {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    !!o.rod && typeof o.rod === "object" &&
    typeof o.rod.rodWeight === "number" &&         // ← add
    Number.isFinite(o.rod.rodWeight) &&            // ← add
    o.rod.rodWeight >= 1 && o.rod.rodWeight <= 12 &&
    typeof o.last_used_at === "string"
  );
}
```

A row with `rod: {}` no longer passes. Other partially-broken rods (e.g. only line profile, no weight) also drop out of the chooser entirely — they're unreachable as bypass candidates anyway. If the user genuinely wants to use one they can recreate it.

### §2.2 — `readPresetRod` validates `flyCount`

Replace the `flyCount` line in `readPresetRod`:

```ts
// before
flyCount: (blob?.flyCount ?? 2) as RodSetupState["flyCount"],

// after
flyCount: (() => {
  const n = blob?.flyCount;
  if (Number.isInteger(n) && n >= 1 && n <= 6) {
    return n as RodSetupState["flyCount"];
  }
  // Malformed preset — fall back to 2 and log so we can spot which row(s).
  if (n !== undefined && n !== null) {
    console.warn("[readPresetRod] invalid flyCount, falling back to 2:", n);
  }
  return 2 as RodSetupState["flyCount"];
})(),
```

### §2.3 — Filter presets after `readPresetRod`

In the chooser's `loadPresets`, after fetching and before `setPresets`:

```ts
const valid = filtered
  .filter(isPresetRow)
  .map((row) => ({ ...row, rod: readPresetRod(row.rod) }))
  .filter((row) => row.rod.rodWeight != null);   // belt-and-braces
setPresets(valid);
```

Now nothing reaches `ChooserView` that can produce an unusable bypass.

### §2.4 — Drop the unreachable `?-fly` fallback

In `ChooserView.tsx` where the subtitle is built (the line with `` `${rod.flyCount ?? "?"}-fly` ``), drop the `?` fallback — `readPresetRod` guarantees a numeric `flyCount`:

```ts
const subtitle = [
  rod.rodWeight ? `#${rod.rodWeight}` : null,
  rod.lineProfile,
  rod.style,
  `${rod.flyCount}-fly`,
].filter(Boolean).join(" · ");
```

---

## §3 — `applyPreset` lands on the first incomplete phase

Today `applyPreset` always calls `setPhase("flies")`. That's correct when the only missing piece is flies, but a half-complete preset (rod+line only, no leader/style) silently skips the user past those phases. The resulting `session_rods` row has null leader / style.

Add a small helper next to `applyPreset`:

```ts
// PHASES order is rod → line → leader → style → droppers → flies.
// Return the earliest phase whose underlying state isn't populated.
function firstIncompletePhase(rod: RodSetupState): Phase {
  if (rod.rodWeight == null || rod.rodLengthFt == null) return "rod";
  if (!rod.lineProfile) return "line";
  if (!rod.leaderId) return "leader";
  if (!rod.style) return "style";
  if (rod.flyCount == null) return "droppers";
  return "flies";
}
```

Then in `applyPreset`:

```ts
// before
setPhase("flies");

// after
const target = firstIncompletePhase(rod);
setPhase(target);
logEvent("wizard.preset_applied_to_phase", { target });   // new event for visibility
```

`wizard.preset_applied_to_phase` is new — fires alongside the existing `wizard.preset_applied`. Lets us see in telemetry how often partial presets land users at non-flies phases (helps decide whether to nag users to fill out their presets or whether the partial-preset workflow is intentional).

---

## §4 — Gate chooser entirely on `profileLoaded && presetsLoaded`

The current flow:

- `handleStart` / `handlePickExisting` check `profileLoaded` and toast-and-return if false.
- User taps "Start fishing" → toast "Loading profile…" → user taps again.

That's a tap-stare-tap UX on slow connections. Cleaner: don't let the user reach the actionable surface until both are loaded.

### §4.1 — Combined loading state

Define a memo'd flag near the top of the wizard:

```ts
const ready = profileLoaded && presetsLoaded;
```

### §4.2 — Spinner covers both

The 204 spinner today only triggers on `mode === "choose" && !presetsLoaded`. Broaden to `!ready`:

```tsx
{!ready && (
  <div className="space-y-6 py-8 flex flex-col items-center">
    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    <p className="text-sm text-muted-foreground">
      {!profileLoaded && !presetsLoaded ? "Loading your profile and saved rigs…"
       : !profileLoaded ? "Loading your profile…"
       : "Loading your saved rigs…"}
    </p>
  </div>
)}

{ready && mode === "choose" && (<ChooserView ... />)}
{ready && mode === "wizard" && (<>...</>)}
```

### §4.3 — Drop the toast-and-return in handlers

Remove these blocks from `handleStart` and `handlePickExisting`:

```ts
if (!profileLoaded) {
  toast.message("Loading profile…");
  return;
}
```

They're now unreachable — handlers only run inside `mode === "wizard"` UI, which only renders once `ready === true`.

---

## §5 — Surface chooser truncation

### §5.1 — Bump the limit

In `loadPresets`:

```ts
.limit(25)   // was 8 — see review #6
```

### §5.2 — Emit `wizard.chooser_truncated` on cap hit

After the fetch:

```ts
if (data.length === 25) {
  logEvent("wizard.chooser_truncated", { limit: 25 });
}
```

No UI change for "see more" — wait for telemetry to show whether any user actually hits the cap. If `chooser_truncated` fires for a single user we'll add pagination then; until then, 25 covers the foreseeable future.

---

## §6 — Log silent line-profile override

In the `user_profiles` defaults useEffect (around line 157 of `SetupWizard.tsx`, where `lineProfile: linesForWeight(rw).includes(line) ? line : "Floating"` lives), add the log:

```ts
const profileLine =
  (wt === "river" ? p.river_default_line : p.stillwater_default_line) ??
  p.default_line_profile ??
  "Floating";
const resolvedLine = linesForWeight(rw).includes(profileLine) ? profileLine : "Floating";
if (profileLine !== resolvedLine) {
  logEvent("wizard.profile_line_overridden", {
    saved: profileLine,
    weight: rw,
    fallback: resolvedLine,
  });
}
setState((s) => ({
  ...s,
  rodWeight: rw,
  rodLengthFt: p.default_rod_length_ft ?? null,
  lineProfile: resolvedLine,
  leaderId: p.default_leader_id ?? null,
}));
```

No UI toast — too disruptive for a setup that almost always works. Telemetry alone is enough.

---

## §7 — Lifecycle effect hygiene

Today's wizard-mode effect:

```ts
useEffect(() => {
  if (mode === "wizard") {
    logEvent("wizard.mounted", { path });
    return () => logEvent("wizard.unmounted", { path });
  }
}, [mode]);
```

`path` is read inside the effect but missing from deps — so if `path` changes from `"new"` to `"existing"` after the effect fires, the unmount log will show the **first** path, not the current one. Snapshot it explicitly and document:

```ts
useEffect(() => {
  if (mode !== "wizard") return;
  // Snapshot path so the cleanup logs the same value the mount logged.
  // Mode transitions (choose → wizard) will cleanly fire mount then unmount;
  // we accept the small double-event noise on the transition tick.
  const pathSnapshot = path;
  logEvent("wizard.mounted", { path: pathSnapshot });
  return () => logEvent("wizard.unmounted", { path: pathSnapshot });
}, [mode, path]);
```

Same shape for the chooser-mode effect:

```ts
useEffect(() => {
  if (mode !== "choose") return;
  logEvent("wizard.chooser_mounted", null);
  return () => logEvent("wizard.chooser_unmounted", null);
}, [mode]);
```

The choose-mode effect doesn't reference `path` so its deps stay `[mode]`.

---

## §8 — Refs & loader cleanup

### §8.1 — Rename + scope `presetFetchOnceRef`

Rename to `initialPresetFetchDoneRef` to make intent unambiguous. Consult it **only** in the mount-effect path. Have `goBack` call `loadPresets()` unconditionally:

```ts
const initialPresetFetchDoneRef = useRef(false);

useEffect(() => {
  let cancelled = false;
  (async () => {
    if (initialPresetFetchDoneRef.current) return;
    const [profileResult, presetsResult] = await Promise.all([ ... ]);
    if (cancelled) return;
    // ... existing handling ...
    initialPresetFetchDoneRef.current = true;
  })();
  return () => { cancelled = true; };
}, [userId, venueWaterType]);

function goBack() {
  // ...existing rod-weight back logic...
  if (prev) { ... }
  else if (presets.length > 0) {
    setMode("choose");
    setPath("new");
    setState(EMPTY_ROD_SETUP);
    setLengthInches(null);
    // goBack ALWAYS refetches; another tab may have changed the user's presets.
    // We don't consult initialPresetFetchDoneRef here on purpose.
    void loadPresets();
  } else {
    onCancel();
  }
}
```

### §8.2 — Reset `dialogDispositionRef` in `doCommit`'s finally

Today `dialogDispositionRef` is reset only when `handleStart` opens the dialog. If the wizard ever re-opens the dialog from the same mounted instance (e.g. a future "edit setup mid-session" affordance), the stale value will incorrectly skip the outside-click branch. Reset on commit completion (success and failure both):

```ts
async function doCommit(...) {
  if (commitInFlightRef.current) return;
  commitInFlightRef.current = true;
  setCommitting(true);
  try {
    // ...
  } catch (e) {
    // ...existing failure handling...
  } finally {
    setCommitting(false);
    dialogDispositionRef.current = null;   // ← add
  }
}
```

---

## §9 — Remove dead `WizardCommit` fields

`WizardCommit` still declares `spotName: string | null` and `plan: string | null`. Every caller passes `null`. The 202 spot-phase removal cleaned up the wizard side but left the public contract dirty. Clean it.

### §9.1 — Update the interface in `SetupWizard.tsx`

```ts
// before
export interface WizardCommit {
  rod: RodSetupState;
  spotName: string | null;
  plan: string | null;
  keepLimit: number | null;
  savePreset: { name: string; includeFlies: boolean } | null;
}

// after
export interface WizardCommit {
  rod: RodSetupState;
  keepLimit: number | null;
  savePreset: { name: string; includeFlies: boolean } | null;
}
```

### §9.2 — Audit `DiaryNew.tsx`

Run:

```
rg "commit\.spotName|commit\.plan" src/
```

For each hit, replace with `null` literals where the destination column accepts null, or remove the line entirely. Document each change in the response log §V. Paste the literal grep output before and after.

`fishing_sessions.spot_name` and `fishing_sessions.plan` columns are not removed at the DB layer — they stay nullable. We're just no longer threading them through the wizard.

### §9.3 — Update onComplete payloads in `SetupWizard.tsx`

Drop `spotName: null, plan: null,` from both `onComplete({...})` invocations.

---

## §10 — Polish cluster

Each item below is small. Apply all.

### §10.1 — Drop the `requestAnimationFrame` in `applyPreset` (#12)

```ts
// before
requestAnimationFrame(() => toast.success("Rig applied — pick your flies"));
// after
toast.success("Rig applied — pick your flies");
```

React 18 already batches the surrounding `setState` calls; the rAF was placebo.

### §10.2 — `keepLimit` initialises to `null` (#13)

```ts
// before
const [keepLimit, setKeepLimit] = useState<string>("2");
// after
const [keepLimit, setKeepLimit] = useState<string | null>(null);
```

Update all reads from `keepLimit` to handle `null`. Profile-load sets it to the user's default or remains `null` if no profile row exists. `doCommit` already handles `keepLimit: null` (`keepLimit != null ? parseInt(...) : null` per §1.2). Setup the gate so commits with `null` keepLimit go through cleanly — the DB column accepts null.

### §10.3 — Add `path` to `wizard.chooser_picked_existing` payload (#19)

```ts
logEvent("wizard.chooser_picked_existing", {
  preset_id: p.id,
  had_flies: !!hasFlies,
  skipped_wizard: !!hasFlies,
  preset_complete: isPresetComplete(rod),
  include_flies_flag: !!p.include_flies,
  path: "existing",   // ← add
});
```

### §10.4 — Comment the `lengthInches` `eslint-disable` (#20)

Above the line that disables `react-hooks/exhaustive-deps`:

```ts
// lengthInches is intentionally excluded from deps — this effect only
// fires on rod-weight change to re-clamp the length within the new
// weight's valid range. Including lengthInches would create a feedback
// loop with setLengthInches inside the effect.
// eslint-disable-next-line react-hooks/exhaustive-deps
```

### §10.5 — `inchesToFt` precision check (#21)

In `vocabulary.ts` (or wherever `inchesToFt` lives), verify the rounding doesn't show `8.49ft` where `8.5ft` was expected. Add a unit test:

```ts
test("inchesToFt is exact for whole half-feet", () => {
  expect(Math.round(inchesToFt(102) * 100) / 100).toBe(8.5);
  expect(Math.round(inchesToFt(108) * 100) / 100).toBe(9.0);
});
```

If the test fails, switch to integer math: store `lengthInches` directly and only convert to ft for display.

### §10.6 — Re-export `WizardCommit` from `presetSchema.ts` (#24)

In `presetSchema.ts`:

```ts
export type { WizardCommit } from "./SetupWizard";
```

(or move the interface there outright — review the impact.)

`SetupWizard.tsx` consumers can keep importing from where they do; `presetSchema.ts` becomes a more natural import surface for downstream code.

---

## Acceptance criteria

1. **Permanent-lockout fix verifiable (§1):** force `onComplete` to throw (temporarily `throw new Error("test")` at the top of `DiaryNew.handleSetupComplete` is sufficient). Open the wizard, hit Start, see the error toast, see `wizard.commit_failed` in console. Hit Start again — second attempt also fires `wizard.commit_started` + `wizard.commit_failed` (i.e. NOT silently short-circuited). Remove the throw, redeploy, confirm normal flow works.

2. **Three-event sequence (§1.3):**
   ```
   rg "wizard.commit_started|wizard.commit_succeeded|wizard.commit_failed" src/components/diary/setup/SetupWizard.tsx
   ```
   Returns ≥6 hits (3 events × 2 commit sites). The bare `wizard.commit` event no longer appears in `SetupWizard.tsx`.

3. **Downstream `wizard.commit` consumers identified:**
   Paste literal output of `rg "wizard.commit\b" src/ supabase/` showing the only remaining hits are in the response log or comments. If there's a real consumer (dashboard query, etc.), it's named in the response log and a follow-up task is created.

4. **Stricter preset filter (§2):** insert a deliberately broken row:
   ```sql
   INSERT INTO user_presets (id, user_id, name, rod, water_type, include_flies, last_used_at)
   VALUES (gen_random_uuid(), '<your user_id>', 'broken test', '{}'::jsonb, 'stillwater', false, now());
   ```
   Open the wizard at a stillwater venue. The "broken test" row does NOT appear in the chooser. Console shows no errors. Delete the test row when done.

5. **First-incomplete-phase landing (§3):** insert a deliberately partial preset (rod weight only):
   ```sql
   INSERT INTO user_presets (id, user_id, name, rod, water_type, include_flies, last_used_at)
   VALUES (gen_random_uuid(), '<your user_id>', 'partial test', '{"rodWeight":7}'::jsonb, 'stillwater', false, now());
   ```
   Tap it. The wizard opens on the **line** phase, not flies. `wizard.preset_applied_to_phase { target: "line" }` event fires. Delete the row when done.

6. **Combined loading state (§4):** with Chrome DevTools "Slow 3G", open the wizard. A single spinner is visible until both fetches resolve. Neither "Loading profile…" nor "Loading your saved rigs…" appears as a separate toast.

7. **Chooser truncation visibility (§5):** insert 30 dummy presets (script). Open the wizard. The first 25 render in the chooser. `wizard.chooser_truncated { limit: 25 }` event fires. Delete the dummies when done.

8. **Line override logged (§6):** set `user_profiles.stillwater_default_line = 'Di-7'` and `user_profiles.default_rod_weight = 5` for your test user. Open the wizard at a stillwater venue. `wizard.profile_line_overridden { saved: "Di-7", weight: 5, fallback: "Floating" }` event fires. State reflects "Floating" on the line step.

9. **`WizardCommit` interface cleaned (§9):**
   ```
   rg "spotName\|plan" src/components/diary/setup/SetupWizard.tsx
   ```
   Returns zero hits. Paste before-and-after of `DiaryNew.tsx` `handleSetupComplete` showing `commit.spotName` / `commit.plan` consumers were removed or replaced with `null` literals.

10. **Ref reset paths (§1, §8.2):**
    ```
    rg "commitInFlightRef.current = false|dialogDispositionRef.current = null" src/components/diary/setup/SetupWizard.tsx
    ```
    Should show: commit ref reset in catch (both sites), disposition ref reset in `doCommit`'s finally, plus the existing `handleStart` reset.

---

## Verification (response log §V)

Paste into `lovable instructions/responses/205_response.md`:

1. Git diff for every file edited.
2. Literal output of every `rg` command in §"Acceptance criteria" — run them, don't paraphrase. The 202 response log was caught doing this.
3. Console-event traces from the manual reproductions in §"Acceptance criteria" 1, 4, 5, 6, 7, 8. Include the SQL inserts for 4, 5, 7 and the cleanup statements.
4. Note any acceptance criterion that **could not** be verified from the deployed PWA — be explicit, don't imply success.
5. Confirm no schema migrations were applied (this prompt is client-side only).

Drive the StrictMode dialog flow at least once and confirm no doubled `wizard.commit_*` events. If StrictMode produces noise the refs should still defeat it.

---

## Out of scope / follow-ups

- **Review #14** (`linesForWeight` memoization) — cheap function, no measurable impact; leave for a future polish pass when step components are also memoized.
- **Review #15** (Step components not `React.memo`'d) — premature optimisation today; revisit if profiling shows render thrash.
- **Review #16** (FlyPicker Sheet cleanup on parent unmount) — observed leak unconfirmed; revisit if FlyPicker grows additional state worth cleaning up.
- **Review #17** (AlertDialog footer ordering) — the review noted this is correct per Radix conventions; no action.
- **Chooser pagination UI** — gated on `wizard.chooser_truncated` telemetry frequency, per §5.
- **"Update existing" vs "Save as new" dialog option** (carried over from 204) — gated on `wizard.save_prompt_skipped { reason: "existing_path" }` frequency.
- **In-memory wizard state loss across reloads** ("loses setup") — still waiting on `wizard.unmounted` event data after Alun's reinstall.
- **`bd71c878-…` numeric overflow** in `session_summaries` backfill — owned by a separate task.
- **River_* tables empty on Supabase** despite master having 1,053 rows — owned by a separate pipeline task.
