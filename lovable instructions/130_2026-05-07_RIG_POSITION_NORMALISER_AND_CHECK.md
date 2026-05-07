# Lovable Prompt 130 — `rig_position` normaliser + CHECK constraint

**Context:** Successor to **prompt 127**, which applied the
`dropper_position` CHECK but deferred `rig_position` after pre-flight
found writers (`CatchModal.tsx`, `LostModal.tsx`) sending values outside
the canonical set.

**Live audit established (2026-05-07):**

- Live `session_events.rig_position` (70 rows) is already entirely
  `{point, middle, top}`. Most recent write was today.
- The writer path (`src/services/diaryService.ts:325` → `addEvent()`) has
  **no normalisation** — whatever the modal sends lands in Postgres
  verbatim.
- `CatchModal.tsx:47` declares `RIG_POSITIONS = ["Point", "Top dropper", "Middle dropper", "Bob fly"]`
  and writes them as-is. Default fallback is `"Point"`.
- `LostModal.tsx:85` writes `rig_position: flyPos` where `flyPos` is a
  key from `currentSetup.flies_on_cast` — i.e. fly slot identity,
  semantically a `dropper_position` value, not `rig_position`.

The fact that live data is clean despite all of the above means the modal
flow paths are reachable but unreached in practice (or another writer is
the actual source of all 70 rows). Either way, the moment those modals do
fire, they'll fail any naïve `('top','middle','point')` CHECK.

This prompt fixes both writers and lands the CHECK in one go.

---

## Pre-flight check

```bash
grep -rIn --include='*.ts' --include='*.tsx' "rig_position" src/ supabase/functions/
```

Expected hits — these are the only writers/readers we need to handle:

1. `src/services/diaryService.ts:46` — type declaration in `Partial<...>`
2. `src/services/diaryService.ts:325` — `addEvent` (pass-through insert; this prompt adds normalisation here)
3. `src/components/diary/CatchModal.tsx:47` (`RIG_POSITIONS` array) and `:173` (`rig_position: rigPosition` write)
4. `src/components/diary/LostModal.tsx:85` (`rig_position: flyPos` write — to be removed)
5. Generated `src/integrations/supabase/types.ts` (auto-regenerates)

If grep returns anything outside that list — particularly any other
`from('session_events').insert({ ..., rig_position: ... })` call site, or
any reader that depends on the capitalised values — **stop and report
back** before applying.

---

## Required changes

### 1. Add a normaliser to `addEvent()`

In `src/services/diaryService.ts`, just before the existing
`addEvent` function:

```ts
/**
 * Normalises rig_position to the canonical lowercase water-column set.
 *
 * Accepts the UI's capitalised + multi-word labels and maps them onto
 * {point, middle, top}. UK convention treats the bob fly as the top fly
 * on a cast, so "Bob fly" maps to "top".
 *
 * Anything genuinely outside the recognised inputs returns null — the
 * DB CHECK constraint then guarantees only valid values land.
 */
function normalizeRigPosition(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  switch (s) {
    case "point":
      return "point";
    case "middle":
    case "middle dropper":
      return "middle";
    case "top":
    case "top dropper":
    case "bob fly":
    case "bob":
      return "top";
    default:
      // Don't pretend we understood — let the row write NULL and surface
      // unknowns in monitoring rather than silently mis-categorising.
      console.warn("[diaryService] Unknown rig_position:", v);
      return null;
  }
}
```

Then in `addEvent()` itself, normalise before the insert:

```ts
export async function addEvent(event: Partial<...>) {
  // ... existing sort_order computation ...
  const normalised = {
    ...event,
    rig_position: normalizeRigPosition(event.rig_position),
    sort_order: ...,
  };
  await supabase.from('session_events').insert(normalised as any);
}
```

### 2. Fix `LostModal.tsx`

`rig_position: flyPos` is semantically wrong — `flyPos` is a fly slot key
(`"point fly"`, `"top dropper"`, etc.), not a water-column position. Two
ways to fix:

**Preferred — write to `dropper_position` instead** (since `dropper_position`
already has its own CHECK constraint accepting `d1`/`d2`/`d3`/`d4`):

If the `currentSetup.flies_on_cast` keys map cleanly to slot indices —
e.g. an array index 0 = `d1`, 1 = `d2` etc. — derive the index and
write that:

```ts
// at LostModal.tsx:85, replace:
//   rig_position: flyPos,
// with:
const slot = mapFlyKeyToDropperPosition(flyPos, currentSetup.flies_on_cast);
// then in the insert payload:
//   dropper_position: slot,         // 'd1' | 'd2' | 'd3' | 'd4' | null
```

Where `mapFlyKeyToDropperPosition` returns `null` if the key doesn't
correspond cleanly to a slot, so the column stays NULL rather than
fail the constraint.

**Fallback — drop the field entirely:** if mapping isn't possible without
ambiguity, remove `rig_position: flyPos` from the LostModal insert. The
row still records *which fly was lost* via the existing `fly_name` /
`fly_slot` (or whatever) field; it doesn't need a redundant position
column.

Pick the path that's quickest to implement cleanly. Either is better
than what's there now.

### 3. Apply the CHECK constraint

```sql
BEGIN;

ALTER TABLE public.session_events
    ADD CONSTRAINT session_events_rig_position_check
        CHECK (rig_position IS NULL
            OR rig_position IN ('top', 'middle', 'point'));

COMMIT;
```

If the migration fails with `check_violation` — a row crept in between
the audit and now — query the offenders and decide whether to UPDATE
them to a canonical value or extend the constraint.

### 4. Reload PostgREST schema cache

```sql
NOTIFY pgrst, 'reload schema';
```

---

## Verification

1. **Constraint exists**:
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
     FROM pg_constraint
    WHERE conrelid = 'public.session_events'::regclass
      AND contype = 'c'
      AND conname = 'session_events_rig_position_check';
   ```
   Expect one row with `CHECK ((rig_position IS NULL) OR (rig_position = ANY (ARRAY['top', 'middle', 'point'])))`.

2. **Constraint enforces**:
   ```sql
   -- Should fail
   INSERT INTO public.session_events (session_id, event_type, rig_position)
     VALUES ('<uuid>', 'catch', 'Point');
   ```
   Expect `ERROR: new row for relation "session_events" violates check constraint`.

3. **Normaliser works** — in the diary UI, log a catch with the rig
   position dropdown set to `"Point"` (capital P). Inspect the resulting
   row in Supabase: `rig_position` should be `"point"`, not `"Point"`.

4. **LostModal no longer writes invalid values** — log a lost-fish event
   referencing a fly slot. Confirm the row has either a valid
   `dropper_position` or a NULL there, and that `rig_position` is NULL or
   a valid canonical value (depending on which path was taken in step 2).

5. **Live data still clean**: re-run the audit query and confirm the 70
   rows are unchanged.

---

## Skipped, with rationale

- **Refactoring `RIG_POSITIONS` array in CatchModal** — leaving the UI
  labels as `"Point"`/`"Top dropper"` etc. is fine; the normaliser
  handles them. A future prompt could clean the labels to lowercase
  if there's a UX preference, but it's not required for correctness.

- **Backfilling existing rows** — there's nothing to backfill; the 70
  live rows already match the canonical set.

- **Removing the `rig_position` column entirely** — separate question
  about whether the column has a real semantic role. Park for now.

---

## Response capture

Per protocol prompt 128, log the outcome to
`lovable instructions/responses/130_response.md` in the same change as
the migration.
