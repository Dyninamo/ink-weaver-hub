# 231 — `admin-upsert`: add a clear-and-reload (replace) mode

Extends the `admin-upsert` edge fn (229). Master's `push_fly_dependents.py`
**clear-and-reloads** 9 fly-dependent tables (`DELETE FROM <t> WHERE <fly_col>
IS NOT NULL` → insert fresh rows) because the 2026-04-23 flies rebuild changed
row shapes and an upsert-only sync would leave stale rows. `admin-upsert` only
upserts, so that writer can't move off the anon key until the fn can delete.

## Change — add one optional param
`delete_where_not_null` (optional string, a **column name**):
- When present, **before** inserting `rows`, run
  `DELETE FROM <table> WHERE <delete_where_not_null> IS NOT NULL`.
- **Validate the column name** is a plain identifier (`^[a-z_][a-z0-9_]*$`,
  case-insensitive) → 400 otherwise. Never interpolate an unchecked string.
- Then insert `rows` (plain insert; `on_conflict` still honoured if also given).
- Keep everything else identical: `requireAdmin`, the 22-table **allowlist**,
  `MAX_ROWS` cap, service_role client.

Semantics match the script exactly: the 9 target tables have `fly_col` NOT NULL
on every row, so "delete where fly_col is not null" = full clear, then reload.

## Response shape
`{ table, deleted: <n|null>, upserted: rows.length }` — return the delete row
count when `delete_where_not_null` was used (null otherwise).

## Verify
1. Pull repo; grep `admin-upsert` for `delete_where_not_null`, the identifier
   regex validation, and that delete runs before insert.
2. No creds → 401; bogus secret → 401 (unchanged).
3. With `X-Admin-Secret` on a low-risk allowlisted table: a normal upsert (no
   `delete_where_not_null`) still works; passing
   `delete_where_not_null: "1; drop"` → 400 (regex rejects).
4. Existing 229 calls (no new param) behave exactly as before.

## Context
Unblocks converting `push_fly_dependents.py` off the anon key. After this +
the rest/v1 writer conversions are done and smoke-tested, prompt **230** can lock
the anon write policies.
