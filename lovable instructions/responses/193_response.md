# 193 — share-via-email URL/sender/validation fixes

## Diffs (`supabase/functions/share-via-email/index.ts`)
- L30-31 (`buildEmailHtml` baseUrl): replaced `VITE_SUPABASE_URL`→`lovableproject.com` fallback with `Deno.env.get('PUBLIC_SITE_URL') ?? 'https://app.itscatching.uk'`.
- L176-180: replaced `.includes('@')` with `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` test and updated error to `Invalid recipient email`.
- L191-192 (handler baseUrl): same replacement as above.
- L282: sender → `"It's Catching <hello@itscatching.uk>"`.

## §4 — share-via-sms
Function does **not exist** in `supabase/functions/`. `shareService.ts:91` references it but no edge function is deployed. Nothing to patch; flag for a future prompt when SMS is wired.

## Action required (master-side)
Add the secret `PUBLIC_SITE_URL=https://app.itscatching.uk` to Supabase project edge-function secrets. SPF/DKIM/DMARC for `itscatching.uk` already in use by `send-venue-report` so deliverability inherits.
