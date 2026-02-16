import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const { spots } = await req.json();

    if (!spots || !Array.isArray(spots) || spots.length === 0) {
      return new Response(
        JSON.stringify({ error: 'spots array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let upserted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      try {
        const { error } = await supabase.from('venue_spots').upsert({
          spot_id: s.spot_id,
          venue_name: s.venue_name,
          spot_name: s.spot_name,
          access_type: s.access_type ?? null,
          notes: s.notes ?? null,
          latitude: s.latitude ?? null,
          longitude: s.longitude ?? null,
        }, { onConflict: 'venue_name,spot_name' });

        if (error) {
          failed++;
          errors.push(`Row ${i}: ${error.message}`);
        } else {
          upserted++;
        }
      } catch (e: unknown) {
        failed++;
        errors.push(`Row ${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ upserted, failed, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
