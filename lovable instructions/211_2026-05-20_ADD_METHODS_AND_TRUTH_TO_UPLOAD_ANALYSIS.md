PROMPT 211 — Add six master tables to `upload-analysis`

Audit on 2026-05-20 found six tables populated in master but stranded on Supabase.
Two were created by prompt 70 (BATCH1) but never got an upload path. One has no
Supabase schema at all. Three more (`weather_youtube`, `stocking_records`,
`venue_clubs`) exist on Supabase but are not whitelisted on any upload edge
function. Same fit as prompt 210 — `upload-analysis` edge function,
`requireAdmin`-gated, service-role internally.

Excluded by design:
- `water_level_daily` — intentionally empty on Supabase (distilled into
  `river_condition_modifiers` on 2026-02-24).
- `weather_daily` / `species_hatch_calendar` — already have dedicated upload
  paths (`Database/sync/push_weather.py`, `Database/sync/push_taxonomy.py`).
  Drift is operational lag, not architectural gap.

## Part A — create `fly_suitability_truth` table

It doesn't exist on Supabase yet. Composite PK matches the local SQLite schema.

```sql
CREATE TABLE fly_suitability_truth (
    fly_name TEXT NOT NULL,
    water_type_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    suitability TEXT NOT NULL,
    generated_at TEXT,
    PRIMARY KEY (fly_name, water_type_id, month)
);

CREATE INDEX idx_fst_fly ON fly_suitability_truth(fly_name);
CREATE INDEX idx_fst_water_month ON fly_suitability_truth(water_type_id, month);

ALTER TABLE fly_suitability_truth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read fly suitability truth" ON fly_suitability_truth FOR SELECT USING (true);
```

The table is 38,556 rows — Sonnet-graded ground truth used by the fly suitability
audit (see `scripts/audit/fly_name_audit.py`). Public read is correct: it's
reference data, no user identifiers.

## Part B — extend `upload-analysis` whitelist

In `supabase/functions/upload-analysis/index.ts`, append three names to
`ALLOWED_TABLES`. Place them in a new commented group at the end so the intent
matches the prompt-210 pattern:

```ts
const ALLOWED_TABLES = [
  // ... existing entries unchanged, including the prompt-210 youtube_atoms line ...

  // Methods canonical + aliases (added 2026-05-20, prompt 211)
  // method_aliases has FK → method_canonical(canonical), so callers MUST
  // upload method_canonical first.
  'method_canonical', 'method_aliases',

  // Sonnet-graded fly suitability ground truth (added 2026-05-20, prompt 211)
  'fly_suitability_truth',

  // Stranded master tables w/ existing Supabase schema (added 2026-05-20, prompt 211)
  'weather_youtube', 'stocking_records', 'venue_clubs',
] as const;
```

Also extend `SERIAL_ID_TABLES` so the edge function strips client-supplied `id`
columns (master uses local `INTEGER` autoincrement; Supabase uses its own
`GENERATED ALWAYS AS IDENTITY`):

```ts
const SERIAL_ID_TABLES = new Set([
  // ... existing entries unchanged ...

  // Added 2026-05-20, prompt 211
  'weather_youtube',
  'stocking_records',
  'venue_clubs',
]);
```

Do **not** add the methods or truth tables to `SERIAL_ID_TABLES`:
- `method_canonical` PK is `canonical TEXT`
- `method_aliases` PK is `raw TEXT`
- `fly_suitability_truth` has a composite PK (`fly_name, water_type_id, month`)

No other behaviour changes. Insert path stays identical.

## Verification after deploy

1. Pull `ink-weaver-hub` and grep the deployed source. Expect lines for **all
   six** new tables and the three new SERIAL_ID entries:
   ```
   grep -E "method_canonical|method_aliases|fly_suitability_truth|weather_youtube|stocking_records|venue_clubs" supabase/functions/upload-analysis/index.ts
   ```
2. Confirm the new `fly_suitability_truth` table exists:
   ```
   curl -I -H "apikey: $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/fly_suitability_truth?limit=0"
   ```
   Expect `Content-Range: 0-0/0` (table present, empty).
3. From the master scripts machine, run the backfills:
   ```
   python Database/upload_methods.py                  # 984 + 2,201 rows
   python Database/upload_fly_suitability_truth.py    # 38,556 rows
   python Database/upload_misc_master.py              # 681 + 90 + 11 rows
   ```
4. Optional follow-on (operational, not part of prompt 211):
   ```
   python Database/sync/push_taxonomy.py    # closes species_hatch_calendar gap
   python Database/sync/push_weather.py     # closes weather_daily gap
   ```
   These already work — they just haven't been run recently.

Each backfill script is idempotent: fetches existing primary keys (or row hashes
for the no-PK `weather_youtube`) from Supabase and pushes only missing rows.
Safe to re-run after partial failures.

## Why not a new edge function per table

Same reasoning as prompt 210. `upload-analysis` is the right abstraction;
adding six strings to a whitelist (and three to the strip-id set) is the
smallest correct change.
