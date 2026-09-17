# 242 — admin-upsert: integer-key deletes + youtube_atoms allowlist

## Diff: `supabase/functions/admin-upsert/index.ts`
- `ALLOWED_TABLES`: added `youtube_atoms`.
- Added `INT_RE = /^[1-9][0-9]{0,18}$/`.
- `delete_ids` validation replaced: homogeneous all-UUID **or** all-positive-integer
  (JS safe integer > 0, or numeric string). Mixed lists → 400
  "delete_ids must be all UUID strings or all positive integers, not a mix".
- Normalised list stored in `deleteIdList` (numbers coerced via `Number(v)`), passed to `.in("id", deleteIdList)`.
- Unchanged: `requireAdmin`, `MAX_IDS = 1000`, non-empty check, mutual exclusivity with
  `delete_where_not_null`, `{ count: "exact" }` delete + error handling, upsert path.

## Deploy
Edge function redeployed.

## Verification
Pending master-side: `python Database/_smoke_admin_upsert_delete.py` (7 existing guards,
plus the 4 new cases). `"'; DROP TABLE reports_enriched; --"` is now rejected by the
homogeneity check (neither UUID nor INT_RE).
