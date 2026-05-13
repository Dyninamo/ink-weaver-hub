// TODO: inline event editing (tap event → field picker in-row). Deferred — Round 4 polish.
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSession } from "@/contexts/ActiveSessionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Fish, Circle, RefreshCw, Star, MapPin,
  Thermometer, Wind, Trash2, Share2, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
// Active-session phases now live in ActiveSessionShell (prompt 143). Active-only
// modal state, handlers, and FAB JSX have been stripped (prompt 147 §2).
import ActiveSessionShell from "@/components/diary/ActiveSessionShell";
import ShareSessionDialog from "@/components/social/ShareSessionDialog";
import NotableFishDialog from "@/components/social/NotableFishDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getSession,
  getSessionEvents,
  deleteSession,
  calculateSessionStats,
  formatFliesOnCast,
  normaliseFliesOnCast,
  type FishingSession,
  type SessionEvent,
  type CurrentSetup,
  type WeatherSnapshot,
} from "@/services/diaryService";

type ViewTab = "timeline" | "fish" | "stats";

export default function DiaryEntry() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { refresh: refreshActiveSession } = useActiveSession();
  const navigate = useNavigate();

  const [session, setSession] = useState<FishingSession | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ViewTab>("timeline");

  // Current setup state (tracked locally)
  const [currentSetup, setCurrentSetup] = useState<CurrentSetup>({
    style: null, rig: null, line_type: null, retrieve: null,
    flies_on_cast: null, spot: null, depth_zone: null,
  });

  // Carry-forward state — only the active shell consumes lastSpecies; kept here
  // because it's derived from completed events too (cheap).
  const [lastSpecies, setLastSpecies] = useState<string | null>(null);

  // Active-only modal state, online tracking, latestWeather, end-session flow,
  // outreach state, justEnded — all stripped (prompt 147 §2). Active sessions
  // bail to ActiveSessionShell before any of that JSX renders.

  const [activeRodIndex, setActiveRodIndex] = useState<number>(0);
  const [latestWeather, setLatestWeather] = useState<WeatherSnapshot | null>(null);
  const [isOnline] = useState<boolean>(true);

  // Expanded events
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const profileId = (profile as any)?.profile_id ?? null;
  const [notableOpen, setNotableOpen] = useState(false);
  const [notablePrefill, setNotablePrefill] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<"not_found" | "bad_id" | "other" | null>(null);

  // Load session + events
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        getSession(id),
        getSessionEvents(id),
      ]);
      setSession(s);
      setEvents(e);

      // Resolve venue_id from venues_new
      if (s.venue_name) {
        const { data: venue } = await supabase
          .from('venues_new')
          .select('venue_id')
          .ilike('name', s.venue_name)
          .limit(1)
          .maybeSingle();
        if (venue) {
          setVenueId(venue.venue_id);
        }
      }

      // Derive current setup from most recent change/catch event
      const setupEvents = [...e].reverse();
      const lastSetupEvent = setupEvents.find(
        (ev) => ev.style || ev.rig || ev.line_type
      );
      if (lastSetupEvent) {
        setCurrentSetup({
          style: lastSetupEvent.style,
          rig: lastSetupEvent.rig,
          line_type: lastSetupEvent.line_type,
          retrieve: lastSetupEvent.retrieve,
          flies_on_cast: normaliseFliesOnCast(lastSetupEvent.flies_on_cast),
          spot: lastSetupEvent.spot,
          depth_zone: lastSetupEvent.depth_zone,
        });
      }

      // Derive carry-forward (lastSpecies only — rig position/fly size were
      // consumed by removed catch-modal handlers).
      const lastCatch = setupEvents.find((ev) => ev.event_type === "catch");
      if (lastCatch) {
        setLastSpecies(lastCatch.species);
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (err?.code === "PGRST116" || /406|no rows|not found/i.test(msg)) {
        setLoadError("not_found");
      } else if (/invalid input syntax for type uuid/i.test(msg) || err?.code === "22P02") {
        setLoadError("bad_id");
      } else {
        setLoadError("other");
        console.error(err);
        toast.error("Failed to load session");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch profile_id for sharing
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("profile_id")
        .eq("id", user.id)
        .single();
      if (data) setProfileId(data.profile_id);
    };
    fetchProfile();
  }, [user]);

  const stats = calculateSessionStats(events);
  const isActive = session?.is_active === true;

  // Weather polling moved to ActiveSessionShell (prompt 147 §2).


  // Active-only handlers (catch/blank/change saved, implicit-change, end-session
  // confirm + syncing complete + outreach check, weather polling) all moved to
  // ActiveSessionShell. DiaryEntry is now completed-view only after the early
  // `if (isActive) return <ActiveSessionShell />` bail above. (prompt 147 §2)

  function handleDeleteSession() {
    if (!id) return;
    if (profile?.confirm_delete_enabled === false) {
      void doDelete();
    } else {
      setDeleteConfirmOpen(true);
    }
  }

  async function doDelete() {
    if (!id) return;
    setDeleting(true);
    // Soft-undo: snapshot the session id, navigate immediately, defer the
    // actual DELETE by 8s. Tapping Undo cancels the timer and returns the
    // user to the timeline (the row is still in the DB, never went away).
    const sessionId = id;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        await deleteSession(sessionId);
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete");
      }
    }, 8000);
    setDeleting(false);
    setDeleteConfirmOpen(false);
    navigate("/diary");
    toast("Session deleted.", {
      duration: 8000,
      action: {
        label: "UNDO",
        onClick: () => {
          cancelled = true;
          window.clearTimeout(timer);
          toast.success("Restored.");
          navigate(`/diary/${sessionId}`);
        },
      },
    });
  }

  // --- Helpers ---

  function humaniseKey(k: string): string {
    return k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').toLowerCase().trim()
            .replace(/^./, c => c.toUpperCase());
  }

  function formatChangeTo(change_to: any): string {
    if (!change_to || typeof change_to !== 'object') return 'Setup change';
    if (change_to.fly_pattern || change_to.fly) {
      const pattern = change_to.fly_pattern ?? (typeof change_to.fly === 'string' ? change_to.fly : change_to.fly?.pattern);
      const size = change_to.fly_size ?? change_to.size ?? change_to.fly?.size;
      const pos = change_to.position;
      return [pos && `${pos}:`, pattern, size && `#${size}`].filter(Boolean).join(' ') || 'Setup change';
    }
    if (change_to.leader) return `Leader: ${change_to.leader}`;
    if (change_to.venue) return `Venue: ${change_to.venue}`;
    const KNOWN_KEYS = ['style', 'rig', 'line_type', 'line', 'retrieve', 'spot', 'depth_zone', 'lineProfile', 'rodWeight', 'flyCount'];
    const parts: string[] = [];
    for (const k of KNOWN_KEYS) {
      const v = change_to[k];
      if (v == null) continue;
      if (typeof v === 'object') continue;
      parts.push(`${humaniseKey(k)}: ${v}`);
    }
    return parts.length ? parts.join(' · ') : 'Setup change';
  }

  function formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatDuration(mins: number | null): string {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }
  if (!session) {
    const headline =
      loadError === "not_found" ? "Session not found" :
      loadError === "bad_id"    ? "Invalid session link" :
                                  "Couldn't load session";
    const body =
      loadError === "not_found" ? "This session doesn't exist or has been deleted." :
      loadError === "bad_id"    ? "The link doesn't look right." :
                                  "Please try again — if it keeps failing, check your connection.";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-medium">{headline}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>
          <Button onClick={() => navigate("/diary")}>Back to diary</Button>
        </div>
      </div>
    );
  }

  // Active session: hand off to ActiveSessionShell which owns phase routing,
  // EndPill persistence, and end-session ceremony (prompt 143).
  if (isActive) {
    return (
      <ActiveSessionShell
        session={session}
        events={events}
        currentSetup={currentSetup}
        setCurrentSetup={setCurrentSetup}
        latestWeather={latestWeather}
        setLatestWeather={setLatestWeather}
        lastSpecies={lastSpecies}
        reloadData={loadData}
        activeRodIndex={activeRodIndex}
        setActiveRodIndex={setActiveRodIndex}
        venueId={venueId}
        isOnline={isOnline}
      />
    );
  }

  const bgClass = "bg-background";
  const mutedClass = "text-muted-foreground";

  // Display weather (completed view only)
  const displayWeather = {
    temp: session.weather_temp,
    windText: session.weather_wind_speed
      ? `${session.weather_wind_speed}mph ${session.weather_wind_dir || ""}`
      : null,
    conditions: session.weather_conditions,
    isLive: false,
  };

  return (
    <div className={cn("min-h-screen pb-32", bgClass)}>
      <>
      <div className="max-w-[420px] mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/diary")}
            className={isActive ? "text-[#8BA3BB] hover:text-[#E8EFF5]" : ""}
            aria-label="Back to diary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold font-diary">{session.venue_name}</h1>
            <p className={cn("text-sm", mutedClass)}>
              {formatDate(session.session_date)}
              {session.fishing_type && ` · ${session.fishing_type}`}
              {isActive && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-diary-catch animate-pulse" />
                  <span className="text-xs text-diary-catch">Live</span>
                </span>
              )}
            </p>
          </div>
          {/* Notable Fish + Share buttons (completed sessions only) */}
          {!isActive && profileId && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setNotablePrefill(null);
                  setNotableOpen(true);
                }}
                className="shrink-0 text-[#F59E0B]"
                title="Submit Notable Fish"
                aria-label="Submit notable fish"
              >
                <Trophy className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareOpen(true)}
                className="shrink-0"
                title="Share to group"
                aria-label="Share session"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Weather bar */}
        {(displayWeather.temp != null || displayWeather.windText) && (
          <div className={cn(
            "flex items-center gap-4 text-xs px-3 py-2 rounded-md",
            isActive ? "bg-[#162230]" : "bg-muted/50"
          )}>
            {displayWeather.temp != null && (
              <span className="flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5" /> {displayWeather.temp}°C
              </span>
            )}
            {displayWeather.windText && (
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" /> {displayWeather.windText}
              </span>
            )}
            {displayWeather.conditions && (
              <span>{displayWeather.conditions}</span>
            )}
            {displayWeather.isLive && (
              <span className="ml-auto text-[10px] text-diary-catch/60">Live</span>
            )}
          </div>
        )}

        {/* Current setup banner (active only) */}
        {isActive && currentSetup.style && (
          <div className="bg-[#162230] rounded-md p-3 text-xs space-y-1">
            <p className="text-[#5A7A95] uppercase tracking-wider text-[10px] mb-1">Current Setup</p>
            <p>{[currentSetup.style, currentSetup.rig].filter(Boolean).join(" · ")}</p>
            <p className="text-[#8BA3BB]">
              {[currentSetup.line_type, currentSetup.retrieve, currentSetup.spot].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className={cn(
          "grid grid-cols-4 gap-2 text-center",
          isActive ? "bg-[#162230] rounded-md p-3" : "bg-muted/30 rounded-md p-3"
        )}>
          <div>
            <p className="text-xl font-mono font-bold text-diary-catch">{stats.totalFish}</p>
            <p className={cn("text-xs", mutedClass)}>Fish</p>
          </div>
          <div>
            <p className={cn("text-xl font-mono font-bold", mutedClass)}>{stats.totalBlanks}</p>
            <p className={cn("text-xs", mutedClass)}>Blanks</p>
          </div>
          <div>
            <p className="text-xl font-mono font-bold text-diary-change">{stats.totalChanges}</p>
            <p className={cn("text-xs", mutedClass)}>Changes</p>
          </div>
          <div>
            <p className="text-xl font-mono font-bold">
              {formatDuration(session.duration_minutes)}
            </p>
            <p className={cn("text-xs", mutedClass)}>Duration</p>
          </div>
        </div>

        {/* Rig block — paper-100 band with current setup (completed sessions only) */}
        {!isActive && (currentSetup.style || currentSetup.line_type || currentSetup.rig) && (
          <div
            className="rounded-md p-3 space-y-1.5 border-l-4"
            style={{
              background: "var(--paper-100, hsl(var(--muted) / 0.4))",
              borderLeftColor: "var(--ink-300, hsl(var(--border)))",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
              Rod 1
            </p>
            <p className="text-sm font-medium font-diary leading-snug">
              {[currentSetup.style, currentSetup.rig, currentSetup.line_type]
                .filter(Boolean)
                .join(" · ") || "Setup not recorded"}
            </p>
            {currentSetup.flies_on_cast && (
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {formatFliesOnCast(currentSetup.flies_on_cast)}
              </p>
            )}
            {(currentSetup.retrieve || currentSetup.spot || currentSetup.depth_zone) && (
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80 font-medium">
                {[currentSetup.retrieve, currentSetup.spot, currentSetup.depth_zone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* Satisfaction (completed only) */}
        {!isActive && session.satisfaction_score && (
          <div className="flex items-center gap-2 justify-center">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-5 w-5",
                  i < session.satisfaction_score!
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted"
                )}
              />
            ))}
          </div>
        )}


        {/* Tab bar */}
        <div className="flex gap-1">
          {(["timeline", "fish", "stats"] as ViewTab[]).map((t) => (
            <Button
              key={t}
              variant={tab === t ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex-1 capitalize min-h-[40px]",
                isActive && tab !== t && "text-[#8BA3BB]"
              )}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "timeline" && (
          <div className="space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <p className={mutedClass}>No events yet</p>
                {isActive && (
                  <p className={cn("text-xs mt-1", mutedClass)}>
                    Use the buttons below to log catches, blanks, or changes
                  </p>
                )}
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "rounded-md p-3 text-sm cursor-pointer transition-colors",
                    isActive ? "bg-[#162230] hover:bg-[#1E3044]" : "bg-muted/30 hover:bg-muted/50",
                    event.event_type === "catch" && "border-l-4 border-l-diary-catch",
                    event.event_type === "blank" && "border-l-4 border-l-diary-blank",
                    event.event_type === "change" && "border-l-4 border-l-diary-change",
                    event.event_type === "got_away" && "border-l-4 border-l-diary-gotaway",
                  )}
                  onClick={() => setExpandedEvent(
                    expandedEvent === event.id ? null : event.id
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-mono shrink-0", mutedClass)}>
                      {formatTime(event.event_time)}
                    </span>

                    {event.event_type === "catch" && (
                      <>
                        <Fish className="h-4 w-4 text-diary-catch shrink-0" />
                        <span className="font-medium">
                          {event.species} {event.weight_display}
                        </span>
                        {event.fly_pattern && (
                          <span className={cn("text-xs truncate", mutedClass)}>
                            · {event.fly_pattern} #{event.fly_size}
                          </span>
                        )}
                        {event.is_best_fish && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                        )}
                      </>
                    )}

                    {event.event_type === "blank" && (
                      <>
                        <Circle className="h-4 w-4 text-diary-blank shrink-0" />
                        <span>Blank</span>
                        {event.blank_confidence && (
                          <span className={cn("text-xs", mutedClass)}>
                            [{event.blank_confidence}]
                          </span>
                        )}
                      </>
                    )}

                    {event.event_type === "change" && (
                      <>
                        <RefreshCw className="h-4 w-4 text-diary-change shrink-0" />
                        <span className="truncate">{formatChangeTo(event.change_to)}</span>
                      </>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {expandedEvent === event.id && (
                    <div className={cn("mt-2 pt-2 border-t text-xs space-y-1", isActive ? "border-[#2A4055]" : "border-border")}>
                      {event.style && <p>Style: {event.style}</p>}
                      {event.rig && <p>Rig: {event.rig}</p>}
                      {event.line_type && <p>Line: {event.line_type}</p>}
                      {event.retrieve && <p>Retrieve: {event.retrieve}</p>}
                      {event.spot && <p><MapPin className="h-3 w-3 inline" /> {event.spot}</p>}
                      {event.depth_zone && <p>Depth: {event.depth_zone}</p>}
                      {event.rig_position && <p>Position: {event.rig_position}</p>}
                      {event.blank_reason && <p>Reason: {event.blank_reason}</p>}
                      {event.change_reason && <p>Reason: {event.change_reason}</p>}
                      {event.notes && (
                        <div
                          className="mt-2 px-3 py-2 rounded-sm border-l-2 italic text-[13px] leading-relaxed text-foreground/80"
                          style={{
                            background: "var(--paper-100, hsl(var(--muted) / 0.5))",
                            borderLeftColor: "var(--ink-300, hsl(var(--border)))",
                          }}
                        >
                          “{event.notes}”
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "fish" && (
          <div className="space-y-3">
            {events.filter((e) => e.event_type === "catch").length === 0 ? (
              <p className={cn("text-center py-8 text-sm", mutedClass)}>No fish caught yet</p>
            ) : (
              events
                .filter((e) => e.event_type === "catch")
                .map((event) => (
                  <Card key={event.id} className={isActive ? "bg-[#162230] border-[#2A4055]" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Fish className="h-4 w-4 text-diary-catch" />
                            <span className="font-medium">{event.species}</span>
                            <span className="font-mono font-bold">{event.weight_display}</span>
                            {event.is_best_fish && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <p className={cn("text-xs mt-1", mutedClass)}>
                            {event.fly_pattern} #{event.fly_size}
                          </p>
                          <p className={cn("text-xs", mutedClass)}>
                            {[event.rig_position, event.retrieve, event.line_type]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className={cn("text-xs", mutedClass)}>
                            {event.spot && `${event.spot} · `}
                            {formatTime(event.event_time)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotablePrefill(event.species || null);
                            setNotableOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                          title="Submit as notable fish"
                        >
                          <Trophy className="h-4 w-4 text-muted-foreground hover:text-[#F59E0B] transition-colors" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-4">
            {/* Species breakdown */}
            {Object.keys(stats.species).length > 0 && (
              <Card className={isActive ? "bg-[#162230] border-[#2A4055]" : ""}>
                <CardContent className="p-4">
                  <p className={cn("text-xs uppercase tracking-wider mb-2", mutedClass)}>Species</p>
                  {Object.entries(stats.species).map(([species, count]) => (
                    <div key={species} className="flex justify-between text-sm">
                      <span>{species}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Flies breakdown */}
            {Object.keys(stats.flies).length > 0 && (
              <Card className={isActive ? "bg-[#162230] border-[#2A4055]" : ""}>
                <CardContent className="p-4">
                  <p className={cn("text-xs uppercase tracking-wider mb-2", mutedClass)}>Flies</p>
                  {Object.entries(stats.flies)
                    .sort(([, a], [, b]) => b - a)
                    .map(([fly, count]) => (
                      <div key={fly} className="flex justify-between text-sm">
                        <span className="truncate mr-2">{fly}</span>
                        <span className="font-mono shrink-0">{count}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Methods breakdown */}
            {Object.keys(stats.styles).length > 0 && (
              <Card className={isActive ? "bg-[#162230] border-[#2A4055]" : ""}>
                <CardContent className="p-4">
                  <p className={cn("text-xs uppercase tracking-wider mb-2", mutedClass)}>Methods</p>
                  {Object.entries(stats.styles)
                    .sort(([, a], [, b]) => b - a)
                    .map(([style, count]) => (
                      <div key={style} className="flex justify-between text-sm">
                        <span>{style}</span>
                        <span className="font-mono">{count}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Session notes */}
            {session.notes && (
              <Card className={isActive ? "bg-[#162230] border-[#2A4055]" : ""}>
                <CardContent className="p-4">
                  <p className={cn("text-xs uppercase tracking-wider mb-2", mutedClass)}>Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Plan */}
            {session.plan && (
              <Card className={isActive ? "bg-[#162230] border-[#2A4055]" : ""}>
                <CardContent className="p-4">
                  <p className={cn("text-xs uppercase tracking-wider mb-2", mutedClass)}>Plan</p>
                  <p className="text-sm">{session.plan}</p>
                </CardContent>
              </Card>
            )}

          </div>
        )}

        {/* Delete button — visible on every tab of a completed session.
            Active sessions use ActiveSessionShell's End-session flow instead. */}
        {!isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive w-full mt-4"
            onClick={handleDeleteSession}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete Session
          </Button>
        )}

        {/* End Session button + FAB removed (active session uses ActiveSessionShell). */}
      </div>

      </>

      {/* Modals for catch / blank / lost / change / rod / end-session are now
          mounted by ActiveSessionShell (prompt 143). VenueOutreachDialog is
          mounted by the shell too. The remaining dialogs below are completed-
          view only (Share, NotableFish, Delete). */}

      {/* Share Session Dialog */}
      {profileId && session && (
        <ShareSessionDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          sessionId={id!}
          venueName={session.venue_name}
          sessionDate={session.session_date}
          venueId={venueId}
          events={events}
          weatherTemp={session.weather_temp}
          weatherWind={session.weather_wind_speed ? `${session.weather_wind_speed}mph ${session.weather_wind_dir || ""}` : null}
          weatherConditions={session.weather_conditions}
          method={session.fishing_type}
          profileId={profileId}
        />
      )}

      {/* Notable Fish Dialog */}
      {user && session && (
        <NotableFishDialog
          open={notableOpen}
          onOpenChange={setNotableOpen}
          sessionId={id!}
          userId={user.id}
          venueId={venueId}
          venueName={session.venue_name}
          prefillSpecies={notablePrefill}
        />
      )}

      {/* VenueOutreachDialog now mounted inside ActiveSessionShell (prompt 143). */}

      {/* Delete-session confirm dialog (rust-accented) */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(o) => !deleting && setDeleteConfirmOpen(o)}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle
              className="font-diary"
              style={{ color: "var(--rust-700, hsl(var(--destructive)))" }}
            >
              Delete this session?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">
                {session?.venue_name} · {formatDate(session?.session_date ?? "")}
              </span>
              <br />
              {stats.totalFish > 0 ? `${stats.totalFish} fish` : "No fish"}
              {stats.totalBlanks > 0 ? ` · ${stats.totalBlanks} blank${stats.totalBlanks !== 1 ? "s" : ""}` : ""}
              {events.length > 0 ? ` · ${events.length} event${events.length !== 1 ? "s" : ""}` : ""}
            </p>
            <p className="text-xs uppercase tracking-[0.14em] font-semibold text-muted-foreground">
              Cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 min-h-[44px]"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 min-h-[44px]"
                onClick={doDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
            <button
              type="button"
              className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors block mx-auto pt-1"
              onClick={() => {
                setDeleteConfirmOpen(false);
                navigate("/settings");
              }}
            >
              Turn off in Settings ›
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
