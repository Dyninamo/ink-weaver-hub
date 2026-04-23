import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addEvent, type CurrentSetup } from "@/services/diaryService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LostModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentSetup: CurrentSetup;
  eventCount: number;
  onSaved: (event: any) => void;
  latestWeather?: {
    temp: number;
    wind_speed: number;
    wind_dir: string;
    pressure: number;
    conditions?: string;
  } | null;
}

const STAGES = [
  { value: "on_strike", label: "On strike" },
  { value: "playing", label: "Playing" },
  { value: "at_net", label: "At the net" },
  { value: "throwing_hook", label: "Threw the hook" },
  { value: "bite_off", label: "Bite-off" },
  { value: "snag", label: "Snag" },
] as const;

export default function LostModal({
  open,
  onClose,
  sessionId,
  currentSetup,
  eventCount,
  onSaved,
  latestWeather,
}: LostModalProps) {
  const [stage, setStage] = useState<string | null>(null);
  const [flyPos, setFlyPos] = useState<string | null>(null); // "unsure" | position name
  const [saving, setSaving] = useState(false);

  // Build fly positions from currentSetup.flies_on_cast
  const positions = useMemo(() => {
    const f = currentSetup.flies_on_cast;
    if (!f || typeof f !== "object") return [];
    return Object.keys(f).filter((k) => f[k]);
  }, [currentSetup.flies_on_cast]);

  const isMultiFly = positions.length > 1;

  useEffect(() => {
    if (open) {
      setStage(null);
      // Default to "Unsure" on multi-fly rigs
      setFlyPos(isMultiFly ? "unsure" : positions[0] ?? null);
    }
  }, [open, isMultiFly, positions]);

  const canSave = stage !== null;
  const flyUnknown = flyPos === "unsure" || flyPos === null;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const fliesObj = currentSetup.flies_on_cast;
      const flyEntry =
        flyUnknown || !flyPos || !fliesObj ? null : fliesObj[flyPos] ?? null;
      const flyPattern = flyEntry?.pattern ?? null;

      const event = await addEvent({
        session_id: sessionId,
        event_type: "got_away",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        got_away_stage: stage!,
        rig_position: flyUnknown ? null : flyPos,
        fly_pattern: flyPattern,
        // @ts-ignore — column added in migration, types regenerate after
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
      toast.success("Lost fish logged");
      onSaved(event);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const ctaSubline = flyUnknown ? "Fly unknown" : flyPos;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Lost a fish</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="smallcaps">At what stage?</p>
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

          {positions.length > 0 && (
            <>
              <p className="smallcaps">On which fly?</p>
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
            </>
          )}

          <button
            type="button"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="event-cta"
            data-tone="lost"
            data-active={canSave}
          >
            {canSave ? (
              <span className="flex flex-col items-center leading-tight">
                <span>Log lost · {stage!.replace(/_/g, " ")}</span>
                {positions.length > 0 && (
                  <span className="text-[11px] opacity-80 mt-0.5">
                    {ctaSubline}
                  </span>
                )}
              </span>
            ) : (
              "Pick stage"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
