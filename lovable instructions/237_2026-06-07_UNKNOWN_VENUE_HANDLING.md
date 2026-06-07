# 237 — Don't silently give ungrounded advice for an unrecognised venue

Found in adversarial review (2026-06-06). `get-ai-advice-v2` resolves the venue with
`venues_new` (`ilike("name", venue_name) … maybeSingle()`, ~`index.ts:543-548`). If
the name doesn't match (typo, casing the `ilike` misses, a renamed/removed venue, or
any non-picker caller), `venue` comes back **null**, `venueId` is null → **no slice,
no lat/lon, no weather grounding** — and the function **carries on and generates
generic AI advice anyway**, returning `slice_used:false` buried in telemetry. The user
gets a confident, authoritative-looking card with no signal we didn't recognise their
venue. That's the worst failure mode: it *looks* grounded but isn't.

(The `__home__` / Home pseudo-venue path is separate and already handled with a 422 —
see `index.ts:302-316`. This is about a **real, non-Home `venue_name` that doesn't
resolve**.)

## Fix A — edge function: detect the miss and say so (don't fabricate)
In `get-ai-advice-v2`, after the `venues_new` lookup, when `venue` is **null** AND the
request is **not** the Home sentinel:
- **Do not proceed to AI generation.** Return a structured, graceful response in the
  **same shape as the existing `home_pseudo_venue` 422** (`index.ts:307-316`) so the
  client can branch consistently. Suggested:
  ```json
  { "error": "venue_not_found",
    "message": "We couldn't find that venue. Pick one from search, or choose Home (River) / Home (Stillwater) for archetype advice.",
    "suggestions": [ { "venue_id": "...", "name": "..." } ] }
  ```
  status `422` (or `404` — pick one and state it in your response).
- **Suggestions (cheap, no paid API):** before returning, run a fuzzy/`ilike '%…%'`
  lookup against `venues_new.name` on the submitted string (and on its first 1–2 words)
  and return up to ~5 nearest names so the UI can offer "did you mean …?". This is a
  plain DB query — **no Anthropic/paid call on the not-found path** (keep the cost rules:
  we must not spend a model call to answer "venue unknown").

## Fix B — PWA client: render a real "venue not found" state
The advice request is normally driven by the picker, so an unresolved `venue_name`
means a stale/renamed venue or a non-picker entry. Wherever advice is requested
(fresh advice, and a re-run of a stored Recent Query), handle the `venue_not_found`
response:
- Show a clear, non-scary state: "We couldn't find **<name>**." + the `suggestions`
  as tappable chips that re-run advice with the chosen real venue, + a "Use Home
  (River/Stillwater) instead" affordance (reuse the existing Home-archetype path).
- **Never render the advice card** for a not-found venue. No empty/zeroed card, no
  silent generic advice.

## Verify
- [ ] A request with a real-but-unknown `venue_name` (e.g. "Grafam Water") returns
      `venue_not_found` with suggestions — **not** a generated advice card.
- [ ] The not-found path makes **no** Anthropic call (check logs/cost).
- [ ] Suggestions include the obvious near-match ("Grafham Water") and tapping one
      produces normal grounded advice (`slice_used:true` where a slice exists).
- [ ] Home (River)/(Stillwater) archetype advice still works unchanged (422
      `home_pseudo_venue` path untouched).
- [ ] A known venue ("Grafham Water") is unaffected — normal card.
