import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Temperature bands per season (from ML analysis of 671 reports)
// Matches the CHECK constraint: 'COLD', 'MILD', 'WARM'
const TEMP_BANDS: Record<string, Record<string, [number, number]>> = {
  Winter: { COLD: [-99, 4], MILD: [4, 6], WARM: [6, 99] },
  Spring: { COLD: [-99, 8], MILD: [8, 11], WARM: [11, 99] },
  Summer: { COLD: [-99, 16], MILD: [16, 18], WARM: [18, 99] },
  Autumn: { COLD: [-99, 11], MILD: [11, 14], WARM: [14, 99] },
};

// Matches the CHECK constraint: 'Winter', 'Spring', 'Summer', 'Autumn'
function getSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Autumn';
  return 'Winter';
}

function getWeatherCategory(season: string, temperature?: number | null): string {
  if (temperature == null) return 'MILD';
  const bands = TEMP_BANDS[season];
  if (!bands) return 'MILD';
  for (const [cat, [lo, hi]] of Object.entries(bands)) {
    if (temperature >= lo && temperature < hi) return cat;
  }
  return 'MILD';
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
    const weatherCategory = getWeatherCategory(season, weatherData?.temperature);

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

    // Fallback: try MILD for same venue + season
    let result = advice;
    if (!result) {
      const { data: fallback } = await supabase
        .from('basic_advice')
        .select('*')
        .eq('venue', venue)
        .eq('season', season)
        .eq('weather_category', 'MILD')
        .maybeSingle();
      result = fallback;
    }

    // Second fallback: any record for this venue
    if (!result) {
      const { data: anyAdvice } = await supabase
        .from('basic_advice')
        .select('*')
        .eq('venue', venue)
        .limit(1)
        .maybeSingle();
      result = anyAdvice;
    }

    if (!result) {
      return new Response(
        JSON.stringify({
          advice: `No historical data available for ${venue} in ${season}. Try a different venue or check back later.`,
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

    // Parse rod average range from "1.7 - 7.3" string format
    const rangeMatch = result.rod_average_range?.match(/([\d.]+)\s*-\s*([\d.]+)/);
    const range: [number, number] = rangeMatch
      ? [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])]
      : [0, 0];

    const confidence = (result.report_count ?? 0) >= 15 ? 'HIGH'
      : (result.report_count ?? 0) >= 8 ? 'MEDIUM' : 'LOW';

    // Map methods_ranked: data has {method, frequency, count}
    const mapMethods = (arr: any[]): { method: string; frequency: number; score: number }[] => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.map(r => ({
        method: r.method ?? r.name ?? '',
        frequency: r.frequency ?? 0,
        score: r.count ?? r.score ?? r.frequency ?? 0,
      }));
    };

    // Map flies_ranked: data has {fly, frequency, count}
    const mapFlies = (arr: any[]): { fly: string; frequency: number; score: number }[] => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.map(r => ({
        fly: r.fly ?? r.name ?? '',
        frequency: r.frequency ?? 0,
        score: r.count ?? r.score ?? r.frequency ?? 0,
      }));
    };

    // Map spots_ranked: data has {spot, frequency, count}
    const mapSpots = (arr: any[]): { spot: string; frequency: number; score: number }[] => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.map(r => ({
        spot: r.spot ?? r.name ?? '',
        frequency: r.frequency ?? 0,
        score: r.count ?? r.score ?? r.frequency ?? 0,
      }));
    };

    const response = {
      advice: result.advice_text,
      prediction: {
        rod_average: {
          predicted: result.expected_rod_average ?? 0,
          range,
          confidence,
        },
        methods: mapMethods(result.methods_ranked).slice(0, 5),
        flies: mapFlies(result.flies_ranked).slice(0, 6),
        spots: mapSpots(result.spots_ranked).slice(0, 5),
      },
      tier: 'free' as const,
      season,
      weatherCategory,
      reportCount: result.report_count ?? 0,
      fallback: result.weather_category !== weatherCategory,
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
