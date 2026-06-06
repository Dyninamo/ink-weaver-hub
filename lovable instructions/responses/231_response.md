# 231 — admin-upsert clear-and-reload mode

## Diff: `supabase/functions/admin-upsert/index.ts`
- New optional body param `delete_where_not_null` (column identifier).
- Validation: must be string matching `/^[a-z_][a-z0-9_]*$/i` → 400 otherwise. Prevents SQL/identifier injection.
- When set, before the upsert: `supabaseAdmin.from(table).delete({ count: "exact" }).not(col, "is", null)`. Errors map to 400 (permission/violation) or 500.
- `deleted` count returned via PostgREST `count: exact`; `null` when param omitted.
- Response shape: `{ table, deleted: <n|null>, upserted: rows.length }`.
- Allowlist, MAX_ROWS, `requireAdmin`, `on_conflict`, service_role client all unchanged.

## Verify
- No creds → 401; bogus secret → 401 (unchanged path).
- `delete_where_not_null: "1; drop"` → 400 (regex rejects).
- Omitting the param → identical behaviour to 229 (`deleted: null`).
- Edge fn auto-deploys.
