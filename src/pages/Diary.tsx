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
  Calendar, ChevronLeft, ChevronRight, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listSessions,
  getActiveSession,
  getSessionEvents,
  calculateSessionStats,
  type FishingSession,
} from "@/services/diaryService";

const PAGE_SIZE = 10;

interface SessionCard extends FishingSession {
  stats?: {
    totalFish: number;
    bestFly: string | null;
    bestStyle: string | null;
    totalChanges: number;
  };
}

export default function Diary() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [venues, setVenues] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<FishingSession | null>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold font-diary">Fishing Diary</h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/diary/settings/setups")}
              title="Rod setups"
            >
              <Settings2 className="h-5 w-5" />
            </Button>
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

        {/* New Session + Filter bar */}
        <div className="flex gap-2">
          <Button
            className="flex-1 min-h-[44px]"
            onClick={() => navigate("/diary/new")}
          >
            <Plus className="h-4 w-4 mr-2" /> New Session
          </Button>
          {venues.length > 1 && (
            <Select value={venueFilter} onValueChange={(v) => { setVenueFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] min-h-[44px]">
                <SelectValue placeholder="All venues" />
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
          <div className="text-center py-16 space-y-3">
            <Fish className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground/60">
              Start your first session to begin tracking
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/diary/${session.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Venue + stars */}
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{session.venue_name}</h3>
                        {session.satisfaction_score && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "h-3 w-3",
                                  i < session.satisfaction_score!
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-muted"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(session.session_date)}
                        {session.fishing_type && ` · ${session.fishing_type}`}
                      </p>

                      {/* Stats row */}
                      {session.stats && (
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1">
                            <Fish className="h-3.5 w-3.5 text-diary-catch" />
                            <strong className="font-mono">{session.stats.totalFish}</strong>
                            <span className="text-muted-foreground">fish</span>
                          </span>
                          {session.duration_minutes && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDuration(session.duration_minutes)}
                            </span>
                          )}
                          {session.stats.bestStyle && (
                            <span className="text-muted-foreground truncate">
                              {session.stats.bestStyle}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Best fly */}
                      {session.stats?.bestFly && (
                        <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                          Best: {session.stats.bestFly}
                        </p>
                      )}
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
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
