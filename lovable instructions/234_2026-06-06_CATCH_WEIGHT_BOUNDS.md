# 234 — Bound catch weight/length (client + server) and unify the input type

Found in adversarial testing (2026-06-06): the catch **weight** field has **no
upper bound** on either form or on the server. A catch saved at `999999 lb`
returned `201` and persisted `weight_lb: 999999, weight_display: "999999 lb"`.
The field also leaves Save enabled for `1e9` and a 20-digit number (which would
eventually 22003-overflow the numeric column rather than validate cleanly).
Separately, the two catch forms use **different input types** for the same field.

Implement all three; checklist at the bottom.

## Fix A — add a sane upper bound to weight + length validation (BOTH forms)
Two places edit a catch's size:
- In-session **Log a catch** (`number` input, currently `min=0`, no `max`,
  `step=0.1`).
- **Edit catch** dialog (`CatchEditForm` / `DiaryEntry`) — currently a **text**
  input with bespoke parsing.

Apply the same numeric guard in both. Suggested bounds (UK stillwater/river
trout + coarse headroom — adjust if you have a house rule):
- **Weight:** `> 0` and `<= 50` lb. (50 lb is ~1.6× the UK record rainbow/brown
  trout (~31 lb) — generous headroom for any trophy-stillwater fish while killing
  fat-finger/overflow values.) Reject `0`, negative, non-numeric, multi-dot,
  scientific notation (`1e9`), and whitespace-only — Save stays disabled with a
  short helper message (e.g. "Enter a weight between 0 and 50 lb").
- **Length:** `> 0` and `<= 60` inches (~5 ft, above any UK freshwater fish) with
  the same rules.
- Keep the existing lb/oz split + `weight_display` logic from prompt 220; just
  gate it behind the new bound so an out-of-range value never reaches the split.

## Fix B — unify the weight input type across both forms
The in-session form uses `<input type="number" inputmode="decimal">`; the edit
dialog uses `<input type="text">`. Pick **one** (recommend
`type="text" inputmode="decimal"` + explicit numeric validation, so iOS/Android
keyboards behave and parsing is identical in both places). Share a single
`parseWeight(input): { ok, lb, oz, display, error }` helper between the two forms
so validation can't drift again.

## Fix C — server-side guard (defence in depth)
The client is not the only writer (RN sync, future clients). Reject out-of-range
sizes at the data layer so a crafted request can't persist a 999999 lb fish:
- Preferred: a `CHECK` constraint on `session_events`
  (`weight_lb IS NULL OR (weight_lb >= 0 AND weight_lb <= 50)`;
  `length_inches IS NULL OR (length_inches >= 0 AND length_inches <= 60)`).
- If a constraint is awkward (RN historically pushes odd values), instead clamp
  /reject in whichever edge function or trigger owns the write path and log the
  rejection. Say in your response which approach you took.

## Verify
- [ ] In-session Log-a-catch: `999999`, `1e9`, `-5`, `0`, `2.5.5`, `abc` all keep
      Save disabled with a helper message; `2.5` saves fine.
- [ ] Edit-catch dialog: same set behaves identically (shared helper).
- [ ] A direct `POST`/`PATCH` to `session_events` with `weight_lb: 999999` is
      rejected (constraint/edge-fn), not persisted.
- [ ] Existing valid catches (e.g. 2 lb, 1.5 lb) still save and display correctly.
