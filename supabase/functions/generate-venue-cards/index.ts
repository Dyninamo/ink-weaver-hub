import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const targetDate = body.target_date || new Date().toISOString().split("T")[0];
    const singleVenue = body.venue_id || null;

    // 1. Find sessions on targetDate
    let query = supabase
      .from("fishing_sessions")
      .select("id, venue_name, weather_temp, weather_wind_speed, weather_conditions")
      .eq("session_date", targetDate);

    if (singleVenue) {
      const { data: mapping } = await supabase
        .from("session_venue_map")
        .select("session_venue_name")
        .eq("venue_id", singleVenue);

      if (mapping && mapping.length > 0) {
        const venueNames = mapping.map((m) => m.session_venue_name);
        query = query.in("venue_name", venueNames);
      }
    }

    const { data: sessions, error: sessError } = await query;
    if (sessError) {
      return new Response(JSON.stringify({ error: sessError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by venue_name
    const venueSessionMap: Record<string, typeof sessions> = {};
    for (const s of sessions || []) {
      if (!venueSessionMap[s.venue_name]) venueSessionMap[s.venue_name] = [];
      venueSessionMap[s.venue_name].push(s);
    }

    // Filter to venues with >= 3 sessions
    const qualifyingVenues = Object.entries(venueSessionMap)
      .filter(([_, arr]) => arr.length >= 3)
      .map(([name, arr]) => ({ venue_name: name, sessions: arr }));

    if (qualifyingVenues.length === 0) {
      return new Response(
        JSON.stringify({ cards_generated: 0, message: "No venues with >= 3 sessions today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cardsGenerated: Array<{ venue: string; sessions: number; rod_average: string }> = [];

    const mostCommon = (arr: string[]) => {
      if (arr.length === 0) return null;
      const counts: Record<string, number> = {};
      arr.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    };

    for (const venue of qualifyingVenues) {
      const sessionIds = venue.sessions.map((s) => s.id);

      // Get events for fish count, fly patterns, methods
      const { data: events } = await supabase
        .from("session_events")
        .select("event_type, fly_pattern, style, species")
        .in("session_id", sessionIds);

      const catchEvents = (events || []).filter((e) => e.event_type === "catch");
      const totalFish = catchEvents.length;
      const rodAverage = totalFish / venue.sessions.length;

      // Top flies
      const flyCounts: Record<string, number> = {};
      const methodCounts: Record<string, number> = {};
      for (const e of catchEvents) {
        if (e.fly_pattern) flyCounts[e.fly_pattern] = (flyCounts[e.fly_pattern] || 0) + 1;
        if (e.style) methodCounts[e.style] = (methodCounts[e.style] || 0) + 1;
      }

      const topFlies = Object.entries(flyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const dominantMethod =
        Object.entries(methodCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name)[0] || null;

      // Weather aggregation
      const temps = venue.sessions.map((s) => s.weather_temp).filter(Boolean) as number[];
      const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
      const winds = venue.sessions
        .map((s) => (s.weather_wind_speed ? `${s.weather_wind_speed}mph` : null))
        .filter(Boolean) as string[];
      const conditionsArr = venue.sessions
        .map((s) => s.weather_conditions)
        .filter(Boolean) as string[];

      // Look up venue_id
      const { data: venueMapping } = await supabase
        .from("session_venue_map")
        .select("venue_id")
        .eq("session_venue_name", venue.venue_name)
        .single();

      const venueId = venueMapping?.venue_id || null;

      // Check for notable fish
      let bestFish: Record<string, unknown> | null = null;
      let hasLeaderboardEvent = false;
      let leaderboardSummary: string | null = null;

      if (venueId) {
        const { data: todayFish } = await supabase
          .from("notable_fish")
          .select("species, weight_kg, weight_lb, length_cm, length_in, is_venue_season_record, is_venue_alltime_record")
          .eq("venue_id", venueId)
          .gte("submitted_at", targetDate + "T00:00:00")
          .lte("submitted_at", targetDate + "T23:59:59")
          .eq("is_active", true)
          .order("weight_kg", { ascending: false })
          .limit(1);

        if (todayFish && todayFish.length > 0) {
          bestFish = todayFish[0];
          hasLeaderboardEvent = !!(todayFish[0].is_venue_season_record || todayFish[0].is_venue_alltime_record);
          if (todayFish[0].is_venue_alltime_record) {
            leaderboardSummary = `New all-time venue record: ${todayFish[0].species} ${todayFish[0].weight_lb}lb`;
          } else if (todayFish[0].is_venue_season_record) {
            leaderboardSummary = `New season record: ${todayFish[0].species} ${todayFish[0].weight_lb}lb`;
          }
        }
      }

      // Generate AI narrative using Lovable AI
      let narrative = `${venue.sessions.length} sessions logged at ${venue.venue_name} today.`;

      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const aiResponse = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              max_tokens: 200,
              messages: [
                {
                  role: "user",
                  content: `Write a 2-3 sentence end-of-day fishing report in the style of a Scottish gillie. Use British English. Be specific about flies and methods. Do not use American fishing terminology.

Data:
- Venue: ${venue.venue_name}
- Date: ${targetDate}
- Sessions logged: ${venue.sessions.length}
- Rod average: ${rodAverage.toFixed(1)} fish
- Total fish: ${totalFish}
- Top flies: ${topFlies.join(", ") || "not recorded"}
- Dominant method: ${dominantMethod || "not recorded"}
- Temperature: ${avgTemp ? avgTemp.toFixed(0) + "°C" : "not recorded"}
- Wind: ${mostCommon(winds) || "not recorded"}
- Conditions: ${mostCommon(conditionsArr) || "not recorded"}
${bestFish ? `- Best fish: ${(bestFish as any).species} ${(bestFish as any).weight_lb}lb` : ""}`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const result = await aiResponse.json();
            narrative = result.choices?.[0]?.message?.content || narrative;
          } else {
            await aiResponse.text(); // consume body
          }
        }
      } catch (e) {
        console.error("AI narrative error, using fallback:", e);
      }

      // Insert venue_daily_cards row
      const cardData = {
        venue_id: venueId,
        card_date: targetDate,
        n_sessions: venue.sessions.length,
        rod_average: rodAverage,
        top_fly_1: topFlies[0] || null,
        top_fly_2: topFlies[1] || null,
        top_fly_3: topFlies[2] || null,
        dominant_method: dominantMethod,
        conditions_temp_c: avgTemp,
        conditions_wind: mostCommon(winds),
        conditions_weather: mostCommon(conditionsArr),
        best_fish_species: (bestFish as any)?.species || null,
        best_fish_weight_kg: (bestFish as any)?.weight_kg || null,
        best_fish_weight_lb: (bestFish as any)?.weight_lb || null,
        best_fish_length_cm: (bestFish as any)?.length_cm || null,
        best_fish_length_in: (bestFish as any)?.length_in || null,
        narrative,
        has_leaderboard_event: hasLeaderboardEvent,
        leaderboard_summary: leaderboardSummary,
      };

      const { error: insertError } = await supabase
        .from("venue_daily_cards")
        .upsert(cardData, { onConflict: "venue_id,card_date" });

      if (!insertError) {
        cardsGenerated.push({
          venue: venue.venue_name,
          sessions: venue.sessions.length,
          rod_average: rodAverage.toFixed(1),
        });
      } else {
        console.error(`Card insert error for ${venue.venue_name}:`, insertError);
      }
    }

    return new Response(
      JSON.stringify({
        cards_generated: cardsGenerated.length,
        date: targetDate,
        cards: cardsGenerated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-venue-cards error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
