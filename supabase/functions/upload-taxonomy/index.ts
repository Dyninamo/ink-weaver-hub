import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TABLES = [
  'fly_types', 'water_types', 'regions', 'fly_species',
  'species_hatch_calendar', 'fly_monthly_availability', 'fly_species_link',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

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

    // PK column map for delete

    // For clear_first, do a proper delete using the PK column
    const pkMap: Record<string, string> = {
      fly_types: 'fly_type_id',
      water_types: 'water_type_id',
      regions: 'region_id',
      fly_species: 'species_id',
      species_hatch_calendar: 'id',
      fly_monthly_availability: 'id',
      fly_species_link: 'id',
    };

    if (clear_first) {
      const pk = pkMap[table];
      const { error: delError } = await supabase.from(table).delete().gte(pk, -999999);
      if (delError) {
        console.error(`Delete error for ${table}:`, delError);
        return new Response(
          JSON.stringify({ inserted: 0, failed: 0, errors: [`Failed to clear table: ${delError.message}`] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Batch insert
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);

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
    console.error('upload-taxonomy error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
