import { Wind, Droplets, Gauge } from "lucide-react";
import type { WeatherData } from "@/services/adviceService";
import { cn } from "@/lib/utils";

interface WeatherBadgeProps {
  weather: WeatherData;
  showDetailed?: boolean;
  className?: string;
}

// Map weather conditions to emoji icons
function getWeatherIcon(conditions: string): string {
  const condition = conditions.toLowerCase();
  
  if (condition.includes('clear') || condition.includes('sunny')) {
    return '☀️';
  } else if (condition.includes('thunder')) {
    return '⛈️';
  } else if (condition.includes('rain')) {
    return '🌧️';
  } else if (condition.includes('drizzle')) {
    return '🌦️';
  } else if (condition.includes('snow')) {
    return '🌨️';
  } else if (condition.includes('mist') || condition.includes('fog')) {
    return '🌫️';
  } else if (condition.includes('cloud')) {
    return '☁️';
  }
  
  return '🌤️'; // Default partly cloudy
}

export function WeatherBadge({ weather, showDetailed = false, className }: WeatherBadgeProps) {
  const weatherIcon = getWeatherIcon(weather.conditions);
  const showRain = weather.precipitationProbability > 30;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-card border border-border",
        showDetailed && "flex-col items-start gap-2 sm:flex-row sm:items-center",
        className
      )}
    >
      {/* Weather Icon and Temperature */}
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-2xl" role="img" aria-label="weather icon">
          {weatherIcon}
        </span>
        <span className="text-foreground">{weather.temperature}°C</span>
      </div>

      {/* Wind Information */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Wind className="w-4 h-4" />
        <span>
          {weather.windDirection} {weather.windSpeed}mph
        </span>
      </div>

      {/* Rain Probability */}
      {showRain && (
        <div className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
          <Droplets className="w-4 h-4" />
          <span>{weather.precipitationProbability}% rain</span>
        </div>
      )}

      {/* Detailed Information */}
      {showDetailed && (
        <>
          {/* Conditions Text */}
          <div className="text-sm text-muted-foreground capitalize">
            {weather.conditions}
          </div>

          {/* Humidity */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Droplets className="w-4 h-4" />
            <span>{weather.humidity}% humidity</span>
          </div>

          {/* Pressure */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Gauge className="w-4 h-4" />
            <span>{weather.pressure} hPa</span>
          </div>

          {/* Precipitation Amount (if any) */}
          {weather.precipitation > 0 && (
            <div className="text-sm text-blue-600 dark:text-blue-400">
              {weather.precipitation.toFixed(1)}mm precipitation
            </div>
          )}
        </>
      )}
    </div>
  );
}
