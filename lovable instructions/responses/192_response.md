# 192 — Passport sessions: is_active=false hygiene

## Migration
- Data UPDATE (insert tool): `UPDATE fishing_sessions SET is_active=false, updated_at=NOW() WHERE source='passport' AND is_active=true`.
- Schema migration: `fishing_sessions_enforce_passport_inactive()` BEFORE INSERT/UPDATE trigger forces `is_active := false` on any `source='passport'` row.

## §2 — Verify
```
 source   | is_active |   n
----------+-----------+--------
 diary    | f         |     24
 diary    | t         |      1   (currently-active diary session)
 passport | f         | 45,084
```
Matches expected outcome.

## §3 — Trigger created? Yes. (Belt-and-braces, prevents future re-occurrence from upload-diary-sessions.)

## Out of scope
- duration_minutes backfill on legacy passport rows.
- Re-running the passport import.
- Tightening `upload-diary-sessions` (trigger covers it).
