# 235 — Offline logging resilience (Part A + Part B core)

## Part A — fail loud, never silent
- `src/hooks/useOnlineStatus.ts`: `useOnlineStatus()`, `isOfflineNow()`, `isOfflineError(err)` (matches `Failed to fetch | NetworkError | ERR_*`).
- All five in-session save handlers (`BlankFlow`, `LostFlow`, `ChangeFlow`, `CatchFlow`, `CatchEditForm`) now branch in their `catch`:
  - `err.queued` → toast "Saved offline — will sync when you're back online" and continue (write is durable, see Part B).
  - `isOfflineError(err)` → destructive toast "Couldn't save — you're offline. Tap to retry." Form **keeps state**, does not close.
  - Else → original error toast.
- Offline indicator: sticky destructive banner at the top of `ActiveSessionShell` while `navigator.onLine === false`, also shows queue depth while syncing.

## Part B core — durable queue + idempotent retry
- Migration: `session_events.client_event_id uuid` (nullable) + partial-unique index `session_events_client_event_id_uniq`.
- `src/lib/pendingWriteQueue.ts`: localStorage-backed (no new dep). `enqueue / remove / listPending / pendingCount / flushQueue / installAutoFlush / onChange`. Flush is single-flight, upserts on `client_event_id` to dedupe partial-success retries, and stops on the first network error to avoid hot looping.
- `diaryService.addEvent` attaches `crypto.randomUUID()` as `client_event_id` and, on a network/offline insert failure, enqueues the normalised payload and throws an `err.queued = true` marker so the caller can surface the "queued" toast.
- `ActiveSessionShell` installs auto-flush on mount; flush fires on `online` and `visibilitychange (visible)`.

## Deferred to Part B follow-up (out of scope here)
- Inline "pending / not synced" badges in the Recent list (requires merging queued items into the events fetch result). The banner queue counter + toast cover the user signal in the meantime.
- RN diary app parity audit.

## Verify
- Offline → Mark a blank → destructive toast appears, form stays open with data. Online queued event eventually appears on next reload (auto-flush on `online`).
- Banner: "Offline — saves are queued" while offline; switches to "Syncing N queued event(s)…" once online if anything is pending.
- Reload mid-outage: queue persists in localStorage, flushes on next online/visible.
- Duplicate guard: forcing two flushes does not double-insert (unique index on `client_event_id`).
