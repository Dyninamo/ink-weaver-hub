import { useState, useEffect, useCallback } from "react";
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
  Thermometer, Wind, StopCircle, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CatchModal from "@/components/diary/CatchModal";
import BlankModal from "@/components/diary/BlankModal";
import ChangeSetupModal from "@/components/diary/ChangeSetupModal";
import {
  getSession,
  getSessionEvents,
  endSession,
  deleteSession,
  calculateSessionStats,
  formatWeight,
  type FishingSession,
  type SessionEvent,
  type CurrentSetup,
} from "@/services/diaryService";

type ViewTab = "timeline" | "fish" | "stats";

export default function DiaryEntry() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
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
  const [changeOpen, setChangeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [implicitChangePrompt, setImplicitChangePrompt] = useState<{
    newSetup: CurrentSetup;
  } | null>(null);

  // End session form
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [ending, setEnding] = useState(false);

  // Expanded events
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

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

  const stats = calculateSessionStats(events);
  const isActive = session?.is_active === true;

  // --- Event handlers ---

  function handleCatchSaved(event: any, setupChanged?: boolean, newSetup?: CurrentSetup) {
    if (event.species) setLastSpecies(event.species);
    if (event.rig_position) setLastRigPosition(event.rig_position);
    if (event.fly_size) setLastFlySize(event.fly_size);

    if (setupChanged && newSetup) {
      setImplicitChangePrompt({ newSetup });
    }

    loadData();
  }

  function handleBlankSaved() {
    loadData();
  }

  function handleChangeSaved(_event: any, newSetup: CurrentSetup) {
    setCurrentSetup(newSetup);
    loadData();
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

  async function handleEndSession() {
    if (!id) return;
    setEnding(true);
    try {
      await endSession(id, {
        satisfaction_score: satisfaction || undefined,
        would_return: wouldReturn ?? undefined,
        notes: sessionNotes || undefined,
      });
      toast.success("Session complete!");
      setEndOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to end session");
    } finally {
      setEnding(false);
    }
  }

  async function handleDeleteSession() {
    if (!id || !confirm("Delete this session and all its events? This cannot be undone.")) return;
    try {
      await deleteSession(id);
      toast.success("Session deleted");
      navigate("/diary");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
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

  const bgClass = isActive ? "bg-[#0F1A24] text-[#E8EFF5]" : "bg-background";
  const mutedClass = isActive ? "text-[#8BA3BB]" : "text-muted-foreground";

  return (
    <div className={cn("min-h-screen pb-32", bgClass)}>
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
        </div>

        {/* Weather bar */}
        {(session.weather_temp || session.weather_wind_speed) && (
          <div className={cn(
            "flex items-center gap-4 text-xs px-3 py-2 rounded-md",
            isActive ? "bg-[#162230]" : "bg-muted/50"
          )}>
            {session.weather_temp && (
              <span className="flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5" /> {session.weather_temp}°C
              </span>
            )}
            {session.weather_wind_speed && (
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" />
                {session.weather_wind_speed}mph {session.weather_wind_dir || ""}
              </span>
            )}
            {session.weather_conditions && (
              <span>{session.weather_conditions}</span>
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
                      {event.notes && <p className="italic">"{event.notes}"</p>}
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
                        <div>
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
            onClick={() => setEndOpen(true)}
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
            onClick={() => setChangeOpen(true)}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
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
          setChangeOpen(true);
        }}
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

      {/* End Session Dialog */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-diary">End Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Satisfaction */}
            <div>
              <Label>How was it?</Label>
              <div className="flex gap-2 mt-2 justify-center">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSatisfaction(satisfaction === s ? null : s)}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition-colors",
                        satisfaction && s <= satisfaction
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-muted"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Would return */}
            <div>
              <Label>Would you fish here again soon?</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={wouldReturn === true ? "default" : "outline"}
                  className="flex-1 min-h-[44px]"
                  onClick={() => setWouldReturn(wouldReturn === true ? null : true)}
                >
                  Yes
                </Button>
                <Button
                  variant={wouldReturn === false ? "default" : "outline"}
                  className="flex-1 min-h-[44px]"
                  onClick={() => setWouldReturn(wouldReturn === false ? null : false)}
                >
                  No
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Session Notes</Label>
              <Textarea
                placeholder="Reflections, conditions changes, anything noteworthy..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                rows={3}
                className="mt-1.5"
              />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
              <p>🐟 {stats.totalFish} fish caught</p>
              {stats.bestFly && <p>Best fly: {stats.bestFly}</p>}
              {stats.bestStyle && <p>Best method: {stats.bestStyle}</p>}
            </div>

            <Button
              className="w-full min-h-[48px]"
              onClick={handleEndSession}
              disabled={ending}
            >
              {ending ? "Saving..." : "Finish & Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
