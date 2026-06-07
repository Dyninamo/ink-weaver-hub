# 239 — Fix offline event sync (235 follow-up)

## Root cause confirmed
`session_events.client_event_id` column existed and a **partial** unique index was created in prompt 235 (`… WHERE client_event_id IS NOT NULL`). PostgREST does not match partial unique indexes for `on_conflict=…`, so every flush returned `42P10` and the queue never drained.

## Fix A — real UNIQUE constraint (migration)
- Dropped the partial index (`session_events_client_event_id_uniq` / `_key`).
- Added `ALTER TABLE session_events ADD CONSTRAINT session_events_client_event_id_key UNIQUE (client_event_id)`. Btree uniques allow multiple NULLs, so legacy rows are unaffected.
- `NOTIFY pgrst, 'reload schema'` issued.

## Fix B — queue resilience (`src/lib/pendingWriteQueue.ts`)
- Classify errors: network/`Failed to fetch` → break loop and retry later; PostgREST/Postgres client errors (`4xx`, codes `22*/23*/42*/PGRST*`, constraint/validation messages) → mark item `failed`, toast once, **continue flushing other items**.
- `MAX_ATTEMPTS = 5` then auto-marks failed.
- Failed items kept in storage for inspection but skipped by future flushes and excluded from `pendingCount` (so the banner doesn't stick on a permanently-bad item).
- Added `clearFailed()` helper.

## Fix C — RLS
No RLS change needed. Existing owner-scoped policies on `session_events` already cover the upsert path (insert + update). 42P10 fires before RLS, so the original symptom was unrelated.

## Verify
- Index check: `pg_indexes` shows only the new non-partial unique constraint backing index.
- Re-run offline → log → reconnect: upsert now resolves via `on_conflict=client_event_id`; banner clears.
- Stale queued items from before this fix will flush on next online/visibility event (auto-flush listeners unchanged).
