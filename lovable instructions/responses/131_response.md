# Lovable response — Prompt 131

**Applied:** 2026-05-07
**Status:** applied (option 3 — additive only)

## Changes
- Migration: `ALTER TABLE public.venues_new ADD COLUMN IF NOT EXISTS facebook_url text, ADD COLUMN IF NOT EXISTS report_submission_form_url text;`
- `NOTIFY pgrst, 'reload schema'` issued.
- `return_email` left in place (deferred pending roadmap decision on the `submit-venue-return` edge function).

## Verification
Migration succeeded. Linter returned the 90 pre-existing project-wide findings — none introduced by this migration.
