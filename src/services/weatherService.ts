import { supabase } from "@/integrations/supabase/client";
import type { WeatherData } from "./adviceService";

function createUnavailableWeather(): WeatherData {
  return {
    temperature: 0,
    windSpeed: 0,
    windDirection: '',
    conditions: 'Unavailable',
    precipitation: 0,
    precipitationProbability: 0,
    humidity: 0,
    pressure: 0,
    isFallback: true,
  };
}

export async function getWeatherForecast(
  venue: string,
  date: string
): Promise<WeatherData> {
  try {
    const { data, error } = await supabase.functions.invoke('get-weather-forecast', {
      body: { venue, date }
    });
    
    if (error) {
      console.error('Weather API error:', error);
      throw new Error(error.message);
    }
    
    if (!data) {
      throw new Error('No weather data returned from API');
    }
    
    return data as WeatherData;
    
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    return createUnavailableWeather();
  }
}
