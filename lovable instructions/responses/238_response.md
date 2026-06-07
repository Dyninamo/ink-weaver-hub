# 238 — Offline auth-refresh retry storm guard

## Diff
- **Created** `src/lib/authRefreshGuard.ts` — `installAuthRefreshGuard()` (idempotent):
  1. On `offline` → `supabase.auth.stopAutoRefresh()` and clear any pending retry.
  2. On `online` → `supabase.auth.startAutoRefresh()` plus **one** guarded refresh.
  3. On refresh failure (network / non-401), exponential back-off `1s → 2s → 4s … capped 60s` with 0–25% jitter; resets on `TOKEN_REFRESHED` / `SIGNED_IN`. Never tight-loops.
  4. Never signs the user out on transient errors — only supabase-js's own `SIGNED_OUT` (real 401 / invalid_grant) clears the session.
  5. If the app boots offline, pauses immediately.
- `src/main.tsx` — call `installAuthRefreshGuard()` once at startup.
- `src/contexts/AuthContext.tsx` — initial `getSession()` is skipped when `navigator.onLine === false`; `onAuthStateChange` picks up state once connectivity returns.

## Why this shape
We can't edit `src/integrations/supabase/client.ts`, so we layer the guard on top via `start/stopAutoRefresh()` (the supported supabase-js APIs) and `online/offline` listeners — not by reconfiguring the client.

## Not in scope
- The RN diary app mentioned in the prompt's footnote — same pattern should be applied there separately.

## Verify
- DevTools → Network: offline → no repeated `/auth/v1/user`; reconnect → exactly one refresh fires, normal cadence resumes, session intact.
- Simulated 503 from auth → back-off intervals grow (1s, 2s, 4s…), capped 60s, not a burst.
- Token nearing expiry while online → normal refresh path unaffected (we only stop the timer on `offline`).
