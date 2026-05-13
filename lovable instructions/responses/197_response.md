# Prompt 197 — Set ADMIN_API_SECRET + PUBLIC_SITE_URL

## §1 — ADMIN_API_SECRET
Set as Supabase edge-function secret. Generated server-side (Node `crypto.randomBytes(32)`, base64url).
- Length: **43 chars** (32 bytes of entropy, base64url, no padding).
- Value NOT recorded here per security protocol.

## §2 — PUBLIC_SITE_URL
Set to `https://app.itscatching.uk`.

## §3 — Verify
Both secrets visible in `fetch_secrets` listing post-set. Admin-gated functions (db-audit, upload-*) will now accept the `X-Admin-Secret` header instead of returning the `ADMIN_API_SECRET not configured` 401. share-via-email will use the configured base URL and `hello@itscatching.uk` sender.

User to confirm end-to-end by:
1. Triggering a share-via-email from PWA → email body contains `https://app.itscatching.uk/share/<token>`, sender `hello@itscatching.uk`.
2. Running an admin upload as Nick — no `ADMIN_API_SECRET not configured` log line.

## §4 — Secret communication
Path **(a)** — value emitted once in chat for Nick to copy into his local `~/.env`. Not written to any committed file. No `.gitignore` change needed.
