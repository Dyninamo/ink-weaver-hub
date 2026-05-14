# Lovable Prompt 208 — Allow admin-email writes to `venue_slices`

**Date:** 2026-05-14
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Depends on:** 207 (created the table).

**Why this prompt exists:**

Prompt 207 created `public.venue_slices` with two RLS policies:

```
Public can read venue_slices  | SELECT  | USING (true)
Service write venue_slices    | ALL     | USING (auth.role() = 'service_role')
```

The master-side push script `Database/sync/push_venue_slices.py` authenticates with the anon key (Bearer = anon key) and gets rejected: `new row violates row-level security policy`. Other master push scripts (`push_analysis_tables.py`, etc.) work around this by calling a `requireAdmin`-gated edge function (`upload-analysis`) that uses service_role internally — but `upload-analysis`'s `ALLOWED_TABLES` allow-list doesn't include `venue_slices`, and bouncing a 67 MB payload through an edge function is wasteful when a direct PostgREST upsert with the right policy is one line of SQL.

Add a third policy so admin-email JWTs (per the existing `ADMIN_EMAILS` convention in `_shared/admin_auth.ts`) can write directly via PostgREST. The push script signs in with Nick's email/password, sends the resulting JWT as Bearer, and the policy lets the write through.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/208_response.md`.

---

## What this prompt does

Adds one RLS policy to `public.venue_slices` allowing INSERT/UPDATE/DELETE for authenticated users whose JWT email matches the admin list. Nothing else changes.

---

## §1 — Migration

Apply via the Lovable migration tool:

```sql
-- PWA prompt 208: allow admin-email JWTs to write directly to venue_slices,
-- matching the dual-path admin auth pattern used by the requireAdmin edge
-- functions. Keeps the existing public-read and service-role-write policies.

CREATE POLICY "Admin emails can write venue_slices"
    ON public.venue_slices
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('nick.dyne@gmail.com'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('nick.dyne@gmail.com'));
```

The admin email list is hard-coded here to match `_shared/admin_auth.ts` (`const ADMIN_EMAILS = new Set<string>(['nick.dyne@gmail.com'])`). Both lists should evolve together — if admins are added/removed in `admin_auth.ts`, this policy must be updated too. **Document this coupling** in the response log.

### Verify post-migration

```sql
SELECT policyname, cmd, qual::text AS using_expr, with_check::text AS check_expr
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'venue_slices'
ORDER BY policyname;
```

Expected 3 rows:

| policyname | cmd |
|---|---|
| Admin emails can write venue_slices | ALL |
| Public can read venue_slices | SELECT |
| Service write venue_slices | ALL |

Paste output.

---

## Acceptance criteria

1. **Policy exists.** Verify query returns 3 rows including the new "Admin emails can write venue_slices" with `cmd = ALL` and `qual` containing the email check.
2. **Service-role write still works.** Existing service-role internal writes (any edge function that uses `supabase` with service_role) continue to function. No regression.
3. **Public read still works.** Anonymous (anon key, no JWT) GET request to `/rest/v1/venue_slices?select=venue_id` returns 200 with empty array (table is currently empty; after master push it'll return rows).
4. **No other changes.** This prompt touches only the migration. No code edits, no edge function changes.

---

## Verification (response log §V)

Paste into `lovable instructions/responses/208_response.md`:

1. The migration SQL exactly as applied.
2. The §"Verify post-migration" query output (3 policy rows).
3. Confirmation that no other files were edited.

---

## Out of scope / follow-ups

- Sync the policy's email list with `_shared/admin_auth.ts` whenever admins change — track in a future "admin onboarding" checklist.
- Extending this same pattern to other master-push tables that currently round-trip through `upload-analysis` (mostly historical; not urgent).
