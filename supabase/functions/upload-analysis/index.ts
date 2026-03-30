import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TABLES = [
  // Stillwater analysis
  'stillwater_venue_profiles', 'stillwater_seasonal_baselines',
  'stillwater_fly_recommendations', 'stillwater_fly_rankings',
  'stillwater_condition_modifiers', 'stillwater_advice_confidence',
  // River analysis
  'river_section_profiles', 'river_seasonal_baselines',
  'river_fly_recommendations', 'river_recommendation_lookup',
  'river_regional_defaults', 'river_seasonal_flies',
  'river_condition_modifiers', 'river_species_composition',
  'river_advice_confidence',
  // Raw / crawl
  'reports_raw', 'harvested_events', 'venues', 'counties', 'fisheries',
  // Water-type advice
  'wt_advice_profiles', 'wt_monthly_fly_advice', 'wt_monthly_method_advice',
  'wt_condition_advice', 'wt_seasonal_overview', 'wt_where_to_fish',
  'wt_narrative_advice', 'wt_advice_confidence',
  // Report-level summaries
  'report_venue_profiles', 'report_seasonal_fly_rankings',
  'report_method_rankings', 'report_condition_fly_rankings',
  'report_advice_confidence',
  // Pattern discovery
  'pattern_weather_effects', 'pattern_fly_conditions',
  'pattern_hatch_weather', 'pattern_discovery_meta',
  // Sources
  'report_sources', 'source_venue_map',
  // Venue/session maps
  'session_venue_map', 'venue_spots',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

// First column of PK for each table (used for clear_first delete)
const pkCol: Record<string, string> = {
  stillwater_venue_profiles: 'venue_id',
  stillwater_seasonal_baselines: 'venue_id',
  stillwater_fly_recommendations: 'venue_id',
  stillwater_fly_rankings: 'id',
  stillwater_condition_modifiers: 'venue_id',
  stillwater_advice_confidence: 'venue_id',
  river_section_profiles: 'section_id',
  river_seasonal_baselines: 'section_id',
  river_fly_recommendations: 'id',
  river_recommendation_lookup: 'id',
  river_regional_defaults: 'region_id',
  river_seasonal_flies: 'region_id',
  river_condition_modifiers: 'section_id',
  river_species_composition: 'section_id',
  river_advice_confidence: 'section_id',
  reports_raw: 'id',
  harvested_events: 'id',
  venues: 'id',
  counties: 'county_id',
  fisheries: 'fishery_id',
  // Water-type advice
  wt_advice_profiles: 'id',
  wt_monthly_fly_advice: 'id',
  wt_monthly_method_advice: 'id',
  wt_condition_advice: 'id',
  wt_seasonal_overview: 'id',
  wt_where_to_fish: 'id',
  wt_narrative_advice: 'id',
  wt_advice_confidence: 'id',
  // Report-level summaries
  report_venue_profiles: 'venue_name',
  report_seasonal_fly_rankings: 'venue_name',
  report_method_rankings: 'venue_name',
  report_condition_fly_rankings: 'venue_name',
  report_advice_confidence: 'venue_name',
  // Pattern discovery
  pattern_weather_effects: 'pattern_id',
  pattern_fly_conditions: 'pattern_id',
  pattern_hatch_weather: 'pattern_id',
  pattern_discovery_meta: 'run_id',
  // Sources
  report_sources: 'source_id',
  source_venue_map: 'source_id',
  // Venue/session maps
  session_venue_map: 'id',
  venue_spots: 'spot_id',
};

// Tables with SERIAL id columns — strip id from input so Postgres auto-generates
const SERIAL_ID_TABLES = new Set([
  'stillwater_fly_rankings',
  'river_fly_recommendations',
  'river_recommendation_lookup',
  'reports_raw',
  'harvested_events',
  'venues',
  'pattern_weather_effects',
  'pattern_fly_conditions',
  'pattern_hatch_weather',
  'pattern_discovery_meta',
  'report_sources',
]);

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
      // Delete all rows — works for both text and integer PKs
      const { error: delError } = await supabase.from(table).delete().neq(pk, '___NEVER_MATCH___');
      if (delError) {
        console.error(`Delete error for ${table}:`, delError);
        return new Response(
          JSON.stringify({ inserted: 0, failed: 0, errors: [`Failed to clear table: ${delError.message}`] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      let batch = data.slice(i, i + BATCH_SIZE);

      // Strip id for SERIAL tables so Postgres auto-generates
      if (SERIAL_ID_TABLES.has(table)) {
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
    console.error('upload-analysis error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
