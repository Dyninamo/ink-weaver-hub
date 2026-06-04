# 218 — Add / edit / delete catch on past sessions

## New `src/components/diary/CatchEditForm.tsx`
Standalone form (CatchFlow untouched). Props match spec: `mode`, `initial`,
`session`, `trail`, `onSaved`, `onCancel`.

- **Time:** read-out + −15 / −5 / +5 / +15 nudge buttons clamped to the session
  window (`session_date+start_time` → `end_time`, or `now` if active).
  Add-mode defaults to session end; edit-mode to `initial.event_time`.
- **Derived location strip:** `deriveFixFromTrail(trail, eventISO)` →
  `📍 <note> (<confidence>)` or the no-track note. Edit-mode keeps
  `initial.latitude/longitude` until the user nudges time OR taps
  "Re-place from track" (the flag `usedTrail` flips on either action).
  Add-mode always uses the derived fix.
- **Fields:** species chips (incl. "Other" → free text), weight/length toggle
  (`measurement_mode` persisted), fly pattern + size, position chips
  (`point/middle/top dropper/bob`), depth chips, kept/released, notes.
- **Validation:** species required; size positive-if-present. Disables Save
  otherwise.
- **Save:** builds `Partial<SessionEvent>` with `event_type:'catch'` and the
  field map in the spec (incl. `gps_accuracy`), calls `addEvent` or
  `updateEvent` from `diaryService`.

## Wiring in `src/pages/DiaryEntry.tsx`
- `loadData` now also fetches `getSessionTrail(id)` in parallel and sorts
  events by `event_time` so back-dated catches land in chronological order.
- New header strip on the Timeline tab (completed sessions only): "GPS track:
  N points · X/Y catches located" plus an "+ Add catch" button.
- Expanded catch rows (completed sessions only) get Edit + Delete buttons.
- Delete uses a 6s soft-undo (mirrors `doDelete`): event is removed from the
  UI immediately, `deleteEvent` runs after the timer; UNDO cancels and
  restores; failure restores + toasts.
- Catch editor mounted as a Dialog at the bottom of the page.

## Out of scope / cautions
- `CatchFlow` and the live-session flow untouched, as specified.
- **Manual verification required** — I can't drive the PWA UI. Please verify:
  1. Open a past session → Timeline tab → tap a catch → Edit → change
     species/fly → save → reload → value persists.
  2. Add catch, nudge time → derived-location line shows a confidence → save →
     row appears in chronological order with a location.
  3. Delete catch → row vanishes; UNDO restores; after 6s confirm the row is
     gone from `session_events` in the DB.
  4. Session with no trail → add catch → strip says "No GPS track for this
     session." → save still works with null lat/lon.
