# Plan: Apply prompts 234 → 238 sequentially

Execute each in ascending order. Each prompt gets its own instruction file copy + response log per the 128 protocol.

## 234 — Bound catch weight/length + unify input type
- Create `src/lib/parseWeight.ts` with shared `parseWeight(input)` and `parseLength(input)` helpers (bounds: weight 0 < w ≤ 50 lb; length 0 < l ≤ 60 in; reject NaN, scientific notation, multi-dot, whitespace).
- Update in-session **Log a catch** form (find via rg — likely under `src/components/diary/` quick-actions) to use `type="text" inputmode="decimal"` and the shared helper; disable Save with inline helper text on invalid.
- Update `CatchEditForm` (and the DiaryEntry edit path) to use the same helper and input type.
- Server guard (Fix C): migration adding `CHECK` constraints on `session_events`:
  - `weight_lb IS NULL OR (weight_lb > 0 AND weight_lb <= 50)`
  - `length_inches IS NULL OR (length_inches > 0 AND length_inches <= 60)`
  - Pre-flight via `supabase--read_query` to confirm no existing rows violate; if any do, clamp/null them in the same migration.

## 235 — Offline logging resilience (Part A + Part B)
- **Part A (minimum, ship first):**
  - Add `useOnlineStatus()` hook backed by `navigator.onLine` + `online`/`offline` events.
  - Wrap every in-session quick-action save (catch, lost fish, blank, fly change) and catch edit/add/delete in try/catch; on failure show destructive toast "Couldn't save — you're offline. Tap to retry." and keep form state (do not close/reset).
  - Add offline pill to session header (`ActiveSessionShell`).
- **Part B (proper fix):**
  - New `src/lib/pendingWriteQueue.ts` backed by IndexedDB (via `idb-keyval` — small dep) keyed by client-generated UUID (`crypto.randomUUID()`).
  - On save: enqueue first → optimistic UI insert tagged `pending:true` in the Recent list → attempt network write → mark synced on success.
  - Flush on `online` event and on `visibilitychange` (focus).
  - Idempotency: server upsert on the `client_event_id` UUID column — add migration to `session_events` (nullable `client_event_id uuid unique`) and update edge/RPC writers to upsert on it.
  - De-dupe on flush by checking server for existing `client_event_id`s for the session.

## 236 — Friendly Home pseudo-venue label (cosmetic)
- Create `src/lib/venueLabel.ts` with `displayVenue(venue)` helper exactly per prompt.
- Apply at `Dashboard.tsx:412` (Recent Queries list).
- Apply on Results page header where `state.venue`/`query.venue` renders.
- Apply on any share/preview card echoing stored venue (`SessionShareView`, `ShareView` — rg to confirm).
- No DB change.

## 237 — Unknown-venue handling
- **Edge (`supabase/functions/get-ai-advice-v2/index.ts`):** after the `venues_new` lookup (~line 543), if `venue` is null AND `venue_name` is not the `__home__` sentinel:
  - Run cheap fuzzy `ilike '%<name>%'` + first-1–2-words lookup on `venues_new.name`, limit 5 (DB only, **no Anthropic call**).
  - Return `422` with shape `{ error: "venue_not_found", message, suggestions: [{venue_id, name}] }` mirroring the existing 422.
- **Client:** wherever advice is requested (fresh + re-run of stored Recent Query), branch on `error === "venue_not_found"`:
  - Render a clear "We couldn't find <name>" state with tappable suggestion chips that re-invoke advice with the chosen venue, plus "Use Home (River)/(Stillwater) instead" affordances reusing existing Home path.
  - Never render the advice card on this path.

## 238 — Offline auth-refresh retry storm
- Create `src/lib/authRefreshGuard.ts`:
  - Subscribe to `online`/`offline`. While offline: short-circuit any `supabase.auth.getUser()` / `refreshSession()` calls in our wrappers; use cached session.
  - Exponential backoff with jitter on refresh failure (1s → 2s → 4s → … capped 60s); reset on success.
  - Only sign out on genuine `401`/`invalid_grant`; ignore `503`/network errors (do not clear session).
- Audit `AuthContext`, `useProfile`, and any place that calls `supabase.auth.getUser()` / `refreshSession()` directly; route through the guarded wrapper. Review the `createClient` config (`auth: { autoRefreshToken }`) — since we cannot edit `src/integrations/supabase/client.ts`, layer the guard on top with `online`/`offline` listeners that call `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()`.

## Order of operations
1. 234 (migration + 2 form edits + shared helper).
2. 235 Part A (toast + offline indicator), then Part B (queue + `client_event_id` migration).
3. 236 (one helper + 3 call sites).
4. 237 (edge function fuzzy fallback + client branch).
5. 238 (auth guard wrapper + start/stopAutoRefresh wiring).

After each prompt: write `lovable instructions/<n>_*.md` (copy of source) and `lovable instructions/responses/<n>_response.md` per protocol 128. Wait for confirmation between prompts only if explicitly requested — user said "do each in ascending order" so I will proceed straight through unless a prompt's migration needs approval (234 + 235 Part B will each pause for migration approval).

## Open clarifications before I start
1. **234 Fix C — existing data:** if `session_events` already has rows above 50 lb or 60 in (test/legacy), do you want them clamped to the cap, set to NULL, or left as-is with the constraint added as `NOT VALID`? (Default: clamp + log count in response.)
2. **235 Part B scope:** add the `client_event_id` UUID column + unique index on `session_events` only, or also on `session_rods`/other in-session writes? (Default: `session_events` only — that's what the quick-actions hit.)
3. **235 dep:** OK to add `idb-keyval` (~600 B) for the IndexedDB queue, or prefer plain `localStorage` (simpler, no dep, ~5 MB limit which is fine for queued events)? (Default: `localStorage` — no new dep.)
4. **237 status code:** confirm **422** (matches existing `home_pseudo_venue` pattern) rather than 404? (Default: 422.)
