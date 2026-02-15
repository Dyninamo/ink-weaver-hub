import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TABLES = [
  'ref_flies', 'ref_rigs', 'ref_retrieves', 'ref_lines',
  'ref_leaders', 'ref_tippets', 'ref_rods',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { table, data, mode } = await req.json() as {
      table: string;
      data: Record<string, unknown>[];
      mode: 'replace' | 'append';
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

    // If replace mode, delete all existing rows first
    if (mode === 'replace') {
      const { error: delError } = await supabase.from(table).delete().gte('id', 0);
      if (delError) {
        console.error(`Delete error for ${table}:`, delError);
        throw new Error(`Failed to clear ${table}: ${delError.message}`);
      }
    }

    // Batch insert in groups of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      // Strip 'id' field so identity column auto-generates
      const cleaned = batch.map(row => {
        const { id, ...rest } = row as Record<string, unknown>;
        return rest;
      });

      const { error: insertError, data: inserted } = await supabase
        .from(table)
        .insert(cleaned)
        .select('id');

      if (insertError) {
        console.error(`Insert error batch ${i / BATCH_SIZE + 1}:`, insertError);
        throw new Error(`Insert failed at batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
      }

      totalInserted += inserted?.length ?? cleaned.length;
    }

    return new Response(
      JSON.stringify({ success: true, table, rows_inserted: totalInserted, mode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('upload-reference-data error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
