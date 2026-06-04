# 219 — deriveFixFromTrail unit tests + Vitest harness

## Diff
- `package.json`: added `vitest` devDep; added `test` / `test:watch` scripts.
- `vitest.config.ts`: minimal — `@` → `./src` alias, `environment: 'node'`.
- `src/lib/deriveFix.test.ts`: 10 tests covering empty/null/undefined, unparseable time, single point, before/after track edges, interior interpolation, high-confidence (~5.5m / 1h), low-confidence (~1.1km), out-of-order sort, accuracy widening.

## Verify
`bunx vitest run` → 10/10 passed (585ms). No app/runtime changes.
