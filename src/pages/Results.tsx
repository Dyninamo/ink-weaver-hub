import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Fish, ArrowLeft, LogOut, RefreshCw, MapPin, Share2, TrendingUp, Sparkles, Zap, AlertTriangle, Info,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import type { Location, WeatherData, PredictionData, ModelInfo } from "@/services/adviceService";
import { cn } from "@/lib/utils";
import FishingMap from "@/components/FishingMap";
import { WeatherBadge } from "@/components/WeatherBadge";
import ResultsErrorBoundary from "@/components/ResultsErrorBoundary";
import { ShareDialog } from "@/components/ShareDialog";
import { FrequencyBar } from "@/components/FrequencyBar";

interface ResultsState {
  venue: string;
  date: string;
  advice: string;
  prediction?: PredictionData;
  locations?: Location[];
  weatherData: WeatherData;
  queryId?: string;
  tier?: "free" | "premium";
  season?: string;
  weatherCategory?: string;
  reportCount?: number;
  model_info?: ModelInfo;
}

const confidenceConfig = {
  HIGH: {
    label: "High confidence (15+ matching reports)",
    className: "bg-success/15 text-success border-success/30",
  },
  MEDIUM: {
    label: "Moderate confidence",
    className: "bg-accent/15 text-accent border-accent/30",
  },
  LOW: {
    label: "Limited data",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut: authSignOut } = useAuth();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const state = location.state as ResultsState | null;

  useEffect(() => {
    if (!state) {
      navigate("/dashboard");
    }
  }, [state, navigate]);

  const handleSignOut = async () => {
    await authSignOut();
    navigate("/");
  };

  if (!state) return null;

  const {
    venue, date, advice, prediction, locations, weatherData, tier, season, weatherCategory, model_info,
  } = state;

  const confidence = prediction?.rod_average?.confidence ?? "LOW";
  const confCfg = confidenceConfig[confidence];

  const reportCount = model_info?.report_count ?? state.reportCount;

  // Compute max frequency for bar scaling
  const maxMethodFreq = prediction?.methods?.length
    ? Math.max(...prediction.methods.map((m) => m.frequency ?? m.score ?? 0))
    : 1;
  const maxFlyFreq = prediction?.flies?.length
    ? Math.max(...prediction.flies.map((f) => f.frequency ?? f.score ?? 0))
    : 1;
  const maxSpotFreq = prediction?.spots?.length
    ? Math.max(...prediction.spots.map((s) => s.frequency ?? s.score ?? 0))
    : 1;

  return (
    <ResultsErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-gradient-water text-white py-4 px-4 shadow-medium">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Fish className="w-6 h-6" />
                <span className="font-semibold hidden sm:inline">Fishing Advice</span>
              </div>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          {/* TOP SECTION */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">{venue}</h1>
              <Badge variant="outline" className={cn("text-xs font-medium border", confCfg.className)}>
                {confCfg.label}
              </Badge>
              {/* Data quality badge from model_info */}
              {model_info?.data_quality === "limited" && (
                <Badge variant="outline" className="text-xs font-medium border bg-amber-500/15 text-amber-600 border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Limited data
                </Badge>
              )}
              {model_info?.data_quality === "insufficient" && (
                <Badge variant="outline" className="text-xs font-medium border bg-destructive/15 text-destructive border-destructive/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Very limited data — predictions may be unreliable
                </Badge>
              )}
            </div>

            {/* Character notes from model_info */}
            {model_info?.character_notes && (
              <p className="text-sm italic text-muted-foreground mb-1">
                {model_info.character_notes}
              </p>
            )}

            <p className="text-lg text-muted-foreground mb-1">{date}</p>

            {reportCount != null && (
              <p className="text-sm text-muted-foreground mb-4">
                Based on {reportCount} historical reports
              </p>
            )}

            <WeatherBadge
              weather={weatherData}
              showDetailed
              className="mb-4 shadow-soft bg-gradient-to-r from-primary/5 to-secondary/5"
            />

            {/* Rod Average */}
            {prediction?.rod_average && (
              <Card className="p-5 shadow-soft border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Predicted Rod Average</p>
                    <p className="text-2xl font-bold text-foreground">
                      {prediction.rod_average.predicted.toFixed(1)}{" "}
                      <span className="text-base font-normal text-muted-foreground">
                        fish per rod
                      </span>
                    </p>
                    {prediction.rod_average.range && (
                      <p className="text-sm text-muted-foreground">
                        Range: {prediction.rod_average.range[0]}–{prediction.rod_average.range[1]}
                      </p>
                    )}
                    {model_info?.rod_mae != null && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Model accuracy: ±{model_info.rod_mae.toFixed(2)} fish per rod
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* MIDDLE SECTION */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* LEFT - Advice text */}
            <Card className="p-6 shadow-medium flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Fish className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Fishing Advice</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  style={{ fontSize: "16px", lineHeight: "1.7", whiteSpace: "pre-line" }}
                >
                  {advice}
                </div>
              </div>
            </Card>

            {/* RIGHT - Data cards */}
            <div className="space-y-6">
              {/* Top Methods */}
              {prediction?.methods && prediction.methods.length > 0 && (
                <Card className="p-6 shadow-medium">
                  <h3 className="text-lg font-bold text-foreground mb-4">Top Methods</h3>
                  <div className="space-y-3">
                    {prediction.methods.slice(0, 6).map((m) => (
                      <FrequencyBar
                        key={m.method}
                        label={m.method}
                        value={m.frequency ?? m.score ?? 0}
                        maxValue={maxMethodFreq}
                      />
                    ))}
                  </div>
                </Card>
              )}

              {/* Recommended Flies */}
              {prediction?.flies && prediction.flies.length > 0 && (
                <Card className="p-6 shadow-medium">
                  <h3 className="text-lg font-bold text-foreground mb-4">Recommended Flies</h3>
                  <div className="space-y-3">
                    {prediction.flies.slice(0, 6).map((f) => (
                      <FrequencyBar
                        key={f.fly}
                        label={f.fly}
                        value={f.frequency ?? f.score ?? 0}
                        maxValue={maxFlyFreq}
                      />
                    ))}
                  </div>
                </Card>
              )}

              {/* Best Spots */}
              {prediction?.spots && prediction.spots.length > 0 && (
                <Card className="p-6 shadow-medium">
                  <h3 className="text-lg font-bold text-foreground mb-4">Best Spots</h3>
                  <div className="space-y-3">
                    {prediction.spots.slice(0, 6).map((s) => (
                      <FrequencyBar
                        key={s.spot}
                        label={s.spot}
                        value={s.frequency ?? s.score ?? 0}
                        maxValue={maxSpotFreq}
                      />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Map Section (if locations exist) */}
          {locations && locations.length > 0 && (
            <Card className="p-6 shadow-medium mb-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Recommended Locations</h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div style={{ minHeight: "400px" }}>
                  <FishingMap locations={locations} venueName={venue} />
                </div>
                <div>
                  <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {locations.map((loc, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full mt-1 flex-shrink-0",
                            loc.type === "hotSpot" && "bg-primary",
                            loc.type === "goodArea" && "bg-accent",
                            loc.type === "entryPoint" && "bg-secondary"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{loc.name}</p>
                          <p className="text-xs text-muted-foreground">{loc.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-foreground">Hot spots – Best locations</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-accent" />
                      <span className="text-foreground">Good areas – Reliable spots</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-secondary" />
                      <span className="text-foreground">Entry points – Easy access</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tier Banner */}
          {tier === "free" && (
            <Card className="p-6 shadow-soft border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    This advice is based on historical patterns. Upgrade to Premium for AI-powered
                    personalised advice matched to today's exact conditions.
                  </p>
                </div>
                <Button className="bg-gradient-water text-white hover:opacity-90 shrink-0 gap-2">
                  <Zap className="w-4 h-4" />
                  Upgrade to Premium
                </Button>
              </div>
            </Card>
          )}

          {tier === "premium" && (
            <Card className="p-5 shadow-soft border-secondary/20 bg-secondary/5 mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-secondary" />
                <p className="text-sm font-medium text-foreground">
                  AI-powered advice based on similar reports matched to today's conditions.
                </p>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="bg-gradient-water text-white hover:opacity-90 shadow-medium"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              New Query
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="shadow-soft"
              onClick={() => setShareDialogOpen(true)}
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share This Advice
            </Button>
          </div>
        </main>

        <ShareDialog
          open={shareDialogOpen}
          selectedQueryIds={state?.queryId ? [state.queryId] : []}
          onClose={() => setShareDialogOpen(false)}
          onShareComplete={() => setShareDialogOpen(false)}
        />
      </div>
    </ResultsErrorBoundary>
  );
};

export default Results;