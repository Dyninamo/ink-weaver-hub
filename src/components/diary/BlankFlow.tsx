// Full-screen Blank entry phase. Replaces BlankModal; phase-1 "same setup
// or changed?" gate stripped per prompt 143 §4 (RN parity — anglers fire
// a Change first if needed).
import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { addEvent, type CurrentSetup } from "@/services/diaryService";
import { toast } from "sonner";

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

interface Props {
  sessionId: string;
  currentSetup: CurrentSetup;
  eventCount: number;
  latestWeather?: any;
  onCancel: () => void;
  onSaved: () => void;
}

export default function BlankFlow({
  sessionId, currentSetup, eventCount, latestWeather, onCancel, onSaved,
}: Props) {
  const [confidence, setConfidence] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

  async function handleSave() {
    if (!confidence) { toast.error("Select a confidence level"); return; }
    setSaving(true);
    try {
      await addEvent({
        session_id: sessionId,
        event_type: "blank",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        blank_confidence: confidence,
        blank_reason: reason,
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
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save blank");
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
          Mark a blank
        </h2>
      </div>

      <div>
        <Label>Confidence *</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {CONFIDENCE_LEVELS.map((cl) => (
            <button
              key={cl.value}
              type="button"
              className="event-chip min-h-[48px]"
              style={
                confidence === cl.value
                  ? { backgroundColor: cl.color, borderColor: cl.color, color: "#fff" }
                  : { borderColor: cl.color, color: cl.color }
              }
              onClick={() => setConfidence(cl.value)}
            >
              {cl.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Reason (optional)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {BLANK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className="event-chip min-h-[44px] text-xs"
              data-active={reason === r}
              data-tone="blank"
              onClick={() => setReason(reason === r ? null : r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="event-cta w-full"
        data-tone="blank"
        data-active={!!confidence && !saving}
        onClick={handleSave}
        disabled={!confidence || saving}
      >
        {saving
          ? "Saving..."
          : confidence
          ? `Log blank · ${confidence}${reason ? ` · ${reason.toLowerCase()}` : ""}`
          : "Pick confidence"}
      </button>
    </div>
  );
}
