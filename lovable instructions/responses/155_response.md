# 155 — Swap ask-ghillie + get-ai-advice-v2 to Claude Haiku 4.5

## Pre-flight
- `ANTHROPIC_API_KEY` was NOT in project secrets — added via `secrets--add_secret` (user entered value).
- Both edge functions previously called `google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions` (3 call sites: ghillie x1, advice-v2 x2 — archetype + venue branches).
- No prior Anthropic helper existed.

## Changes
- **New `supabase/functions/_shared/anthropic.ts`** — `callAnthropic({ systemPrompt?, messages, maxTokens?, temperature?, model? })` posting to Anthropic Messages API, default model `claude-haiku-4-5-20251001`, returns `{ text, stop_reason, model, usage }`.
- **`ask-ghillie/index.ts`**:
  - Imports `callAnthropic`; dropped `LOVABLE_API_KEY` env read.
  - Replaced Lovable Gateway block with `callAnthropic({ systemPrompt, messages: [{role:"user", content: userPrompt}], maxTokens: 1024, temperature: 0.4 })`.
  - Persisted `model` now equals `result.model` (e.g. `claude-haiku-4-5-20251001`); 429/402 fallback branches removed.
- **`get-ai-advice-v2/index.ts`**:
  - Imports `callAnthropic`.
  - Both archetype branch (`archPrompt`) and main venue branch (`aiPrompt`) now call `callAnthropic({ messages: [...], maxTokens: 2048, temperature: 0.4 })`.

## Out of scope
- LOVABLE_API_KEY left in project secrets (other surfaces may still use it).
- Token-usage persistence (helper returns `usage`; no consumer yet).
- Model swap to Sonnet for advice-v2 archetype path.

## Verification
Edge functions deploy automatically. End-to-end checks (Wensum mid-May ghillie, dashboard archetype, model field in `user_queries`) deferred to user smoke test in PWA.
