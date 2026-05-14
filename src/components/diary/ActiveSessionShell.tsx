// ActiveSessionShell — replaces the in-line modal mounting in DiaryEntry's
// active branch. Owns phase state, renders the EndPill at shell level so it
// persists across catch / blank / lost / change phases, and routes phases as
// full-page bodies (no Dialog overlays). Per prompt 143.
import { useEffect, useState } from "react";
import { logEvent } from "@/services/eventLogger";
import { toast } from "sonner";
import CoachBanner from "./CoachBanner";
import ReadyView from "./ReadyView";
import EndPill from "./EndPill";
import CatchFlow from "./CatchFlow";
import BlankFlow from "./BlankFlow";
import LostFlow from "./LostFlow";
import ChangeFlow from "./ChangeFlow";
import RodPickerSheet, { type SessionRod } from "./RodPickerSheet";
import EndSessionConfirm from "./EndSessionConfirm";
import EndSessionSyncing from "./EndSessionSyncing";
import EndSessionView from "./EndSessionView";
import VenueOutreachDialog from "./VenueOutreachDialog";
import AskGhillieOverlay from "./AskGhillieOverlay";
import VenuePickerOverlay from "./VenuePickerOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSession } from "@/contexts/ActiveSessionContext";
import { acquireWakeLock, releaseWakeLock } from "@/lib/wakeLock";
import {
  endSession,
  pollSessionWeather,
  getCurrentSetup,
  type CurrentSetup,
  type FishingSession,
  type SessionEvent,
  type WeatherSnapshot,
} from "@/services/diaryService";

export type SessionPhase =
  | "ready" | "catch" | "blank" | "lost" | "change" | "rod_change"
  | "ask_ghillie" | "venue_switch"
  | "end_confirm" | "end_syncing" | "end_done";

// End-Session pill is only visible on the main menu (ready). Per prompt 183 §3.
const PHASES_WITH_PILL = new Set<SessionPhase>(["ready"]);

interface Props {
  session: FishingSession;
  events: SessionEvent[];
  currentSetup: CurrentSetup;
  setCurrentSetup: (s: CurrentSetup) => void;
  latestWeather: WeatherSnapshot | null;
  setLatestWeather: (w: WeatherSnapshot | null) => void;
  lastSpecies: string | null;
  reloadData: () => void | Promise<void>;
  activeRodIndex: number;
  setActiveRodIndex: (i: number) => void;
  venueId: string | null;
  isOnline: boolean;
}

export default function ActiveSessionShell({
  session, events, currentSetup, setCurrentSetup, latestWeather, setLatestWeather,
  lastSpecies, reloadData, activeRodIndex, setActiveRodIndex, venueId, isOnline,
}: Props) {
  
  const { refresh: refreshActiveSession } = useActiveSession();
  const [phase, setPhase] = useState<SessionPhase>("ready");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachEmail, setOutreachEmail] = useState<string | null>(null);
  const [outreachChecked, setOutreachChecked] = useState(false);
  const [endSaveDone, setEndSaveDone] = useState(false);
  const [endSaveError, setEndSaveError] = useState<string | null>(null);
  const [activeRodRow, setActiveRodRow] = useState<{
    rod_weight: number | null;
    rod_length_ft: number | null;
    line_profile: string | null;
  } | null>(null);

  const sessionId = session.id!;

  useEffect(() => {
    logEvent("session.phase_enter", { phase, sessionId }, sessionId);
  }, [phase, sessionId]);

  // Per prompt 201 §3.5 — mount/unmount events. Unmount without a session.end
  // or end-route transition means the user got bounced out mid-session.
  useEffect(() => {
    logEvent("session_shell.mounted", { sessionId }, sessionId);
    return () => logEvent("session_shell.unmounted", { sessionId }, sessionId);
  }, [sessionId]);

  useEffect(() => {
    void acquireWakeLock();
    return () => {
      void releaseWakeLock();
    };
  }, []);

  // Periodic weather repoll — without this, latestWeather is stale between events.
  // 10 minutes balances freshness vs battery; backgrounded tabs skipped.
  useEffect(() => {
    if (!sessionId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pollSessionWeather(sessionId).then((s) => s && setLatestWeather(s));
    }, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Fetch live rod row when about to confirm end-session — so the summary
  // reflects post-change line/rod state, not the original session columns.
  useEffect(() => {
    if (phase !== "end_confirm") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("session_rods" as any)
        .select("rod_weight, rod_length_ft, line_profile")
        .eq("session_id", sessionId)
        .eq("rod_index", activeRodIndex)
        .maybeSingle();
      if (!cancelled && data) setActiveRodRow(data as any);
    })();
    return () => { cancelled = true; };
  }, [phase, sessionId, activeRodIndex]);

  function repollWeather() {
    if (!sessionId) return;
    pollSessionWeather(sessionId).then((s) => s && setLatestWeather(s));
  }

  async function handleConfirmEnd() {
    setEndSaveDone(false);
    setEndSaveError(null);
    setPhase("end_syncing");
    try {
      await endSession(sessionId, {});
      setEndSaveDone(true);
    } catch (err: any) {
      console.error("endSession failed:", err);
      setEndSaveError(err?.message || "Failed to end session");
    }
    refreshActiveSession();
  }

  async function handleSyncingComplete() {
    await reloadData();

    if (venueId && !outreachChecked) {
      setOutreachChecked(true);
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
          const { data: recent } = await supabase
            .from("venue_outreach")
            .select("outreach_id")
            .eq("venue_id", venueId)
            .eq("status", "sent")
            .gte("sent_at", ninetyDaysAgo)
            .limit(1)
            .maybeSingle();
          if (!recent) {
            const { data: venueData } = await supabase
              .from("venues_new")
              .select("contact_email")
              .eq("venue_id", venueId)
              .single();
            setOutreachEmail(venueData?.contact_email || null);
            setOutreachOpen(true);
          }
        }
      } catch (err) {
        console.warn("Outreach check failed (non-critical):", err);
      }
    }
    setPhase("end_done");
  }

  // ---- Phase rendering ----

  let body: JSX.Element;
  if (phase === "ready") {
    body = (
      <>
        <CoachBanner />
        <ReadyView
          session={session}
          events={events}
          currentSetup={currentSetup}
          onCatch={() => setPhase("catch")}
          onLost={() => setPhase("lost")}
          onBlank={() => setPhase("blank")}
          onChange={() => setPhase("change")}
          onEndSession={() => setPhase("end_confirm")}
          onAskGhillie={() => setPhase("ask_ghillie")}
          onVenueGreetingTap={() => setPhase("venue_switch")}
        />
      </>
    );
  } else if (phase === "venue_switch") {
    body = (
      <VenuePickerOverlay
        sessionId={sessionId}
        currentVenueName={session.venue_name}
        onClose={() => setPhase("ready")}
        onSwitched={() => {
          setPhase("ready");
          void reloadData();
        }}
      />
    );
  } else if (phase === "ask_ghillie") {
    body = (
      <AskGhillieOverlay
        session={session}
        events={events}
        currentSetup={currentSetup}
        rodWeight={(session as any).rod_weight ?? null}
        latestWeather={latestWeather}
        onClose={() => setPhase("ready")}
      />
    );
  } else if (phase === "catch") {
    body = (
      <CatchFlow
        sessionId={sessionId}
        rodIndex={activeRodIndex}
        venueType={session.venue_type as "stillwater" | "river"}
        venueName={session.venue_name}
        defaultSpecies={lastSpecies}
        carryRetrieve={currentSetup.retrieve}
        carryDepth={currentSetup.depth_zone}
        latestWeather={latestWeather}
        onCancel={() => setPhase("ready")}
        onSaved={() => {
          setPhase("ready");
          reloadData();
          repollWeather();
        }}
      />
    );
  } else if (phase === "blank") {
    body = (
      <BlankFlow
        sessionId={sessionId}
        currentSetup={currentSetup}
        eventCount={events.length}
        latestWeather={latestWeather}
        onCancel={() => setPhase("ready")}
        onSaved={() => {
          setPhase("ready");
          reloadData();
          repollWeather();
        }}
      />
    );
  } else if (phase === "lost") {
    body = (
      <LostFlow
        sessionId={sessionId}
        currentSetup={currentSetup}
        eventCount={events.length}
        latestWeather={latestWeather}
        onCancel={() => setPhase("ready")}
        onSaved={() => {
          setPhase("ready");
          reloadData();
          repollWeather();
        }}
      />
    );
  } else if (phase === "change") {
    body = (
      <ChangeFlow
        sessionId={sessionId}
        venueType={session.venue_type as "stillwater" | "river"}
        venueName={session.venue_name}
        currentSetup={currentSetup}
        rodWeight={(session as any).rod_weight ?? null}
        eventCount={events.length}
        latestWeather={latestWeather}
        onCancel={() => setPhase("ready")}
        onPickRod={() => setPhase("rod_change")}
        onSaved={(newSetup) => {
          setCurrentSetup(newSetup);
          setPhase("ready");
          reloadData();
          repollWeather();
        }}
      />
    );
  } else if (phase === "rod_change") {
    // Mounted as a full-page phase via the existing Sheet (the Sheet still
    // works on mobile; the EndPill sits at z-60 above the sheet backdrop).
    body = (
      <RodPickerSheet
        open={true}
        onClose={() => setPhase("ready")}
        sessionId={sessionId}
        events={events}
        activeRodIndex={activeRodIndex}
        onSwitchRod={async (rod: SessionRod) => {
          setActiveRodIndex(rod.rod_index);
          // Hydrate from session_rods + events overlay (prompt 182 §3).
          const setup = await getCurrentSetup(sessionId, rod.rod_index);
          setCurrentSetup(setup);
          toast.success(`Switched to ${rod.name || `Rod ${rod.rod_index}`}`);
          setPhase("ready");
        }}
        onSetupNewRod={() => {
          setPhase("change");
          toast.info("Pick a field to update for the new rod");
        }}
      />
    );
  } else if (phase === "end_confirm") {
    body = (
      <EndSessionConfirm
        session={session}
        events={events}
        activeRod={{
          rodWeight:   activeRodRow?.rod_weight    ?? (session as any).rod_weight    ?? null,
          rodLengthFt: activeRodRow?.rod_length_ft ?? (session as any).rod_length_ft ?? null,
          line:        activeRodRow?.line_profile  ?? (session as any).line_profile  ?? null,
        }}
        onCancel={() => setPhase("ready")}
        onConfirm={handleConfirmEnd}
      />
    );
  } else if (phase === "end_syncing") {
    body = (
      <EndSessionSyncing
        isOnline={isOnline}
        serverDone={endSaveDone}
        serverError={endSaveError}
        onComplete={() => { void handleSyncingComplete(); }}
        onRetry={() => { void handleConfirmEnd(); }}
      />
    );
  } else { // end_done
    body = (
      <EndSessionView
        session={session}
        events={events}
        anglerName={(session as any).angler_name ?? null}
      />
    );
  }

  return (
    <main role="main" aria-live="polite" className="almanack-surface min-h-screen">
      <div className="max-w-[440px] mx-auto">
        {body}
      </div>
      {PHASES_WITH_PILL.has(phase) && (
        <EndPill
          onEndSession={() => setPhase("end_confirm")}
          eventCount={events.length}
        />
      )}
      {venueId && (
        <VenueOutreachDialog
          open={outreachOpen}
          onClose={() => {
            setOutreachOpen(false);
            toast.success("Session complete!");
          }}
          venueName={session.venue_name}
          venueId={venueId}
          sessionId={sessionId}
          contactEmail={outreachEmail}
        />
      )}
    </main>
  );
}
