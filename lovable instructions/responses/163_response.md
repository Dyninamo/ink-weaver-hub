# 163 — ask-ghillie ungrounded prompt + JSON-fallback chip-loss

## Diff: `supabase/functions/ask-ghillie/index.ts`
- §1: Hoisted `const grounded = groundedFlies.length > 0` above the system prompt; introduced `groundingInstruction` that branches on `grounded` (curated-list lean vs. honest "no curated data, prefer presentation" copy). The system prompt now appends `${groundingInstruction}` instead of an unconditional GROUND TRUTH reference.
- §2: JSON-parse catch now logs `console.warn` with `model`, `stop_reason`, first 200 chars of `cleaned`, and `parse_error`; user-facing narrative is a deterministic "I had a hiccup parsing the guide's reply — please try again." with `chips = []`. Removed duplicate inner `const grounded` declaration.
- Persistence block unchanged (already gates `grounding` on length > 0).

Edge function auto-deploys.
