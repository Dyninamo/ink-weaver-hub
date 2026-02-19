import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import SetupCascade from "./SetupCascade";
import SpotPicker from "./SpotPicker";
import {
  addEvent,
  type CurrentSetup,
} from "@/services/diaryService";
import { toast } from "sonner";

interface ChangeSetupModalProps {
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

export default function ChangeSetupModal({
  open,
  onClose,
  sessionId,
  venueType,
  venueName,
  currentSetup,
  eventCount,
  onSaved,
  latestWeather,
}: ChangeSetupModalProps) {
  const [newSetup, setNewSetup] = useState<CurrentSetup>(currentSetup);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset to current setup when opened
  useEffect(() => {
    if (open) {
      setNewSetup({ ...currentSetup });
      setReason("");
    }
  }, [open, currentSetup]);

  // Calculate diff
  function getDiff(): { from: Record<string, any>; to: Record<string, any> } {
    const from: Record<string, any> = {};
    const to: Record<string, any> = {};

    const fields: (keyof CurrentSetup)[] = [
      "style", "rig", "line_type", "retrieve", "flies_on_cast", "spot", "depth_zone",
    ];

    for (const field of fields) {
      if (currentSetup[field] !== newSetup[field]) {
        from[field] = currentSetup[field];
        to[field] = newSetup[field];
      }
    }

    return { from, to };
  }

  const diff = getDiff();
  const hasChanges = Object.keys(diff.to).length > 0;

  async function handleSave() {
    if (!hasChanges) {
      toast.error("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const event = await addEvent({
        session_id: sessionId,
        event_type: "change",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        change_from: diff.from,
        change_to: diff.to,
        change_reason: reason || null,
        // Snapshot of the NEW state
        style: newSetup.style,
        rig: newSetup.rig,
        line_type: newSetup.line_type,
        retrieve: newSetup.retrieve,
        flies_on_cast: newSetup.flies_on_cast,
        spot: newSetup.spot,
        depth_zone: newSetup.depth_zone,
        event_temp: latestWeather?.temp ?? null,
        event_wind_speed: latestWeather?.wind_speed ?? null,
        event_wind_dir: latestWeather?.wind_dir ?? null,
        event_pressure: latestWeather?.pressure ?? null,
        event_conditions: latestWeather?.conditions ?? null,
      });

      const changedFields = Object.keys(diff.to).join(", ");
      toast.success(`Setup changed: ${changedFields}`);
      onSaved(event, newSetup);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save change");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-diary">Change Setup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show current state summary */}
          <div className="text-xs bg-muted/50 rounded-md p-3 space-y-1">
            <p className="font-medium text-muted-foreground mb-1">Current:</p>
            {currentSetup.style && <p>Style: {currentSetup.style}</p>}
            {currentSetup.rig && <p>Rig: {currentSetup.rig}</p>}
            {currentSetup.line_type && <p>Line: {currentSetup.line_type}</p>}
            {currentSetup.retrieve && <p>Retrieve: {currentSetup.retrieve}</p>}
            {currentSetup.spot && <p>Spot: {currentSetup.spot}</p>}
            {currentSetup.depth_zone && <p>Depth: {currentSetup.depth_zone}</p>}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4 text-diary-change" />
            <span className="font-medium text-diary-change">Change to:</span>
          </div>

          {/* Setup Cascade for new state */}
          <SetupCascade
            venueType={venueType}
            value={newSetup}
            onChange={setNewSetup}
          />

          {/* Spot picker */}
          <SpotPicker
            value={newSetup.spot}
            onChange={(v) => setNewSetup({ ...newSetup, spot: v })}
            venueName={venueName}
          />

          {/* Change reason */}
          <div>
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g. Fish gone deep after wind shift"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Diff summary */}
          {hasChanges && (
            <div className="text-xs bg-diary-change/10 border border-diary-change/20 rounded-md p-3 space-y-1">
              <p className="font-medium text-diary-change mb-1">Changes:</p>
              {Object.entries(diff.to).map(([field, value]) => (
                <p key={field}>
                  {field}: {String(diff.from[field] || "not set")} → <strong>{String(value)}</strong>
                </p>
              ))}
            </div>
          )}

          <Button
            className="w-full min-h-[48px] bg-diary-change hover:bg-diary-change/90"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "Saving..." : hasChanges ? "Save Change" : "No changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
