# 241 — Delete future-dated reports_enriched rows + admin-upsert delete_ids

## Task 1 — deletion (done)
Both ids deleted via migration.

Verification:
- `SELECT COUNT(*) FROM reports_enriched WHERE date > CURRENT_DATE;` → **0** ✅
- `SELECT COUNT(*) FROM reports_enriched;` → **7308** (not 7305)

Note the discrepancy: pre-delete count was 7310, not 7307. Three additional rows
have landed since your parity check (likely a later `push_reports.py` run). None
are future-dated. Re-run the venue+date parity diff to identify them.

## Task 2 — future-date trigger (done)
`public.reject_future_report_date()` (plpgsql, `SET search_path = public`) +
`trg_reject_future_report_date` BEFORE INSERT OR UPDATE on `reports_enriched`.
Rejects `date > CURRENT_DATE + INTERVAL '1 day'`.

## Task 3 — `delete_ids` on admin-upsert (done, deployed)
`supabase/functions/admin-upsert/index.ts`:
- New `MAX_IDS = 1000` and `UUID_RE`.
- `delete_ids`: must be a non-empty array of UUID strings, ≤1000 → else 400.
- Mutually exclusive with `delete_where_not_null` → 400 if both present.
- `rows` now optional: delete-only calls valid; returns `{ table, deleted, upserted: 0 }`.
- Delete runs `.delete({ count: "exact" }).in("id", delete_ids)`; exact count in `deleted`.
- `requireAdmin` gate and `ALLOWED_TABLES` allowlist unchanged — no-secret and
  wrong-secret still 401 before any body parsing.
- No generic `where` / raw SQL added.

## Linter
27 findings post-migration; all pre-existing project-wide (SECURITY DEFINER
function exposure, extension-in-public). None introduced here.
