# 235 — In-session logging: don't silently lose offline writes; show failures

Found in adversarial testing (2026-06-06): during an **active session**, logging
an event while offline **fails silently**. Repro: go offline → "Mark a blank" →
the form submits, the POST fails (`ERR_INTERNET_DISCONNECTED`), the form just
stays open, and on reconnect the blank is **never** retried or persisted (the
session kept only its online events). No toast, no banner — the user believes
they logged it. This is the realistic failure mode for this app: people fish in
no-signal spots and rely on in-session logging.

(The RN diary app is local-first and queues these writes; the PWA's in-session
quick-actions currently do not.)

Two parts — at minimum do Part A; Part B is the proper fix.

## Part A — never fail silently (minimum)
For every in-session quick-action save (catch, lost fish, blank, fly change) and
the edit/add/delete-catch paths:
- On write failure (network error or non-2xx), show a clear destructive **toast**
  ("Couldn't save — you're offline. Tap to retry.") and keep the entered data so
  the user can retry. Do **not** close the form / clear state as if it succeeded.
- Add an **offline indicator** in the session header when `navigator.onLine` is
  false (and on `offline`/`online` events), so logging-while-offline is visibly
  risky before the user even taps save.

## Part B — queue offline writes and flush on reconnect (proper fix)
Mirror the RN approach: a local **pending-writes queue** for session events.
- On save, write to the queue first (optimistic UI: the event appears in the
  "Recent" list immediately, marked "pending / not synced"), then attempt the
  network write.
- Flush the queue automatically on the `online` event and on app focus; mark
  each item synced on success. Persist the queue (localStorage/IndexedDB) so a
  reload mid-outage doesn't drop it.
- Idempotency: give each queued event a client-generated UUID and upsert on it,
  so a retry after a partial success can't create duplicates. (We already saw a
  single online save correctly produce exactly one catch + its auto "change"
  event — preserve that; the queue must not double-post on flush.)
- De-dupe on flush against what's already server-side for the session.

## Verify
- [ ] Offline → log a blank/catch → a clear "not saved / offline" toast appears
      and the form keeps the data (Part A).
- [ ] Header shows an offline indicator while `navigator.onLine` is false.
- [ ] (Part B) Offline-logged events appear immediately as "pending", then
      auto-sync on reconnect; a reload during the outage doesn't lose them.
- [ ] (Part B) Flushing the queue does not create duplicate events
      (client-UUID upsert); re-running flush twice is a no-op.
- [ ] Online behaviour unchanged: one save = one event (+ legitimate auto-change).

## Note (separate, non-blocking)
While offline the Supabase auth client fired a retry storm — 8+ repeated `503`s
to `/auth/v1/user` within seconds. If easy, throttle/back-off the session-refresh
when `navigator.onLine` is false so we're not hammering auth during an outage.
