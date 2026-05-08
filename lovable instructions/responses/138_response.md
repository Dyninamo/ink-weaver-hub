# Lovable Prompt 138 — PWA-RN parity refresh — response

## Pre-flight grep findings

- `options={[]}` in CatchModal — 1 hit (line 382, the retrieve autocomplete) ✓ as expected.
- `currentSetup.depth_zone` — 8 hits across `BlankModal`, `CatchModal`, `ChangeFlyFlow`, `ChangeSetupModal`, `LostModal`, `DiaryEntry`. Per the prompt's scope (§2 explicitly targets `CatchModal` line ~180), only the catch path was edited. Carry-forward behaviour for blank/change/lost/setup is unchanged — flagged for a follow-up if the same per-event edit is wanted there.
- `leaderMaterial` / `LEADER_MATERIALS` / `leader_material` — **0 hits in `src/`**. The PWA never grew a leader picker UI; only the `leaders` table type and `leader_id` / `leader_length_ft` etc. columns exist in `types.ts`. The post-prompt-135 simplified leader picker referenced in §3 does **not exist on the PWA side** — `SetupCascade.tsx` has Style/Rig/Line/Retrieve/Depth only.
- `measurement_mode` / `measureMode` — already wired in `CatchModal` (state at line 74, written at line 170, toggle rendered at lines 252–268 prominently above the input). §4 already satisfied; no edits needed.

## Deviation: §3 skipped

**No leader picker exists in the PWA**, so there is nothing to refactor. Adding one from scratch is a net-new feature, not a "refresh", and would require a SetupCascade redesign + a session-end leader prompt — out of scope for a parity refresh prompt. **Recommend a separate prompt** that (a) extends `SetupCascade` with material/length/strain steps and (b) pipes `leader_material` / `leader_length_ft` / `leader_strength_lb` (+ best-effort `leader_id` lookup) onto the `fishing_sessions` insert in `DiaryNew.tsx`. Defaults (15 ft / 6 lb) and unit toggles (ft↔m, lb↔X) per §3 spec.

## Diff summary

### §1 + §2 — `src/services/styleRules.ts` (NEW)
Canonical `CANONICAL_RETRIEVES` (7) and `CANONICAL_DEPTHS` (8) lists, plus
`retrievesForStyle(style)` / `depthsForStyle(style)` lookups mirroring the
RN `styleRules.ts` table from the prompt. Unknown / null style returns the
full set. Both `Lure + Nymph` (PWA `FISHING_STYLES` spelling) and
`Lure+Nymph` (prompt spelling) map to the same set.

### §1 — `src/components/diary/CatchModal.tsx` retrieve step
- Removed `DiaryAutocomplete` import + the `options={[]}` autocomplete row.
- Step 4 is now a chip grid pulling from `retrievesForStyle(currentSetup.style)`.
- Default selection: existing `currentSetup.retrieve` if it's in the allowed set, otherwise `allowedRetrieves[0]`.
- If `allowedRetrieves.length === 1`, chips are hidden and a "Only option for {style}: X" line is shown — the value still commits on Save.
- Reset block re-applies the same default rule on `open`.

### §2 — `src/components/diary/CatchModal.tsx` depth step (NEW step 5)
- New `depthZone` state, defaulted to `currentSetup.depth_zone` if it sits in the style-allowed set, else `allowedDepths[0]`.
- New step 5 renders `depthsForStyle(currentSetup.style)` as a chip grid; same single-option auto-emit pattern as retrieve.
- Save now writes `depth_zone: depthZone` (line 200) instead of `currentSetup.depth_zone`.
- `totalSteps` 5 → 6, `stepLabels` updated, Line moved to step 6.

### §4 — measurement mode
Already correct on the PWA — toggle is at the top of step 1 with 44px-tall icon buttons, Weight default. No edits.

### §5 — sensible defaults audit
- Catch flow: retrieve and depth now pre-fill from `currentSetup` (so `Next` is enabled immediately).
- `canAdvance()` only gates step 1 (weight/length numeric) and step 2 (fly required) — steps 3–6 always advance, so all chip steps already enable Next on entry.
- DiaryNew: the only required field is venue (typed by the user) + `keep_limit` defaults to a numeric input — no blocked-Next regressions.
- Leader defaults (§5 mention of 15 ft / 6 lb) deferred with §3.

### §6 — voice biasing
N/A — PWA has no SpeechRecognizer flow. No-op as instructed.

## Verification

- TypeScript build is clean (Lovable's auto-typecheck reports no errors after the final edit).
- Behavioural verification (live session through to a catch row in `session_events`) requires a running stillwater session — not exercised in this prompt. The data shape written from `addEvent`:
  - `retrieve` ∈ canonical 7
  - `depth_zone` ∈ canonical 8
  - `measurement_mode` ∈ {`weight`, `length`}
  - `length_inches` numeric in length mode, null otherwise
  - `leader_id` / `leader_*` columns untouched (§3 deferred)

## Screenshots

Skipped — capturing the modal at three states (Lure / Dry / leader) requires
launching a live session in the running preview. Flagged in the response
file rather than fabricating shots; the deterministic chip lists are
covered by the `retrievesForStyle` / `depthsForStyle` table tests anyone
can eyeball in `src/services/styleRules.ts`.

## Files touched

- Created `src/services/styleRules.ts`
- Edited `src/components/diary/CatchModal.tsx`
- Created `lovable instructions/138_2026-05-08_RN_PARITY_REFRESH.md` (prompt copy)
- Created `lovable instructions/responses/138_response.md` (this file)
