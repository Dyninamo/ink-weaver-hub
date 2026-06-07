# 238 — Stop the offline auth-refresh retry storm (back off when offline)

Found in adversarial review (2026-06-06). While the device was **offline**, the
Supabase auth client fired a **retry storm — 8+ repeated `503`s to `/auth/v1/user`
within a few seconds**. The session-refresh / `getUser` path keeps hammering auth with
no back-off and no offline guard, which wastes battery/network during an outage and
spams the logs (and on metered connections, data). This compounds the in-session
offline experience covered by prompt 235.

## Fix — guard + back off auth refresh on connectivity, not blindly
1. **Don't attempt auth network calls while offline.** Gate `getUser` /
   `refreshSession` / any auto-refresh on `navigator.onLine`; when offline, skip the
   call and use the cached session, scheduling a single retry for when connectivity
   returns.
2. **Pause/resume with connectivity events.** On `offline`, suspend the auto-refresh
   timer; on `online`, do **one** refresh, then resume normal cadence. (If using the
   supabase-js client, review `auth: { autoRefreshToken }` setup and add an
   online/offline-aware wrapper rather than letting it free-run.)
3. **Exponential back-off + jitter + cap on failures.** If a refresh fails (network
   error or 5xx), back off (e.g. 1s → 2s → 4s …, capped at ~30–60s) with jitter, and
   cap consecutive attempts — never a tight loop. Reset the back-off on the next
   success.
4. **Don't sign the user out on transient offline/5xx.** Only clear the session on a
   genuine `401/invalid_grant`, not on `503`/network failure — otherwise an outage
   logs people out.

## Verify
- [ ] Go offline mid-session → **no** repeated `/auth/v1/user` calls; at most one
      guarded attempt, then quiet until connectivity returns.
- [ ] Back online → a single refresh fires and normal cadence resumes; the session is
      intact (user not signed out by the outage).
- [ ] Simulated 503s from auth produce backed-off retries (increasing gaps, capped),
      not a burst.
- [ ] Token actually nearing expiry still refreshes correctly when online (no
      regression to the happy path).

## Note
The RN diary app shares this risk pattern; if the same un-guarded auto-refresh exists
there, apply the same offline-guard + back-off. (PWA is the one observed here.)
