import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TABLES = [
  'station_registry', 'venue_station_map', 'weather_daily',
  'water_level_daily', 'water_quality_daily',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

// PK column for clear_first delete
const pkCol: Record<string, string> = {
  station_registry: 'station_id',
  venue_station_map: 'venue_name',
  weather_daily: 'id',
  water_level_daily: 'station_id',
  water_quality_daily: 'station_id',
};

// Tables with auto-generated id — strip id from input
const AUTO_ID_TABLES = new Set(['weather_daily']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { table, data, clear_first } = await req.json() as {
      table: string;
      data: Record<string, unknown>[];
      clear_first?: boolean;
    };

    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
      return new Response(
        JSON.stringify({ error: `Invalid table: ${table}. Allowed: ${ALLOWED_TABLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'data must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (clear_first) {
      const pk = pkCol[table];
      // For auto-id (integer) tables use gte(0), for text PK use neq
      let delQuery;
      if (AUTO_ID_TABLES.has(table)) {
        delQuery = supabase.from(table).delete().gte(pk, 0);
      } else {
        delQuery = supabase.from(table).delete().neq(pk, '___NEVER_MATCH___');
      }
      const { error: delError } = await delQuery;
      if (delError) {
        console.error(`Delete error for ${table}:`, delError);
        return new Response(
          JSON.stringify({ inserted: 0, failed: 0, errors: [`Failed to clear table: ${delError.message}`] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const BATCH_SIZE = 200;
    let totalInserted = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      let batch = data.slice(i, i + BATCH_SIZE);

      // Strip id for auto-id tables
      if (AUTO_ID_TABLES.has(table)) {
        batch = batch.map(row => {
          const { id, ...rest } = row as Record<string, unknown>;
          return rest;
        });
      }

      const { error: insertError, data: inserted } = await supabase
        .from(table)
        .insert(batch)
        .select();

      if (insertError) {
        console.error(`Insert error batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
        totalFailed += batch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
      } else {
        totalInserted += inserted?.length ?? batch.length;
      }
    }

    return new Response(
      JSON.stringify({ inserted: totalInserted, failed: totalFailed, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('upload-environmental error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
