import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const CONFLICT_COLUMNS: Record<string, string> = {
  ref_flies: 'pattern_name',
  ref_lines: 'line_type_code',
  ref_retrieves: 'retrieve_name',
  ref_rigs: 'rig_name',
  ref_hook_sizes: 'hook_size',
  ref_colours: 'colour',
  ref_depths: 'depth',
  ref_lines_from_reports: 'line_type',
  fly_water_types: 'pattern_name,water_type_id',
  fish_types: 'fish_type_id',
  fish_species_game: 'species_id',
  angler_profiles: 'id',
  angler_type_weights: 'id',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { table_name, records, clear_first } = await req.json()

    if (!CONFLICT_COLUMNS[table_name]) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid table: ${table_name}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (clear_first) {
      await supabase.from(table_name).delete().neq('id', 0)
    }

    const { data, error } = await supabase
      .from(table_name)
      .upsert(records, { onConflict: CONFLICT_COLUMNS[table_name] })

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, count: records.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
