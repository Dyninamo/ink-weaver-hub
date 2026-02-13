import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function getWeatherCategory(weather?: { temperature?: number; windSpeed?: number; precipitation?: number }): string {
  if (!weather) return 'mild_calm_dry';
  
  const temp = weather.temperature ?? 12;
  const wind = weather.windSpeed ?? 10;
  const precip = weather.precipitation ?? 0;
  
  const tempLabel = temp < 8 ? 'cold' : temp < 16 ? 'mild' : 'warm';
  const windLabel = wind < 10 ? 'calm' : wind < 20 ? 'moderate' : 'strong';
  const precipLabel = precip > 2 ? 'wet' : 'dry';
  
  return `${tempLabel}_${windLabel}_${precipLabel}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venue, date, weatherData } = await req.json();

    if (!venue || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: venue, date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const season = getSeason(date);
    const weatherCategory = getWeatherCategory(weatherData);

    // Look up pre-computed advice
    const { data: advice, error } = await supabase
      .from('basic_advice')
      .select('*')
      .eq('venue', venue)
      .eq('season', season)
      .eq('weather_category', weatherCategory)
      .maybeSingle();

    if (error) {
      console.error('DB error:', error);
      throw new Error('Failed to query advice');
    }

    // Fallback: try same season, any weather
    let result = advice;
    if (!result) {
      const { data: fallback } = await supabase
        .from('basic_advice')
        .select('*')
        .eq('venue', venue)
        .eq('season', season)
        .limit(1)
        .maybeSingle();
      result = fallback;
    }

    if (!result) {
      return new Response(
        JSON.stringify({
          advice: `No historical data available for ${venue} in ${season}. Try logging some trips to build your personal database!`,
          prediction: {
            rod_average: { predicted: 0, range: [0, 0], confidence: 'LOW' },
            methods: [],
            flies: [],
            spots: [],
          },
          tier: 'free',
          season,
          weatherCategory,
          reportCount: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse ranked arrays from JSONB
    const parseRanked = (json: unknown): { name: string; frequency: number; score: number }[] => {
      if (!json || !Array.isArray(json)) return [];
      return json;
    };

    const rangeMatch = result.rod_average_range?.match(/([\d.]+)\s*-\s*([\d.]+)/);
    const range: [number, number] = rangeMatch
      ? [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])]
      : [0, 0];

    const confidence = (result.report_count ?? 0) >= 10 ? 'HIGH'
      : (result.report_count ?? 0) >= 5 ? 'MEDIUM' : 'LOW';

    const response = {
      advice: result.advice_text,
      prediction: {
        rod_average: {
          predicted: result.expected_rod_average ?? 0,
          range,
          confidence,
        },
        methods: parseRanked(result.methods_ranked).map(r => ({ method: r.name, frequency: r.frequency, score: r.score })),
        flies: parseRanked(result.flies_ranked).map(r => ({ fly: r.name, frequency: r.frequency, score: r.score })),
        spots: parseRanked(result.spots_ranked).map(r => ({ spot: r.name, frequency: r.frequency, score: r.score })),
      },
      tier: 'free' as const,
      season,
      weatherCategory,
      reportCount: result.report_count ?? 0,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-basic-advice error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
