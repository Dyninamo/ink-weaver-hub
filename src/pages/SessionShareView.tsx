import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Thermometer, Wind, Cloud, CloudRain, Sun, FishSymbol } from "lucide-react";
import AvatarCircle from "@/components/AvatarCircle";
import { format } from "date-fns";

const getWeatherIcon = (w: string | null) => {
  if (!w) return Cloud;
  const lower = w.toLowerCase();
  if (lower.includes("rain") || lower.includes("drizzle")) return CloudRain;
  if (lower.includes("sun") || lower.includes("clear")) return Sun;
  return Cloud;
};

export default function SessionShareView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [shareData, setShareData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    fetchShareLink();
  }, [shareToken]);

  const fetchShareLink = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", shareToken!)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setShareData(data);
    }
    setLoading(false);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-6 md:py-8 space-y-3">
            <FishSymbol className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-foreground font-medium">Link not found</p>
            <p className="text-sm text-muted-foreground">This share link may have expired or been removed.</p>
            <Button onClick={() => navigate("/")} variant="outline">Go home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const snap = shareData.card_snapshot || {};
  const formattedDate = snap.session_date
    ? format(new Date(snap.session_date + "T12:00:00"), "d MMM yyyy")
    : "";
  const flies = [snap.top_fly_1, snap.top_fly_2].filter(Boolean);
  const WeatherIcon = getWeatherIcon(snap.conditions_weather);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <FishSymbol className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">It's Catching!</span>
          </div>
        </div>

        {/* Session card */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AvatarCircle
                  displayName={snap.display_name || "Angler"}
                  profileId={shareData.profile_id || ""}
                  size={32}
                />
                <div>
                  <p className="font-semibold text-foreground text-sm">{snap.display_name || "Angler"}</p>
                  <p className="text-sm text-muted-foreground">{snap.venue_name}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formattedDate}</span>
            </div>

            <p className="text-sm text-foreground">
              {snap.n_fish} fish{snap.species_breakdown ? ` (${snap.species_breakdown})` : ""}
            </p>

            {flies.length > 0 && (
              <p className="text-sm text-muted-foreground">{flies.join(", ")}</p>
            )}

            {snap.method && (
              <p className="text-sm text-muted-foreground">{snap.method}</p>
            )}

            {(snap.conditions_temp_c || snap.conditions_wind || snap.conditions_weather) && (
              <div className="flex flex-wrap gap-2">
                {snap.conditions_temp_c !== null && snap.conditions_temp_c !== undefined && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                    {Math.round(snap.conditions_temp_c)}°C
                  </Badge>
                )}
                {snap.conditions_wind && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Wind className="h-3.5 w-3.5 text-muted-foreground" />
                    {snap.conditions_wind}
                  </Badge>
                )}
                {snap.conditions_weather && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <WeatherIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {snap.conditions_weather}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA for unauthenticated users */}
        {!user && (
          <Card>
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm text-foreground font-medium">
                Sign up to see more and join the conversation
              </p>
              <Button
                className="w-full"
                onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/social/session/${shareToken}`)}`)}
              >
                Sign up / Sign in
              </Button>
            </CardContent>
          </Card>
        )}

        {user && (
          <div className="text-center">
            <Button variant="outline" onClick={() => navigate("/social")}>
              Go to Social Feed
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
