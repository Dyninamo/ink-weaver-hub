import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Fish, Clock, Star, ArrowRight, Play,
  Calendar, ChevronLeft, ChevronRight, Settings2, Mail, User, Sparkles, Map as MapIcon,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listSessions,
  getSessionEvents,
  calculateSessionStats,
  type FishingSession,
} from "@/services/diaryService";

const PAGE_SIZE = 10;

interface SessionCard extends FishingSession {
  stats?: {
    totalFish: number;
    totalLost: number;
    totalBlanks: number;
    bestFly: string | null;
    bestStyle: string | null;
    totalChanges: number;
  };
}

export default function Diary() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [venues, setVenues] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<FishingSession | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search input (150ms)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load venues for filter
  useEffect(() => {
    if (!user) return;
    async function loadVenues() {
      const { data } = await supabase
        .from("fishing_sessions")
        .select("venue_name")
        .eq("user_id", user!.id);
      if (data) {
        const unique = [...new Set(data.map((r: any) => r.venue_name))].sort();
        setVenues(unique);
      }
    }
    loadVenues();
  }, [user]);

  // Check for active session
  useEffect(() => {
    if (!user) return;
    async function checkActive() {
      const active = await getActiveSession(user!.id);
      setActiveSession(active);
    }
    checkActive();
  }, [user]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { sessions: data, count } = await listSessions(user.id, {
        venue: venueFilter === "all" ? undefined : venueFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setTotalCount(count);

      // Enrich with stats (load events for each session)
      const enriched: SessionCard[] = await Promise.all(
        data.map(async (session) => {
          try {
            const events = await getSessionEvents(session.id);
            const stats = calculateSessionStats(events);
            return {
              ...session,
              stats: {
                totalFish: stats.totalFish,
                totalLost: stats.totalLost,
                totalBlanks: stats.totalBlanks,
                bestFly: stats.bestFly,
                bestStyle: stats.bestStyle,
                totalChanges: stats.totalChanges,
              },
            };
          } catch {
            return { ...session, stats: undefined };
          }
        })
      );

      setSessions(enriched);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [user, venueFilter, page]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function formatDuration(mins: number | null): string {
    if (!mins) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // Aggregate stats for header subtitle
  const totalFishAcrossLoaded = sessions.reduce(
    (acc, s) => acc + (s.stats?.totalFish ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-4">
        {/* Header — title + small-caps stats + profile icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight font-diary leading-tight">
              Timeline
            </h1>
            {totalCount > 0 && (
              <p
                className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mt-1 font-medium"
              >
                {totalCount} session{totalCount !== 1 ? "s" : ""}
                {totalFishAcrossLoaded > 0 ? ` · ${totalFishAcrossLoaded} fish` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/map")}
              title="Discover waters"
            >
              <MapIcon className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/queries")}
              title="Ask the Ghillie"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/diary/settings/setups")}
              title="Rod setups"
            >
              <Settings2 className="h-5 w-5" />
            </Button>
            {/* Profile icon (top-right) → Settings */}
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Settings"
              title="Settings"
              className="ml-1 inline-flex items-center justify-center h-9 w-9 rounded-full bg-foreground text-background text-xs font-bold tracking-wide hover:opacity-90 transition-opacity"
            >
              {(profile?.display_name || user?.email || "A").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </div>

        {/* Active session banner */}
        {activeSession && (
          <Card className="border-diary-catch/50 bg-diary-catch/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-diary-catch animate-pulse" />
                    <span className="text-sm font-medium">Active Session</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeSession.venue_name} · {formatDate(activeSession.session_date)}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-diary-catch hover:bg-diary-catch/90 min-h-[44px]"
                  onClick={() => navigate(`/diary/${activeSession.id}`)}
                >
                  <Play className="h-4 w-4 mr-1" /> Resume
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Session + Search + Filter bar */}
        <div className="flex gap-2">
          <Button
            className="min-h-[44px]"
            onClick={() => navigate("/diary/new")}
          >
            <Plus className="h-4 w-4 mr-2" /> New
          </Button>
          <input
            type="search"
            placeholder="Search notes, spots…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 h-11 px-4 rounded-full bg-[var(--paper-100,hsl(var(--muted)/0.4))] border border-[var(--ink-700,hsl(var(--border)))] text-sm outline-none focus:ring-1 focus:ring-foreground/40"
          />
          {venues.length > 1 && (
            <Select value={venueFilter} onValueChange={(v) => { setVenueFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[120px] min-h-[44px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All venues</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Session list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="mx-auto h-20 w-20 rounded-full bg-muted/50 border border-border flex items-center justify-center">
              <Fish className="h-9 w-9 text-muted-foreground/40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold tracking-tight font-diary">A blank page.</p>
              <p className="text-sm text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
                Your sessions will appear here as you log them.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions
              .filter((s) => {
                if (!search) return true;
                const hay = [
                  s.venue_name,
                  (s as any).spot_name,
                  s.notes,
                  s.plan,
                  (s as any).area,
                  (s as any).beat,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return hay.includes(search);
              })
              .map((session) => {
              const d = new Date(session.session_date + "T00:00:00");
              const dd = d.getDate().toString().padStart(2, "0");
              const mmm = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
              const fishCount = session.stats?.totalFish ?? 0;
              const isBlank = fishCount === 0;
              return (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors overflow-hidden"
                  onClick={() => navigate(`/diary/${session.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-stretch gap-3 p-3">
                      {/* Date block */}
                      <div className="shrink-0 w-14 rounded-md bg-muted/50 border border-border flex flex-col items-center justify-center py-2">
                        <span className="text-xl font-semibold tabular-nums leading-none font-diary">
                          {dd}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-1 font-semibold">
                          {mmm}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{session.venue_name}</h3>
                          {session.satisfaction_score && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {Array.from({ length: 5 }, (_, i) => {
                                const filled = i < session.satisfaction_score!;
                                return (
                                  <Star
                                    key={i}
                                    className="h-3 w-3"
                                    style={{
                                      color: filled
                                        ? "var(--gild-500, hsl(var(--accent)))"
                                        : "hsl(var(--muted))",
                                      fill: filled
                                        ? "var(--gild-500, hsl(var(--accent)))"
                                        : "transparent",
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                          {session.duration_minutes ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration_minutes)}
                            </span>
                          ) : null}
                          {session.fishing_type && (
                            <span className="truncate">{session.fishing_type}</span>
                          )}
                        </div>

                        {/* Tally row — caught · lost · blanks */}
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          {fishCount > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--event-catch, hsl(var(--primary)))" }}
                              />
                              <strong
                                className="font-semibold tabular-nums"
                                style={{ color: "var(--event-catch-dark, hsl(var(--primary)))" }}
                              >
                                {fishCount}
                              </strong>
                              <span className="text-muted-foreground">caught</span>
                            </span>
                          )}
                          {(session.stats?.totalLost ?? 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-1.5 tabular-nums"
                              style={{ color: "var(--event-lost, hsl(var(--destructive)))" }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--event-lost, hsl(var(--destructive)))" }}
                              />
                              {session.stats!.totalLost} lost
                            </span>
                          )}
                          {(session.stats?.totalBlanks ?? 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-1.5 tabular-nums"
                              style={{ color: "var(--event-blank, hsl(var(--muted-foreground)))" }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--event-blank, hsl(var(--muted-foreground)))" }}
                              />
                              {session.stats!.totalBlanks} blanks
                            </span>
                          )}
                          {isBlank && (session.stats?.totalLost ?? 0) === 0 && (session.stats?.totalBlanks ?? 0) === 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--event-blank, hsl(var(--muted-foreground)))" }}
                              />
                              <span className="text-muted-foreground uppercase tracking-[0.12em] text-[11px] font-medium">
                                Blank
                              </span>
                            </span>
                          )}
                          {session.stats?.bestFly && fishCount > 0 && (
                            <span className="text-muted-foreground/80 truncate">
                              · {session.stats.bestFly}
                            </span>
                          )}
                        </div>

                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Total count */}
        {totalCount > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            {totalCount} session{totalCount !== 1 ? "s" : ""} recorded
          </p>
        )}
      </div>
    </div>
  );
}
