# Lovable Prompt 145 — PWA app_events log surface

**Date:** 2026-05-08
**Branch / repo:** `Dyninamo/ink-weaver-hub`
**Why this is happening:** Nick is hitting bugs in the live preview that are hard to reproduce from code alone (e.g. picking "Home" + River and getting stillwater advice — would have been obvious in a log of the advice request payload). He needs a structured event log he can pull from Supabase / sync to master and grep when something looks wrong. Real telemetry (PostHog / Sentry) is overkill at 2 users; this is the lightweight version.

**Capture protocol:** per prompt 128, log to `lovable instructions/responses/145_response.md`.

---

## What this prompt does

1. Adds an `app_events` table on Supabase with RLS that lets each user write/read their own events.
2. Adds a small `eventLogger.ts` helper that batches client-side events and flushes to Supabase every 10s + on tab unload.
3. Sprinkles ~12 strategically-placed `logEvent()` calls across the diary / advice / shell paths so the log captures what we actually need to debug session flow + advice quality.
4. Adds an admin route at `/admin/events` gated to a hard-coded user_id allowlist that renders the last 200 events as a table.
5. Defers the master-side sync to a separate Python script (out of scope for this prompt — flagged at the end).

**No diary feature changes.** Pure observability layer.

---

## File targets

- **New schema migration** — single `CREATE TABLE app_events` + RLS policies
- **New file:** `src/services/eventLogger.ts`
- **New file:** `src/pages/AdminEvents.tsx`
- **New route:** `/admin/events` in `src/App.tsx`
- **Edited (sprinkle `logEvent` calls):**
  - `src/components/diary/ActiveSessionShell.tsx` — phase enter/exit
  - `src/components/diary/CatchFlow.tsx` — catch save, fly correction, missing-fly recovery
  - `src/components/diary/ChangeFlow.tsx` — change save with field
  - `src/components/diary/BlankFlow.tsx` — blank save
  - `src/components/diary/LostFlow.tsx` — lost save
  - `src/components/diary/setup/SetupWizard.tsx` — wizard phase advances + commit
  - `src/pages/DiaryNew.tsx` — venue selected, Home picked, water-type override, build-rig CTA
  - `src/pages/Dashboard.tsx` + `src/services/adviceService.ts` — advice request fired + advice received (with venue + water-type-in-response so the Home-stillwater bug would have shown up immediately)

---

## Pre-flight greps

```bash
grep -rIn "app_events\|eventLogger\|logEvent" src/
# expect: zero hits — clean cut

grep -rIn "/admin/" src/App.tsx
# expect: existing admin routes (AdminUpload, AdminDbStatus, etc.) — confirm pattern for the new /admin/events route

grep -n "VITE_DEBUG_USER_IDS\|ALLOWED_DEBUG_UIDS" src/
# expect: zero — we'll hardcode the allowlist for now
```

---

## 1. Schema migration — `app_events`

```sql
CREATE TABLE public.app_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_time timestamptz NOT NULL,         -- when the event happened on the client
  server_time timestamptz NOT NULL DEFAULT now(),  -- when it landed
  route       text,                          -- "/diary/new", "/dashboard", "/diary/:id"
  event_type  text NOT NULL,                 -- "phase.enter", "catch.saved", "advice.received", etc.
  payload     jsonb,                         -- arbitrary context
  session_id  text,                          -- fishing session id when applicable
  app_version text,                          -- pulled from build env if available
  user_agent  text
);

CREATE INDEX idx_app_events_user_time ON public.app_events (user_id, server_time DESC);
CREATE INDEX idx_app_events_event_type ON public.app_events (event_type);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Users insert + read their own rows
CREATE POLICY "users_insert_own_events"
  ON public.app_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_events"
  ON public.app_events FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role full access for sync scripts (default)

NOTIFY pgrst, 'reload schema';
```

Apply via Supabase SQL editor. Update generated types after the migration.

---

## 2. `src/services/eventLogger.ts`

```ts
import { supabase } from "@/integrations/supabase/client";

interface AppEvent {
  client_time: string;
  route: string | null;
  event_type: string;
  payload: any;
  session_id?: string | null;
}

const BATCH_SIZE = 5;
const FLUSH_INTERVAL_MS = 10_000;

let queue: AppEvent[] = [];
let flushing = false;
let intervalHandle: number | null = null;

function getRoute(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname || null;
}

export function logEvent(event_type: string, payload?: any, session_id?: string | null) {
  queue.push({
    client_time: new Date().toISOString(),
    route: getRoute(),
    event_type,
    payload: payload ?? null,
    session_id: session_id ?? null,
  });

  // Always also mirror to the browser console so you can see what's being captured
  // when developing.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[event]", event_type, payload ?? "");
  }

  if (queue.length >= BATCH_SIZE) {
    void flush();
  } else if (intervalHandle === null && typeof window !== "undefined") {
    intervalHandle = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

export async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Drop events for unauthenticated users — they can't write
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const rows = batch.map((e) => ({ ...e, user_id: user.id, user_agent: ua }));
    const { error } = await supabase.from("app_events").insert(rows);
    if (error) {
      // Push back into queue so we don't lose them (best-effort).
      // eslint-disable-next-line no-console
      console.warn("[event] flush failed, re-queueing", error);
      queue.unshift(...batch);
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => { void flush(); });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
```

Notes:
- Failure to flush re-queues the batch (no event loss on transient network blips).
- DEV mode mirrors to `console.debug` so you can watch events fire while developing.
- Not authenticated → drop silently. Unauthenticated events are noise.
- No batching cap on memory — queue is bounded in practice by user activity, but if you want safety, add `if (queue.length > 500) queue = queue.slice(-500)` inside `logEvent`.

---

## 3. `logEvent` call sprinkles

Place these exact lines (or close adaptations) at the locations below. Keep payloads small and meaningful — no PII beyond what's already in the row.

### 3.1 `src/pages/DiaryNew.tsx`

```ts
import { logEvent } from "@/services/eventLogger";

// On venue change
useEffect(() => {
  if (!venue) return;
  logEvent("diary.venue_selected", { venue, isHome: venue === "Home" });
}, [venue]);

// On manual water-type pick
function handleWaterTypePick(wt: "stillwater" | "river") {
  setVenueType(wt);
  setVenueTypeManual(true);
  logEvent("diary.water_type_override", { venue, water_type: wt, was_resolved: venueTypeResolved });
}

// On Build-rig CTA
function handleBuildRig() {
  if (!canBuildRig) { /* existing toast */ return; }
  logEvent("diary.build_rig_clicked", { venue, venueType, sessionDate, fishingType });
  setShowWizard(true);
}

// Inside handleCommit, after successful session insert
logEvent("diary.session_started", {
  session_id: session.id,
  venue,
  venueType,
  has_real_venue_match: !!matchedVenue?.venue_id,
  rod_weight: rod.rodWeight,
  fly_count: rod.flyCount,
  saved_preset: !!commit.savePreset,
}, session.id);
```

### 3.2 `src/components/diary/ActiveSessionShell.tsx`

```ts
import { logEvent } from "@/services/eventLogger";

useEffect(() => {
  logEvent("session.phase_enter", { phase, sessionId }, sessionId);
}, [phase]);
```

### 3.3 `src/components/diary/CatchFlow.tsx`

```ts
// Inside handleSave success path, after addEvent for catch
logEvent("catch.saved", {
  session_id: sessionId,
  rod_index: rodIndex,
  position,
  species: speciesEffective,
  measurement_mode: measureMode,
  weight_lb,
  length_inches,
  retrieve,
  depth_zone: depthZone,
  outcome,
  fly_corrections: flyCorrections.length,
}, sessionId);

// Inside handleFlyPicked — emit a separate event for visibility
logEvent("catch.fly_correction", {
  session_id: sessionId,
  position,
  was_missing: !prev,
}, sessionId);
```

### 3.4 `src/components/diary/ChangeFlow.tsx`

```ts
// On save
logEvent("session.change", {
  session_id: sessionId,
  field,
  has_reason: !!reason,
}, sessionId);
```

### 3.5 `src/components/diary/BlankFlow.tsx`

```ts
logEvent("session.blank", { session_id: sessionId, confidence, reason }, sessionId);
```

### 3.6 `src/components/diary/LostFlow.tsx`

```ts
logEvent("session.lost", { session_id: sessionId, stage }, sessionId);
```

### 3.7 `src/components/diary/setup/SetupWizard.tsx`

```ts
// On phase advance
useEffect(() => { logEvent("wizard.phase_enter", { phase, rodSubStep }); }, [phase, rodSubStep]);

// On preset apply
function applyPreset(...) {
  logEvent("wizard.preset_applied", { hasFlies });
  // ... existing logic
}

// On final commit, after onComplete resolves
logEvent("wizard.commit", {
  rod_weight: state.rodWeight,
  rod_length_ft: state.rodLengthFt,
  line: state.lineProfile,
  style: state.style,
  fly_count: state.flyCount,
  saved_preset: savePreset,
});
```

### 3.8 `src/pages/Dashboard.tsx` + `src/services/adviceService.ts`

This is **the most important pair of events** for the Home/stillwater bug.

In `getFishingAdvice` (or wherever the request is fired):

```ts
import { logEvent } from "@/services/eventLogger";

export async function getFishingAdvice(venue: string, date: string, ...) {
  logEvent("advice.request", { venue, date });
  try {
    const result = await getAdviceV2(venue, date);
    logEvent("advice.received", {
      venue,
      date,
      from: "v2",
      water_type_in_response: (result as any)?.venue?.water_type ?? null,
      fly_count: (result as any)?.tactical?.flies?.length ?? null,
      had_weather: !!(result as any)?.weather,
    });
    return result;
  } catch (err) {
    logEvent("advice.fallback_v1", { venue, date, error: (err as Error).message });
    const result = await getBasicAdvice(venue, date, _weatherData);
    logEvent("advice.received", {
      venue,
      date,
      from: "v1",
      tier: (result as any)?.tier ?? null,
      season: (result as any)?.season ?? null,
    });
    return result;
  }
}
```

These two events alone would have caught the Home/stillwater bug — the `advice.received` payload would have shown `water_type_in_response: "stillwater"` for a query made against a river venue, making the issue obvious.

### 3.9 Error toasts

Add a generic logger inside the existing `toast.error(...)` call sites that matter (anywhere we currently call `toast.error` with a meaningful message). Specifically:

- `DiaryNew.handleCommit` rollback path
- `CatchFlow.handleSave` catch-block
- `ChangeFlow` save catch-block
- `addEvent` failures inside any flow

```ts
catch (err: any) {
  logEvent("error", { context: "catch_save", message: err?.message ?? String(err) });
  toast.error(err?.message || "Failed to save catch");
}
```

---

## 4. Admin route `/admin/events`

`src/pages/AdminEvents.tsx`

```tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Hardcoded allowlist. Add Alun's UUID once known.
const ALLOWED_UIDS = new Set([
  // Nick's UUID — fetch with `SELECT id FROM auth.users WHERE email='nick.dyne@gmail.com'`
  // and replace this comment with the value before the build.
]);

interface EventRow {
  id: number;
  client_time: string;
  server_time: string;
  route: string | null;
  event_type: string;
  payload: any;
  session_id: string | null;
}

export default function AdminEvents() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    if (!ALLOWED_UIDS.has(user.id)) { nav("/dashboard"); return; }
    void load();
  }, [user, filterType]);

  async function load() {
    setLoading(true);
    let q = supabase.from("app_events").select("*").order("server_time", { ascending: false }).limit(200);
    if (filterType) q = q.eq("event_type", filterType);
    const { data } = await q;
    setRows((data as EventRow[]) ?? []);
    setLoading(false);
  }

  if (!user || !ALLOWED_UIDS.has(user.id)) return null;

  const types = Array.from(new Set(rows.map((r) => r.event_type))).sort();

  return (
    <div className="min-h-screen p-4 max-w-screen-lg mx-auto">
      <h1 className="text-xl font-semibold mb-3">Recent app events</h1>
      <div className="flex gap-2 items-center mb-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border rounded p-1 text-sm">
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        <span className="text-xs text-muted-foreground">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-1.5 w-32">Server time</th>
              <th className="text-left p-1.5 w-28">Route</th>
              <th className="text-left p-1.5 w-44">Type</th>
              <th className="text-left p-1.5">Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="p-3 text-center">Loading…</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-1.5 font-mono">{new Date(r.server_time).toLocaleString()}</td>
                <td className="p-1.5 font-mono">{r.route ?? ""}</td>
                <td className="p-1.5 font-mono">{r.event_type}</td>
                <td className="p-1.5 font-mono">
                  <pre className="whitespace-pre-wrap text-[11px]">{r.payload ? JSON.stringify(r.payload, null, 2) : ""}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

`src/App.tsx` — add the route:

```tsx
<Route path="/admin/events" element={<AdminEvents />} />
```

**Allowlist value:** before this lands, the response file should include the SQL needed to fetch Nick's auth UUID so the const can be filled in. Don't put a real UUID in this prompt — fetch it during apply.

---

## 5. Master-side sync — out of scope

The master-side `Database/sync_app_events_from_supabase.py` script is a separate piece (not Lovable's job). It'll mirror the `app_events` table down so we can grep it from the pipeline side. I'll write that on the fishing-intelligence side once this lands.

---

## Verification

1. **Build clean:** `npm run build`. No TS errors. The migration applies cleanly via Supabase SQL editor.
2. **Smoke flow:** open `/diary/new` (logged in as Nick). Pick a venue. Pick a date. Tap Build your rig. Walk through the wizard. Start a session. Log a catch. End the session.
3. **Confirm rows land:**
   ```sql
   SELECT server_time, event_type, route, payload
   FROM app_events
   WHERE user_id = auth.uid()
   ORDER BY server_time DESC
   LIMIT 30;
   ```
   Expect a chronological run including `diary.venue_selected`, `diary.water_type_override`, `diary.build_rig_clicked`, `wizard.phase_enter` for each phase, `wizard.commit`, `diary.session_started`, `session.phase_enter` for `ready` then `catch`, `catch.saved`, `session.phase_enter` for `end_*` phases.
4. **Confirm Home + River bug surfaces in the log:**
   - On the Dashboard, make an advice request for "Home" (or any unmapped venue).
   - Run `SELECT payload FROM app_events WHERE event_type = 'advice.received' ORDER BY server_time DESC LIMIT 1;`
   - Expect `water_type_in_response` to show whatever the service actually returned. If it says `'stillwater'` for a query made against a river venue, you have your repro evidence.
5. **Admin route:** open `/admin/events` as Nick. Expect the table to render. Open as a non-allowlisted user — should redirect to `/dashboard`.
6. **RLS:** as Alun, run `SELECT * FROM app_events WHERE user_id = '<nick uuid>'`. Expect zero rows.

---

## Out of scope

- **Master-side sync script.** Separate Python work on the fishing-intelligence side.
- **Real telemetry tools** (PostHog, Sentry). Defer until 50+ users.
- **Event retention policy.** No purge. Cheap for now (a few hundred rows per day per user).
- **Server-side error logging from edge functions.** Worth adding but separate prompt.

---

## Response capture

Per protocol 128, write to `lovable instructions/responses/145_response.md`:

- Pre-flight grep findings + which files you actually edited.
- The SQL you ran for the migration + the `NOTIFY pgrst` confirmation.
- Nick's auth UUID (so the allowlist can be filled in — pull from `auth.users` where email matches).
- A 5-minute smoke-test transcript from Verification §3 — actual rows that landed.
- A second transcript from Verification §4 — Home/unmapped venue advice request, with the `advice.received` payload pasted verbatim. **This is the one I want to see immediately** — it's the data that would have caught the original bug.
- One screenshot of `/admin/events` rendered with at least 20 events.
- Anywhere the sprinkle locations (§3) made the code awkward — propose alternatives.
