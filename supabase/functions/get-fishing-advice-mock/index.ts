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
  precipitationProbability: number;
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
  const { temperature, windSpeed, windDirection, conditions } = weather;

  // Weather-based adjustments
  const windStrength = windSpeed < 10 ? 'light' : windSpeed < 20 ? 'moderate' : 'strong';
  const tempCategory = temperature < 10 ? 'cold' : temperature < 18 ? 'mild' : 'warm';

  switch (venue) {
    case 'Grafham Water':
      return `Based on recent reports and current weather conditions, Grafham Water is fishing well this week.

Weather Impact:
With ${windDirection} winds at ${windSpeed}mph and temperatures around ${temperature}°C, fish should be ${tempCategory === 'warm' ? 'active in the upper layers' : 'holding at mid to deep levels'}. ${windStrength === 'strong' ? 'The strong wind will create excellent drift conditions.' : 'Calm conditions favor stalking visible fish.'}

Best Methods:
- Buzzers on a ${windStrength === 'strong' ? 'floating line (wind will create good drift)' : 'slow-sinking line'}
- Lures ${tempCategory === 'warm' ? 'in the morning' : 'throughout the day'} (current conditions favor lures)
- Nymphs in ${windStrength === 'strong' ? 'sheltered areas' : 'open water'}

Recommended Spots:
- The Dam (consistent catches, ${windDirection === 'SW' || windDirection === 'W' ? 'perfect for current wind' : 'fishable in all winds'})
- Stumps (excellent for lures, ${windStrength !== 'strong' ? 'ideal in current conditions' : 'sheltered area'})
- Sanctuary Bay (${windDirection === 'SW' ? 'wind pushes fish here - top choice!' : 'afternoon fishing'})
- Willows (good ${windStrength === 'light' ? 'in current calm conditions' : 'when wind drops'})

Rod Average: ${tempCategory === 'warm' ? '5-7' : '4-6'} fish per rod expected in these conditions.

Top Flies:
- Diawl Bach (size 12-14)
- Bloodworm patterns ${tempCategory === 'cold' ? '(essential in cold water)' : ''}
- ${tempCategory === 'warm' ? 'Daddy Long Legs and hoppers' : 'Black Lures for morning sessions'}
- ${windStrength === 'strong' ? 'Big booby patterns for deep fishing' : 'Small nymphs for careful presentations'}`;

    case 'Rutland Water':
      return `Rutland Water continues to provide excellent fishing opportunities this week.

Weather Considerations:
Current ${windDirection} winds at ${windSpeed}mph with ${temperature}°C temperatures create ${windStrength === 'light' ? 'perfect calm water conditions for surface activity' : 'ideal conditions for drifting with buzzers'}.

Productive Methods:
- Floating line with buzzers ${windStrength === 'light' ? '(perfect in calm)' : '(good drift conditions)'}
- Intermediate line with lures ${tempCategory === 'cold' ? '(fish are deeper in cold water)' : ''}
- ${windStrength === 'light' ? 'Dry fly in these calm conditions' : 'Sinking line in the wind'}

Hot Spots:
- North Arm (${windDirection === 'N' || windDirection === 'NW' ? 'sheltered from current wind' : 'consistent for boat fishing'})
- South Arm (excellent ${windStrength === 'light' ? 'bank fishing in calm' : 'with wave action'})
- Armley Wood (${windStrength === 'strong' ? 'perfect shelter in strong winds' : 'good all conditions'})
- Dam area (${windDirection === 'E' || windDirection === 'NE' ? 'prime spot with current wind' : 'good all conditions'})

Expected Rod Average: ${tempCategory === 'warm' && windStrength !== 'strong' ? '6-8' : '5-7'} fish per rod.

Recommended Patterns:
- FAB patterns (${temperature > 15 ? 'bright colors in warm water' : 'darker colors in cold water'})
- Cormorants ${windStrength === 'strong' ? '(excellent in choppy water)' : ''}
- Cat's Whisker ${tempCategory === 'warm' ? '(very effective in warm conditions)' : ''}
- ${windStrength === 'light' ? 'Hoppers and surface patterns' : 'Weighted nymphs'}`;

    case 'Pitsford Water':
      return `Pitsford Water is showing good form with quality fish being caught regularly.

Weather Analysis:
With ${windDirection} winds at ${windSpeed}mph and ${temperature}°C, expect fish to be ${tempCategory === 'warm' ? 'feeding actively in the upper layers' : 'moving to deeper areas'}.

Effective Techniques:
- Washing line setup ${windStrength !== 'light' ? '(perfect for current conditions)' : ''}
- Static buzzer fishing ${windStrength === 'light' ? '(ideal in calm water)' : '(less effective in wind)'}
- Lure stripping ${windStrength === 'strong' ? 'in breezy conditions (highly recommended)' : tempCategory === 'warm' ? 'early morning' : 'throughout the day'}

Prime Locations:
- The Dam (${windDirection === 'SW' || windDirection === 'S' ? 'excellent with current wind direction' : 'reliable year-round'})
- Holcot Bank (${windStrength === 'light' ? 'perfect bank fishing in calm' : 'good from bank'})
- Causeway (${windStrength === 'strong' ? 'best sheltered spot today' : 'sheltered spot'})
- Walgrave Shallows (${windStrength === 'light' && tempCategory === 'warm' ? 'top choice in current conditions' : 'in calmer weather'})

Rod Average Prediction: ${tempCategory === 'warm' ? '4-6' : '3-5'} fish per rod.

Fly Selection:
- Black Buzzers (${tempCategory === 'cold' ? 'essential in cold water' : 'always reliable'})
- Shipman's Buzzers ${windStrength === 'light' ? '(perfect for surface feeding)' : ''}
- ${tempCategory === 'warm' ? 'Daddy patterns and hoppers' : 'Tadpoles'}
- Small lures (size ${temperature > 15 ? '10-12' : '8-10'})`;

    case 'Ravensthorpe Reservoir':
      return `Ravensthorpe offers intimate fishing with quality rainbows and browns.

Current Conditions:
${windDirection} winds at ${windSpeed}mph with ${temperature}°C create ${windStrength === 'light' ? 'perfect stalking conditions' : windStrength === 'moderate' ? 'favorable fishing conditions' : 'challenging but productive conditions'}.

Best Approaches:
- Light lines and smaller flies ${windStrength === 'light' ? '(essential in calm water)' : '(even in wind)'}
- ${windStrength === 'light' ? 'Stealthy presentations to visible fish' : 'Systematic coverage of likely areas'}
- Accurate casting ${windStrength === 'strong' ? 'despite the wind' : 'to visible fish'}

Productive Areas:
- Eastern Shore (${windDirection === 'W' || windDirection === 'SW' ? 'sheltered from wind today' : 'morning sun'})
- Western Shore (${windDirection === 'E' || windDirection === 'NE' ? 'best protection from current wind' : 'afternoon shade'})
- Dam Wall (deeper water ${tempCategory === 'cold' ? '- fish often hold here in cold' : '- consistent'})
- North Bank (${windDirection === 'S' || windDirection === 'SW' ? 'well sheltered today' : 'sheltered'})

Expected Catches: ${tempCategory === 'warm' && windStrength === 'light' ? '3-5' : '2-4'} fish per session.

Fly Recommendations:
- PTN (size ${temperature > 15 ? '14-16' : '12-14'})
- Hare's Ear nymphs ${tempCategory === 'cold' ? '(very effective in cold water)' : ''}
- Small black lures ${windStrength !== 'light' ? '(good in choppy water)' : ''}
- ${windStrength === 'light' && tempCategory === 'warm' ? 'CDC dry flies in calm (top choice!)' : 'Weighted nymphs'}`;

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
