# 230 — Security: lock down anonymous writes (223 #7 / #22)

Closes the last ERROR-level finding: many catalog/reference tables have `ALL`
policies with `USING (true)` granted to `public` (so `anon` can INSERT/UPDATE/
DELETE). Restrict writes to `service_role`; keep legitimate public **reads** where
they are intentional (these are non-PII catalog tables — youtube_atoms,
method_*, venue_slices, stocking_records, etc. may keep `SELECT USING(true)`).

## ⚠️ PREREQUISITE — 229 deployed + master writers converted FIRST
Master writes these tables with the **anon key** (`Database/sync/push_*.py`,
`Database/upload_*.py`). Restricting writes to `service_role` will break the
weekly pipeline until those scripts call the **`admin-upsert` edge fn (229)**
with `X-Admin-Secret`. Order: **229 deployed → master writers converted +
smoke-tested → THEN apply 230.** (RN/PWA never write these tables.)

## Audit + migration
1. **Enumerate every table** with a permissive write policy: any policy that is
   `FOR ALL` or `FOR INSERT/UPDATE/DELETE` with `USING (true)` / `WITH CHECK
   (true)` granted to `public`/`anon`. Query `pg_policies` and list them in the
   response — do not rely on the 223 sample list alone.
2. For each, **one migration per table** (independently revertible):
   - Drop the permissive write policy (or the `ALL` policy if it also grants the
     intended public read — in that case replace with a SELECT-only public policy
     where reads are wanted, plus a service_role write policy).
   - Add (or rely on default) `service_role` full access.
   - **Preserve intended public SELECT** on non-PII catalog tables — don't break
     the apps'/site's read of venues, flies, slices, stocking, etc.
3. Do **not** touch the diary/PII tables (already owner-locked in 227) or the
   user-owned tables.

## Verify (don't trust the apply log)
- Pull repo; per-table migrations; `pg_policies` shows no `{public}`/`{anon}`
  write policies remain on the audited tables; intended public SELECTs intact.
- Anon `POST`/`PATCH`/`DELETE` to e.g. `reports_enriched`, `venues_new`,
  `flies` → **denied**. Anon `GET` on the still-public catalog tables → still OK.
- `admin-upsert` (229) writes succeed (service_role).
- After master writers are converted: a dry-run of one `push_*`/`upload_*`
  succeeds via the edge fn.
- Linter: 223 #7 / #22 cleared.
