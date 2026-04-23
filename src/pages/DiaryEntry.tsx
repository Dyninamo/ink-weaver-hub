// TODO: inline event editing (tap event → field picker in-row). Deferred — Round 4 polish.
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Fish, Circle, RefreshCw, Clock, Star, MapPin,
  Thermometer, Wind, StopCircle, Trash2, Share2, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CatchModal from "@/components/diary/CatchModal";
import ShareSessionDialog from "@/components/social/ShareSessionDialog";
import NotableFishDialog from "@/components/social/NotableFishDialog";
import VenueOutreachDialog from "@/components/diary/VenueOutreachDialog";
import { supabase } from "@/integrations/supabase/client";
import BlankModal from "@/components/diary/BlankModal";
import LostModal from "@/components/diary/LostModal";
import ChangeSetupModal from "@/components/diary/ChangeSetupModal";
import ChangeWhatPicker, { type ChangeField } from "@/components/diary/ChangeWhatPicker";
import LineCascadePrompt from "@/components/diary/LineCascadePrompt";
import RodPickerSheet, { type SessionRod } from "@/components/diary/RodPickerSheet";
import ReadyView from "@/components/diary/ReadyView";
import CoachBanner from "@/components/diary/CoachBanner";
import EndSessionView from "@/components/diary/EndSessionView";
import EndSessionConfirm from "@/components/diary/EndSessionConfirm";
import EndSessionSyncing from "@/components/diary/EndSessionSyncing";
import {
  getSession,
  getSessionEvents,
  endSession,
  deleteSession,
  calculateSessionStats,
  formatWeight,
  pollSessionWeather,
  type FishingSession,
  type SessionEvent,
  type CurrentSetup,
  type WeatherSnapshot,
} from "@/services/diaryService";

type ViewTab = "timeline" | "fish" | "stats";

export default function DiaryEntry() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
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

  // Carry-forward state for catch modal
  const [lastSpecies, setLastSpecies] = useState<string | null>(null);
  const [lastRigPosition, setLastRigPosition] = useState<string | null>(null);
  const [lastFlySize, setLastFlySize] = useState<number | null>(null);

  // Modal state
  const [catchOpen, setCatchOpen] = useState(false);
  const [blankOpen, setBlankOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [whatPickerOpen, setWhatPickerOpen] = useState(false);
  const [lineCascadeOpen, setLineCascadeOpen] = useState(false);
  const [rodPickerOpen, setRodPickerOpen] = useState(false);
  const [activeRodIndex, setActiveRodIndex] = useState<number>(1);
  // 3-phase end-session flow: confirm → syncing → ended (null = not in flow)
  type EndPhase = "confirm" | "syncing" | "ended";
  const [endPhase, setEndPhase] = useState<EndPhase | null>(null);
  const [implicitChangePrompt, setImplicitChangePrompt] = useState<{
    newSetup: CurrentSetup;
  } | null>(null);

  // Online/offline awareness for the syncing screen
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Expanded events
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [latestWeather, setLatestWeather] = useState<WeatherSnapshot | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [notableOpen, setNotableOpen] = useState(false);
  const [notablePrefill, setNotablePrefill] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachEmail, setOutreachEmail] = useState<string | null>(null);
  const outreachChecked = useRef(false);

  // After ending an active session, show the editorial "wrap" screen.
  // Distinct from `isActive=false` for older completed sessions loaded directly.
  const [justEnded, setJustEnded] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          flies_on_cast: lastSetupEvent.flies_on_cast,
          spot: lastSetupEvent.spot,
          depth_zone: lastSetupEvent.depth_zone,
        });
      }

      // Derive carry-forward from most recent catch
      const lastCatch = setupEvents.find((ev) => ev.event_type === "catch");
      if (lastCatch) {
        setLastSpecies(lastCatch.species);
        setLastRigPosition(lastCatch.rig_position);
        setLastFlySize(lastCatch.fly_size);
      }
    } catch (err: any) {
      toast.error("Failed to load session");
      console.error(err);
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

  // Weather polling — every 15 minutes while session is active
  useEffect(() => {
    if (!id || !isActive) return;
    let mounted = true;

    async function poll() {
      const snapshot = await pollSessionWeather(id!);
      if (mounted && snapshot) setLatestWeather(snapshot);
    }

    poll(); // immediate first poll on mount
    const interval = setInterval(poll, 15 * 60 * 1000); // then every 15 min

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id, isActive]);

  // --- Event handlers ---

  function handleCatchSaved(event: any, setupChanged?: boolean, newSetup?: CurrentSetup) {
    if (event.species) setLastSpecies(event.species);
    if (event.rig_position) setLastRigPosition(event.rig_position);
    if (event.fly_size) setLastFlySize(event.fly_size);

    if (setupChanged && newSetup) {
      setImplicitChangePrompt({ newSetup });
    }

    loadData();
    if (id) pollSessionWeather(id).then(s => s && setLatestWeather(s));
  }

  function handleBlankSaved() {
    loadData();
    if (id) pollSessionWeather(id).then(s => s && setLatestWeather(s));
  }

  function handleChangeSaved(_event: any, newSetup: CurrentSetup) {
    const lineChanged = currentSetup.line_type !== newSetup.line_type && !!newSetup.line_type;
    setCurrentSetup(newSetup);
    loadData();
    if (id) pollSessionWeather(id).then(s => s && setLatestWeather(s));
    // After a line change, prompt the leader/flies cascade
    if (lineChanged) {
      // Defer so the change modal closes first
      setTimeout(() => setLineCascadeOpen(true), 200);
    }
  }

  async function handleImplicitChangeAccept() {
    if (!implicitChangePrompt || !id) return;
    const { addEvent: addEv } = await import("@/services/diaryService");
    await addEv({
      session_id: id,
      event_type: "change",
      event_time: new Date().toISOString(),
      sort_order: events.length + 1,
      change_from: { line_type: currentSetup.line_type },
      change_to: { line_type: implicitChangePrompt.newSetup.line_type },
      change_reason: "Implicit — detected from catch entry",
      style: implicitChangePrompt.newSetup.style || currentSetup.style,
      rig: implicitChangePrompt.newSetup.rig || currentSetup.rig,
      line_type: implicitChangePrompt.newSetup.line_type,
      retrieve: implicitChangePrompt.newSetup.retrieve || currentSetup.retrieve,
      spot: currentSetup.spot,
      depth_zone: currentSetup.depth_zone,
    });
    setCurrentSetup({ ...currentSetup, ...implicitChangePrompt.newSetup });
    setImplicitChangePrompt(null);
    loadData();
  }

  // Fired from EndSessionConfirm "End session" button.
  // Kicks off the DB write (fire-and-forget) and advances to the syncing screen.
  function handleConfirmEnd() {
    if (!id) return;
    void endSession(id, {}).catch((err) => {
      console.error("endSession failed:", err);
      toast.error(err?.message || "Failed to end session");
    });
    setEndPhase("syncing");
  }

  // Fired from EndSessionSyncing onComplete. Reloads session, runs the
  // venue-outreach eligibility check, then either opens the outreach
  // dialog or advances to the EndSessionView.
  async function handleSyncingComplete() {
    if (!id) {
      setEndPhase("ended");
      return;
    }

    // Refresh the session row so EndSessionView sees end_time / duration_minutes.
    await loadData();

    if (venueId && !outreachChecked.current) {
      outreachChecked.current = true;
      try {
        const { data: optedOut } = await supabase
          .from("venue_outreach")
          .select("outreach_id")
          .eq("venue_id", venueId)
          .eq("status", "opted_out")
          .limit(1)
          .maybeSingle();

        if (!optedOut) {
          const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
          const { data: recentSend } = await supabase
            .from("venue_outreach")
            .select("outreach_id")
            .eq("venue_id", venueId)
            .eq("status", "sent")
            .gte("sent_at", ninetyDaysAgo)
            .limit(1)
            .maybeSingle();

          if (!recentSend) {
            const { data: venueData } = await supabase
              .from("venues_new")
              .select("contact_email")
              .eq("venue_id", venueId)
              .single();

            setOutreachEmail(venueData?.contact_email || null);
            setOutreachOpen(true);
            // Outreach dialog will toast on close — fall through to ended view behind it.
          }
        }
      } catch (err) {
        console.warn("Outreach check failed (non-critical):", err);
      }
    }

    setJustEnded(true);
    setEndPhase("ended");
  }

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
    try {
      await deleteSession(id);
      toast.success("Session deleted");
      navigate("/diary");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  // --- Helpers ---

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

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  // 3-phase end-session flow takes over the page (shell tab bar stays visible).
  if (endPhase === "confirm") {
    return (
      <EndSessionConfirm
        session={session}
        events={events}
        activeRod={{
          rodWeight: (session as any).rod_weight ?? null,
          rodLengthFt: (session as any).rod_length_ft ?? null,
          line: (session as any).line_profile ?? null,
        }}
        onCancel={() => setEndPhase(null)}
        onConfirm={handleConfirmEnd}
      />
    );
  }
  if (endPhase === "syncing") {
    return (
      <EndSessionSyncing
        isOnline={isOnline}
        onComplete={() => {
          void handleSyncingComplete();
        }}
      />
    );
  }

  const bgClass = isActive ? "bg-[#0F1A24] text-[#E8EFF5]" : "bg-background";
  const mutedClass = isActive ? "text-[#8BA3BB]" : "text-muted-foreground";

  // Display weather: prefer live polled data for active sessions
  const displayWeather = isActive && latestWeather
    ? {
        temp: latestWeather.temp,
        windText: `${latestWeather.wind_speed}mph ${latestWeather.wind_dir}`,
        conditions: latestWeather.conditions || null,
        isLive: true,
      }
    : {
        temp: session.weather_temp,
        windText: session.weather_wind_speed
          ? `${session.weather_wind_speed}mph ${session.weather_wind_dir || ""}`
          : null,
        conditions: session.weather_conditions,
        isLive: false,
      };

  return (
    <div className={cn("min-h-screen pb-32", isActive ? "almanack-surface" : bgClass)}>
      {justEnded && session && !isActive ? (
        <EndSessionView
          session={session}
          events={events}
          anglerName={(session as any).angler_name ?? null}
        />
      ) : isActive ? (
        <div className="max-w-[440px] mx-auto">
          <CoachBanner />
          <ReadyView
            session={session}
            events={events}
            currentSetup={currentSetup}
            onCatch={() => setCatchOpen(true)}
            onLost={() => setLostOpen(true)}
            onBlank={() => setBlankOpen(true)}
            onChange={() => setWhatPickerOpen(true)}
            onEndSession={() => setEndPhase("confirm")}
          />
        </div>
      ) : (
      <>
      <div className="max-w-[420px] mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/diary")}
            className={isActive ? "text-[#8BA3BB] hover:text-[#E8EFF5]" : ""}
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
              >
                <Trophy className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareOpen(true)}
                className="shrink-0"
                title="Share to group"
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
                {Object.values(currentSetup.flies_on_cast as Record<string, string>)
                  .filter(Boolean)
                  .join(" · ")}
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
                        <span className="truncate">
                          {event.change_to
                            ? Object.entries(event.change_to as Record<string, any>)
                                .map(([, v]) => `${v}`)
                                .join(" · ")
                            : "Setup change"}
                        </span>
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

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive w-full"
              onClick={handleDeleteSession}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Session
            </Button>
          </div>
        )}

        {/* End Session button (active only) */}
        {isActive && (
          <Button
            variant="outline"
            className="w-full min-h-[44px] border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => setEndPhase("confirm")}
          >
            <StopCircle className="h-4 w-4 mr-2" /> End Session
          </Button>
        )}
      </div>

      {/* ============================================================ */}
      {/* FLOATING ACTION BUTTONS (active session only)                */}
      {/* ============================================================ */}
      {isActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-50">
          <Button
            size="lg"
            className="rounded-full h-14 px-6 bg-diary-catch hover:bg-diary-catch/90 shadow-lg"
            onClick={() => setCatchOpen(true)}
          >
            <Fish className="h-5 w-5 mr-2" /> Catch
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full h-14 px-6 bg-[#162230] border-[#2A4055] text-[#8BA3BB] hover:bg-[#1E3044] shadow-lg"
            onClick={() => setBlankOpen(true)}
          >
            <Circle className="h-5 w-5 mr-2" /> Blank
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full h-14 px-5 bg-[#162230] border-diary-change/30 text-diary-change hover:bg-[#1E3044] shadow-lg"
            onClick={() => setWhatPickerOpen(true)}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      )}
      </>
      )}

      {/* ============================================================ */}
      {/* MODALS                                                        */}
      {/* ============================================================ */}

      <CatchModal
        open={catchOpen}
        onClose={() => setCatchOpen(false)}
        sessionId={id!}
        venueType={session.venue_type as "stillwater" | "river"}
        venueName={session.venue_name}
        currentSetup={currentSetup}
        lastSpecies={lastSpecies}
        lastRigPosition={lastRigPosition}
        lastFlySize={lastFlySize}
        eventCount={events.length}
        onSaved={handleCatchSaved}
        latestWeather={latestWeather}
      />

      <BlankModal
        open={blankOpen}
        onClose={() => setBlankOpen(false)}
        sessionId={id!}
        currentSetup={currentSetup}
        eventCount={events.length}
        onSaved={handleBlankSaved}
        onChangeFirst={() => {
          setBlankOpen(false);
          setWhatPickerOpen(true);
        }}
        latestWeather={latestWeather}
      />

      <LostModal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        sessionId={id!}
        currentSetup={currentSetup}
        eventCount={events.length}
        onSaved={() => {
          loadData();
          if (id) pollSessionWeather(id).then(s => s && setLatestWeather(s));
        }}
        latestWeather={latestWeather}
      />

      <ChangeSetupModal
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        sessionId={id!}
        venueType={session.venue_type as "stillwater" | "river"}
        venueName={session.venue_name}
        currentSetup={currentSetup}
        eventCount={events.length}
        onSaved={handleChangeSaved}
        latestWeather={latestWeather}
      />

      {/* Change · what picker */}
      <ChangeWhatPicker
        open={whatPickerOpen}
        onClose={() => setWhatPickerOpen(false)}
        onPick={(field: ChangeField) => {
          setWhatPickerOpen(false);
          if (field === "rod") {
            setRodPickerOpen(true);
          } else if (field === "line") {
            // Line change → open Change modal, then cascade after save
            setChangeOpen(true);
          } else {
            setChangeOpen(true);
          }
        }}
      />

      {/* Change · line cascade prompt (shown after a line change is saved) */}
      <LineCascadePrompt
        open={lineCascadeOpen}
        onClose={() => setLineCascadeOpen(false)}
        newLineName={currentSetup.line_type || "new line"}
        currentLeader={currentSetup.rig}
        currentFlies={
          currentSetup.flies_on_cast
            ? Object.values(currentSetup.flies_on_cast as Record<string, string>)
                .filter(Boolean)
                .join(" · ")
            : null
        }
        onContinue={({ updateLeader, updateFlies }) => {
          setLineCascadeOpen(false);
          if (updateLeader || updateFlies) {
            // Re-open change modal so user can update the cascading bits
            setChangeOpen(true);
          }
        }}
      />

      {/* Rod picker bottom sheet */}
      <RodPickerSheet
        open={rodPickerOpen}
        onClose={() => setRodPickerOpen(false)}
        sessionId={id!}
        events={events}
        activeRodIndex={activeRodIndex}
        onSwitchRod={async (rod: SessionRod) => {
          setActiveRodIndex(rod.rod_index);
          setRodPickerOpen(false);
          // Restore that rod's setup into currentSetup
          setCurrentSetup({
            style: rod.style,
            rig: null,
            line_type: rod.line_name,
            retrieve: null,
            flies_on_cast: null,
            spot: currentSetup.spot,
            depth_zone: null,
          } as CurrentSetup);
          toast.success(`Switched to ${rod.name || `Rod ${rod.rod_index}`}`);
        }}
        onSetupNewRod={() => {
          setRodPickerOpen(false);
          // Re-uses Change modal to capture the new rod's full rig
          setChangeOpen(true);
          toast.info("Set up your new rod — it'll be added to the rod list");
        }}
      />

      {/* Implicit Change Prompt */}
      <Dialog
        open={implicitChangePrompt !== null}
        onOpenChange={(o) => !o && setImplicitChangePrompt(null)}
      >
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Update setup?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You caught that on <strong>{implicitChangePrompt?.newSetup.line_type}</strong>,
            but your setup is <strong>{currentSetup.line_type}</strong>. Update your current setup?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setImplicitChangePrompt(null)}
            >
              No, keep as is
            </Button>
            <Button
              className="flex-1 bg-diary-change hover:bg-diary-change/90"
              onClick={handleImplicitChangeAccept}
            >
              Yes, update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Session flow now handled by 3-phase EndSessionConfirm + EndSessionSyncing
          early returns above; the legacy inline form Dialog has been removed. */}

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

      {/* Venue Outreach Dialog */}
      {venueId && session && (
        <VenueOutreachDialog
          open={outreachOpen}
          onClose={() => {
            setOutreachOpen(false);
            toast.success("Session complete!");
          }}
          venueName={session.venue_name}
          venueId={venueId}
          sessionId={id!}
          contactEmail={outreachEmail}
        />
      )}


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
