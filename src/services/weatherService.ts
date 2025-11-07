import type { WeatherData } from "./adviceService";

// Venue coordinates for weather lookup
const VENUE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "Grafham Water": { lat: 52.2856, lon: -0.3238 },
  "Rutland Water": { lat: 52.6619, lon: -0.6428 },
  "Pitsford Water": { lat: 52.3167, lon: -0.9167 },
  "Ravensthorpe Reservoir": { lat: 52.3167, lon: -0.8833 },
};

// Wind direction conversion from degrees to cardinal
function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Fallback weather data generator
function generateFallbackWeather(venue: string): WeatherData {
  const baseTemp = 10 + Math.random() * 8; // 10-18°C
  const baseWind = 5 + Math.random() * 15; // 5-20mph
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Overcast'];
  
  return {
    temperature: Math.round(baseTemp),
    windSpeed: Math.round(baseWind),
    windDirection: directions[Math.floor(Math.random() * directions.length)],
    conditions: conditions[Math.floor(Math.random() * conditions.length)],
    precipitationProbability: Math.round(Math.random() * 60), // 0-60%
  };
}

export async function getWeatherForecast(
  venue: string,
  date: string
): Promise<WeatherData> {
  try {
    const coords = VENUE_COORDINATES[venue];
    
    if (!coords) {
      console.warn(`No coordinates found for venue: ${venue}, using fallback`);
      return generateFallbackWeather(venue);
    }

    // For now, generate realistic mock weather data
    // TODO: Integrate with real weather API (OpenWeatherMap, etc.)
    const fallbackData = generateFallbackWeather(venue);
    
    console.log(`Weather forecast for ${venue} on ${date}:`, fallbackData);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return fallbackData;
  } catch (error) {
    console.error('Error fetching weather forecast:', error);
    // Return fallback data on error
    return generateFallbackWeather(venue);
  }
}
