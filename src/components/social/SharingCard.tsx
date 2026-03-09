import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Thermometer, Wind, Cloud, CloudRain, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import ThreadView from "./ThreadView";

interface SharingCardProps {
  card: {
    card_id: string;
    venue_name: string;
    session_date: string;
    n_fish: number;
    species_breakdown: any;
    top_fly_1: string | null;
    top_fly_2: string | null;
    method: string | null;
    conditions_temp_c: number | null;
    conditions_wind: string | null;
    conditions_weather: string | null;
    personal_note: string | null;
    created_at: string;
    display_name: string;
  };
  profileId: string;
  reactionCount: number;
  replyCount: number;
  userReacted: boolean;
}

const getWeatherIcon = (w: string | null) => {
  if (!w) return Cloud;
  const lower = w.toLowerCase();
  if (lower.includes("rain") || lower.includes("drizzle")) return CloudRain;
  if (lower.includes("sun") || lower.includes("clear")) return Sun;
  return Cloud;
};

const SharingCard = ({ card, profileId, reactionCount, replyCount, userReacted }: SharingCardProps) => {
  const [reacted, setReacted] = useState(userReacted);
  const [reactions, setReactions] = useState(reactionCount);
  const [showThread, setShowThread] = useState(false);

  const formattedDate = format(new Date(card.session_date + "T12:00:00"), "d MMM yyyy");
  const flies = [card.top_fly_1, card.top_fly_2].filter(Boolean);
  const WeatherIcon = getWeatherIcon(card.conditions_weather);

  // Parse species breakdown
  let speciesText = "";
  if (card.species_breakdown && Array.isArray(card.species_breakdown)) {
    speciesText = (card.species_breakdown as { species: string; count: number }[])
      .map((s) => `${s.count} ${s.species}`)
      .join(", ");
  }

  const handleToggleReaction = async () => {
    // Optimistic
    const wasReacted = reacted;
    setReacted(!wasReacted);
    setReactions((r) => (wasReacted ? r - 1 : r + 1));

    if (wasReacted) {
      const { data: existing } = await supabase
        .from("card_reactions")
        .select("reaction_id")
        .eq("card_id", card.card_id)
        .eq("profile_id", profileId)
        .is("reply_id", null)
        .single();

      if (existing) {
        const { error } = await supabase.from("card_reactions").delete().eq("reaction_id", existing.reaction_id);
        if (error) { setReacted(true); setReactions((r) => r + 1); }
      }
    } else {
      const { error } = await supabase.from("card_reactions").insert({
        card_id: card.card_id,
        reply_id: null,
        profile_id: profileId,
        emoji: "heart",
      });
      if (error) { setReacted(false); setReactions((r) => r - 1); }
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-foreground text-sm">{card.display_name}</p>
              <p className="text-sm text-muted-foreground">{card.venue_name}</p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formattedDate}</span>
          </div>

          {/* Fish count */}
          <p className="text-sm text-foreground">
            {card.n_fish} fish{speciesText ? ` (${speciesText})` : ""}
          </p>

          {/* Flies */}
          {flies.length > 0 && (
            <p className="text-sm text-muted-foreground">{flies.join(", ")}</p>
          )}

          {/* Method */}
          {card.method && (
            <p className="text-sm text-muted-foreground">{card.method}</p>
          )}

          {/* Conditions */}
          {(card.conditions_temp_c || card.conditions_wind || card.conditions_weather) && (
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
          )}

          {/* Personal note */}
          {card.personal_note && (
            <p className="text-sm italic text-muted-foreground">"{card.personal_note}"</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleToggleReaction}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Heart className={cn("h-4 w-4", reacted && "fill-red-500 text-red-500")} />
              {reactions > 0 && <span>{reactions}</span>}
            </button>

            <button
              onClick={() => setShowThread(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              {replyCount > 0 && <span>{replyCount}</span>}
            </button>

            <button
              onClick={() => setShowThread(true)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Tap to reply
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Thread */}
      <ThreadView
        open={showThread}
        onOpenChange={setShowThread}
        cardId={card.card_id}
        profileId={profileId}
        cardSummary={{
          display_name: card.display_name,
          venue_name: card.venue_name,
          session_date: card.session_date,
          n_fish: card.n_fish,
        }}
      />
    </>
  );
};

export default SharingCard;
