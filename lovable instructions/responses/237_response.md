# 237 — Unknown-venue handling (no ungrounded advice)

## Fix A — edge function (`supabase/functions/get-ai-advice-v2/index.ts`)
After the `venues_new ilike(...)` lookup (~line 543), if `venueId` is null (Home sentinel already handled earlier at line 302–316), short-circuit before any AI / weather / Anthropic work:

- Build cheap fuzzy suggestions via two `ilike '%<term>%'` lookups on `venues_new.name` — full submitted string + first 1–2 words. Dedup by `venue_id`, cap at 5. **No paid API call on this path.**
- Return **HTTP 422** with body shape mirroring `home_pseudo_venue`:
  ```json
  { "error": "venue_not_found",
    "message": "We couldn't find that venue. …",
    "submitted": "<as sent>",
    "suggestions": [ { "venue_id": "...", "name": "..." } ] }
  ```

## Fix B — client
- `src/services/adviceService.ts` — added `VenueNotFoundError extends AdviceServiceError` (carries `submitted` + `suggestions`). `getAdviceV2` parses the 422 body and throws it. `getFishingAdvice` rethrows (does **not** fall back to v1 — v1 would also fabricate ungrounded advice).
- `src/pages/Dashboard.tsx` — catch `VenueNotFoundError` and set `venueNotFound` state instead of toasting a generic error. UI block above `VenueSearch` renders:
  - "We couldn't find **<name>**." plus tappable suggestion chips that re-invoke `handleAdviceRequest` with the chosen real `venue_id` + `name`,
  - "Use Home (River)" / "Use Home (Stillwater)" affordances that route through the existing `__home__` sentinel path.
- Advice card is **never** rendered on this path — navigation to `/results` only happens on a successful response.

## Status code
Chose **422** (per the prompt's "pick one and state it") — matches the existing `home_pseudo_venue` 422 so the client branches consistently. Telemetry: new `advice.venue_not_found` event with `{ suggestions: <count> }`.

## Deploy
Edge function `get-ai-advice-v2` redeployed.

## Verify
- Request advice with a misspelt venue → response is 422 `venue_not_found`, no Anthropic call, suggestions list returned.
- Dashboard renders the not-found alert with chips; tapping a chip re-runs advice with the resolved venue.
- Real venue requests unaffected; Home sentinel still hits the existing 422 / archetype path (handled earlier in the function).
