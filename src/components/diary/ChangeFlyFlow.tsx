import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import FlyPicker from "./FlyPicker";
import {
  addEvent,
  type CurrentSetup,
  type FliesOnCast,
  type FlyOnCast,
} from "@/services/diaryService";

type Phase = "position" | "picker" | "readback";

interface PendingChange {
  position: string;
  pattern: string;
  size: number | null;
  from: FlyOnCast | null;
}

interface ChangeFlyFlowProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  venueType: "stillwater" | "river";
  venueName: string;
  currentSetup: CurrentSetup;
  eventCount: number;
  onSaved: (event: any, newSetup: CurrentSetup) => void;
  latestWeather?: {
    temp: number;
    wind_speed: number;
    wind_dir: string;
    pressure: number;
    conditions?: string;
  } | null;
}

function formatFly(f: FlyOnCast | null): string {
  if (!f) return "(empty)";
  return f.size != null ? `${f.pattern} #${f.size}` : f.pattern;
}

export default function ChangeFlyFlow({
  open,
  onClose,
  sessionId,
  venueType,
  venueName,
  currentSetup,
  eventCount,
  onSaved,
  latestWeather,
}: ChangeFlyFlowProps) {
  const [phase, setPhase] = useState<Phase>("position");
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase("position");
      setPending(null);
      setSaving(false);
    }
  }, [open]);

  const flies = currentSetup.flies_on_cast ?? null;
  const positions = flies ? Object.keys(flies) : [];

  function handlePickPosition(pos: string) {
    setPending({
      position: pos,
      pattern: "",
      size: null,
      from: flies?.[pos] ?? null,
    });
    setPhase("picker");
  }

  function handlePickFly({ pattern, size }: { pattern: string; size: number | null }) {
    if (!pending) return;
    setPending({ ...pending, pattern, size });
    setPhase("readback");
  }

  async function handleSave() {
    if (!pending || !flies) return;
    setSaving(true);
    try {
      const newFly: FlyOnCast = { pattern: pending.pattern, size: pending.size };
      const nextFlies: FliesOnCast = { ...flies, [pending.position]: newFly };
      const newSetup: CurrentSetup = { ...currentSetup, flies_on_cast: nextFlies };

      const event = await addEvent({
        session_id: sessionId,
        event_type: "change",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        change_from: {
          position: pending.position,
          fly_pattern: pending.from?.pattern ?? null,
          fly_size: pending.from?.size ?? null,
        },
        change_to: {
          position: pending.position,
          fly_pattern: pending.pattern,
          fly_size: pending.size,
        },
        change_reason: `Fly swap at ${pending.position}`,
        // snapshot of new state
        style: currentSetup.style,
        rig: currentSetup.rig,
        line_type: currentSetup.line_type,
        retrieve: currentSetup.retrieve,
        flies_on_cast: nextFlies,
        spot: currentSetup.spot,
        depth_zone: currentSetup.depth_zone,
        event_temp: latestWeather?.temp ?? null,
        event_wind_speed: latestWeather?.wind_speed ?? null,
        event_wind_dir: latestWeather?.wind_dir ?? null,
        event_pressure: latestWeather?.pressure ?? null,
        event_conditions: latestWeather?.conditions ?? null,
      } as any);

      toast.success(`${pending.position} fly changed`);
      onSaved(event, newSetup);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save fly change");
    } finally {
      setSaving(false);
    }
  }

  // Width depends on phase; FlyPicker likes a wider sheet.
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px] p-0 gap-0 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="font-diary">
            {phase === "position" && "Change a fly"}
            {phase === "picker" && pending && `${pending.position} · pick a pattern`}
            {phase === "readback" && pending && `${pending.position} · confirm`}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 pt-0">
          {/* PHASE 1 — pick a position */}
          {phase === "position" && (
            <>
              {positions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No flies recorded yet on this rod. Set them up first via
                  Change &rarr; Style or the setup cascade.
                </p>
              ) : (
                <div className="space-y-2">
                  {positions.map((pos) => {
                    const fly = flies?.[pos];
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handlePickPosition(pos)}
                        className="w-full rounded-lg border border-border p-3 text-left hover:border-foreground/40 hover:bg-muted/40 transition-colors flex items-center gap-3"
                      >
                        <div className="w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {pos}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {fly?.pattern ?? "(empty)"}
                          </div>
                          {fly?.size != null && (
                            <div className="text-xs text-muted-foreground">#{fly.size}</div>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* PHASE 2 — FlyPicker */}
          {phase === "picker" && pending && (
            <FlyPicker
              value={pending.from?.pattern ?? null}
              onChange={handlePickFly}
              currentStyle={currentSetup.style}
              currentLine={currentSetup.line_type}
              venueName={venueName}
              venueType={venueType}
            />
          )}

          {/* PHASE 3 — Readback */}
          {phase === "readback" && pending && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground">
                  Position
                </div>
                <div className="text-sm font-medium">{pending.position}</div>

                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground pt-2">
                  From
                </div>
                <div className="text-sm">{formatFly(pending.from)}</div>

                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground pt-2">
                  <ArrowRight className="h-3 w-3" />
                  To
                </div>
                <div className="text-sm font-semibold">
                  {pending.pattern}
                  {pending.size != null && (
                    <span className="text-muted-foreground"> · #{pending.size}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px]"
                  onClick={() => setPhase("picker")}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 min-h-[44px] bg-diary-change hover:bg-diary-change/90"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save change"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
