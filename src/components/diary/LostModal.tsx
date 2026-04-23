import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addEvent, type CurrentSetup } from "@/services/diaryService";
import { toast } from "sonner";

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setStage(null);
  }, [open]);

  const canSave = stage !== null;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const event = await addEvent({
        session_id: sessionId,
        event_type: "got_away",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        got_away_stage: stage!,
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
      });
      toast.success("Lost fish logged");
      onSaved(event);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

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

          <button
            type="button"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="event-cta"
            data-tone="lost"
            data-active={canSave}
          >
            {canSave
              ? `Log lost · ${stage!.replace(/_/g, " ")}`
              : "Pick stage"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
