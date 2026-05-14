# Lovable Prompt 204 — 202 wizard hardening & polish (review findings #5–#23)

**Date:** 2026-05-14
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** 202 (chooser-first wizard), 203 (preset schema + commit locks).

**Why this prompt exists:**

Companion to prompt 203. 203 handles the two ship-blockers and one stale-state regression from the antagonistic review (`202_code_review.md`). 204 covers everything else — twenty smaller findings ranging from logic bugs to telemetry hygiene to accessibility. Splitting them out keeps 203 deployable on its own and gives 204 room to be polish without ship-pressure.

**Out of scope:** Anything not in `202_code_review.md`. Anything 203 owns (rod-blob schema, commit locks, dead state). Anything that would require new tables or edge functions — this is all client-side.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/204_response.md`.

---

## What this prompt does

| § | Review item | What it fixes |
|---|---|---|
| 1 | #5 | Validate preset structural integrity before bypassing the wizard. A preset whose `flies` map doesn't match `flyCount` must drop into the flies phase, not commit straight from the chooser. |
| 2 | #6 | Stop the save-prompt firing on the "existing-no-flies" fork. The user just used a saved rig — offering to save it again creates near-duplicate presets. |
| 3 | #7, #8 | Distinguish preset fetch failure from genuinely-empty. Show a loading state. Surface fetch errors to the user. |
| 4 | #10, #11, #12, #14 | Telemetry hygiene: `path` non-nullable, `wizard.mounted` fires only inside the wizard fork (chooser gets its own event), effect re-run guard, chooser-cancel event. |
| 5 | #9, #13, #15, #16 | Small race/cosmetic fixes: drop dead writes in the chooser-with-flies handler, defer toast until phase paints, gate commits on profile-load, refetch presets when goBack returns to chooser. |
| 6 | #17, #18 | Replace `as any` / `as unknown as PresetRow[]` with a hand-rolled type guard. Extract the `wizard.commit` payload to a helper so the two emit sites can't drift. |
| 7 | #19, #20, #21 | Accessibility nits: AlertDialog autoFocus on name input, aria-labels on chooser cards, list semantics. |
| 8 | #22, #23 | Refactor: extract `ChooserView`, `SaveRigPromptDialog`, and the existing per-phase blocks into sibling files. Parallelise `user_profiles` + `user_presets` fetches. |

No DB changes. No edge function changes. No new telemetry event types beyond those listed in §4.

---

## File targets

- **Edit (and split):** `src/components/diary/setup/SetupWizard.tsx`
- **New:** `src/components/diary/setup/ChooserView.tsx` — extracted component (§8)
- **New:** `src/components/diary/setup/SaveRigPromptDialog.tsx` — extracted dialog (§8)
- **New:** `src/components/diary/setup/presetSchema.ts` — type guard + helpers (§6)

---

## §1 — Validate preset structure before bypassing the wizard (#5)

The chooser-with-flies fork (in `onPickExisting`) currently classifies a preset as "has flies" with:

```ts
const hasFlies =
  p.include_flies &&
  rod?.flies &&
  Object.values(rod.flies).some((f: any) => !!f?.name);
```

`some` returns true if **any** position has a fly. A preset with `flyCount: 3` and only `point` populated still gets `hasFlies: true`, bypasses the wizard, and commits with two empty fly positions — silently writing partial fly data to `session_event_flies` etc.

Replace with a structural completeness check using the existing `positionsForFlyCount` from `vocabulary.ts`:

```ts
import { positionsForFlyCount } from "./vocabulary";

function isPresetComplete(rod: { flyCount: number; flies: Record<string, any> }): boolean {
  const expected = positionsForFlyCount(rod.flyCount as any);
  return expected.every((pos) => rod.flies?.[pos]?.name);
}
```

Use it in the chooser:

```ts
const rod = readPresetRod(p.rod);   // from 203 §1.4
const hasFlies = p.include_flies && isPresetComplete(rod);
```

Behaviour:
- Complete preset (every position filled) → bypass wizard (existing chooser-with-flies behaviour).
- Incomplete preset (missing any position) → falls through to the no-flies branch, applies the rig, drops into the flies phase, user fills the gaps.

Log the difference so we can see in telemetry how often presets need patching:

```ts
logEvent("wizard.chooser_picked_existing", {
  preset_id: p.id,
  had_flies: !!hasFlies,
  skipped_wizard: !!hasFlies,
  preset_complete: isPresetComplete(rod),    // new field
  include_flies_flag: !!p.include_flies,     // new field — distinguishes "user opted out" from "preset has gaps"
});
```

---

## §2 — Stop save-prompt firing on the existing-no-flies fork (#6)

Today, picking an "existing-no-flies" preset → adding flies → hitting Start fires the save-prompt asking "Save this rig?". The user just used their existing saved rig — accepting creates `existing_rig` + `existing_rig (1)` etc. as the user names them slightly differently each time. Over a season the chooser becomes a wall of near-duplicates.

Three options, in increasing complexity:

1. **Skip the dialog on `path === "existing"`.** Simplest. The user has the source preset; if they want to update it, they can do it explicitly elsewhere.
2. **Offer "Update existing" vs "Save as new" in the dialog.** Best UX but adds a write path (UPDATE not just INSERT).
3. **Skip on `path === "existing"` AND dropper-shape unchanged from the source preset; prompt only when materially different.** Heuristic-heavy.

**Pick option 1 for this prompt.** Keep it simple, the data tells us how often users actually want to update. If we see `wizard.save_prompt_skipped_reason: "existing_path"` (new field below) firing frequently and users complaining their flies aren't sticking, we revisit with option 2 in a later prompt.

In `handleStart`:

```ts
async function handleStart() {
  if (commitInFlightRef.current) return;
  // Existing-rig path: user is already using a saved rig. Skip the save
  // prompt — re-asking creates near-duplicate presets (#6 from 202 review).
  if (path === "existing") {
    logEvent("wizard.save_prompt_skipped", { reason: "existing_path" });
    void doCommit(null);
    return;
  }
  // … existing dialog-opening code unchanged …
}
```

New event: `wizard.save_prompt_skipped` with `{ reason }`. Distinct from `wizard.save_prompt_dismissed` (which is user-driven). Today the only `reason` value is `existing_path`; later prompts may add others.

---

## §3 — Fetch error vs no-presets, and loading state (#7, #8)

### §3.1 — Distinguish fetch error from genuine empty

The preset-fetch effect today:

```ts
const rows = (error || !data ? [] : data) as PresetRow[];
// … filter …
if (filtered.length === 0) {
  setMode("wizard");
  setPath("new");
  logEvent("wizard.chooser_skipped", { reason: "no_presets" });
}
```

An offline user with 5 presets becomes indistinguishable from a brand-new user with 0 presets. Both get dumped into "create new" with telemetry claiming `no_presets`.

Track the error separately and emit a distinct event:

```ts
const [presetError, setPresetError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  async function load() {
    const { data, error } = await supabase
      .from("user_presets")
      .select("id, name, rod, water_type, include_flies, last_used_at")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(8);
    if (cancelled) return;
    if (error) {
      setPresetError(error.message || "Failed to load saved rigs");
      setPresetsLoaded(true);
      setMode("wizard");
      setPath("new");
      logEvent("wizard.chooser_skipped", { reason: "fetch_error", error: error.message });
      toast.error("Couldn't load saved rigs — starting fresh setup");
      return;
    }
    // … existing happy-path …
  }
  load();
  return () => { cancelled = true; };
}, [userId, venueWaterType]);
```

`wizard.chooser_skipped` payload now carries `reason: "no_presets" | "fetch_error"`. Existing dashboards keying off `reason: "no_presets"` are unaffected; new `fetch_error` is additive.

### §3.2 — Loading state instead of blank render

The wizard today renders nothing during the fetch window (`mode === "choose"` but `presetsLoaded === false`). On a slow mobile network this is 250–500 ms of blank screen. The user may tap Build Rig again.

Add an inline loading branch:

```tsx
{mode === "choose" && !presetsLoaded && (
  <div className="space-y-6 py-8 flex flex-col items-center">
    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    <p className="text-sm text-muted-foreground">Loading your saved rigs…</p>
  </div>
)}

{mode === "choose" && presetsLoaded && (
  <ChooserView ... />
)}
```

If the project already has a `<Spinner />` or `<Skeleton />` component, use it instead of inlining the animate-spin div.

---

## §4 — Telemetry hygiene (#10, #11, #12, #14)

### §4.1 — `path` non-nullable

`path: "existing" | "new" | null` is over-permissive. The chooser sets `path` before the wizard mounts, the no-presets branch sets `path` to `"new"`, so by the time any commit logger runs `path` is always set in practice. Tighten the type:

```ts
const [path, setPath] = useState<"existing" | "new">("new");
```

Default to `"new"` because that's the natural default before the chooser is shown. The chooser flips it to `"existing"` only on a preset tap. The no-presets effect's `setPath("new")` becomes a no-op (still leave the call for clarity).

Drop any `path ?? "new"` fallbacks at log sites — they're dead.

### §4.2 — `wizard.mounted` semantics

Pre-202 `wizard.mounted` meant "user is on the rod-weight dial". Post-202 it also fires while the user is staring at the chooser. Dashboards that compare `wizard.mounted` ↔ `wizard.commit` ratios now see inflated abandonment numbers.

Fix by:

1. Renaming the chooser-mount log to `wizard.chooser_mounted` and emitting it where the chooser actually renders.
2. Firing `wizard.mounted` lazily, when `mode` transitions from "choose" to "wizard":

```ts
useEffect(() => {
  if (mode === "wizard") {
    logEvent("wizard.mounted", { path });
    return () => logEvent("wizard.unmounted", { path });
  }
}, [mode]);

useEffect(() => {
  if (mode === "choose") {
    logEvent("wizard.chooser_mounted", null);
    return () => logEvent("wizard.chooser_unmounted", null);
  }
}, [mode]);
```

`wizard.mounted` now means "user is in the wizard proper". `wizard.chooser_mounted` covers the entry-chooser surface. Existing prompt-201 `wizard.mounted` / `wizard.unmounted` consumers should be re-evaluated; this is a deliberate breaking change documented in the response log.

### §4.3 — Effect re-run guard

The preset-fetch effect deps are `[userId, venueWaterType]`. If `venueWaterType` resolves late (e.g. parent does a venue lookup that completes after wizard mount), the effect re-runs:

- With `filtered.length > 0` it logs `wizard.chooser_shown` again — double-counted in dashboards.
- With `filtered.length === 0` while `mode` is already `"wizard"`, it calls `setPath("new")` — clobbering a `path === "existing"` that was set by a previous chooser interaction.

Guard with a ref that flips after the first successful load:

```ts
const presetFetchOnceRef = useRef(false);

useEffect(() => {
  if (presetFetchOnceRef.current) return;
  let cancelled = false;
  async function load() {
    // … existing fetch logic …
    if (!cancelled) presetFetchOnceRef.current = true;
  }
  load();
  return () => { cancelled = true; };
}, [userId, venueWaterType]);
```

If we ever need to invalidate (e.g. user creates a preset elsewhere), clear the ref explicitly there. For now the wizard is the only path that creates presets, so once is enough.

### §4.4 — Chooser-cancelled event

`onCancel` on the chooser today does not log anything. We can't distinguish "opened chooser, bailed" from "never opened the wizard at all". Add:

```ts
<Button variant="ghost" size="sm" onClick={() => {
  logEvent("wizard.chooser_cancelled", { existing_count: presets.length });
  onCancel();
}}>Cancel</Button>
```

Same in any other chooser-level cancel surface.

---

## §5 — Small fixes (#9, #13, #15, #16)

### §5.1 — Drop dead writes in chooser-with-flies (#9)

In `onPickExisting`'s with-flies branch, the calls to `setState({...rod, ...})` and `setLengthInches(...)` before `await onComplete(...)` are dead — `onComplete` reads its `rod` argument directly, not the wizard's internal state, and the wizard unmounts before the state writes paint. Delete them. The handler shrinks to:

```ts
if (hasFlies) {
  if (commitInFlightRef.current) return;
  commitInFlightRef.current = true;
  setCommitting(true);
  try {
    logEvent("wizard.commit", buildCommitPayload({
      state: rod, path: "existing", skipped_wizard: true, saved_preset: false,
    }));
    await onComplete({
      rod, spotName: null, plan: null,
      keepLimit: keepLimit ? parseInt(keepLimit, 10) : null,
      savePreset: null,
    });
  } finally { setCommitting(false); }
  return;
}
```

(`buildCommitPayload` defined in §6.2.)

### §5.2 — Defer "Rig applied" toast until flies phase paints (#13)

In `applyPreset`, the `toast.success("Rig applied — pick your flies")` fires synchronously, but the chooser-driven phase change to `flies` paints on the next render tick. On slow devices the toast can appear before the screen visually changes, which is confusing.

Defer the toast to the next paint frame:

```ts
function applyPreset(rod: RodSetupState, hasFlies: boolean) {
  // … existing setState / setLengthInches / logEvent / setPhase("flies") …
  requestAnimationFrame(() => toast.success("Rig applied — pick your flies"));
}
```

`requestAnimationFrame` queues the toast for after the next render flush — good enough that the screen transition completes first.

### §5.3 — Block commits until `user_profiles` loads (#15)

`keepLimit` defaults to `"2"` and is overwritten by the `user_profiles` fetch. There is a narrow window (effectively never via UI, but logically possible via the chooser-with-flies fork firing before the profile fetch resolves) where a commit could go out with `keepLimit: 2` regardless of the user's real default.

Track profile-load with a state flag and gate commits on it:

```ts
const [profileLoaded, setProfileLoaded] = useState(false);

// Inside the existing user_profiles useEffect, set the flag after the fetch resolves
// (in BOTH the success and not-found cases — we don't want to block forever if the
// row doesn't exist).
```

Then in the chooser-with-flies handler and `handleStart`, refuse early if profile isn't loaded:

```ts
if (!profileLoaded) {
  toast.message("Loading profile…");
  return;   // user can tap again once loaded
}
```

In practice the profile fetch is fast enough that this never fires, but it's a contract not a wish.

### §5.4 — Refetch presets when goBack returns to chooser (#16)

`goBack` from the rod phase to the chooser uses the cached `presets` list. If the user (in another tab / device) deleted their last preset between wizard-open and goBack, the chooser renders an empty list — a dead UI state requiring a second cancel.

When goBack returns to chooser, refetch (and use the loading state from §3.2 so the UI is well-defined):

```ts
function goBack() {
  // … existing rod-weight / phase-back logic …
  if (presets.length > 0) {
    setMode("choose");
    setPath("new");
    setState(EMPTY_ROD_SETUP);
    setLengthInches(null);
    // Refetch presets — they may have changed since the wizard mounted.
    presetFetchOnceRef.current = false;
    setPresetsLoaded(false);
    // The fetch effect's deps haven't changed, so toggling the ref + presetsLoaded
    // is the trigger. Force a re-fetch by calling the inner fetch directly OR
    // by adding a `fetchTick` state and bumping it.
  } else {
    onCancel();
  }
}
```

The cleanest implementation: extract the fetch body into a callback that both the initial effect and `goBack` can invoke. Pseudo-code:

```ts
const loadPresets = useCallback(async () => {
  setPresetsLoaded(false);
  // … same fetch + setState code as in the effect …
}, [userId, venueWaterType]);

useEffect(() => { void loadPresets(); }, [loadPresets]);

// In goBack: void loadPresets(); after the state resets.
```

Drop the `presetFetchOnceRef` if `useCallback` deps are stable enough that re-renders don't refire.

---

## §6 — Types & helper extraction (#17, #18)

### §6.1 — Hand-rolled preset type guard

Create `src/components/diary/setup/presetSchema.ts`:

```ts
import type { RodSetupState, FlyEntry, FlyPosition } from "./vocabulary";

export interface PresetRow {
  id: string;
  name: string;
  rod: RodSetupState;          // post-203 §1, canonical
  water_type: string | null;
  include_flies: boolean;
  last_used_at: string;
}

/** Defensive read — handles both canonical and pre-203 legacy keys. */
export function readPresetRod(blob: any): RodSetupState {
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

/** Validates that every fly position implied by flyCount is populated. */
export function isPresetComplete(rod: Pick<RodSetupState, "flyCount" | "flies">): boolean {
  // Reuse positionsForFlyCount from vocabulary to avoid drift.
  const { positionsForFlyCount } = require("./vocabulary");
  return positionsForFlyCount(rod.flyCount).every(
    (pos: FlyPosition) => !!(rod.flies as any)?.[pos]?.name
  );
}
```

Move `readPresetRod` (introduced in 203 §1.4) out of `SetupWizard.tsx` into this file. Replace every `as unknown as PresetRow[]` / `rod: any` in the chooser code with calls through these helpers.

### §6.2 — Extract `wizard.commit` payload builder

The chooser-with-flies handler and `doCommit` both emit `wizard.commit` with slightly different field sources. Extract:

```ts
function buildCommitPayload(args: {
  state: RodSetupState;
  path: "existing" | "new";
  skipped_wizard: boolean;
  saved_preset: boolean;
}) {
  return {
    rod_weight: args.state.rodWeight,
    rod_length_ft: args.state.rodLengthFt,
    line: args.state.lineProfile,
    style: args.state.style,
    fly_count: args.state.flyCount,
    saved_preset: args.saved_preset,
    path: args.path,
    skipped_wizard: args.skipped_wizard,
  };
}
```

Both emit sites now read from one place. The next field added to `wizard.commit` is a one-line change.

---

## §7 — Accessibility (#19, #20, #21)

### §7.1 — autoFocus name input

In the save-prompt dialog (`SaveRigPromptDialog.tsx` per §8), add `autoFocus` to the name input:

```tsx
<Input
  id="save-prompt-name"
  autoFocus
  value={savePromptName}
  onChange={(e) => setSavePromptName(e.target.value)}
  placeholder="e.g. Buzzer 3-fly stillwater"
/>
```

### §7.2 — aria-label on chooser cards

The chooser card buttons currently render `<button><div>name</div><div>subtitle</div></button>` — screen readers announce "button" with no useful context. Add aria-labels:

```tsx
<button
  key={p.id}
  type="button"
  onClick={() => onPickExisting(p)}
  aria-label={`Apply saved rig "${p.name}", ${subtitle}`}
  className="…"
>
  …
</button>
```

### §7.3 — List semantics

Wrap the chooser cards in list semantics so assistive tech announces "list of X items":

```tsx
<ul role="list" className="space-y-2">
  {presets.map((p) => (
    <li key={p.id}>
      <button ...>…</button>
    </li>
  ))}
</ul>
```

---

## §8 — Refactor (#22, #23)

### §8.1 — Extract sibling components

Pull these out of `SetupWizard.tsx`:

- `src/components/diary/setup/ChooserView.tsx` — the chooser screen.
- `src/components/diary/setup/SaveRigPromptDialog.tsx` — the AlertDialog and its state inputs.

`SetupWizard.tsx` should drop to under 700 lines after the extraction + the dead-state removals from 203 §3.

Each sibling component takes its props explicitly — no shared state through globals. State that crosses both (`presets`, `savePromptOpen`, the refs) stays in `SetupWizard.tsx` and passes down.

### §8.2 — Parallelise startup fetches

`user_profiles` and `user_presets` are fetched in independent `useEffect` blocks today. They could overlap. Combine the initial fetch into a single effect using `Promise.all`:

```ts
useEffect(() => {
  let cancelled = false;
  async function loadAll() {
    const [profileResult, presetsResult] = await Promise.all([
      supabase.from("user_profiles").select("…").eq("id", userId).maybeSingle(),
      supabase.from("user_presets").select("…").eq("user_id", userId)
        .order("last_used_at", { ascending: false }).limit(8),
    ]);
    if (cancelled) return;
    // … existing handling for each, factored into helper functions …
  }
  loadAll();
  return () => { cancelled = true; };
}, [userId, venueWaterType]);
```

Halves the time-to-first-paint on slow connections. Confirm both fetches use the same auth context (they do via `supabase` client) — no header drift.

---

## Acceptance criteria

1. **Preset structural validation (§1):** chooser-with-flies skips the wizard only when `isPresetComplete(rod)` is true. Verified by adding a test preset with `flyCount: 3` and only 2 flies populated, tapping it, and observing the wizard opens at the flies phase rather than committing.

2. **No save-prompt on `existing` path (§2):** drive both forks manually.
   - Chooser → existing preset (without flies) → add flies → Start. **No dialog.** `wizard.save_prompt_skipped` with `reason: "existing_path"` logged.
   - Chooser → "Create new rig" → walk wizard → Start. **Dialog appears** as before.

3. **Fetch error visible (§3.1):** simulate by temporarily breaking the RLS policy (or with the browser dev-tools network throttle set to offline). `wizard.chooser_skipped` payload contains `reason: "fetch_error"`. A toast says "Couldn't load saved rigs…". User can still proceed.

4. **Loading state (§3.2):** on Chrome DevTools "Slow 3G" throttle, opening Build Rig shows a spinner + "Loading your saved rigs…" for the duration of the fetch, not a blank screen.

5. **`path` is non-null (§4.1):**
   ```
   rg "path: \"existing\" \| \"new\" \| null|path \?\? \"new\"" src/components/diary/setup/SetupWizard.tsx src/components/diary/setup/ChooserView.tsx src/components/diary/setup/SaveRigPromptDialog.tsx
   ```
   Returns **zero hits**.

6. **`wizard.mounted` only inside wizard (§4.2):** on chooser-open, `wizard.chooser_mounted` fires but `wizard.mounted` does not. On chooser → wizard transition (any fork that mounts the wizard body), `wizard.mounted` fires exactly once. Confirmed via console log dump.

7. **Re-run guard (§4.3):** force the parent to send a fresh `venueWaterType` value after wizard mount (any test harness will do — or just hot-reload the parent). The preset fetch does NOT re-run after the first successful load.

8. **Chooser cancel logged (§4.4):** tap Cancel from the chooser. `wizard.chooser_cancelled` event present with `existing_count` payload.

9. **goBack refetches (§5.4):** go from chooser → Create new → rod-weight → Back. Network panel shows a second `user_presets` query.

10. **No dead writes (§5.1):** grep:
    ```
    rg "setState\\(.*\\.\\.\\.rod" src/components/diary/setup/SetupWizard.tsx
    ```
    Should NOT appear inside the chooser-with-flies handler.

11. **Files extracted (§8.1):**
    ```
    ls src/components/diary/setup/
    ```
    Shows `ChooserView.tsx`, `SaveRigPromptDialog.tsx`, `presetSchema.ts`, plus the existing `SetupWizard.tsx`, `LeaderPicker.tsx`, `FlyPicker.tsx`, etc.

12. **`SetupWizard.tsx` size (§8.1):** `wc -l` reports under 700.

13. **Parallel fetch (§8.2):** in the Chrome DevTools network panel, `user_profiles` and `user_presets` requests overlap in time. (Eyeball check; no automated verification needed.)

---

## Verification (response log §V)

Paste into `lovable instructions/responses/204_response.md`:

1. Diffs for `SetupWizard.tsx`, `DiaryNew.tsx` (if any — should be none for 204), plus the three new files.
2. `wc -l` for the post-edit `SetupWizard.tsx`.
3. Literal output of the §"Acceptance criteria" greps that have explicit `rg` commands.
4. Console-event traces for the manual reproductions in §"Acceptance criteria" 2, 3, 6, 7, 8, 9.
5. Brief notes on anything that could not be verified (e.g., RLS-break simulation requires admin access; describe what was done in lieu).

Drive the chooser → wizard → save-prompt flow with **React StrictMode on** at least once to catch any second-render-only doubled logs. None should appear; 203's ref-based locks defeat StrictMode.

If anything in §"Acceptance criteria" cannot be verified from the deployed PWA, state that explicitly in the response log rather than implying success. **The 202 response log made this mistake.** Don't make it again.

---

## Out of scope / follow-ups

- **#6 option 2** (Update existing vs Save new in the dialog) — revisit if `wizard.save_prompt_skipped { reason: "existing_path" }` proves common AND users complain that their evolved rigs aren't being captured. Hold for now.
- Wizard / active-session in-memory state loss across reloads. Owned by a future prompt once 201's `wizard.unmounted` events tell us when this actually happens.
- Per-venue (not water-type) preset filtering. Same hold reasoning as 202's out-of-scope.
