import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all public tables
    const { data: tables, error: tablesError } = await supabase.rpc('_lovable_noop').maybeSingle();
    // Use raw SQL via supabase-js postgrest isn't ideal here, so we query information_schema
    
    // Query tables list
    const { data: tableRows, error: trErr } = await supabase
      .from('information_schema.tables' as any)
      .select('table_name')
      .eq('table_schema', 'public');

    // Since we can't query information_schema via postgrest, use a different approach
    // We'll hardcode known tables and query each one
    const knownTables = [
      'fishing_reports', 'basic_advice', 'queries', 'diary_entries', 'diary_fish',
      'ref_flies', 'ref_rigs', 'ref_retrieves', 'ref_lines', 'ref_lines_from_reports',
      'ref_leaders', 'ref_tippets', 'ref_rods', 'ref_colours', 'ref_depths', 'ref_hook_sizes',
      'prediction_params', 'venue_profiles', 'venue_correlations', 'venue_metadata', 'venue_spots',
      'reference_data', 'shared_reports', 'share_views', 'user_profiles', 'verification_codes',
      'fly_types', 'water_types', 'regions', 'fly_species',
      'species_hatch_calendar', 'fly_monthly_availability', 'fly_species_link',
    ];

    const results = [];

    for (const tableName of knownTables) {
      try {
        // Get count
        const { count, error: countErr } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (countErr) {
          results.push({ table_name: tableName, row_count: null, error: countErr.message });
          continue;
        }

        // Get a sample row to detect columns
        const { data: sample, error: sampleErr } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        const columns = sample && sample.length > 0
          ? Object.keys(sample[0]).map(col => ({ column_name: col, data_type: typeof sample[0][col] }))
          : [];

        // Try to find the most recent record
        let latestDate: string | null = null;
        const dateColumns = ['created_at', 'report_date', 'trip_date', 'last_updated', 'updated_at'];
        for (const dc of dateColumns) {
          if (columns.some(c => c.column_name === dc)) {
            const { data: latest } = await supabase
              .from(tableName)
              .select(dc)
              .order(dc, { ascending: false })
              .limit(1);
            if (latest && latest.length > 0 && (latest[0] as Record<string, unknown>)[dc]) {
              latestDate = (latest[0] as Record<string, unknown>)[dc] as string;
              break;
            }
          }
        }

        results.push({
          table_name: tableName,
          row_count: count ?? 0,
          columns,
          latest_date: latestDate,
        });
      } catch (e) {
        results.push({ table_name: tableName, row_count: null, error: String(e) });
      }
    }

    // Also check diary_as_reports view
    try {
      const { count } = await supabase
        .from('diary_as_reports')
        .select('*', { count: 'exact', head: true });
      results.push({ table_name: 'diary_as_reports (view)', row_count: count ?? 0, columns: [], latest_date: null });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      tables: results,
      queried_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
