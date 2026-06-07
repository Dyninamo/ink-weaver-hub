# 239 — Fix offline event sync: missing unique index breaks the queue flush (235 follow-up)

**Severity: HIGH — offline-logged events are silently lost on reconnect.** This is the
exact failure prompt 235 set out to prevent, caught in live testing (2026-06-07).

## What happens (reproduced live)
1. Active session, go offline, log a blank/catch → it queues; banner shows
   "Offline — saves are queued" (✅ Part A works).
2. Reconnect → banner shows "Syncing 1 queued event…" and a `POST` to
   `session_events` fires — but it **400s every time** and the queue **never drains**
   (banner stuck on "Syncing 1 queued event…" indefinitely; observed 25s+, multiple
   retries, queue persists across reloads).
3. Server-side check: `GET session_events?session_id=eq.<id>` returns `[]` — **the
   event never persisted.** The offline write is lost.

## Root cause
The flush in `pendingWriteQueue` upserts with:
```
POST /rest/v1/session_events?on_conflict=client_event_id
Prefer: resolution=merge-duplicates
body: { …, client_event_id: "<uuid>" }
```
Postgres rejects it:
```
400 { "code": "42P10",
      "message": "there is no unique or exclusion constraint matching the ON CONFLICT specification" }
```
Prompt 235 added the **client-UUID idempotent upsert in code** (`on_conflict=client_event_id`)
but the **matching unique constraint/index on `session_events.client_event_id` was never
created**. Without it, every flush 400s → queue never clears → data lost.

## Fix A — add the missing unique index (the actual fix)
Migration on `session_events`. `client_event_id` is NULL for all pre-existing/online rows,
so use a **partial UNIQUE index** (avoids NULL collisions and lets the upsert target match):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS session_events_client_event_id_key
  ON public.session_events (client_event_id)
  WHERE client_event_id IS NOT NULL;
```
PostgREST `on_conflict=client_event_id` matches a partial unique index, so the
`resolution=merge-duplicates` upsert will then succeed and be idempotent on retry.
- Confirm the column exists and is the type the client sends (uuid/text). If the column
  is missing entirely, add it first (`ALTER TABLE … ADD COLUMN client_event_id uuid`).

## Fix B — make the queue resilient so a bad item can't wedge it
Even with A, harden `pendingWriteQueue` so one un-syncable item never blocks the rest:
- On a **non-retryable 4xx** (e.g. 400/409/422 — schema/constraint/validation), do **not**
  infinite-retry: surface a clear error toast, mark the item failed (keep it for inspection),
  and continue flushing the others. Only retry on network/5xx.
- Cap retries per item with back-off; show a real failure state rather than a perpetual
  "Syncing…".

## Fix C — RLS check on the upsert path
Confirm the authenticated upsert satisfies `session_events` RLS WITH CHECK (owner via
`session_id` → `fishing_sessions.user_id`). The 42P10 fired before RLS here, but verify the
insert/update policy covers the upsert once A lands.

## Verify (must runtime-probe, not just deploy)
- [ ] Offline → log a blank → reconnect → **"Syncing…" clears**, banner returns to normal.
- [ ] `GET session_events?session_id=eq.<id>` shows the event **persisted** (status 200, 1 row).
- [ ] Re-fire the flush twice (dispatch `online` again): **no duplicate** row created
      (idempotent upsert on `client_event_id`).
- [ ] A deliberately-bad queued item surfaces a failure toast and does **not** wedge the
      queue for good items (Fix B).
- [ ] Online logging unaffected: one save = one row.

## Note
The queue persists in `localStorage` (`diary.pending_events.v1`) and survives reloads —
good — but that means any user who logged offline before this fix has **stuck, unsynced
events** there. Consider a one-time migration/flush attempt after A deploys so their
queued data lands rather than staying orphaned.
