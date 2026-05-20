# 210 — Add youtube_atoms to upload-analysis whitelist

## Diff
- `supabase/functions/upload-analysis/index.ts`: appended `// YouTube atom corpus (added 2026-05-20, prompt 210)` group containing `'youtube_atoms'` to `ALLOWED_TABLES`.
- `SERIAL_ID_TABLES` unchanged — `youtube_atoms.id` is a client-supplied BIGINT PK; ids must pass through.

## Deploy
Edge function auto-deploys on save. Ready for smoke test via `Database/_smoke_upload_youtube_atoms.py`.
