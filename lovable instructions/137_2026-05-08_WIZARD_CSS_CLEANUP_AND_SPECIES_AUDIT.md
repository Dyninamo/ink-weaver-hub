# Lovable Prompt 137 — Wizard CSS cleanup + species-name audit (read-only)

**Context:** Two small leftovers from prompts 135 + 136:

1. **Orphan `.wizard-*` CSS** in `src/index.css` — the SetupWizard's
   styles, ~140 lines that lost their consumer when 135 deleted
   `SetupWizard.tsx`. Section 4 of prompt 136 asked Lovable to remove
   them but it was skipped. Doing it now in its own dedicated prompt.

2. **Species-name casing audit** (read-only, no changes) — three
   different conventions exist for fish-species names across the data
   surfaces:

   | Source | Format | Sample |
   |---|---|---|
   | Master `fish_species_game.species_name` (reference) | single word | `Brown`, `Rainbow`, `Brook`, `Grayling` |
   | Master `session_events.species` (catch data, 163k rows) | mostly umbrella terms | `Trout` (109k), `Grayling` (30k), `Sea Trout` |
   | PWA `Settings.tsx` `SPECIES_OPTIONS` | two words, lowercase t | `'Brown trout'`, `'Rainbow trout'` |

   This prompt audits Supabase's `session_events.species` distribution
   and the diary code paths that emit those values. **No data changes,
   no migrations.** Output is a report so we can decide whether a
   canonicalisation pass is worth doing later.

---

## Pre-flight check

```bash
grep -rIn -E "\.wizard-|wizard-shell|wizard-progress|wizard-footer|wizard-btn" \
     src/ supabase/functions/
```

Expected hits: only `src/index.css` (the styles being removed). If
anything else references these classes, **stop and report back**
because it'd mean a non-wizard component started borrowing them.

---

## Required changes

### 1. Remove orphan `.wizard-*` CSS from `src/index.css`

Find and delete the block of selectors. Approximate range was
lines 548-685 in 135's response, but line numbers may have shifted.
Use the regex `\.wizard-` to locate, then delete the contiguous block
of `.wizard-shell`, `.wizard-inner`, `.wizard-banner`, `.wizard-progress`
(+ `.pill`, `.pill.active`, `.pill.done`), `.wizard-footer`,
`.wizard-btn` (+ `.primary`, `.skip`) rules.

Confirm zero matches after:

```bash
grep -rIn "\.wizard-\|wizard-shell\|wizard-progress" src/
```

### 2. Audit `session_events.species` distribution (read-only)

Run this query against Supabase:

```sql
SELECT species, COUNT(*) AS rows
  FROM public.session_events
 WHERE species IS NOT NULL
 GROUP BY species
 ORDER BY rows DESC;
```

Include the full result table in the response file.

### 3. Audit `fishing_sessions.species` if such a column exists

```sql
-- If fishing_sessions.species exists, distribution; otherwise note absent.
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'fishing_sessions'
   AND column_name = 'species';
```

If present, run the same `GROUP BY species, COUNT(*)` query against
`fishing_sessions`.

### 4. Source audit — where do the species values come from?

Grep for every place the diary code emits a species value into a
Supabase write:

```bash
grep -rIn -E "species[\"']?\s*:\s*[\"']|species:\s*\w" \
     src/ supabase/functions/ | grep -v '\.test\.' | head -40
```

Pull out the distinct hard-coded species literals. Compare to the
distribution from step 2. If the data has values not present in any
literal (e.g. `"Other"`, `"Chub"`, `"Pike"`, `"Barbel"`), those came
from somewhere else — note them as "unknown writer."

### 5. Recommend a canonical form

In the response file, give a one-paragraph judgment: which of the
three conventions (single-word reference, umbrella-term diary,
two-word lowercase PWA) should be the canonical form going forward?
Consider:

- What the RN app emits (you may need to ask the user — RN code isn't
  in this repo)
- Whether master analytics queries depend on a particular form
- Whether changing the canonical breaks any RLS / CHECK constraints
- The cost of a one-off normalisation pass on 163k existing rows

**No code or data changes.** This is a recommendation only. The user
will decide whether to do a follow-up canonicalisation prompt.

---

## Verification

1. **CSS cleaned**:
   ```bash
   grep -rIn "wizard-" src/
   # expect: 0 matches
   ```

2. **App still builds**: `npm run build` succeeds with no missing-class
   warnings.

3. **No visual regression**: load `/diary/new` (the simplified form
   from 135) — should look identical (it never used `.wizard-*`
   classes).

4. **Audit output captured**: response file contains the species
   distribution + the source-audit grep results + the canonical
   recommendation.

---

## Out of scope

- **Actually changing species values** — not in this prompt. After we
  see the audit, decide whether/how.
- **RN-app species audit** — that's a Claude Code task on the
  FishingDiary side, not Lovable.
- **Updating `fish_species_game`** — master schema, not Supabase. Not
  Lovable's concern.

---

## Response capture

Per protocol prompt 128, log to
`lovable instructions/responses/137_response.md`. Include:

- The full species distribution from §2 (likely 10-15 distinct values)
- The grep findings from §4 (literal lists per file)
- The canonical-form recommendation paragraph
- Confirmation that the `.wizard-*` block is gone
