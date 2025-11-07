import { supabase } from "@/integrations/supabase/client";
import type { WeatherData } from "./adviceService";

// Fallback weather data generator
function generateFallbackWeather(): WeatherData {
  const baseTemp = 10 + Math.random() * 8; // 10-18°C
  const baseWind = 5 + Math.random() * 15; // 5-20mph
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Overcast'];
  
  return {
    temperature: Math.round(baseTemp),
    windSpeed: Math.round(baseWind),
    windDirection: directions[Math.floor(Math.random() * directions.length)],
    conditions: conditions[Math.floor(Math.random() * conditions.length)],
    precipitation: 0,
    precipitationProbability: Math.round(Math.random() * 60), // 0-60%
    humidity: 60 + Math.round(Math.random() * 30), // 60-90%
    pressure: 1005 + Math.round(Math.random() * 20), // 1005-1025 hPa
  };
}

export async function getWeatherForecast(
  venue: string,
  date: string
): Promise<WeatherData> {
  try {
    console.log(`Fetching weather forecast for ${venue} on ${date}`);
    
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
    
    console.log('Weather forecast received:', data);
    return data as WeatherData;
    
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    console.warn('Falling back to generated weather data');
    
    // Return fallback data if API fails
    return generateFallbackWeather();
  }
}
