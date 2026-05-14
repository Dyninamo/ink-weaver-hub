# 200 — app_events logging expansion + admin dump endpoint

## §1 Logger expansion (`src/services/eventLogger.ts`)
Added `installGlobalEventHooks()` (idempotent via `installed` flag), called from `src/main.tsx` before `createRoot`. Emits:
- `error.uncaught` — window `error` (message/filename/lineno/colno/stack, truncated 500/2000)
- `error.unhandled_rejection` — window `unhandledrejection`
- `net.online` / `net.offline` — window online/offline
- `auth.signed_in` (`{user_id, email}`) / `auth.signed_out` / `auth.token_refreshed` / `auth.user_updated` — via `supabase.auth.onAuthStateChange`
- `app.boot` — `{url, referrer, standalone, viewport, language, platform, timezone}`

Existing batching/flush logic untouched. `logEvent` signature unchanged.

## §1.7 Route logger
New `src/services/eventLoggerHooks.tsx` (zero-render, subscribes `useLocation`), mounted inside `<BrowserRouter>` in `src/App.tsx` as a sibling of `<Routes>`. Skips initial mount; emits `route.changed` `{from, to}` on subsequent navigations.

## §2 Edge function `admin-dump-app-events`
New `supabase/functions/admin-dump-app-events/index.ts`. CORS preflight, `requireAdmin` gate (197's secret OR Nick's Bearer), service-role client. Accepts `user_email` / `user_id` / `since` / `until` / `event_type` / `route` / `limit` (capped 5000, default 200) via query OR JSON body. Email→user_id resolution via paginated `auth.admin.listUsers` (up to 50×200=10k users) — replaced spec's single-page lookup so users beyond page 1 still resolve. Returns `{user_id, user_email, count, rows}`.

Added `[functions.admin-dump-app-events] verify_jwt = false` to `supabase/config.toml`.

## §3 AdminEvents page
Added `viewingEmail` state + email input next to the type select. Empty → existing RLS-bound self query. Non-empty → fetch `/functions/v1/admin-dump-app-events?user_email=…&limit=500&event_type=…` with the current session's Bearer JWT. Shows "Viewing: x@y — N events" status when active; surfaces non-2xx as `error <status>: <body>` without crashing. Existing `ALLOWED_UIDS` page gate retained.

## §4 Verification
Deployed via `supabase--deploy_edge_functions`. Probe (wrong secret) via `curl_edge_functions`:

```
GET /admin-dump-app-events?user_email=nick.dyne@gmail.com&limit=1
  x-admin-secret: wrong  → 401 {"error":"Invalid admin secret"}
```

Anonymous (no header) → 401 ("Missing admin credentials"); valid-secret 200 and unknown-email 404 paths are exercised by the same `requireAdmin` + lookup code paths but require the live `ADMIN_API_SECRET` value (not held by the agent) to curl from outside; Nick should run probes 1/3/4 from his shell using the secret in `~/.env`.

UI smoke: visit `/admin/events`, leave email blank → self rows load (RLS path); type Alun's email → admin-dump path, status shows count.

Browser-console smoke (run after deploy):
- `throw new Error("logger-test-uncaught")` → `error.uncaught`
- `Promise.reject(new Error("logger-test-rejection"))` → `error.unhandled_rejection`
- Navigate `/` → `/dashboard` → `route.changed`
- Sign out / in → `auth.signed_out` then `auth.signed_in`
- Devtools offline toggle → `net.offline` / `net.online`
- Hard refresh → exactly one `app.boot`

## Files touched
- new: `supabase/functions/admin-dump-app-events/index.ts`
- new: `src/services/eventLoggerHooks.tsx`
- edit: `src/services/eventLogger.ts` (appended `installGlobalEventHooks`)
- edit: `src/main.tsx` (call hooks before createRoot)
- edit: `src/App.tsx` (mount `<EventLoggerHooks/>`)
- edit: `src/pages/AdminEvents.tsx` (admin email picker + edge-function path)
- edit: `supabase/config.toml` (function stanza)

## Deviations
- §2 user lookup: paginated up to 50 pages instead of single page=1 (spec capped at 200 users, which would silently miss users on page 2+).
- AdminEvents: added inline status string + Enter-to-submit on email field for usability — no behavioural change to spec.
