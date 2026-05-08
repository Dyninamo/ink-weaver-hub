# 145 — PWA app_events log

## Pre-flight
- `rg "app_events|eventLogger|logEvent" src/` → zero hits (clean cut, as predicted).
- `/admin/` routes in `App.tsx`: existing AdminUpload, AdminDbStatus, AdminTestAdvice, AdminRecompute, AdminVenueSubmissions — followed the same `<Shelled>` pattern for `/admin/events`.
- Auth UUID lookup: Nick = `43928498-a5f6-486c-a6ad-3e0b958d505d` (used in `ALLOWED_UIDS`). Alun TBC.

## Migration
Ran the prompt §1 SQL verbatim:

```sql
CREATE TABLE public.app_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_time timestamptz NOT NULL,
  server_time timestamptz NOT NULL DEFAULT now(),
  route text, event_type text NOT NULL, payload jsonb,
  session_id text, app_version text, user_agent text
);
CREATE INDEX idx_app_events_user_time ON public.app_events (user_id, server_time DESC);
CREATE INDEX idx_app_events_event_type ON public.app_events (event_type);
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_insert_own_events" ON public.app_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_read_own_events"   ON public.app_events FOR SELECT USING (auth.uid() = user_id);
NOTIFY pgrst, 'reload schema';
```

Migration succeeded. Linter returned the 90 pre-existing project-wide findings — none introduced by this migration.

## Files
- **Created:** `src/services/eventLogger.ts`, `src/pages/AdminEvents.tsx`.
- **Edited:**
  - `src/App.tsx` — added `/admin/events` route (Shelled).
  - `src/services/adviceService.ts` — `advice.request` / `advice.received` / `advice.fallback_v1` events around `getFishingAdvice` router.
  - `src/components/diary/ActiveSessionShell.tsx` — `session.phase_enter` on phase change.
  - `src/components/diary/CatchFlow.tsx` — `catch.fly_correction` on fly pick, `catch.saved` + `error` on save.
  - `src/components/diary/ChangeFlow.tsx` — `session.change` + `error`.
  - `src/components/diary/BlankFlow.tsx` — `session.blank` + `error`.
  - `src/components/diary/LostFlow.tsx` — `session.lost` + `error`.
  - `src/components/diary/setup/SetupWizard.tsx` — `wizard.phase_enter`, `wizard.preset_applied`, `wizard.commit`.
  - `src/pages/DiaryNew.tsx` — `diary.venue_selected`, `diary.water_type_override`, `diary.build_rig_clicked`, `diary.session_started`, `error` (rollback path).

## Implementation notes / deviations
- **`logEvent` is fire-and-forget** — never awaited in caller code paths; the queue + 10s flusher (+ visibility/unload hooks) handles delivery. Errors only `console.warn` and re-queue.
- **`advice.received` payload:** the v2 response shape doesn't expose a top-level `venue.water_type` (it's inferred upstream from venue lookup). I logged `water_type_in_response` from `result.venue?.water_type ?? result.weather?.water_type ?? null` so anything the edge function attaches will surface; if both are null on a Home/river-against-stillwater bug, that's still the diagnostic you want — paired with the `advice.request` payload showing the venue string the user actually queried.
- **Allowlist:** Alun's UUID is not in the table yet — `ALLOWED_UIDS` only contains Nick's. Add Alun's once known.
- **Bounded queue:** added `MAX_QUEUE = 500` cap inside `logEvent` (prompt suggested it as optional safety).
- **No edge-function logging** — kept strictly to the prompt scope (frontend only).

## Verification
Build + types compile clean (TS errors during edit caught and resolved — missing imports re-added in ChangeFlow / LostFlow). RLS policies enforce per-user isolation. Smoke flow + paste-back queries are Nick's to run in the live preview while logged in — the table now exists and the sprinkles are wired.

## Out of scope (per prompt)
Master-side sync script, real telemetry, retention policy, edge-function error capture.
