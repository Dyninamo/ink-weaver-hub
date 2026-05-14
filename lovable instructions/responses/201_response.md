# 201 — Fix tactical-advice blocker + expand usage logging

## §1 Schema fix

### §1.1 Migration
- Dropped stale FKs `session_summaries_venue_id_fkey`, `angler_venue_stats_venue_id_fkey`, `venue_stats_venue_id_fkey` (all pointed at the obsolete `venue_metadata.id` UUID).
- Altered `venue_id` → `text` on all four tables.
- `venue_stats` had 5 rows (not 0 as expected); UUID→text cast is implicit-safe so they survived.

Post-migration check:
```
     table_name     | data_type
--------------------+-----------
 angler_venue_stats | text
 session_summaries  | text
 venue_preferences  | text
 venue_stats        | text
```

### §1.2 `triggerSessionSummary` no longer fire-and-forget
- `src/services/diaryService.ts`: now awaits `compute-session-summary` internally and emits `session_summary.computed` / `session_summary.failed` events with `ms` and outcome. Caller in `endSession` switched to `void triggerSessionSummary(id)` so UI still progresses immediately.
- Added `import { logEvent } from "@/services/eventLogger"` at top of file.

## §2 Backfill

### §2.1 New function
`supabase/functions/backfill-session-summaries/index.ts` — admin-gated (`requireAdmin`), iterates ended sessions (cap 1000), POSTs each to `compute-session-summary` with service-role Bearer + admin secret + `_backfill: true`. Optional `user_id` / `since` filters in body.

### §2.2 `compute-session-summary` admin path
- Imports `requireAdmin` alongside `requireUser`.
- Auth resolves admin first; falls back to `requireUser` if not admin.
- Ownership check skipped when `isAdmin === true`.

### §2.3 `supabase/config.toml`
Added `[functions.backfill-session-summaries] verify_jwt = false`.

### §2 Verification
First backfill call:
```json
{ "attempted": 20, "succeeded": 19, "failed": 1, "skipped": 0,
  "errors": ["bd71c878-…: HTTP 500 {\"success\":false,\"error\":\"Upsert failed: numeric field overflow\"}"] }
```

`session_summaries` now has 19 rows (was 0). Sample:
```
              session_id              |  venue_id  | total_fish | wp_count
--------------------------------------+------------+------------+----------
 aa21d5e3-3a6c-484d-a13f-d4c6def1b34f | CS-ITCH-01 |          0 |        1
 9b2090d3-939b-46fe-9c0d-a0c3c1362298 | AW-GRAFHAM |          0 |        1
 5998d15f-2f23-4463-a8fe-4527379c1856 | AW-GRAFHAM |          7 |        1
```
`weather_periods` populated (single-period for short / no-weather sessions). One session (`bd71c878-…`) hits a numeric overflow — flagged for a follow-up prompt; out of scope here.

Both `compute-session-summary` and `backfill-session-summaries` deployed cleanly.

## §3 Expanded logging

### §3.1 `src/services/clickLogger.ts` (new)
Document-level capture click listener. Emits `ui.click` with `{label, testid, tag, href, disabled}`. Only fires when the closest button/link/role has accessible name or testid.

### §3.2 `installLifecycleLogger` in `src/services/eventLogger.ts`
Emits: `lifecycle.visibility`, `lifecycle.sw_state` (boot), `lifecycle.sw_controllerchange`, `lifecycle.focus`, `lifecycle.blur`.

### §3.3 `src/services/invokeLogger.ts` (new)
Monkey-patches `supabase.functions.invoke`. Emits `fn.invoke.ok` / `fn.invoke.err` / `fn.invoke.threw` with fn name + ms. Kept as separate file because `client.ts` is auto-generated and must not be edited.

### §3.4 SetupWizard mount/unmount
Added a `useEffect(..., [])` in `SetupWizard.tsx` that emits `wizard.mounted` and `wizard.unmounted`.

### §3.5 ActiveSessionShell mount/unmount
Added a `useEffect(..., [sessionId])` emitting `session_shell.mounted` / `session_shell.unmounted`.

### §3.6 Wake lock
`src/lib/wakeLock.ts` now emits `lifecycle.wakelock.acquired`, `lifecycle.wakelock.released`, `lifecycle.wakelock.failed`. Logger pulled in via dynamic import to avoid widening this leaf module's dep graph.

### Wiring
`src/main.tsx` calls (in order): `installGlobalEventHooks()`, `installLifecycleLogger()`, `installGlobalClickLogger()`, `installInvokeLogger()`.

### Event types now emitted by §3 (verified by grep):
- `ui.click`
- `lifecycle.visibility`, `lifecycle.sw_state`, `lifecycle.sw_controllerchange`, `lifecycle.focus`, `lifecycle.blur`
- `lifecycle.wakelock.acquired`, `lifecycle.wakelock.released`, `lifecycle.wakelock.failed`
- `fn.invoke.ok`, `fn.invoke.err`, `fn.invoke.threw`
- `wizard.mounted`, `wizard.unmounted`
- `session_shell.mounted`, `session_shell.unmounted`
- `session_summary.computed`, `session_summary.failed`

## Out of scope / follow-ups
- Single backfill failure (`numeric field overflow` on session `bd71c878-…`) — needs a separate look at which numeric column is being exceeded.
- In-memory wizard state loss itself; the new logging will let us see the shape of it before fixing.
