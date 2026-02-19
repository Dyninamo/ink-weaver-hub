import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  addEvent,
  type CurrentSetup,
} from "@/services/diaryService";
import { toast } from "sonner";

interface BlankModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentSetup: CurrentSetup;
  eventCount: number;
  onSaved: (event: any) => void;
  onChangeFirst: () => void; // opens ChangeSetupModal before blank
  latestWeather?: {
    temp: number;
    wind_speed: number;
    wind_dir: string;
    pressure: number;
    conditions?: string;
  } | null;
}

const CONFIDENCE_LEVELS = [
  { value: "Dead", label: "Dead", color: "#5A6A7A" },
  { value: "Seeing fish", label: "Seeing fish", color: "#3498DB" },
  { value: "Had follows", label: "Had follows", color: "#E67E22" },
  { value: "Had pulls", label: "Had pulls", color: "#E74C3C" },
] as const;

const BLANK_REASONS = [
  "Fish not feeding",
  "Wrong area",
  "Wrong flies",
  "Wrong depth",
] as const;

type Phase = "setup_check" | "details";

export default function BlankModal({
  open,
  onClose,
  sessionId,
  currentSetup,
  eventCount,
  onSaved,
  onChangeFirst,
  latestWeather,
}: BlankModalProps) {
  const [phase, setPhase] = useState<Phase>("setup_check");
  const [confidence, setConfidence] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase("setup_check");
      setConfidence(null);
      setReason(null);
    }
  }, [open]);

  function handleSameSetup() {
    setPhase("details");
  }

  function handleChangedSetup() {
    onClose();
    onChangeFirst(); // parent opens ChangeSetupModal, then re-opens BlankModal
  }

  async function handleSave() {
    if (!confidence) {
      toast.error("Select a confidence level");
      return;
    }
    setSaving(true);
    try {
      const event = await addEvent({
        session_id: sessionId,
        event_type: "blank",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        blank_confidence: confidence,
        blank_reason: reason,
        // Full setup snapshot
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

      toast.success("Blank period logged");
      onSaved(event);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save blank");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-diary">Log Blank Period</DialogTitle>
        </DialogHeader>

        {/* Phase 1: Setup check */}
        {phase === "setup_check" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Same setup, or changed something?
            </p>
            <div className="text-xs bg-muted/50 rounded-md p-3 space-y-1">
              {currentSetup.style && <p>Style: <strong>{currentSetup.style}</strong></p>}
              {currentSetup.rig && <p>Rig: <strong>{currentSetup.rig}</strong></p>}
              {currentSetup.line_type && <p>Line: <strong>{currentSetup.line_type}</strong></p>}
              {currentSetup.spot && <p>Spot: <strong>{currentSetup.spot}</strong></p>}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 min-h-[48px]"
                onClick={handleChangedSetup}
              >
                Changed setup
              </Button>
              <Button
                className="flex-1 min-h-[48px]"
                onClick={handleSameSetup}
              >
                Same setup ✓
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Confidence + Reason */}
        {phase === "details" && (
          <div className="space-y-4">
            <div>
              <Label>Confidence *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CONFIDENCE_LEVELS.map((cl) => (
                  <Button
                    key={cl.value}
                    variant={confidence === cl.value ? "default" : "outline"}
                    className="min-h-[48px] text-sm"
                    style={
                      confidence === cl.value
                        ? { backgroundColor: cl.color, borderColor: cl.color, color: "#fff" }
                        : { borderColor: cl.color, color: cl.color }
                    }
                    onClick={() => setConfidence(cl.value)}
                  >
                    {cl.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Reason (optional)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {BLANK_REASONS.map((r) => (
                  <Button
                    key={r}
                    variant={reason === r ? "default" : "outline"}
                    size="sm"
                    className="min-h-[44px] text-xs"
                    onClick={() => setReason(reason === r ? null : r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full min-h-[48px]"
              onClick={handleSave}
              disabled={!confidence || saving}
            >
              {saving ? "Saving..." : "Save Blank"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
