# Prompt 208 Response — venue_slices admin write policy

## §1 Migration applied

```sql
CREATE POLICY "Admin emails can write venue_slices"
    ON public.venue_slices
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('nick.dyne@gmail.com'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('nick.dyne@gmail.com'));
```

Migration completed successfully. Linter returned 94 pre-existing project-wide findings, none introduced by this change.

## §V Verification

`pg_policies` for `public.venue_slices`:

| policyname | cmd | using_expr | check_expr |
|---|---|---|---|
| Admin emails can write venue_slices | ALL | `((auth.jwt() ->> 'email'::text) = 'nick.dyne@gmail.com'::text)` | `((auth.jwt() ->> 'email'::text) = 'nick.dyne@gmail.com'::text)` |
| Public can read venue_slices | SELECT | `true` | — |
| Service write venue_slices | ALL | `(auth.role() = 'service_role'::text)` | `(auth.role() = 'service_role'::text)` |

3 rows as expected.

## Files changed

- Created: `supabase/migrations/<timestamped>_admin_write_venue_slices.sql` (via migration tool)
- Created: `lovable instructions/208_2026-05-14_VENUE_SLICES_ADMIN_WRITE.md` (prompt copy)
- Created: `lovable instructions/responses/208_response.md` (this file)

No code, edge function, or config edits.

## Coupling note

The policy email list is hard-coded to match `supabase/functions/_shared/admin_auth.ts` (`ADMIN_EMAILS = {'nick.dyne@gmail.com'}`). Both must be updated together when admins are added/removed.
