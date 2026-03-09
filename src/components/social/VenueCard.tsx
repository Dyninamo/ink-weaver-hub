import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Thermometer, Wind, Cloud, CloudRain, Sun, ChevronUp, Trophy, Fish } from "lucide-react";

interface VenueCardProps {
  card: {
    daily_card_id: string;
    venue_name: string;
    card_date: string;
    n_sessions: number;
    rod_average: number | null;
    top_fly_1: string | null;
    top_fly_2: string | null;
    top_fly_3: string | null;
    dominant_method: string | null;
    conditions_temp_c: number | null;
    conditions_wind: string | null;
    conditions_weather: string | null;
    best_fish_species: string | null;
    best_fish_weight_lb: number | null;
    narrative: string;
    has_leaderboard_event: boolean;
    leaderboard_summary: string | null;
  };
}

const getWeatherIcon = (weather: string | null) => {
  if (!weather) return Cloud;
  const w = weather.toLowerCase();
  if (w.includes("rain") || w.includes("drizzle")) return CloudRain;
  if (w.includes("sun") || w.includes("clear")) return Sun;
  return Cloud;
};

const formatWeight = (lb: number | null) => {
  if (!lb) return null;
  const wholeLb = Math.floor(lb);
  const oz = Math.round((lb - wholeLb) * 16);
  if (oz === 0) return `${wholeLb}lb`;
  return `${wholeLb}lb ${oz}oz`;
};

const VenueCard = ({ card }: VenueCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const topFlies = [card.top_fly_1, card.top_fly_2, card.top_fly_3].filter(Boolean) as string[];
  const formattedDate = format(new Date(card.card_date + "T12:00:00"), "d MMM yyyy");
  const WeatherIcon = getWeatherIcon(card.conditions_weather);

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all duration-200 border-border hover:shadow-md"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        {/* Collapsed header — always visible */}
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-foreground">{card.venue_name}</h3>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">{formattedDate}</span>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{card.n_sessions} sessions logged</span>
          {card.rod_average !== null && (
            <>
              <span className="text-border">|</span>
              <span>Rod avg: {card.rod_average.toFixed(1)}</span>
            </>
          )}
        </div>

        {topFlies.length > 0 && !expanded && (
          <p className="text-sm text-muted-foreground mt-1">
            Top fly: {topFlies[0]}
          </p>
        )}

        {card.has_leaderboard_event && !expanded && (
          <Badge variant="secondary" className="mt-2 gap-1 text-xs">
            <Trophy className="h-3 w-3" />
            Record set
          </Badge>
        )}

        {/* Expanded content */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            expanded ? "max-h-[600px] opacity-100 mt-4" : "max-h-0 opacity-0"
          }`}
        >
          {/* Top flies */}
          {topFlies.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Top flies</p>
              <ol className="list-decimal list-inside text-sm text-foreground space-y-0.5">
                {topFlies.map((fly, i) => (
                  <li key={i}>{fly}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Dominant method */}
          {card.dominant_method && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Dominant method</p>
              <p className="text-sm text-foreground">{card.dominant_method}</p>
            </div>
          )}

          {/* Conditions */}
          {(card.conditions_temp_c || card.conditions_wind || card.conditions_weather) && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Conditions</p>
              <div className="flex flex-wrap gap-2">
                {card.conditions_temp_c !== null && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                    {Math.round(card.conditions_temp_c)}°C
                  </Badge>
                )}
                {card.conditions_wind && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Wind className="h-3.5 w-3.5 text-muted-foreground" />
                    {card.conditions_wind}
                  </Badge>
                )}
                {card.conditions_weather && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <WeatherIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {card.conditions_weather}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Best fish */}
          {card.best_fish_species && card.best_fish_weight_lb && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Best fish</p>
              <p className="text-sm text-foreground flex items-center gap-1.5">
                <Fish className="h-4 w-4 text-primary" />
                {card.best_fish_species}, {formatWeight(card.best_fish_weight_lb)}
              </p>
            </div>
          )}

          {/* Leaderboard event */}
          {card.has_leaderboard_event && card.leaderboard_summary && (
            <div className="mb-3 p-2 rounded-md bg-accent/50">
              <p className="text-sm text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-primary" />
                {card.leaderboard_summary}
              </p>
            </div>
          )}

          {/* AI narrative */}
          <div className="mb-3">
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              "{card.narrative}"
            </p>
          </div>

          {/* Collapse button */}
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}>
              <ChevronUp className="h-4 w-4" />
              Collapse
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VenueCard;
