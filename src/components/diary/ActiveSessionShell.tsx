// ActiveSessionShell — replaces the in-line modal mounting in DiaryEntry's
// active branch. Owns phase state, renders the EndPill at shell level so it
// persists across catch / blank / lost / change phases, and routes phases as
// full-page bodies (no Dialog overlays). Per prompt 143.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useActiveSession } from "@/contexts/ActiveSessionContext";
import {
  endSession,
  pollSessionWeather,
  type CurrentSetup,
  type FishingSession,
  type SessionEvent,
  type WeatherSnapshot,
} from "@/services/diaryService";

export type SessionPhase =
  | "ready" | "catch" | "blank" | "lost" | "change" | "rod_change"
  | "end_confirm" | "end_syncing" | "end_done";

const PHASES_WITH_PILL = new Set<SessionPhase>([
  "ready", "catch", "blank", "lost", "change", "rod_change",
]);

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
  const navigate = useNavigate();
  const { refresh: refreshActiveSession } = useActiveSession();
  const [phase, setPhase] = useState<SessionPhase>("ready");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachEmail, setOutreachEmail] = useState<string | null>(null);
  const [outreachChecked, setOutreachChecked] = useState(false);

  const sessionId = session.id!;

  function repollWeather() {
    if (!sessionId) return;
    pollSessionWeather(sessionId).then((s) => s && setLatestWeather(s));
  }

  async function handleConfirmEnd() {
    setPhase("end_syncing");
    try {
      await endSession(sessionId, {});
    } catch (err: any) {
      console.error("endSession failed:", err);
      toast.error(err?.message || "Failed to end session");
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
        />
      </>
    );
  } else if (phase === "catch") {
    body = (
      <CatchFlow
        sessionId={sessionId}
        rodIndex={Math.max(0, activeRodIndex - 1)}
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
          rodWeight: (session as any).rod_weight ?? null,
          rodLengthFt: (session as any).rod_length_ft ?? null,
          line: (session as any).line_profile ?? null,
        }}
        onCancel={() => setPhase("ready")}
        onConfirm={handleConfirmEnd}
      />
    );
  } else if (phase === "end_syncing") {
    body = (
      <EndSessionSyncing
        isOnline={isOnline}
        onComplete={() => { void handleSyncingComplete(); }}
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
    </main>
  );
}
