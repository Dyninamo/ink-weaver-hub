import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let partial = false;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('__TIMEOUT__')), 25000)
  );

  try {
    const supabase = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    const work = async () => {
      // 1. Get all row counts in a single query via pg_stat_user_tables
      const { data: countRows, error: countErr } = await supabase.rpc('_lovable_noop').maybeSingle();
      // pg_stat_user_tables isn't exposed via PostgREST, so use raw SQL via a direct fetch
      const pgUrl = Deno.env.get('SUPABASE_DB_URL')!;

      // We'll use the supabase client to query two utility views instead.
      // Since we can't run arbitrary SQL via PostgREST, we fetch from the REST API using raw SQL endpoint.
      const supabaseUrl = requireEnv('SUPABASE_URL');
      const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

      // Helper to run raw SQL via Supabase's pg endpoint
      const runSQL = async (sql: string): Promise<any[]> => {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/_lovable_noop`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
            'Content-Type': 'application/json',
          },
        });
        // _lovable_noop won't work for SQL. Use the pg connection directly.
        // Actually, let's use Deno's postgres driver for raw SQL.
        return [];
      };

      // Use Deno postgres for raw SQL queries
      const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
      const pool = new Pool(Deno.env.get('SUPABASE_DB_URL')!, 1, true);
      const conn = await pool.connect();

      try {
        // Query 1: All row counts from pg_stat_user_tables
        const countResult = await conn.queryObject<{ table_name: string; row_count: number }>`
          SELECT relname AS table_name, n_live_tup AS row_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          ORDER BY relname
        `;
        const rowCounts = new Map<string, number>();
        for (const r of countResult.rows) {
          rowCounts.set(r.table_name, Number(r.row_count));
        }

        // Query 2: All column metadata
        const colResult = await conn.queryObject<{
          table_name: string; column_name: string; data_type: string;
        }>`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `;
        const columnsByTable = new Map<string, { column_name: string; data_type: string }[]>();
        for (const r of colResult.rows) {
          if (!columnsByTable.has(r.table_name)) columnsByTable.set(r.table_name, []);
          columnsByTable.get(r.table_name)!.push({
            column_name: r.column_name,
            data_type: r.data_type,
          });
        }

        // Build results map
        const allTables = new Set([...rowCounts.keys(), ...columnsByTable.keys()]);
        const dateColumns = ['created_at', 'report_date', 'trip_date', 'last_updated', 'updated_at', 'session_date'];

        // Query 3: Latest dates — only for tables that have a date column, in parallel batches
        const tableDateCol: { table: string; col: string }[] = [];
        for (const t of allTables) {
          const cols = columnsByTable.get(t) || [];
          for (const dc of dateColumns) {
            if (cols.some(c => c.column_name === dc)) {
              tableDateCol.push({ table: t, col: dc });
              break;
            }
          }
        }

        const latestDates = new Map<string, string | null>();
        // Run in parallel batches of 10
        for (let i = 0; i < tableDateCol.length; i += 10) {
          const batch = tableDateCol.slice(i, i + 10);
          const results = await Promise.all(
            batch.map(async ({ table, col }) => {
              try {
                const r = await conn.queryObject(
                  `SELECT "${col}" AS d FROM "${table}" WHERE "${col}" IS NOT NULL ORDER BY "${col}" DESC LIMIT 1`
                );
                return { table, date: r.rows.length > 0 ? String((r.rows[0] as any).d) : null };
              } catch {
                return { table, date: null };
              }
            })
          );
          for (const r of results) latestDates.set(r.table, r.date);
        }

        // Assemble final results
        const tables = [...allTables].sort().map(table_name => ({
          table_name,
          row_count: rowCounts.get(table_name) ?? 0,
          columns: (columnsByTable.get(table_name) || []),
          latest_date: latestDates.get(table_name) ?? null,
        }));

        // Also check views
        const viewResult = await conn.queryObject<{ table_name: string }>`
          SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
        `;
        for (const v of viewResult.rows) {
          if (allTables.has(v.table_name)) continue;
          try {
            const cr = await conn.queryObject(
              `SELECT count(*) AS c FROM "${v.table_name}"`
            );
            tables.push({
              table_name: `${v.table_name} (view)`,
              row_count: Number((cr.rows[0] as any).c),
              columns: [],
              latest_date: null,
            });
          } catch { /* skip */ }
        }

        return tables;
      } finally {
        conn.release();
        await pool.end();
      }
    };

    const tables = await Promise.race([work(), timeout]);

    return new Response(JSON.stringify({
      tables,
      queried_at: new Date().toISOString(),
      partial: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    if (err instanceof Error && err.message === '__TIMEOUT__') {
      return new Response(JSON.stringify({
        tables: [],
        queried_at: new Date().toISOString(),
        partial: true,
        error: 'Function timed out after 25s',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
