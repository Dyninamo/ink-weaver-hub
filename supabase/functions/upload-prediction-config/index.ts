import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function getConflictKey(table: string): string {
  switch (table) {
    case 'prediction_params': return 'venue,target'
    case 'venue_profiles': return 'venue'
    case 'venue_correlations': return 'venue_a,venue_b,metric'
    default: return ''
  }
}

const allowedTables = ['prediction_params', 'venue_profiles', 'venue_correlations']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { table, data } = await req.json()

    if (!allowedTables.includes(table)) {
      return new Response(
        JSON.stringify({ error: `Invalid table: ${table}. Allowed: ${allowedTables.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Data must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabase
      .from(table)
      .upsert(data, { onConflict: getConflictKey(table) })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        table,
        rows_uploaded: data.length,
        message: `Successfully uploaded ${data.length} rows to ${table}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
