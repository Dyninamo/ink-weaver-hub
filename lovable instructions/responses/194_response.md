# 194 — Edge function auth phase 2 (admin gate)

## §0 — `_shared/admin_auth.ts`
Created. Exports `requireAdmin(req)` returning `{ ok, via, user? } | { ok:false, status, error }`. Dual-path: `X-Admin-Secret` header (env `ADMIN_API_SECRET`) OR Bearer JWT whose user.email is in `ADMIN_EMAILS = { 'nick.dyne@gmail.com' }` (case-insensitive).

## §0a — Secret
**Action required:** add `ADMIN_API_SECRET` to Supabase project secrets (`openssl rand -base64 32`). Without it, the secret-header path returns 401 `ADMIN_API_SECRET not configured`.

## §1 — Gates applied
Each file: imported `requireAdmin` after `env.ts` import; inserted gate immediately after the OPTIONS preflight, before the service-role `createClient`.

- `db-audit/index.ts` — import L4, gate L16-22.
- `generate-venue-cards/index.ts` — import L4, gate L10-16.
- `compute-angler-stats/index.ts` — import L3, gate L15-21.
- `compute-venue-stats/index.ts` — import L3, gate L15-21.
- `lapse-affiliations/index.ts` — import L4, gate L10-16.

## §3 — `generate-venue-cards` rate cap
The function does NOT take a `body.limit` param (verified by grep). Its venue list is bounded by sessions on `target_date`. **No cap inserted** — natural bound. If a future signature adds `limit`, apply `Math.min(limit, 50)`.

## §4 — Python snippet (for phase-3 reference)
```python
import os, urllib.request, json
ADMIN_SECRET = os.environ["ADMIN_API_SECRET"]
SUPABASE_URL = "https://zprlfecbvdltfpneidte.supabase.co"
ANON_KEY     = os.environ["SUPABASE_ANON_KEY"]
req = urllib.request.Request(
    f"{SUPABASE_URL}/functions/v1/<name>",
    data=json.dumps(payload).encode(),
    headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "X-Admin-Secret": ADMIN_SECRET,
        "Content-Type": "application/json",
    },
    method="POST",
)
```

## Smoke tests
Pending live curl after deploy + secret set — request user runs the 5-step harness from §5.
