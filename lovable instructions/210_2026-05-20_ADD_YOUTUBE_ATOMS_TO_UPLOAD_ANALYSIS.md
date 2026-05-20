PROMPT 210 — Add `youtube_atoms` to `upload-analysis` whitelist

The `youtube_atoms` table was created by prompt 70 (BATCH1, 2026-04-21) with public-read
RLS, but no upload path exists. Local has 18,501 atoms ready to backfill, and the
weekly pipeline will add a delta push step. The cleanest fit is the existing
`upload-analysis` edge function, which is `requireAdmin`-gated and uses the
service role internally.

### Change required

In `supabase/functions/upload-analysis/index.ts`, add `'youtube_atoms'` to the
`ALLOWED_TABLES` constant array. Place it in a new commented group at the end so the
intent is obvious:

```ts
const ALLOWED_TABLES = [
  // ... existing entries unchanged ...

  // Venue/session maps
  'session_venue_map', 'venue_spots',

  // YouTube atom corpus (added 2026-05-20, prompt 210)
  'youtube_atoms',
] as const;
```

Do not add `youtube_atoms` to `SERIAL_ID_TABLES` — the `id` column is a
client-supplied `BIGINT PRIMARY KEY` (matches the source SQLite primary key, used
for idempotent delta sync). Leave the insert path otherwise unchanged.

### Verification after deploy

1. From the master scripts machine, hit `upload-analysis` with a one-row test
   payload — see `Database/_smoke_upload_youtube_atoms.py` (created alongside this
   prompt) or run an ad-hoc curl with `X-Admin-Secret`.
2. Expected response: `{"inserted": 1, "failed": 0, "errors": []}`.
3. Then run the real backfill: `python Database/upload_youtube_atoms.py`.
4. The weekly pipeline will push deltas automatically thereafter
   (`pipelines/weekly_update.py` Phase A Step A5).

### Scope

No UI changes. No new RLS policy needed (existing public-read policy is fine; INSERT
flows through service role inside the edge function, same as every other table in
this whitelist). No new table. No schema migration.

### Why not a new dedicated edge function

`upload-analysis` already does exactly the right thing for table-name + rows
payloads with admin gating, error reporting, and service-role insert. Adding one
string to the whitelist is the smallest possible change and keeps the surface area
consistent.
