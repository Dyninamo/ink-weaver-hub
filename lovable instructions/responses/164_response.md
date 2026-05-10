# 164 — eventLogger durability

## Diff: `src/services/eventLogger.ts`
- Added `APP_VERSION` constant from `import.meta.env.VITE_APP_VERSION` (with `PACKAGE_VERSION` and `"dev"` fallbacks).
- Added `SUPABASE_URL` / `SUPABASE_ANON_KEY` constants for the unload beacon.
- `flush()` rewritten with `succeeded` flag — restores `[...batch, ...queue]` on any failure (auth lapse, RLS, network) and trims to MAX_QUEUE. On clean drain, `clearInterval(intervalHandle)` + reset to null (M8).
- All inserted rows now include `app_version: APP_VERSION` (H12).
- New `flushBeacon()` uses `fetch(..., { keepalive: true })` against `/rest/v1/app_events` with apikey + JWT headers (sendBeacon can't set custom headers). Restores queue on failure.
- `beforeunload` now early-returns when queue is empty, otherwise calls `flushBeacon()`.
- `visibilitychange → hidden` still uses the regular async `flush()`.

## Diff: `vite.config.ts`
- Added `import pkg from "./package.json"` and a `define` block injecting `import.meta.env.VITE_APP_VERSION = JSON.stringify(pkg.version)`.

`package.json` version is currently `"0.0.0"` — bump as needed in deploy. JSON imports are supported by the existing tsconfig (resolveJsonModule).
