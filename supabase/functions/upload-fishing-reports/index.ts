import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { reports } = await req.json()
    
    if (!reports || !Array.isArray(reports)) {
      return new Response(JSON.stringify({ error: 'reports array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let inserted = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < reports.length; i++) {
      const r = reports[i]
      try {
        const { error } = await supabase.from('fishing_reports').upsert({
          venue: r.venue,
          report_date: r.report_date,
          report_text: r.report_text,
          rod_average: r.rod_average,
          methods: r.methods || [],
          flies: r.flies || [],
          weather: r.weather || [],
          best_spots: r.best_spots || [],
          report_url: r.report_url,
          year: r.year,
          returns: r.returns,
          fish_killed: r.fish_killed,
          fish_released: r.fish_released,
          water_level: r.water_level,
          summary: r.summary,
          headers: r.headers,
          t_mean_week: r.t_mean_week,
          wind_speed_mean_week: r.wind_speed_mean_week,
          wind_dir_deg_week: r.wind_dir_deg_week,
          precip_total_mm_week: r.precip_total_mm_week,
          pressure_mean_week: r.pressure_mean_week,
          humidity_mean_week: r.humidity_mean_week,
          water_temp_week: r.water_temp_week,
        }, { onConflict: 'venue,report_date' })

        if (error) {
          failed++
          errors.push(`Row ${i}: ${error.message}`)
        } else {
          inserted++
        }
      } catch (e) {
        failed++
        errors.push(`Row ${i}: ${e.message}`)
      }
    }

    return new Response(JSON.stringify({ inserted, failed, errors: errors.slice(0, 10) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
