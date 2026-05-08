# Lovable Prompt 140 — Leader schema migration + resume prompt 139

**Date:** 2026-05-08
**Supersedes:** the schema-gap stop on prompt 139.
**Context:** prompt 139's pre-flight correctly caught that
`fishing_sessions` has only `leader_id` — not `leader_material`,
`leader_length_ft`, or `leader_strength_lb`. The 138 response
mis-stated those existed. This prompt closes the gap and authorises
prompt 139 to resume as written.

**Capture protocol:** per prompt 128, log to
`lovable instructions/responses/140_response.md`.

---

## Decision: path 1 (schema migration)

The `leaders` catalogue is 25 rows. The picker space (5 materials × 8
lengths × 10 strains) is 400 combos. Catalogue-only mode (path 2 in
the 139 stop) would silently drop data for every angler whose gear
isn't among the 25 — exact failure mode prompt 139 was trying to
prevent.

User-extensibility was rejected on 2026-05-08 only for *the catalogue
of materials* (no new material types). Per-session capture of the
angler's actual gear was always in scope.

---

## Step 1 — apply the migration

```sql
ALTER TABLE public.fishing_sessions
  ADD COLUMN leader_material text,
  ADD COLUMN leader_length_ft real,
  ADD COLUMN leader_strength_lb real;

NOTIFY pgrst, 'reload schema';
```

Notes on shape:

- No CHECK constraint on `leader_material`. The 5-value vocabulary
  (`nylon` / `copolymer` / `mono` / `fluoro` / `furled`) is enforced
  UI-side. Keeping the column permissive so the RN-app's rod-side
  string (which already exists in local state but is currently only
  written into the `notes` JSON blob) can land here unchanged in a
  follow-up.
- `real` for both numeric columns — matches the existing
  `leaders.length_ft` / `leaders.breaking_strain_lb` types.
- Issue the `NOTIFY pgrst` at the end so PostgREST picks up the new
  columns without a manual restart.

Verify after migration:

```sql
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'fishing_sessions'
   AND column_name IN ('leader_id','leader_material','leader_length_ft','leader_strength_lb')
 ORDER BY column_name;
```

Expect 4 rows.

---

## Step 2 — resume prompt 139 as written

With the schema gap closed, every column referenced in prompt 139's
"State + writes" section now exists. Implement the rest of 139
unchanged:

- Material chip row (5 options, must pick).
- Length picker with **ft / m** unit toggle, ft default **15**,
  m converts to canonical feet.
- Strain picker with **lb / X** unit toggle, lb default **6**, X is
  display-only.
- Best-effort `leader_id` lookup against the `leaders` catalogue
  (single-row match → write the id; otherwise null).
- **Always** write `leader_material` / `leader_length_ft` /
  `leader_strength_lb` to `fishing_sessions` regardless of whether
  `leader_id` resolved.
- Pre-fill from the user's most recent prior session.
- Slot the leader step in `SetupCascade.tsx` between Rig and Line.

Re-read prompt 139 as the source of truth for the UI specifics; this
prompt only adds the migration + reaffirms the data shape.

---

## Out of scope

- Master DB / `MASTER_FLYFISHING.db` schema sync — same three columns
  need adding on the Python-pipeline side so the round-trip works.
  That's a fishing-intelligence repo task, not yours.
- RN-app sessionMapper changes to write the new columns — separate
  RN-side prompt against the `round3-redesign-wip` branch.
- A CHECK constraint on `leader_material` — deliberately omitted per
  the note above.

---

## Verification

1. Migration ran clean (the verify query above returns 4 rows).
2. PostgREST picked up the new columns (a fresh `select` on the
  `fishing_sessions` row from the client returns the new fields
  without a 500 / "column does not exist" error).
3. Implement prompt 139 + the verification steps in 139's
  "Verification" block.

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/140_response.md`:

- Confirmation the migration applied + the verify-query output.
- Then the full 139 response content (since 140 supersedes 139's
  stop) — pre-flight greps, diff summary per sub-step, screenshots,
  and the DB row from 139's §3 verification.
- Anything else you want to flag.
