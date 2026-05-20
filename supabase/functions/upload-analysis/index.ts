import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { requireEnv, envErrorResponse } from "../_shared/env.ts";
import { requireAdmin } from "../_shared/admin_auth.ts";

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
  'harvested_events', 'venues', 'counties',
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

  // YouTube atom corpus (added 2026-05-20, prompt 210)
  'youtube_atoms',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];


// Tables with SERIAL id columns — strip id from input so Postgres auto-generates
const SERIAL_ID_TABLES = new Set([
  'stillwater_fly_rankings',
  'river_fly_recommendations',
  'river_recommendation_lookup',
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

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    if (clear_first) {
      const { error: clearError } = await supabase.rpc('clear_table', {
        target_table: table
      });
      if (clearError) {
        console.error(`Clear error for ${table}:`, clearError);
        return new Response(
          JSON.stringify({ inserted: 0, failed: 0, errors: [`Failed to clear table: ${clearError.message}`] }),
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
    const envResp = envErrorResponse(err, corsHeaders);
    if (envResp) return envResp;
    console.error('upload-analysis error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
