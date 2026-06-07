// Prompt 218 — CatchEditForm: standalone add/edit form for past-session catches.
// Wraps addEvent / updateEvent (RLS-scoped). Drives location from the GPS trail.
// Deliberately separate from CatchFlow — the live in-session logger stays
// untouched.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  addEvent,
  updateEvent,
  SPECIES_LIST,
  type FishingSession,
  type SessionEvent,
  type TrailPoint,
} from "@/services/diaryService";
import { deriveFixFromTrail, type DerivedFix } from "@/lib/deriveFix";
import { parseWeight, parseLength } from "@/lib/parseSize";
import { cn } from "@/lib/utils";

const POSITIONS = ["point", "middle", "top dropper", "bob"];
const DEPTHS = ["surface", "sub-surface", "mid", "deep"];

interface Props {
  mode: "add" | "edit";
  initial?: SessionEvent;
  session: FishingSession;
  trail: TrailPoint[];
  onSaved: () => void;
  onCancel: () => void;
}

function sessionWindow(session: FishingSession): { start: number; end: number } {
  const date = session.session_date;
  const startISO = session.start_time
    ? new Date(session.start_time).toISOString()
    : `${date}T00:00:00`;
  const endISO = session.end_time
    ? new Date(session.end_time).toISOString()
    : session.is_active
    ? new Date().toISOString()
    : `${date}T23:59:59`;
  return { start: Date.parse(startISO), end: Date.parse(endISO) };
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CatchEditForm({
  mode,
  initial,
  session,
  trail,
  onSaved,
  onCancel,
}: Props) {
  const win = useMemo(() => sessionWindow(session), [session]);

  // Time (ms) — add mode defaults to session end; edit to event_time.
  const [eventMs, setEventMs] = useState<number>(() => {
    if (mode === "edit" && initial?.event_time) return Date.parse(initial.event_time);
    return win.end;
  });

  // Track whether the user has moved time / explicitly re-placed — if so, the
  // derived fix overrides the kept latlng.
  const [usedTrail, setUsedTrail] = useState<boolean>(mode === "add");

  // Form state
  const initialSpecies = initial?.species ?? "Rainbow";
  const isOtherSpecies = !SPECIES_LIST.includes(initialSpecies);
  const [speciesPick, setSpeciesPick] = useState<string>(isOtherSpecies ? "Other" : initialSpecies);
  const [speciesOther, setSpeciesOther] = useState<string>(isOtherSpecies ? initialSpecies : "");

  const [measureMode, setMeasureMode] = useState<"weight" | "length">(() => {
    if (initial?.measurement_mode === "length") return "length";
    if (initial?.length_inches != null && initial?.weight_lb == null) return "length";
    return "weight";
  });
  const [weightLb, setWeightLb] = useState<string>(
    initial?.weight_lb != null
      ? String(initial.weight_lb + ((initial as any).weight_oz ?? 0) / 16)
      : ""
  );
  const [lengthIn, setLengthIn] = useState<string>(
    initial?.length_inches != null ? String(initial.length_inches) : ""
  );

  const [flyPattern, setFlyPattern] = useState<string>(initial?.fly_pattern ?? "");
  const [flySize, setFlySize] = useState<string>(
    initial?.fly_size != null ? String(initial.fly_size) : ""
  );
  const [position, setPosition] = useState<string>(initial?.rig_position ?? "");
  const [depth, setDepth] = useState<string>(initial?.depth_zone ?? "");
  const [keptReleased, setKeptReleased] = useState<string>(
    (initial as any)?.kept_released ?? "released"
  );
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Clamp time to session window
  useEffect(() => {
    setEventMs((t) => Math.min(Math.max(t, win.start), win.end));
  }, [win.start, win.end]);

  const eventISO = useMemo(() => new Date(eventMs).toISOString(), [eventMs]);
  const fix: DerivedFix = useMemo(() => deriveFixFromTrail(trail, eventISO), [trail, eventISO]);

  function nudge(mins: number) {
    setEventMs((t) => {
      const next = Math.min(Math.max(t + mins * 60_000, win.start), win.end);
      if (next !== t) setUsedTrail(true);
      return next;
    });
  }

  function rePlace() {
    setUsedTrail(true);
  }

  // Resolved location for save
  const resolvedLat = usedTrail ? fix.latitude : initial?.latitude ?? fix.latitude;
  const resolvedLon = usedTrail ? fix.longitude : initial?.longitude ?? fix.longitude;
  const resolvedAcc = usedTrail ? fix.accuracy : (initial as any)?.gps_accuracy ?? fix.accuracy;

  const speciesFinal = speciesPick === "Other" ? speciesOther.trim() : speciesPick;
  const sizeOk =
    (measureMode === "weight" && (weightLb === "" || Number(weightLb) > 0)) ||
    (measureMode === "length" && (lengthIn === "" || Number(lengthIn) > 0));
  const canSave = !!speciesFinal && sizeOk && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: Partial<SessionEvent> & Record<string, any> = {
        session_id: session.id,
        event_type: "catch",
        event_time: eventISO,
        species: speciesFinal,
        fly_pattern: flyPattern.trim() || null,
        fly_size: flySize ? Number(flySize) : null,
        rig_position: position || null,
        depth_zone: depth || null,
        notes: notes.trim() || null,
        latitude: resolvedLat,
        longitude: resolvedLon,
        gps_accuracy: resolvedAcc,
        kept_released: keptReleased,
        measurement_mode: measureMode,
      };
      if (measureMode === "weight") {
        const f = parseFloat(weightLb);
        let weight_lb: number | null = null;
        let weight_oz: number | null = null;
        let weight_display: string | null = null;
        if (Number.isFinite(f) && f > 0) {
          weight_lb = Math.floor(f);
          weight_oz = Math.round((f - weight_lb) * 16);
          if (weight_oz >= 16) { weight_lb += 1; weight_oz = 0; }
          weight_display = weight_oz === 0 ? `${weight_lb} lb` : `${weight_lb} lb ${weight_oz} oz`;
        }
        payload.weight_lb = weight_lb;
        payload.weight_oz = weight_oz;
        payload.weight_display = weight_display;
        payload.length_inches = null;
      } else {
        const f = parseFloat(lengthIn);
        const length_inches = Number.isFinite(f) && f > 0 ? f : null;
        payload.length_inches = length_inches;
        payload.weight_display = length_inches != null ? `${length_inches} in` : null;
        payload.weight_lb = null;
        payload.weight_oz = null;
      }

      if (mode === "add") {
        await addEvent(payload);
        toast.success("Catch added");
      } else if (initial?.id) {
        await updateEvent(initial.id, payload);
        toast.success("Catch updated");
      }
      onSaved();
    } catch (err: any) {
      console.error("save catch", err);
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-1">
      {/* Time */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-lg tabular-nums min-w-[64px]">{fmtClock(eventMs)}</span>
          {[-15, -5, 5, 15].map((d) => (
            <Button key={d} type="button" variant="outline" size="sm" onClick={() => nudge(d)}>
              {d > 0 ? `+${d}` : d} min
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Within {fmtClock(win.start)} – {fmtClock(win.end)}
        </p>
      </div>

      {/* Derived location */}
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
        {fix.latitude != null && fix.longitude != null ? (
          <p>
            📍 {fix.note} <span className="text-muted-foreground">({fix.confidence})</span>
          </p>
        ) : (
          <p className="text-muted-foreground">📍 {fix.note}</p>
        )}
        {mode === "edit" && !usedTrail && initial?.latitude != null && (
          <button
            type="button"
            className="text-primary underline text-[11px]"
            onClick={rePlace}
          >
            Re-place from track
          </button>
        )}
      </div>

      {/* Species */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Species</Label>
        <div className="flex flex-wrap gap-1">
          {SPECIES_LIST.map((s) => (
            <Button
              key={s}
              type="button"
              variant={speciesPick === s ? "default" : "outline"}
              size="sm"
              onClick={() => setSpeciesPick(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {speciesPick === "Other" && (
          <Input
            placeholder="Species name"
            value={speciesOther}
            onChange={(e) => setSpeciesOther(e.target.value)}
          />
        )}
      </div>

      {/* Size */}
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Size</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={measureMode === "weight" ? "default" : "outline"}
              size="sm"
              onClick={() => setMeasureMode("weight")}
            >
              Weight
            </Button>
            <Button
              type="button"
              variant={measureMode === "length" ? "default" : "outline"}
              size="sm"
              onClick={() => setMeasureMode("length")}
            >
              Length
            </Button>
          </div>
        </div>
        {measureMode === "weight" ? (
          <Input
            inputMode="decimal"
            placeholder="lb"
            value={weightLb}
            onChange={(e) => setWeightLb(e.target.value)}
          />
        ) : (
          <Input
            inputMode="decimal"
            placeholder="inches"
            value={lengthIn}
            onChange={(e) => setLengthIn(e.target.value)}
          />
        )}
      </div>

      {/* Fly */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fly</Label>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Pattern"
            value={flyPattern}
            onChange={(e) => setFlyPattern(e.target.value)}
          />
          <Input
            className="w-20"
            inputMode="numeric"
            placeholder="size"
            value={flySize}
            onChange={(e) => setFlySize(e.target.value)}
          />
        </div>
      </div>

      {/* Position */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position</Label>
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map((p) => (
            <Button
              key={p}
              type="button"
              variant={position === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPosition(position === p ? "" : p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* Depth */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Depth</Label>
        <div className="flex flex-wrap gap-1">
          {DEPTHS.map((d) => (
            <Button
              key={d}
              type="button"
              variant={depth === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDepth(depth === d ? "" : d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      {/* Kept/released */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Outcome</Label>
        <div className="flex gap-1">
          {["released", "kept"].map((k) => (
            <Button
              key={k}
              type="button"
              variant={keptReleased === k ? "default" : "outline"}
              size="sm"
              onClick={() => setKeptReleased(k)}
              className="capitalize"
            >
              {k}
            </Button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering…"
        />
      </div>

      <div className={cn("flex gap-2 pt-2 sticky bottom-0 bg-background")}>
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={!canSave}>
          {saving ? "Saving…" : mode === "add" ? "Add catch" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
