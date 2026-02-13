import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PERSONAL_WEIGHT_BOOST = 1.5;
const RECENCY_DECAY = 0.6;

function getSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

interface ReportRow {
  venue: string;
  date: string;
  year: number | null;
  rod_average: number | null;
  methods: string[] | null;
  flies: string[] | null;
  best_spots: string[] | null;
  summary: string | null;
  t_mean_week: number | null;
  wind_speed_mean_week: number | null;
  precip_total_mm_week: number | null;
  pressure_mean_week: number | null;
  humidity_mean_week: number | null;
  is_personal?: boolean;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function recencyWeight(reportDate: string, targetDate: string, isPersonal: boolean): number {
  const days = daysBetween(reportDate, targetDate);
  const decay = Math.pow(RECENCY_DECAY, days / 365);
  return isPersonal ? decay * PERSONAL_WEIGHT_BOOST : decay;
}

function rankItems(reports: ReportRow[], field: 'methods' | 'flies' | 'best_spots', targetDate: string): { name: string; frequency: number; score: number }[] {
  const scores = new Map<string, { freq: number; score: number }>();

  for (const r of reports) {
    const items = r[field];
    if (!items || !Array.isArray(items)) continue;
    const w = recencyWeight(r.date, targetDate, r.is_personal ?? false);
    for (const item of items) {
      const name = String(item).trim();
      if (!name) continue;
      const existing = scores.get(name) ?? { freq: 0, score: 0 };
      existing.freq += 1;
      existing.score += w;
      scores.set(name, existing);
    }
  }

  return Array.from(scores.entries())
    .map(([name, { freq, score }]) => ({ name, frequency: freq, score: Math.round(score * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function predictRodAverage(reports: ReportRow[], targetDate: string): { predicted: number; range: [number, number]; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const valid = reports.filter(r => r.rod_average != null && r.rod_average > 0);
  if (valid.length === 0) return { predicted: 0, range: [0, 0], confidence: 'LOW' };

  let totalWeight = 0;
  let weightedSum = 0;
  const values: number[] = [];

  for (const r of valid) {
    const w = recencyWeight(r.date, targetDate, r.is_personal ?? false);
    weightedSum += r.rod_average! * w;
    totalWeight += w;
    values.push(r.rod_average!);
  }

  const predicted = Math.round((weightedSum / totalWeight) * 10) / 10;
  values.sort((a, b) => a - b);
  const p10 = values[Math.floor(values.length * 0.1)] ?? 0;
  const p90 = values[Math.floor(values.length * 0.9)] ?? predicted;

  const confidence = valid.length >= 15 ? 'HIGH' : valid.length >= 5 ? 'MEDIUM' : 'LOW';
  return { predicted, range: [Math.round(p10 * 10) / 10, Math.round(p90 * 10) / 10], confidence };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venue, date, userId, weatherData } = await req.json();

    if (!venue || !date || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: venue, date, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch fishery reports for this venue
    const { data: fisheryReports, error: frError } = await supabase
      .from('fishing_reports')
      .select('venue, report_date, year, rod_average, methods, flies, best_spots, summary, t_mean_week, wind_speed_mean_week, precip_total_mm_week, pressure_mean_week, humidity_mean_week')
      .eq('venue', venue);

    if (frError) {
      console.error('fishing_reports query error:', frError);
      throw new Error('Failed to query fishing reports');
    }

    // 2. Fetch user's personal diary entries (via diary_as_reports view)
    const { data: diaryReports, error: drError } = await supabase
      .from('diary_as_reports')
      .select('venue, date, year, rod_average, methods, flies, best_spots, summary, t_mean_week, wind_speed_mean_week, precip_total_mm_week, pressure_mean_week, humidity_mean_week')
      .eq('venue', venue)
      .eq('user_id', userId);

    if (drError) {
      console.error('diary_as_reports query error:', drError);
      // Non-fatal: continue without diary data
    }

    // 3. Merge into unified report list
    const allReports: ReportRow[] = [
      ...(fisheryReports ?? []).map(r => ({
        venue: r.venue,
        date: r.report_date,
        year: r.year,
        rod_average: r.rod_average,
        methods: r.methods,
        flies: r.flies,
        best_spots: r.best_spots,
        summary: r.summary,
        t_mean_week: r.t_mean_week,
        wind_speed_mean_week: r.wind_speed_mean_week,
        precip_total_mm_week: r.precip_total_mm_week,
        pressure_mean_week: r.pressure_mean_week,
        humidity_mean_week: r.humidity_mean_week,
        is_personal: false,
      })),
      ...(diaryReports ?? []).map(r => ({
        venue: r.venue ?? venue,
        date: r.date ?? date,
        year: r.year,
        rod_average: r.rod_average,
        methods: r.methods as string[] | null,
        flies: r.flies as string[] | null,
        best_spots: r.best_spots as string[] | null,
        summary: r.summary,
        t_mean_week: r.t_mean_week,
        wind_speed_mean_week: r.wind_speed_mean_week,
        precip_total_mm_week: r.precip_total_mm_week,
        pressure_mean_week: r.pressure_mean_week,
        humidity_mean_week: r.humidity_mean_week,
        is_personal: true,
      })),
    ];

    const season = getSeason(date);
    const totalReports = allReports.length;
    const personalCount = allReports.filter(r => r.is_personal).length;

    // 4. Compute weighted predictions
    const rodAvg = predictRodAverage(allReports, date);
    const methods = rankItems(allReports, 'methods', date);
    const flies = rankItems(allReports, 'flies', date);
    const spots = rankItems(allReports, 'best_spots', date);

    // 5. Generate AI advice using Lovable AI Gateway
    const aiPrompt = `You are a fly fishing expert. Generate personalised advice for fishing at ${venue} on ${date} (${season}).

Weather: ${weatherData ? JSON.stringify(weatherData) : 'not available'}

Based on ${totalReports} historical reports (${personalCount} personal diary entries):
- Predicted rod average: ${rodAvg.predicted} (range ${rodAvg.range[0]}-${rodAvg.range[1]}, confidence: ${rodAvg.confidence})
- Top methods: ${methods.slice(0, 5).map(m => m.name).join(', ') || 'none recorded'}
- Top flies: ${flies.slice(0, 5).map(f => f.name).join(', ') || 'none recorded'}
- Best spots: ${spots.slice(0, 5).map(s => s.name).join(', ') || 'none recorded'}

Write 3-4 paragraphs of practical advice. Reference the weather conditions and how they affect fly/method selection. Be specific about fly sizes, line choices, and retrieve styles. Keep it conversational but expert.`;

    let adviceText = '';
    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: aiPrompt }],
          max_tokens: 800,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        adviceText = aiData.choices?.[0]?.message?.content ?? '';
      }
    } catch (aiErr) {
      console.error('AI advice generation failed:', aiErr);
    }

    if (!adviceText) {
      adviceText = `Based on ${totalReports} reports for ${venue} in ${season}, the predicted rod average is ${rodAvg.predicted} fish. Top methods: ${methods.slice(0, 3).map(m => m.name).join(', ')}. Top flies: ${flies.slice(0, 3).map(f => f.name).join(', ')}.`;
    }

    // 6. Save query record
    const { data: queryData, error: qError } = await supabase
      .from('queries')
      .insert({
        user_id: userId,
        venue,
        query_date: date,
        advice_text: adviceText,
        weather_data: weatherData ?? null,
      })
      .select('id')
      .single();

    if (qError) {
      console.error('Failed to save query:', qError);
    }

    const response = {
      advice: adviceText,
      prediction: {
        rod_average: rodAvg,
        methods: methods.map(m => ({ method: m.name, frequency: m.frequency, score: m.score })),
        flies: flies.map(f => ({ fly: f.name, frequency: f.frequency, score: f.score })),
        spots: spots.map(s => ({ spot: s.name, frequency: s.frequency, score: s.score })),
      },
      tier: 'premium' as const,
      season,
      reportCount: totalReports,
      personalReportCount: personalCount,
      queryId: queryData?.id,
      weatherData,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-fishing-advice error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
