# 177 — Auto-end stale diary sessions

## Migrations
1. Create `pg_cron`, `auto_end_stale_diary_sessions(integer)` function, schedule cron.
2. Drop+recreate the function with disambiguated OUT names (`ended_id, ended_user_id, ended_venue_name, ended_duration_minutes`) — first version hit `42702: column reference "user_id" is ambiguous`.
3. One-off `SELECT * FROM public.auto_end_stale_diary_sessions(12)` invocation.

## §3 one-off output
| ended_id | ended_user_id | ended_venue_name | ended_duration_minutes |
|---|---|---|---|
| `2f3cf84d-57be-4e76-940f-79f804f1d361` | `43928498-a5f6-486c-a6ad-3e0b958d505d` | Home | 4415 |

(Nick's 3-day-old stale session, ~73h.)

## Cron registration
`SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname='auto-end-stale-diary-sessions';`
→ `jobid=1, schedule='*/30 * * * *', active=true`. First scheduled run will fire at the next :00/:30 boundary; verify subsequently via `cron.job_run_details`.

## Notes
- `read_query` is read-only, so the one-off run was triggered via a migration `SELECT`.
- 92 lints (2 net-new function search_path WARN entries are pre-existing project-wide pattern; the new function explicitly sets `search_path = public` so it doesn't add to that count).
- No client changes.
