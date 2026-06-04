# 218 — PWA: add / edit / delete a catch on a past session (DiaryEntry)

The headline feature — port of the RN app's `SessionDetailScreen` +
`EditCatchForm` (shipped yesterday). Let the angler **add a forgotten catch**,
**edit** an existing one, or **delete** one on a past session, from the session
detail page. The catch's TIME drives an auto-derived map location via the GPS
trail (prompt 217). All writes use the **already-existing** `diaryService`
functions over RLS — `addEvent`, `updateEvent`, `deleteEvent` — so there's **no
new backend** here.

Reference implementations (read them, match the behaviour):
- `FishingDiary/src/components/EditCatchForm.tsx`
- `FishingDiary/src/screens/SessionDetailScreen.tsx`

## Part A — `CatchEditForm` component (new, standalone)
New `src/components/diary/CatchEditForm.tsx`. **Do NOT refactor `CatchFlow`** (the
live in-session logger) — keep that critical path untouched; this is a separate
form for past/edit. Reuse CatchFlow's *field inputs* (species chips + Other,
weight/length toggle, fly picker, position chips, depth chips, kept/released,
notes) — extract them into shared sub-components if convenient, or copy the
markup. Props:
```ts
{ mode: 'add' | 'edit';
  initial?: SessionEvent;          // edit: hydrate from this
  session: FishingSession;
  trail: TrailPoint[];             // from getSessionTrail (prompt 217)
  onSaved: () => void;             // parent re-loads events
  onCancel: () => void; }
```

**Time + derived location (the key bit):**
- A **time control**: a readout (HH:mm) with **−15 / −5 / +5 / +15 min** nudge
  buttons, clamped to the session span (`started_at`..`ended_at`, or now if still
  running). Add mode defaults to session end; edit mode starts at the event's
  `event_time`.
- Below it, a **derived-location line** driven by `deriveFixFromTrail(trail,
  timestampISO)`: show `📍 <note> (<confidence>)` when a fix is found, or the
  no-track note otherwise. Edit mode: keep the event's existing
  `latitude`/`longitude` **unless** the user moves the time or taps a
  **"Re-place from track"** link; add mode always uses the derived fix.

**Save** builds a PWA `SessionEvent` and calls `addEvent` (add) or `updateEvent`
(edit). Field mapping from the RN form:
| form value | session_events column |
|---|---|
| species (or Other text) | `species` |
| weight (lb) / length (in) + mode | `weight_lb` / `length_inches`, `measurement_mode` |
| fly | `fly_pattern` |
| position | `rig_position` |
| kept/released | `kept_released` |
| depth | `depth_zone` |
| notes | `notes` |
| derived/kept fix | `latitude`, `longitude` (and `gps_accuracy` if the column/type allows) |
| time | `event_time` (ISO) |
| — | `event_type: 'catch'` |

Validation: species required; size optional but if present must be a positive
number. Disable Save otherwise.

## Part B — wire into `DiaryEntry.tsx`
- **Add:** an **"+ Add catch"** button on the Timeline tab header. Opens
  `CatchEditForm` in `mode:'add'`. On `onSaved`, re-run the existing
  `getSessionEvents` load.
- **Edit:** on each **catch** event's expanded card (the existing
  `// TODO: inline event editing` slot, ~line 577), an **Edit** affordance that
  opens `CatchEditForm` in `mode:'edit'` with that event as `initial`.
- **Delete:** a **Delete** action on a catch (in the edit form and/or the
  expanded card) calling `deleteEvent(id)`, then re-load. Use the **existing
  soft-undo pattern** from `deleteSession`/`doDelete` (toast + brief undo window)
  for consistency.
- On mount, also fetch the trail once via `getSessionTrail(sessionId)` and pass
  it to the form. Show a small **"GPS track: N points · X/Y catches located"**
  strip (like RN's SessionDetailScreen) so the angler knows whether a back-added
  catch can be auto-placed.
- Keep events **chronological**: after add/edit, the list should display sorted by
  `event_time` (RN re-sorts so a back-dated catch doesn't sort last). If
  `sort_order` is used for ordering, recompute it from `event_time` on save.

## Constraints / cautions
- This is a UI-only change over existing RLS service functions — **no edge fn, no
  schema change**. `updateEvent`/`deleteEvent` already exist in `diaryService`
  but are currently unused; this is their first caller.
- Don't touch `CatchFlow` or the live-session flow.
- I (the author) can't verify PWA UI in a browser — after building, **say so
  explicitly** and list the manual steps below rather than claiming it works.

## Verify (manual — UI)
1. Open a past session with events → Timeline tab. Edit a catch's species/fly →
   save → value persists after reload, and re-opening shows the new value.
2. Add a catch, nudge the time into the session span → derived-location line
   shows a confidence; save → new catch appears in time order with a location.
3. Delete a catch → it disappears; undo within the window restores it; after the
   window it's gone from `session_events` (confirm via DB).
4. A session with **no** trail → add a catch → location line says "no track",
   save still works (location null).
