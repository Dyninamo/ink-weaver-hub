# 242 — admin-upsert: integer-key deletes, and youtube_atoms on the allowlist

**Date:** 2026-09-17
**Origin:** Verifying 241. The delete mode works correctly for `reports_enriched`
but cannot reach either of the other two tables that still hold rows deleted in
master.

---

## Background

241 gave `admin-upsert` a `delete_ids` mode and closed §19 for `reports_enriched`:
master and Supabase are now at **exact parity, 7,308 = 7,308**, verified on the
natural key `(venue, date)` — 0 rows on either side, not merely equal totals.

The other two tables are still out of sync, and `delete_ids` cannot touch either.
Both blockers were confirmed by probing the **deployed** function, not by reading
the source:

| Table | Stranded in Supabase | Blocker (live response) |
|---|---:|---|
| `youtube_atoms` | 2,900 | `{"error":"table 'youtube_atoms' not in allowlist"}` |
| `weather_daily` | 143 | `{"error":"delete_ids must contain only UUID strings"}` |

**Why the UUID check blocks `weather_daily`:** `reports_enriched.id` really is a
UUID, so 241's `UUID_RE` test worked for the table it was written against. But
`weather_daily.id` and `youtube_atoms.id` are **bigint identity columns**, and
most of the 25-plus tables already on `ALLOWED_TABLES` are integer-keyed too. The
UUID assumption will block every one of them the first time a delete is needed.

### What the stranded rows are

- **`youtube_atoms` — 2,900 rows.** The foreign-source purge of 2026-09-16
  (Korean channel, tropical species in location-less tutorials, UK non-fly
  content). Master went 20,973 → 17,331; the sync is insert-only so Supabase
  kept all 2,900. These are actively wrong to serve: the PWA is showing advice
  atoms scraped from foreign fisheries.
- **`weather_daily` — 143 rows.** Not a purge — a **rename**.
  `scripts/maintenance/rename_meon_springs.py` moved 143 rows from
  `Meon Springs` to `Meon Springs (Lake)` on 2026-09-16. Supabase received the
  new-name rows and kept the old-name ones, so the venue's weather is duplicated
  under two names. Confirmed: every stranded key is
  `('Meon Springs', <date>, 'daily')`, ids 355176–374482.

### Not in scope for this prompt

The same diff found **1,730 `youtube_atoms` rows in master that were never pushed
to Supabase.** That is a master-side gap in the push path, not an edge-function
problem, and is being handled separately. Mentioned only so the counts make
sense: 18,501 − 17,331 = 1,170 is a *net* figure hiding 2,900 surplus against
1,730 missing. Do not try to fix that here.

---

## Task 1 — put `youtube_atoms` on the allowlist

In `supabase/functions/admin-upsert/index.ts`, add to `ALLOWED_TABLES`:

```ts
  "youtube_atoms",
```

Nothing else about the allowlist changes.

---

## Task 2 — let `delete_ids` carry integer keys

Today:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
...
if (!delete_ids.every((v: unknown) => typeof v === "string" && UUID_RE.test(v))) {
  return jsonResp({ error: "delete_ids must contain only UUID strings" }, 400);
}
```

Accept **either** a list of UUID strings **or** a list of positive integers, and
require the list to be homogeneous — a mixed array is a caller bug and must be
rejected rather than half-applied.

```ts
const INT_RE = /^[1-9][0-9]{0,18}$/;

const allUuid = delete_ids.every(
  (v: unknown) => typeof v === "string" && UUID_RE.test(v),
);
// Accept a JS number only when it is a positive safe integer; a numeric string
// is also allowed so callers need not care how JSON round-trips a bigint.
const allInt = delete_ids.every(
  (v: unknown) =>
    (typeof v === "number" && Number.isSafeInteger(v) && v > 0) ||
    (typeof v === "string" && INT_RE.test(v)),
);

if (!allUuid && !allInt) {
  return jsonResp(
    {
      error:
        "delete_ids must be all UUID strings or all positive integers, not a mix",
    },
    400,
  );
}

const ids = allUuid
  ? (delete_ids as string[])
  : (delete_ids as Array<string | number>).map((v) => Number(v));
```

Then pass `ids` to the existing `.in("id", ids)` call. **Everything else stays
exactly as it is** — the `requireAdmin` gate, `MAX_IDS = 1000`, the non-empty
check, mutual exclusivity with `delete_where_not_null`, the `{ count: "exact" }`
delete and its error handling. Do not widen the cap, do not add a "delete all"
path, and do not make `table` dynamic beyond the allowlist.

**Why homogeneous:** a mixed array means the caller has muddled two id spaces.
Coercing it would delete whatever happened to cast successfully and report
success for the rest — the silent-partial-success failure this codebase has been
bitten by repeatedly.

---

## Verification

Re-run the standing probe, which asserts the guards against the deployed
function and cannot delete anything (every case is a rejection case):

```
python Database/_smoke_admin_upsert_delete.py
```

All seven existing guards must still pass unchanged — in particular
`"'; DROP TABLE reports_enriched; --"` must still be rejected, now by the
homogeneity check rather than the UUID test.

Then these four, which are new:

| Request | Expected |
|---|---|
| `{table:"youtube_atoms", delete_ids:[1,2]}` with a valid admin secret | **not** an allowlist error |
| `{table:"weather_daily", delete_ids:[355176]}` | accepted (integer path) |
| `{table:"weather_daily", delete_ids:["355176"]}` | accepted (numeric string) |
| `{table:"weather_daily", delete_ids:[355176,"a3f1c2d4-0000-4000-8000-000000000000"]}` | **400**, mixed list |

And unchanged auth behaviour — both must still be **401**:

- no `X-Admin-Secret` header
- wrong `X-Admin-Secret` value

## After it deploys

Master-side clean-up runs from this repo, batched at ≤1000 ids per call:

- `weather_daily` — 143 ids, already computed
- `youtube_atoms` — 2,900 ids, already computed

Parity is then re-asserted with `python Database/_smoke_supabase_sync.py`, which
must report no table holding rows deleted in master. Note that probe compares
**totals**, so it can be fooled by simultaneous surplus and shortfall — the
youtube_atoms case above is exactly that. Confirm with an id-level diff, not the
count.
