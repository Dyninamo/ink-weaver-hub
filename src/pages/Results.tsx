import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Fish, MapPin, Wind, Thermometer, Clock,
  TrendingUp, Target, User, BarChart3, Shield, ShoppingBag, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdviceV2Response, FishingAdviceResponse } from "@/services/adviceService";
import FlySelector from "@/components/FlySelector";
import { enrichFliesForSelector } from "@/utils/enrichFlies";
import { MOCK_FLIES } from "@/data/mockFlies";
import type { RecommendedFly } from "@/types/flySelector";

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showFlySelector, setShowFlySelector] = useState(false);
  const [selectorFlies, setSelectorFlies] = useState<RecommendedFly[]>([]);
  const [loadingFlies, setLoadingFlies] = useState(false);

  const state = location.state as {
    adviceV2?: AdviceV2Response;
    advice?: FishingAdviceResponse;
    venue?: string;
    date?: string;
    advice_text?: string;
    prediction?: any;
    weatherData?: any;
    locations?: any[];
    queryId?: string;
    tier?: string;
    season?: string;
    model_info?: any;
  } | null;

  if (!state || (!state.adviceV2 && !state.advice && !state.advice_text)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No advice data</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isV2 = !!state.adviceV2;
  const v2 = state.adviceV2;
  const v1 = state.advice;

  // Unified accessors — support v2, v1 object, and legacy flat state
  const advice = v2?.advice ?? v1?.advice ?? (state as any).advice_text ?? "";
  const prediction = v2?.prediction ?? v1?.prediction ?? (state as any).prediction;
  const weather = v2?.weather;
  const tactical = v2?.tactical;
  const personal = v2?.personal;
  const confidence = v2?.confidence;
  const season = v2?.season ?? v1?.season ?? (state as any).season ?? "";
  const reportCount = v2?.reportCount ?? v1?.reportCount ?? 0;


  async function handleOrderFlies() {
    setLoadingFlies(true);
    try {
      const tacticalFlies = tactical?.flies ?? [];
      const predictionFlies = prediction?.flies ?? [];

      let flies: RecommendedFly[];
      if (tacticalFlies.length > 0) {
        flies = await enrichFliesForSelector(tacticalFlies, predictionFlies);
      } else {
        flies = MOCK_FLIES;
      }

      setSelectorFlies(flies);
      setShowFlySelector(true);
    } catch (err) {
      console.error("Failed to enrich flies:", err);
      setSelectorFlies(MOCK_FLIES);
      setShowFlySelector(true);
    } finally {
      setLoadingFlies(false);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  // Parse advice into sections (v2 uses ## headers)
  function renderAdvice(text: string) {
    if (!text) return null;
    const sections = text.split(/^## /m).filter(Boolean);
    if (sections.length <= 1) {
      // No headers — render with inline bold support
      return (
        <div className="space-y-2">
          {text.split('\n').map((line, i) => {
            if (line.startsWith('### ')) {
              return <h3 key={i} className="font-semibold text-sm mt-3 mb-1">{line.replace('### ', '')}</h3>;
            }
            if (line.trim() === '') return <div key={i} className="h-1" />;
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {parts.map((part, j) =>
                  part.startsWith('**') && part.endsWith('**')
                    ? <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>
                    : part
                )}
              </p>
            );
          })}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {sections.map((section, i) => {
          const lines = section.split("\n");
          const title = lines[0].replace(/\*\*/g, "").trim();
          const body = lines.slice(1).join("\n").trim();
          return (
            <div key={i}>
              <h3 className="font-semibold text-sm mb-1 text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {body}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  // Catch-by-hour chart
  function renderCatchByHour(data: Record<string, number>) {
    const entries = Object.entries(data).sort(([a], [b]) => Number(a) - Number(b));
    if (entries.length === 0) return null;
    const maxVal = Math.max(...entries.map(([, v]) => v));

    return (
      <div className="space-y-1">
        {entries.map(([hour, val]) => (
          <div key={hour} className="flex items-center gap-2 text-xs">
            <span className="w-12 text-right text-muted-foreground font-mono">
              {hour.padStart(2, "0")}:00
            </span>
            <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded"
                style={{ width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%` }}
              />
            </div>
            <span className="w-8 text-muted-foreground font-mono">
              {val.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Confidence badge
  function ConfidenceBadge({ level }: { level: string }) {
    const colors: Record<string, string> = {
      high: "bg-success/10 text-success border-success/20",
      medium: "bg-accent/10 text-accent border-accent/20",
      low: "bg-destructive/10 text-destructive border-destructive/20",
      none: "bg-muted text-muted-foreground border-border",
      available: "bg-success/10 text-success border-success/20",
      insufficient: "bg-muted text-muted-foreground border-border",
    };
    return (
      <span className={cn(
        "text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase",
        colors[level] || colors.low
      )}>
        {level}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[480px] mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{state.venue}</h1>
            <p className="text-sm text-muted-foreground">
              {state.date ? (state.date.includes('-') ? formatDate(state.date) : state.date) : ""}{season ? ` · ${season}` : ""}
            </p>
          </div>
        </div>

        {/* Weather bar */}
        {weather && (
          <div className="flex flex-wrap items-center gap-3 text-xs px-3 py-2 rounded-md bg-muted/50">
            <span className="flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5" /> {weather.temp}°C
            </span>
            <span className="flex items-center gap-1">
              <Wind className="h-3.5 w-3.5" /> {weather.wind_speed}mph {weather.wind_dir}
            </span>
            {weather.conditions && (
              <span className="text-muted-foreground">{weather.conditions}</span>
            )}
            {weather.is_historical && (
              <span className="ml-auto text-[10px] text-accent font-medium">Estimate</span>
            )}
          </div>
        )}

        {/* Rod Average */}
        {prediction?.rod_average && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Predicted Rod Average
              </p>
              <p className="text-4xl font-mono font-bold text-primary">
                {typeof prediction.rod_average.predicted === 'number'
                  ? prediction.rod_average.predicted.toFixed(1)
                  : prediction.rod_average.predicted}
              </p>
              {prediction.rod_average.range && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-2">
                  <span>Range {prediction.rod_average.range[0]}–{prediction.rod_average.range[1]}</span>
                  <ConfidenceBadge level={prediction.rod_average.confidence?.toLowerCase() ?? 'low'} />
                </p>
              )}
              {reportCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Based on {reportCount} reports</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Advice text */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fish className="h-4 w-4" /> Fishing Advice
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {renderAdvice(advice)}
          </CardContent>
        </Card>

        {/* Predictions — methods, flies, spots */}
        {prediction && (
          <>
            {/* Methods */}
            {prediction.methods?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" /> Top Methods
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {prediction.methods.slice(0, 6).map((m: any, i: number) => {
                      const val = m.frequency ?? m.score ?? 0;
                      const maxVal = Math.max(...prediction.methods.slice(0, 6).map((x: any) => x.frequency ?? x.score ?? 0));
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center justify-between text-sm">
                            <span>{m.method}</span>
                            <span className="text-xs text-muted-foreground font-mono">{val.toFixed ? val.toFixed(1) : val}</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded overflow-hidden">
                            <div className="h-full bg-primary/50 rounded" style={{ width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Flies */}
            {prediction.flies?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Fish className="h-4 w-4" /> Top Flies
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {prediction.flies.slice(0, 6).map((f: any, i: number) => {
                      const val = f.frequency ?? f.score ?? 0;
                      const maxVal = Math.max(...prediction.flies.slice(0, 6).map((x: any) => x.frequency ?? x.score ?? 0));
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center justify-between text-sm">
                            <span>{f.fly}</span>
                            <span className="text-xs text-muted-foreground font-mono">{val.toFixed ? val.toFixed(1) : val}</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded overflow-hidden">
                            <div className="h-full bg-secondary/60 rounded" style={{ width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Spots */}
            {prediction.spots?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Best Spots
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {prediction.spots.slice(0, 6).map((s: any, i: number) => {
                      const val = s.frequency ?? s.score ?? 0;
                      const maxVal = Math.max(...prediction.spots.slice(0, 6).map((x: any) => x.frequency ?? x.score ?? 0));
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center justify-between text-sm">
                            <span>{s.spot}</span>
                            <span className="text-xs text-muted-foreground font-mono">{val.toFixed ? val.toFixed(1) : val}</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded overflow-hidden">
                            <div className="h-full bg-accent/60 rounded" style={{ width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Tactical Insights (v2 only) */}
        {tactical && tactical.session_count > 0 && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Diary Network Intelligence
                <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                  {tactical.session_count} sessions · {tactical.period_count} periods
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Techniques from diary */}
              {tactical.techniques.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                    Effective Techniques
                  </p>
                  <div className="space-y-1.5">
                    {tactical.techniques.slice(0, 5).map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{t.technique}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {t.weighted_catches.toFixed(1)} catches · {t.weighted_minutes}min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flies from diary */}
              {tactical.flies.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                    Productive Flies
                  </p>
                  <div className="space-y-1.5">
                    {tactical.flies.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{f.fly}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {f.weighted_catches.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spots from diary */}
              {tactical.spots.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                    Best Producing Spots
                  </p>
                  <div className="space-y-1.5">
                    {tactical.spots.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{s.spot}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {s.weighted_catches.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catch by hour */}
              {Object.keys(tactical.catch_by_hour).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Peak Catch Times
                  </p>
                  {renderCatchByHour(tactical.catch_by_hour)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Personal Performance (v2 only) */}
        {personal && (
          <Card className={personal.has_personal ? "border-success/20" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-success" /> Your Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {personal.has_personal ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-mono font-bold">{personal.total_sessions}</p>
                      <p className="text-[10px] text-muted-foreground">Sessions</p>
                    </div>
                    <div>
                      <p className="text-xl font-mono font-bold">{personal.catch_rate?.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">Fish/session</p>
                    </div>
                    <div>
                      <p className={cn(
                        "text-xl font-mono font-bold",
                        (personal.general_ability ?? 1) > 1.1 ? "text-success"
                          : (personal.general_ability ?? 1) < 0.9 ? "text-destructive" : ""
                      )}>
                        {personal.general_ability?.toFixed(2) ?? "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Ability</p>
                    </div>
                  </div>

                  {personal.technique_stats && Object.keys(personal.technique_stats).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                        Your Technique Effectiveness
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(personal.technique_stats)
                          .slice(0, 5)
                          .map(([style, stats]: [string, any]) => (
                            <div key={style} className="flex items-center justify-between text-sm">
                              <span>{style}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                eff: {stats.effectiveness?.toFixed(2) ?? "?"} · {stats.catches ?? 0} fish
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {personal.message || "Log 3+ sessions at this venue to unlock personalised advice."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confidence & Data Sources */}
        {confidence && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Data Confidence
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Report data ({reportCount} reports)</span>
                  <ConfidenceBadge level={confidence.report_data} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Diary data ({v2?.sessionCount ?? 0} sessions)
                  </span>
                  <ConfidenceBadge level={confidence.tactical_data} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Personal data</span>
                  <ConfidenceBadge level={confidence.personal_data} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Flies */}
        <div className="text-center space-y-2">
          <Button
            onClick={handleOrderFlies}
            disabled={loadingFlies}
            className="min-h-[44px] px-8 text-base"
            size="lg"
          >
            {loadingFlies ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading flies...
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 mr-2" /> Order Flies
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            {(tactical?.flies?.length ?? 0) > 0
              ? "Based on diary session data for this venue"
              : "Demo selection — log sessions to get personalised picks"}
          </p>
        </div>

        {/* Back / New Query button */}
        <Button
          variant="outline"
          className="w-full min-h-[44px]"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> New Query
        </Button>

        {/* Fly Selector Modal */}
        {showFlySelector && selectorFlies.length > 0 && (
          <FlySelector
            flies={selectorFlies}
            venueName={state.venue ?? ""}
            tripDate={state.date ?? ""}
            onClose={() => setShowFlySelector(false)}
          />
        )}
      </div>
    </div>
  );
}
