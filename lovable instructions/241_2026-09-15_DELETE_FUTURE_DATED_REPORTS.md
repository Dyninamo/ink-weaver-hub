# 241 — Delete two future-dated reports_enriched rows, and give admin-upsert a targeted delete

**Date:** 2026-09-15
**Origin:** S40 master→Supabase parity check after the §14 enrichment backfill.

---

## Background

Master's `reports_enriched` holds 7,305 rows. Supabase holds 7,307. Every master row
is present in Supabase (0 missing), so the surplus is two rows that exist **only** in
Supabase:

| id | venue | date |
|----|-------|------|
| `97c0a4b1-eef8-4e95-90e1-b3be4ba4e57b` | Ladybower Fisheries | 2026-11-15 |
| `3689528c-7f45-4df0-b758-8e63d967f6d5` | Tenterden Trout Waters | 2026-11-15 |

Both are dated two months in the future. They are year-bumped duplicates: the real
Tenterden report is `reports_raw` dated **2025**-11-15 and is already enriched in master
at that correct date; Ladybower has correct rows at 2025-11-01 and 2025-11-08. Nothing
unique is lost by deleting them.

They were deleted from master by `scripts/maintenance/phase0_cleanup.py` on 2026-09-14,
but `Database/sync/push_reports.py` is **insert-only** — it never propagates deletions —
so they survived in Supabase.

An anon-key `DELETE` via PostgREST does not work: RLS filters the rows and PostgREST
returns **HTTP 200 with an empty body**, which is indistinguishable from a successful
delete. Verified after the fact that both rows were still present.

---

## Task 1 — delete the two rows (required)

```sql
DELETE FROM public.reports_enriched
 WHERE id IN (
   '97c0a4b1-eef8-4e95-90e1-b3be4ba4e57b',
   '3689528c-7f45-4df0-b758-8e63d967f6d5'
 );
```

Verify — this must return **0**:

```sql
SELECT COUNT(*) FROM public.reports_enriched WHERE date > CURRENT_DATE;
```

And this must return **7305**:

```sql
SELECT COUNT(*) FROM public.reports_enriched;
```

Please report both numbers back in the response, not just "done".

---

## Task 2 — reject future-dated reports at the table (recommended)

A fishing report cannot describe a day that has not happened. Postgres will not accept
`CURRENT_DATE` in a CHECK constraint (not immutable), so use a trigger:

```sql
CREATE OR REPLACE FUNCTION public.reject_future_report_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date > CURRENT_DATE + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'reports_enriched.date % is in the future', NEW.date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_future_report_date ON public.reports_enriched;
CREATE TRIGGER trg_reject_future_report_date
  BEFORE INSERT OR UPDATE ON public.reports_enriched
  FOR EACH ROW EXECUTE FUNCTION public.reject_future_report_date();
```

The `+ INTERVAL '1 day'` is deliberate slack for timezone skew between the master box
(Europe/London) and Postgres (UTC).

---

## Task 3 — targeted delete on admin-upsert (recommended)

`supabase/functions/admin-upsert/index.ts` currently supports only
`delete_where_not_null`, which deletes **every** row where the named column is non-null.
That is a full-table replace and is unusable for removing specific rows — pointing it at
`reports_enriched` would delete all 7,305.

So master-side cleanups can propagate, add a `delete_ids` parameter alongside the
existing options, subject to the same `ALLOWED_TABLES` allowlist and `X-Admin-Secret`
gate as the rest of the function:

- Accept `delete_ids`: an array of strings, **cap it at 1000 entries** (reject above that
  with a 400, matching the existing `MAX_ROWS` discipline).
- Validate every entry is a UUID string before use; reject the whole request otherwise.
- Run `supabaseAdmin.from(table).delete({ count: "exact" }).in("id", delete_ids)`.
- Return the exact deleted count in the JSON response as `deleted`.
- `delete_ids` and `delete_where_not_null` are mutually exclusive — reject with a 400 if
  both are present, rather than guessing which was meant.
- `rows` must stay optional so a delete-only call is valid; do not require an upsert
  payload alongside a delete.

**Do not** add a generic `where` clause or accept raw SQL — an id list is the whole
surface area needed here.

---

## Verification I will run master-side afterwards

1. Re-query `reports_enriched` for `date > CURRENT_DATE` — expect 0 rows.
2. Re-run the full venue+date parity diff against master — expect 0 in each direction.
3. For Task 3, probe the no-secret and wrong-secret cases against `delete_ids`; both must
   return 401 before I use it for anything.
