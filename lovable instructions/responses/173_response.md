# 173 — Polish trio response

## §1 — 503 service_misconfigured surfacing

**Files touched:**
- `src/services/adviceService.ts` — added `ServiceMisconfiguredError` (extends `AdviceServiceError`, code `SERVICE_MISCONFIGURED`) and a `readFunctionErrorBody` helper that reads `err.context.json()` / `.text()`. `getAdviceV2` and `getBasicAdvice` now both inspect the error body and throw `ServiceMisconfiguredError` when the payload is `{error: "service_misconfigured", ...}`. `getFishingAdvice` re-throws on `ServiceMisconfiguredError` (no v1 fallback) and emits `advice.service_misconfigured` telemetry.
- `src/components/diary/AskGhillieOverlay.tsx` — catch block reads `err.context.json()` and renders the bespoke "ghillie is offline for maintenance…" copy when the body matches.
- `src/pages/Dashboard.tsx` — added `ServiceMisconfiguredError` import and an `instanceof` branch with bespoke toast title "Service Unavailable" / "Backend is temporarily misconfigured. Please contact support." The error inherits from `AdviceServiceError`, so `Results.tsx` (which doesn't toast advice-service errors) needs no changes.

Confirmed: `getFishingAdvice` no longer falls back to v1 when v2 throws `ServiceMisconfiguredError` — both endpoints share the same service-role secret.

## §2 — package.json version bump

`package.json.version` bumped from `"0.0.0"` → `"0.1.0"`. New `app_events` rows written after this deploy will stamp `app_version = "0.1.0"`. Older rows remain `"0.0.0"` (legacy, not backfilled per scope).

## §3 — rod_index audit

Run via Lovable Cloud SQL runner:

| Audit | Result |
|---|---|
| 1 — `rod_index IS NULL` | **0 rows / 0 sessions** |
| 2 — `rod_index = 1` on sessions with no Rod 1 in `session_rods` | **45,097 sessions affected** |
| 3 — `rod_index = 0` on multi-rod sessions | **0 rows** |

**Decision per the prompt's tree:** Audit 2 returned ≥ 10 rows (vastly so). Per the rule, **no auto-UPDATE is applied here**. Flagged for a separate prompt with a deliberate UPDATE migration after manual inspection.

**Caveat / hypothesis:** the count (45k sessions) is far larger than the live PWA bug could plausibly produce (two-user beta). The `last_event` timestamps span 2006–2025 — these are almost certainly **historical bulk-ingested rows** (Passport / scraper data) where `rod_index` was defaulted to `1` by an upload edge function without seeding a matching `session_rods` row. Not the `Math.max(0, activeRodIndex - 1)` PWA bug. The follow-up prompt should distinguish ingestion source (`source IN ('passport', 'scrape', …)`) from live PWA writes before deciding on the UPDATE shape.

## Verification

- TS edits compile clean (build runs out of band).
- `package.json` shows `"version": "0.1.0"`.
- §1 walkthrough: `getAdviceV2` → 503 body parsed → `ServiceMisconfiguredError` thrown → `getFishingAdvice` skips v1, re-throws → `Dashboard` catch hits `instanceof ServiceMisconfiguredError` → "Service Unavailable" toast. Ghillie overlay independently inspects `err.context.json()` and renders maintenance copy.
