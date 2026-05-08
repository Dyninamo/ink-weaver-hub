# Lovable response — Prompt 137

**Prompt file:** `lovable instructions/137_2026-05-08_WIZARD_CSS_CLEANUP_AND_SPECIES_AUDIT.md`
**Applied:** 2026-05-08
**Status:** applied (CSS cleanup) + audit (read-only, no changes)

## 1. `.wizard-*` CSS cleanup

Pre-flight grep matched only `src/index.css` — no other consumers.

Removed two blocks from `src/index.css`:
- Lines 548-578 (`.wizard-shell`, `.wizard-inner`, `.wizard-banner`,
  `.wizard-progress` + `.pill` / `.pill.done` / `.pill.active`)
- Lines 658-685 (`.wizard-footer` + `.inner`, `.wizard-btn` +
  `.primary` / `.primary:disabled` / `.skip`)

Replaced each with a single-line comment marker pointing back to this
prompt and prompt 135.

Post-cleanup grep:
```
src/index.css:548:/* .wizard-shell ... removed (prompt 137 ...) */
src/index.css:628:/* .wizard-footer ... removed (prompt 137 ...) */
```
Zero remaining selector matches. ✅

**Intentionally kept** (NOT in prompt's removal list, still possibly
referenced by other future setup-flow surfaces — prompt was explicit
about scope):
`.step-title`, `.step-sub`, `.step-field`, `.chip-grid`, `.chip`,
`.chip.selected`, `.chip.compact`, `.segmented` + button states,
`.scope-prompt`, `.scope-btn`, `.dropper-chip`. Flag for a future
sweep if they're confirmed orphans.

## 2. `session_events.species` distribution (163 162 rows)

| species     | rows    |
|-------------|---------|
| Trout       | 109 794 |
| Grayling    |  29 923 |
| Other       |   3 853 |
| Salmon      |   2 044 |
| Chub        |   1 024 |
| Sea Trout   |     256 |
| Barbel      |     125 |
| Pike        |     123 |
| Rainbow     |      15 |
| Brown       |       5 |

10 distinct values. Single-word reference forms (Rainbow, Brown) are
**vanishingly rare** in the existing data (20 rows total).

## 3. `fishing_sessions.species`

Column does **not** exist. No per-session target species stored.
(`user_profiles.{stillwater,river}_default_species` is the only
session-time default surface.)

## 4. Source audit — where do the values come from?

### PWA writers into `session_events.species` (single-word reference form)
- `src/services/diaryService.ts` `SPECIES_LIST = ['Rainbow', 'Brown',
  'Brook', 'Tiger', 'Blue', 'Grayling', 'Other']`
- `src/services/diaryService.ts` `DEFAULT_SPECIES = { stillwater:
  'Rainbow', river: 'Brown' }`
- `src/components/diary/CatchModal.tsx:70,107` — falls back to
  `DEFAULT_SPECIES[venueType] || "Rainbow"`

These match the **15 Rainbow + 5 Brown** rows. PWA traffic is so
recent / so light it's a rounding error against the historical 163k.

### PWA writers into `user_profiles.*_default_species` (two-word lowercase form, NOT into session_events)
- `src/components/onboarding/OnboardingWizard.tsx:19-20,40,43`
- `src/pages/Settings.tsx:40,57,60,80,83`
- Values: `'Rainbow trout'`, `'Brown trout'`, `'Brook trout'`,
  `'Sea trout'`, `'Grayling'`, `'Salmon'`

These are profile defaults only — never read back into a catch event,
so they don't pollute `session_events.species`. Different surface,
different vocabulary.

### Notable-fish writer (capitalised two-word form)
- `src/components/social/NotableFishDialog.tsx:36,40` — explicit map
  `{ Brown: "Brown Trout", Rainbow: "Rainbow Trout", Brook: "Brook
  Trout", Grayling: "Grayling" }`

Writes to `notable_fish` table, again **not** to `session_events`.

### Manager / leaderboard surfaces
- `src/pages/Leaderboard.tsx:40-41` reads `'Rainbow Trout'`,
  `'Brown Trout'`, etc. (capitalised two-word) — display only
- `src/manager/utils/slug.ts` maps `rainbow→Rainbow`, `brook→Brook`,
  `other→Other` for stocking-form slug round-trips
- `src/manager/pages/ManagerStockingForm.tsx` writes lowercase
  single-word slugs (`'rainbow'`) into stocking_events, **not** into
  session_events

### Unknown writer (the bulk of historical data)
- `Trout` (109 794), `Grayling` (29 923), `Other` (3 853), `Salmon`
  (2 044), `Chub` (1 024), `Sea Trout` (256), `Barbel` (125), `Pike`
  (123) — **none** of these literal forms appear in any current PWA
  code path emitting into `session_events.species`.
- These came from the **legacy ingestion pipeline / passport import
  / RN app** writing to `session_events` directly (not in this repo).

## 5. Canonical-form recommendation

**Recommend: keep the two-word capitalised form (`'Brown Trout'`,
`'Rainbow Trout'`, `'Sea Trout'`, `'Grayling'`, `'Salmon'`, `'Chub'`,
`'Pike'`, `'Barbel'`, `'Other'`) as the canonical for catch
records, and normalise everything else to it.** Reasoning:

1. **The umbrella term `'Trout'` (67% of all rows) is the real
   problem, not the casing.** Whatever pipeline is producing 109k
   `Trout` rows isn't distinguishing rainbow vs brown vs brook — that
   loses analytical power forever. Fixing the writer matters more
   than the canonical-form decision.
2. **`NotableFishDialog`'s map and `Leaderboard.tsx`'s array already
   converged on `'Brown Trout'` (capital T)** as the display form.
   The PWA's `Settings.tsx` lowercase-`t` form is the outlier — and
   only writes to profile defaults, never into the data lake.
3. **Single-word reference (`fish_species_game.species_name`) is fine
   as a join key but unusable as a catch label** — `'Brown'` is
   ambiguous outside fishing context, and `'Sea Trout'` / `'Chub'`
   etc. don't fit a single-word convention.
4. **No RLS / CHECK constraints reference `species` literals** (no
   such constraints found in `db-functions` listing) — a one-shot
   `UPDATE` pass on 163k rows is cheap and breaks nothing
   server-side.
5. **Cost of normalisation:** trivial — single SQL `UPDATE` with a
   `CASE` table, plus a one-line PWA change to flip
   `SPECIES_LIST`/`DEFAULT_SPECIES` in `diaryService.ts`. RN app
   would need a parallel change. The 109k `Trout` rows are the
   blocker — they need a backfill strategy (probably "leave as
   `'Trout'` umbrella and stop emitting it going forward") since
   we can't recover the lost rainbow/brown distinction.

**Suggested canonical alphabet** (9 values):
`'Rainbow Trout'`, `'Brown Trout'`, `'Brook Trout'`, `'Sea Trout'`,
`'Salmon'`, `'Grayling'`, `'Chub'`, `'Pike'`, `'Barbel'`, `'Other'`
— plus `'Trout'` as a tolerated legacy value for the historical
backfill (do not emit going forward).

## Verification

- `grep -rIn "wizard-" src/` → only the two comment markers, zero
  selector matches.
- App builds (Lovable harness will surface any failure).
- `/diary/new` was rewritten in prompt 135 to never use any
  `.wizard-*` class — visual regression risk = 0.

## Anything else

- No data changes made. No migration written. Audit only, per prompt
  scope.
- The 109k `Trout` umbrella problem is the headline finding —
  recommend a follow-up prompt to (a) fix the writer (likely RN-side)
  and (b) decide whether to backfill or accept the loss.
