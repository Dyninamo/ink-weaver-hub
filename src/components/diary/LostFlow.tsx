// Full-screen Lost-fish phase. Replaces LostModal — same content, no Dialog.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { addEvent, type CurrentSetup } from "@/services/diaryService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logEvent } from "@/services/eventLogger";

// RN canonical 3 stages (per prompt 149 §1). Causes (throwing_hook / bite_off /
// snag) are captured as free-text notes. Historic rows with the old vocabulary
// stay as-is; this change is forward-only.
const STAGES = [
  { value: "on_take", label: "On the take" },
  { value: "during_fight", label: "During the fight" },
  { value: "at_net", label: "At the net" },
] as const;

interface Props {
  sessionId: string;
  currentSetup: CurrentSetup;
  eventCount: number;
  latestWeather?: any;
  onCancel: () => void;
  onSaved: () => void;
}

export default function LostFlow({
  sessionId, currentSetup, eventCount, latestWeather, onCancel, onSaved,
}: Props) {
  const [stage, setStage] = useState<string | null>(null);
  const [flyPos, setFlyPos] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const positions = useMemo(() => {
    const f = currentSetup.flies_on_cast;
    if (!f || typeof f !== "object") return [];
    return Object.keys(f).filter((k) => f[k]);
  }, [currentSetup.flies_on_cast]);

  const isMultiFly = positions.length > 1;

  useEffect(() => {
    headingRef.current?.focus();
    setFlyPos(isMultiFly ? "unsure" : positions[0] ?? null);
  }, [isMultiFly, positions]);

  const canSave = stage !== null;
  const flyUnknown = flyPos === "unsure" || flyPos === null;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const fliesObj = currentSetup.flies_on_cast as any;
      const flyEntry = flyUnknown || !flyPos || !fliesObj ? null : fliesObj[flyPos] ?? null;
      const flyPattern = flyEntry?.pattern ?? null;

      await addEvent({
        session_id: sessionId,
        event_type: "got_away",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        got_away_stage: stage!,
        fly_pattern: flyPattern,
        // @ts-ignore
        fly_position_unknown: flyUnknown,
        style: currentSetup.style,
        rig: currentSetup.rig,
        line_type: currentSetup.line_type,
        retrieve: currentSetup.retrieve,
        flies_on_cast: currentSetup.flies_on_cast,
        spot: currentSetup.spot,
        depth_zone: currentSetup.depth_zone,
        event_temp: latestWeather?.temp ?? null,
        event_wind_speed: latestWeather?.wind_speed ?? null,
        event_wind_dir: latestWeather?.wind_dir ?? null,
        event_pressure: latestWeather?.pressure ?? null,
        event_conditions: latestWeather?.conditions ?? null,
      } as any);
      logEvent("session.lost", { session_id: sessionId, stage, fly_unknown: flyUnknown }, sessionId);
      toast.success("Lost fish logged");
      onSaved();
    } catch (err: any) {
      logEvent("error", { context: "lost_save", message: err?.message ?? String(err) }, sessionId);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[440px] mx-auto p-4 space-y-5 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-2 -ml-2" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold font-diary">
          Lost a fish
        </h2>
      </div>

      <div>
        <p className="smallcaps mb-2">At what stage?</p>
        <div className="grid grid-cols-2 gap-2">
          {STAGES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStage(s.value)}
              className="event-chip"
              data-active={stage === s.value}
              data-tone="lost"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {positions.length > 0 && (
        <div>
          <p className="smallcaps mb-2">On which fly?</p>
          <div className="grid grid-cols-2 gap-2">
            {positions.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setFlyPos(pos)}
                className="event-chip"
                data-active={flyPos === pos}
                data-tone="lost"
              >
                {pos}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFlyPos("unsure")}
              className={cn("event-chip col-span-2")}
              data-active={flyPos === "unsure"}
              data-tone="lost"
            >
              Unsure
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!canSave || saving}
        onClick={handleSave}
        className="event-cta w-full"
        data-tone="lost"
        data-active={canSave}
      >
        {canSave ? (
          <span className="flex flex-col items-center leading-tight">
            <span>Log lost · {stage!.replace(/_/g, " ")}</span>
            {positions.length > 0 && (
              <span className="text-[11px] opacity-80 mt-0.5">
                {flyUnknown ? "Fly unknown" : flyPos}
              </span>
            )}
          </span>
        ) : (
          "Pick stage"
        )}
      </button>
    </div>
  );
}
