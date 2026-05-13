# 196 — witness race + SSRF + EXIF surfacing

## §1 — `witness-notable-fish` atomic increment
Migration applied: `public.increment_notable_fish_witnesses(p_fish_id UUID)` returns `(n_witnesses, confidence_score, verification_tier)`. Uses `SELECT … FOR UPDATE` to row-lock `notable_fish`, applies the +5 first-witness bonus only when `v_old_count = 0`, recomputes tier, and writes back atomically. `GRANT EXECUTE` to `authenticated, service_role` succeeded.

`supabase/functions/witness-notable-fish/index.ts` L74-102 replaced: read-modify-write block swapped for a single `supabase.rpc('increment_notable_fish_witnesses', { p_fish_id: fish_id }).single<…>()` call. Response payload (L104-109) unchanged.

## §2 — `find-venue-email` SSRF guard
Added `isPublicHttpUrl(rawUrl)` helper (L13+) that rejects: non-http(s), `localhost`/`metadata*` hostnames, RFC1918 + loopback + link-local + multicast IPv4 literals, and any IPv6 literal.

L183-185 replaced: now calls the guard against the cleaned root URL and short-circuits with HTTP 400 `{status:"not_found", error:"root_url blocked: <reason>"}` (and writes `status='not_found'` to `venue_email_searches` if `searchId` exists). The `error_note` column field was dropped from the update because it isn't in the existing schema; reason still surfaces in the response body and via `console`/function logs.

## §3 — `submit-notable-fish` EXIF status
L142-183 replaced. Added `exifStatus: 'ok'|'no_metadata'|'error'|'skipped'` and `exifErrorReason: string|null`. Distinguishes parsed-with-data, parsed-empty, parser-threw, and download-failed. Response payload (L442-452) gains `exif: { status, error_reason }`. Photo still earns the 15pt photo bonus regardless of EXIF outcome.

## Out of scope (per prompt)
- DNS-rebinding defence (Deno edge runtime exposes no DNS resolver) — residual risk accepted.
- Front-end EXIF-error toast — backend now signals it; UI follow-up.
- Backfilling tier corrections for any historic doubled-witness fish.

## Smoke tests
Pending — request user runs §4 (race fix from two tabs, SSRF check with `169.254.169.254`, EXIF statuses on PNG/JPEG/corrupt).
