import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  conditions: string;
  precipitation: number;
  precipitationProbability: number;
  humidity: number;
  pressure: number;
}

interface RequestBody {
  venue: string;
  date: string;
  userId: string;
  weatherData: WeatherData;
}

interface Location {
  name: string;
  coordinates: [number, number];
  type: 'hotSpot' | 'goodArea' | 'entryPoint';
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venue, date, userId, weatherData }: RequestBody = await req.json();

    if (!venue || !date || !userId || !weatherData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate advice based on venue
    const advice = generateAdvice(venue, weatherData);
    const locations = generateLocations(venue);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save query to database
    const { data: queryData, error: queryError } = await supabase
      .from('queries')
      .insert({
        user_id: userId,
        venue,
        query_date: date,
        advice_text: advice,
        recommended_locations: locations,
        weather_data: weatherData,
      })
      .select()
      .single();

    if (queryError) {
      console.error('Error saving query:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to save query' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        advice,
        locations,
        queryId: queryData.id,
        weatherData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-fishing-advice-mock:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateAdvice(venue: string, weather: WeatherData): string {
  const { temperature, windSpeed, windDirection, conditions, precipitationProbability } = weather;

  // Weather-based adjustments
  const windStrength = windSpeed < 10 ? 'light' : windSpeed < 20 ? 'moderate' : 'strong';
  const tempCategory = temperature < 10 ? 'cold' : temperature < 18 ? 'mild' : 'warm';
  const rainCategory = precipitationProbability > 60 ? 'high' : precipitationProbability > 30 ? 'moderate' : 'low';

  switch (venue) {
    case 'Grafham Water':
      return `Based on recent reports and current weather conditions, Grafham Water is fishing well this week.

Weather Impact:
With ${windDirection} winds at ${windSpeed}mph and temperatures around ${temperature}°C, fish should be ${tempCategory === 'warm' ? 'active in the upper layers' : 'holding at mid to deep levels'}. ${windStrength === 'strong' ? 'The strong wind will create excellent drift conditions.' : 'Calm conditions favor stalking visible fish.'}

${tempCategory === 'cold' ? '❄️ Cold Water Strategy: Fish deeper with slower retrieves. Use darker flies as fish are less active and holding in deeper, warmer water.' : tempCategory === 'mild' ? '🌤️ Ideal Conditions: Fish are active throughout the water column. Normal retrieves work well.' : '☀️ Warm Water Advantage: Fish the surface with faster retrieves. Consider dry flies as fish are feeding actively in upper layers.'}

${windStrength === 'light' ? '💨 Light Wind Tactics: Perfect for dry fly fishing and stalking visible fish. Stealthy approach essential.' : windStrength === 'moderate' ? '💨 Moderate Wind Bonus: Use wind for natural drift. Washing line setup very effective in these conditions.' : '💨 Strong Wind Strategy: Focus on sheltered areas like Stumps and use sinking lines to get below wind-affected layers.'}

${rainCategory === 'high' ? '🌧️ Rain Incoming: Fish often feed aggressively before rain arrives - prime fishing window! Get on the water early.' : rainCategory === 'moderate' ? '☁️ Overcast Advantage: Cloud cover can improve fishing significantly as fish are less cautious.' : '☀️ Clear Conditions: Fish deeper or focus on early morning/late evening sessions when light levels are lower.'}

Best Methods:
- Buzzers on a ${windStrength === 'strong' ? 'floating line (wind will create good drift)' : 'slow-sinking line'}
- Lures ${tempCategory === 'warm' ? 'in the morning' : 'throughout the day'} (current conditions favor lures)
- Nymphs in ${windStrength === 'strong' ? 'sheltered areas' : 'open water'}
${tempCategory === 'warm' && windStrength === 'light' ? '- Try dry flies - conditions are perfect for surface feeding' : ''}

Recommended Spots:
- ${windDirection === 'SW' || windDirection === 'W' ? '⭐ Sanctuary Bay (PRIORITY: downwind bank - fish pushed here by wind)' : 'Sanctuary Bay (afternoon fishing)'}
- The Dam (consistent catches, ${windDirection === 'SW' || windDirection === 'W' ? 'good wind direction' : 'fishable in all conditions'})
- ${windStrength === 'strong' ? '⭐ Stumps (PRIORITY: excellent shelter in strong winds, perfect for lures)' : 'Stumps (excellent for lures)'}
- Willows (${windStrength === 'light' ? 'perfect in current calm' : 'best when wind drops'})

Rod Average: ${tempCategory === 'warm' ? '5-7' : '4-6'} fish per rod expected in these conditions.

Top Flies:
- Diawl Bach (size 12-14)
- ${tempCategory === 'cold' ? 'Bloodworm patterns (essential - fish deep and slow)' : 'Bloodworm patterns'}
- ${tempCategory === 'warm' ? 'Daddy Long Legs and hoppers (surface feeding active)' : tempCategory === 'cold' ? 'Black Lures with slow retrieve' : 'Black Lures for morning sessions'}
- ${windStrength === 'strong' ? 'Big booby patterns for deep fishing' : 'Small nymphs for careful presentations'}`;

    case 'Rutland Water':
      return `Rutland Water continues to provide excellent fishing opportunities this week.

Weather Considerations:
Current ${windDirection} winds at ${windSpeed}mph with ${temperature}°C temperatures create ${windStrength === 'light' ? 'perfect calm water conditions for surface activity' : 'ideal conditions for drifting with buzzers'}.

${tempCategory === 'cold' ? '❄️ Cold Water Strategy: Fish are holding deeper. Use slower retrieves with darker patterns. Focus on mid to deep water columns.' : tempCategory === 'mild' ? '🌤️ Balanced Approach: Fish active at all depths. Standard techniques producing well.' : '☀️ Warm Water Tactics: Surface activity excellent. Use faster retrieves and do not be afraid to fish shallow.'}

${windStrength === 'light' ? '💨 Calm Water Advantage: Ideal for dry fly fishing and targeting visible cruising fish. Stealth is key.' : windStrength === 'moderate' ? '💨 Perfect Drift Conditions: Wind creating excellent natural drift. Washing line setup highly recommended.' : '💨 Heavy Wind Plan: Fish sheltered banks especially Armley Wood. Use sinking lines to avoid surface turbulence.'}

${rainCategory === 'high' ? '🌧️ Pre-Rain Feeding: Excellent timing - fish sense pressure change and feed actively. Make the most of it!' : rainCategory === 'moderate' ? '☁️ Overcast Bonus: Reduced light makes fish bolder. Great opportunity for larger flies and aggressive tactics.' : '☀️ Bright Conditions: Fish early/late or focus on deeper areas during midday. Use more natural patterns.'}

Productive Methods:
- Floating line with buzzers ${windStrength === 'light' ? '(perfect in calm)' : '(excellent drift in this wind)'}
- Intermediate line with lures ${tempCategory === 'cold' ? '(essential - fish are deeper in cold)' : '(covers mid-water effectively)'}
- ${windStrength === 'light' && tempCategory !== 'cold' ? 'Dry fly - conditions are perfect for surface work' : 'Sinking line for deeper presentations'}

Hot Spots:
- ${(windDirection === 'E' || windDirection === 'NE') ? '⭐ Dam Area (PRIORITY: downwind bank - fish concentrated here)' : 'Dam area (reliable all conditions)'}
- ${windStrength === 'strong' ? '⭐ Armley Wood (PRIORITY: best shelter from wind)' : 'Armley Wood (consistent producer)'}
- North Arm (${windDirection === 'N' || windDirection === 'NW' ? 'sheltered from wind' : 'excellent boat fishing'})
- South Arm (${windStrength === 'light' ? 'top bank fishing in calm' : 'good with wave action'})

Expected Rod Average: ${tempCategory === 'warm' && windStrength !== 'strong' ? '6-8' : '5-7'} fish per rod.

Recommended Patterns:
- FAB patterns (${temperature > 15 ? 'bright colors work well in warm water' : 'darker colors better in cold'})
- Cormorants ${windStrength === 'strong' ? '(perfect for choppy water)' : '(always reliable)'}
- Cat's Whisker ${tempCategory === 'warm' ? '(excellent in warm conditions)' : ''}
- ${windStrength === 'light' && tempCategory !== 'cold' ? 'Hoppers and CDC patterns for surface' : 'Weighted nymphs for depth'}`;

    case 'Pitsford Water':
      return `Pitsford Water is showing good form with quality fish being caught regularly.

Weather Analysis:
With ${windDirection} winds at ${windSpeed}mph and ${temperature}°C, expect fish to be ${tempCategory === 'warm' ? 'feeding actively in the upper layers' : 'moving to deeper areas'}.

${tempCategory === 'cold' ? '❄️ Cold Water Approach: Slow down everything. Fish deeper with darker flies and patient retrieves. Quality over quantity in these temperatures.' : tempCategory === 'mild' ? '🌤️ Optimal Conditions: Fish active throughout water column. All standard techniques effective.' : '☀️ Warm Water Opportunity: Fish surface layers with confidence. Faster retrieves and dry flies producing well.'}

${windStrength === 'light' ? '💨 Calm Perfection: Ideal for static buzzer fishing and stalking. Watch for risers and target them specifically.' : windStrength === 'moderate' ? '💨 Wind Advantage: Perfect for washing line. Use the wind to create natural movement in your flies.' : '💨 Strong Wind Tactics: Focus on sheltered Causeway area. Lure stripping highly effective in these conditions.'}

${rainCategory === 'high' ? '🌧️ Pre-Storm Feeding: Fish are on! They know rain is coming and are feeding hard. Prime fishing ahead.' : rainCategory === 'moderate' ? '☁️ Cloud Cover Benefit: Overcast skies reduce spooking. Fish are more confident and easier to approach.' : '☀️ Bright Sky Strategy: Fish deeper water or time your sessions for dawn/dusk when fish are less cautious.'}

Effective Techniques:
- Washing line setup ${windStrength !== 'light' ? '(excellent in current wind)' : '(works but static better in calm)'}
- Static buzzer fishing ${windStrength === 'light' ? '(perfect technique right now)' : '(challenging in wind)'}
- Lure stripping ${windStrength === 'strong' ? '(top choice in breezy conditions)' : tempCategory === 'warm' ? 'early morning' : 'throughout the day'}
${tempCategory === 'warm' && windStrength === 'light' ? '- Dry fly fishing - do not miss this opportunity!' : ''}

Prime Locations:
- ${(windDirection === 'SW' || windDirection === 'S') ? '⭐ The Dam (PRIORITY: wind direction perfect, fish pushed to this bank)' : 'The Dam (reliable year-round)'}
- ${windStrength === 'strong' ? '⭐ Causeway (PRIORITY: best shelter available)' : 'Causeway (sheltered option)'}
- Holcot Bank (${windStrength === 'light' ? 'excellent bank fishing in calm' : 'accessible from shore'})
- Walgrave Shallows (${windStrength === 'light' && tempCategory === 'warm' ? 'perfect conditions for this spot!' : 'better in calmer weather'})

Rod Average Prediction: ${tempCategory === 'warm' ? '4-6' : '3-5'} fish per rod.

Fly Selection:
- Black Buzzers (${tempCategory === 'cold' ? 'critical in cold - fish slow and deep' : 'always productive'})
- Shipman's Buzzers ${windStrength === 'light' ? '(ideal for surface in calm)' : ''}
- ${tempCategory === 'warm' ? 'Daddy patterns and hoppers (surface feeding active)' : 'Tadpoles and nymphs'}
- Small lures (size ${temperature > 15 ? '10-12 with brighter colors' : '8-10 darker patterns'})`;

    case 'Ravensthorpe Reservoir':
      return `Ravensthorpe offers intimate fishing with quality rainbows and browns.

Current Conditions:
${windDirection} winds at ${windSpeed}mph with ${temperature}°C create ${windStrength === 'light' ? 'perfect stalking conditions' : windStrength === 'moderate' ? 'favorable fishing conditions' : 'challenging but productive conditions'}.

${tempCategory === 'cold' ? '❄️ Cold Water Tactics: Fish will be lethargic. Use smaller flies, slower retrieves, and focus on deeper areas like Dam Wall where water is slightly warmer.' : tempCategory === 'mild' ? '🌤️ Ideal Conditions: Fish active and responsive. Standard approaches all working well.' : '☀️ Warm Water Tactics: Fish are feeding confidently. Faster retrieves work well and surface activity likely, especially early/late.'}

${windStrength === 'light' ? '💨 Calm Water Advantage: Perfect for stalking individual fish. Watch for cruisers and target them with precision casts. Stealth crucial.' : windStrength === 'moderate' ? '💨 Moderate Wind: Good for systematic coverage. Fish less spooked but still requires accurate casting.' : '💨 Strong Wind Challenge: Difficult conditions but fish still feeding. Focus on downwind sheltered banks.'}

${rainCategory === 'high' ? '🌧️ Pre-Rain Activity: Great timing for Ravensthorpe. Fish become less cautious before rain - they will be more aggressive.' : rainCategory === 'moderate' ? '☁️ Overcast Conditions: Cloud cover is your friend here. Fish more willing to move and less wary.' : '☀️ Clear Sky Tactics: Bright sun makes fish cautious at Ravensthorpe. Early morning or evening sessions will be most productive.'}

Best Approaches:
- Light lines and smaller flies ${windStrength === 'light' ? '(absolutely essential in calm - fish are easily spooked)' : '(maintains natural presentation)'}
- ${windStrength === 'light' ? 'Stealthy stalking to visible fish (stay low, move slowly)' : 'Systematic coverage of likely holding areas'}
- Accurate casting ${windStrength === 'strong' ? '(challenging but necessary in wind)' : '(precision to individual fish)'}

Productive Areas:
- ${(windDirection === 'W' || windDirection === 'SW') ? '⭐ Eastern Shore (PRIORITY: sheltered from wind, excellent conditions)' : 'Eastern Shore (morning sun, good visibility)'}
- ${(windDirection === 'E' || windDirection === 'NE') ? '⭐ Western Shore (PRIORITY: protected from wind today)' : 'Western Shore (afternoon shade)'}
- Dam Wall (${tempCategory === 'cold' ? 'key spot - fish hold in deeper, warmer water' : 'deeper water, consistent producer'})
- North Bank (${windDirection === 'S' || windDirection === 'SW' ? 'well sheltered - top choice!' : 'good shelter option'})

Expected Catches: ${tempCategory === 'warm' && windStrength === 'light' ? '3-5' : '2-4'} fish per session.

Fly Recommendations:
- PTN (size ${temperature > 15 ? '14-16 (smaller in warm)' : '12-14 (standard for cold)'})
- Hare's Ear nymphs ${tempCategory === 'cold' ? '(excellent cold water choice)' : '(reliable all-rounder)'}
- Small black lures ${windStrength !== 'light' ? '(effective in choppy water)' : '(subtle presentation)'}
- ${windStrength === 'light' && tempCategory === 'warm' ? 'CDC dry flies (perfect conditions - do not miss this!)' : tempCategory === 'cold' ? 'Weighted nymphs (get down to the fish)' : 'Nymphs and small lures'}`;

    default:
      return 'Venue not found. Please select a valid venue.';
  }
}

function generateLocations(venue: string): Location[] {
  switch (venue) {
    case 'Grafham Water':
      return [
        { name: "The Dam", coordinates: [52.2975, -0.3124], type: "hotSpot", description: "Consistent catches year-round" },
        { name: "Stumps", coordinates: [52.2955, -0.3144], type: "goodArea", description: "Excellent for lures" },
        { name: "Sanctuary Bay", coordinates: [52.2985, -0.3154], type: "goodArea", description: "Wind-dependent hotspot" },
        { name: "Willows", coordinates: [52.2945, -0.3164], type: "entryPoint", description: "Good bank access" }
      ];

    case 'Rutland Water':
      return [
        { name: "North Arm", coordinates: [52.6671, -0.6361], type: "hotSpot", description: "Boat fishing favorite" },
        { name: "South Arm", coordinates: [52.6651, -0.6381], type: "hotSpot", description: "Excellent bank access" },
        { name: "Armley Wood", coordinates: [52.6641, -0.6351], type: "goodArea", description: "Sheltered spot" },
        { name: "Dam", coordinates: [52.6661, -0.6341], type: "entryPoint", description: "All weather access" }
      ];

    case 'Pitsford Water':
      return [
        { name: "The Dam", coordinates: [52.3177, -0.9157], type: "hotSpot", description: "Reliable spot" },
        { name: "Holcot Bank", coordinates: [52.3157, -0.9177], type: "goodArea", description: "Good from shore" },
        { name: "Causeway", coordinates: [52.3167, -0.9147], type: "goodArea", description: "Sheltered area" },
        { name: "Walgrave", coordinates: [52.3187, -0.9167], type: "entryPoint", description: "Shallow water" }
      ];

    case 'Ravensthorpe Reservoir':
      return [
        { name: "Eastern Shore", coordinates: [52.3466, -0.8779], type: "hotSpot", description: "Morning favorite" },
        { name: "Western Shore", coordinates: [52.3446, -0.8799], type: "goodArea", description: "Afternoon shade" },
        { name: "Dam Wall", coordinates: [52.3456, -0.8769], type: "goodArea", description: "Deeper water" },
        { name: "North Bank", coordinates: [52.3476, -0.8789], type: "entryPoint", description: "Easy access" }
      ];

    default:
      return [];
  }
}
