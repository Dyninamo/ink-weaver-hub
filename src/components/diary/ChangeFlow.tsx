// Single-screen Change flow. Replaces ChangeWhatPicker + ChangeSetupModal +
// ChangeFlyFlow + LineCascadePrompt. Field picker grid, then per-field editor
// inline (no modal nesting). Per prompt 143 §3.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addEvent, type CurrentSetup, type FliesOnCast, type FlyOnCast } from "@/services/diaryService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEvent } from "@/services/eventLogger";
import FlyPicker from "./FlyPicker";
import LeaderPicker, { type LeaderValue, EMPTY_LEADER } from "./LeaderPicker";
import SpotPicker from "./SpotPicker";
import { STYLE_OPTIONS, ALL_LINES, linesForWeight, positionsForFlyCount } from "./setup/vocabulary";
import { retrievesForStyle, depthsForStyle } from "@/services/styleRules";

export type ChangeField =
  | "fly" | "line" | "leader" | "style"
  | "depth" | "retrieve" | "spot" | "droppers" | "rod";

interface Props {
  sessionId: string;
  venueType: "stillwater" | "river";
  venueName: string;
  currentSetup: CurrentSetup;
  rodWeight?: number | null;
  eventCount: number;
  latestWeather?: any;
  onCancel: () => void;
  onSaved: (newSetup: CurrentSetup) => void;
  onPickRod: () => void;
}

const FIELD_CARDS: { value: Exclude<ChangeField, "rod">; label: string; sub: string }[] = [
  { value: "fly",      label: "Fly",      sub: "Swap a pattern" },
  { value: "line",     label: "Line",     sub: "Density / profile" },
  { value: "leader",   label: "Leader",   sub: "Tippet section" },
  { value: "style",    label: "Style",    sub: "Buzzer · Dry · …" },
  { value: "depth",    label: "Depth",    sub: "Where you fish" },
  { value: "retrieve", label: "Retrieve", sub: "How you fish it" },
  { value: "spot",     label: "Spot",     sub: "Where you stand" },
  { value: "droppers", label: "Droppers", sub: "Cast structure" },
];

export default function ChangeFlow({
  sessionId, venueType, venueName, currentSetup, rodWeight, eventCount,
  latestWeather, onCancel, onSaved, onPickRod,
}: Props) {
  const [field, setField] = useState<ChangeField | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastAutoSavedRef = useRef<string | null>(null);

  // Per-field draft state
  const [newValue, setNewValue] = useState<any>(null);
  const [flyPos, setFlyPos] = useState<string | null>(null);
  const [pendingFly, setPendingFly] = useState<{ pattern: string; size: number | null } | null>(null);
  const [leader, setLeader] = useState<LeaderValue>(EMPTY_LEADER);

  useEffect(() => { headingRef.current?.focus(); }, [field]);

  function pickField(f: ChangeField) {
    if (f === "rod") { onPickRod(); return; }
    setField(f);
    setNewValue(null);
    setFlyPos(null);
    setPendingFly(null);
    lastAutoSavedRef.current = null;
    setReason("");
    if (f === "leader") setLeader(EMPTY_LEADER);
  }

  function backToPicker() {
    setField(null);
    setNewValue(null);
    setFlyPos(null);
    setPendingFly(null);
    lastAutoSavedRef.current = null;
  }

  // Auto-save when FlyPicker hands us a fully-formed pendingFly (prompt 183 §2).
  useEffect(() => {
    if (field !== "fly") return;
    if (saving) return;
    if (!pendingFly?.pattern) return;
    if (!isReady("fly", newValue, pendingFly, leader, flyPos)) return;
    const fingerprint = `${pendingFly.pattern}|${pendingFly.size ?? ""}|${flyPos ?? ""}`;
    if (lastAutoSavedRef.current === fingerprint) return;
    lastAutoSavedRef.current = fingerprint;
    void handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFly, field, flyPos, saving]);

  // ---- Field picker landing ----
  if (field === null) {
    return (
      <div className="max-w-[440px] mx-auto p-4 space-y-4 pb-32">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 -ml-2" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold font-diary">
            Change something
          </h2>
        </div>

        <div role="radiogroup" aria-required="true" className="grid grid-cols-2 gap-2.5">
          {FIELD_CARDS.map((f) => (
            <button
              key={f.value}
              role="radio"
              aria-checked="false"
              type="button"
              className={cn(
                "rounded-lg border border-border p-3 text-left",
                "hover:border-foreground/40 hover:bg-muted/40 transition-colors",
                "min-h-[68px] flex flex-col justify-center gap-0.5"
              )}
              onClick={() => pickField(f.value)}
            >
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-[11px] text-muted-foreground">{f.sub}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={cn(
            "w-full rounded-lg border-2 p-3.5 text-left",
            "border-[hsl(var(--gild,42_70%_55%))]/40 bg-[hsl(var(--gild,42_70%_55%))]/8",
            "hover:bg-[hsl(var(--gild,42_70%_55%))]/15 transition-colors",
            "flex flex-col gap-0.5"
          )}
          onClick={() => pickField("rod")}
        >
          <span className="text-sm font-semibold">Set up a new rod</span>
          <span className="text-[11px] text-muted-foreground">
            Keeps Rod 1 in history
          </span>
        </button>
      </div>
    );
  }

  // ---- Per-field editors ----
  const oldValue = readField(currentSetup, field);
  const summary = summariseChange(field, oldValue, newValue, flyPos, pendingFly, leader);

  async function handleSave() {
    if (!isReady(field, newValue, pendingFly, leader, flyPos)) {
      toast.error("Pick a value first");
      return;
    }
    setSaving(true);
    try {
      const next: CurrentSetup = { ...currentSetup };
      const fromBlob: Record<string, any> = {};
      const toBlob: Record<string, any> = {};

      if (field === "fly") {
        const pos = flyPos!;
        const fliesObj: FliesOnCast = { ...(currentSetup.flies_on_cast || {}) } as any;
        const oldFly = fliesObj[pos] ?? null;
        const newFly: FlyOnCast = { pattern: pendingFly!.pattern, size: pendingFly!.size };
        fliesObj[pos] = newFly;
        next.flies_on_cast = fliesObj;
        fromBlob.position = pos;
        fromBlob.fly_pattern = oldFly?.pattern ?? null;
        fromBlob.fly_size = oldFly?.size ?? null;
        toBlob.position = pos;
        toBlob.fly_pattern = newFly.pattern;
        toBlob.fly_size = newFly.size;
      } else if (field === "droppers") {
        // droppers isn't on session_events as a column — record delta in
        // change_from/change_to so Timeline + analytics have data (prompt 183 §5).
        const oldDropperCount =
          currentSetup.dropper_count ??
          Math.max(
            0,
            Object.keys(currentSetup.flies_on_cast ?? {}).filter((k) => (currentSetup.flies_on_cast as any)?.[k]).length - 1,
          );
        fromBlob.droppers = oldDropperCount;
        toBlob.droppers = newValue;
        next.dropper_count = newValue;
      } else if (field === "leader") {
        // Leader stored on session_rods; we record summary in change event.
        const summaryText = `${leader.material ?? ""} ${leader.length_ft ?? ""}ft @ ${leader.strength_lb ?? ""}lb`.trim();
        fromBlob.leader = currentSetup.rig ?? null;
        toBlob.leader = summaryText;
        next.rig = summaryText;
      } else {
        const setupKey = mapFieldToSetupKey(field);
        if (setupKey) {
          fromBlob[setupKey] = (currentSetup as any)[setupKey] ?? null;
          toBlob[setupKey] = newValue;
          (next as any)[setupKey] = newValue;
        }
      }

      await addEvent({
        session_id: sessionId,
        event_type: "change",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        change_from: fromBlob,
        change_to: toBlob,
        change_reason: reason || `angler change · ${field}`,
        style: next.style,
        rig: next.rig,
        line_type: next.line_type,
        retrieve: next.retrieve,
        flies_on_cast: next.flies_on_cast,
        spot: next.spot,
        depth_zone: next.depth_zone,
        event_temp: latestWeather?.temp ?? null,
        event_wind_speed: latestWeather?.wind_speed ?? null,
        event_wind_dir: latestWeather?.wind_dir ?? null,
        event_pressure: latestWeather?.pressure ?? null,
        event_conditions: latestWeather?.conditions ?? null,
      } as any);

      // Persist new setup state to session_rods so subsequent CatchFlow reads
      // see post-change values (not the original setup snapshot). Non-blocking.
      try {
        const rodUpdates: Record<string, any> = {};
        if (field === "style")    rodUpdates.style = next.style;
        if (field === "line")     rodUpdates.line_profile = next.line_type;
        if (field === "fly")      rodUpdates.flies_on_cast = next.flies_on_cast;
        if (field === "droppers" && typeof newValue === "number") {
          rodUpdates.dropper_count = Math.max(0, newValue);
        }
        if (Object.keys(rodUpdates).length > 0) {
          const { error: rodErr } = await supabase
            .from("session_rods" as any)
            .update(rodUpdates)
            .eq("session_id", sessionId)
            .eq("is_active", true);
          if (rodErr) {
            console.warn("session_rods sync failed:", rodErr.message);
            logEvent("warning", { context: "rod_sync_after_change", field, message: rodErr.message }, sessionId);
            toast.warning(
              "Change saved, but rod state didn't sync. Refresh the page and verify the new setup is shown.",
              { duration: 6000 }
            );
          }
        }
      } catch (rodWriteErr: any) {
        console.warn("session_rods sync threw:", rodWriteErr?.message);
        logEvent("error", { context: "rod_sync_after_change", field, message: rodWriteErr?.message }, sessionId);
        toast.warning(
          "Change saved, but rod state didn't sync. Refresh the page and verify the new setup is shown.",
          { duration: 6000 }
        );
      }

      logEvent("session.change", { session_id: sessionId, field, has_reason: !!reason }, sessionId);
      toast.success("Change saved");
      onSaved(next);
    } catch (err: any) {
      logEvent("error", { context: "change_save", field, message: err?.message ?? String(err) }, sessionId);
      toast.error(err?.message || "Failed to save change");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[440px] mx-auto p-4 space-y-4 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={backToPicker} className="p-2 -ml-2" aria-label="Back to fields">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold font-diary capitalize">
          Change · {field}
        </h2>
      </div>

      {/* Editors */}
      {field === "style" && (
        <ChipGrid
          options={[...STYLE_OPTIONS]}
          value={newValue}
          onChange={setNewValue}
        />
      )}

      {field === "line" && (
        <ChipGrid
          options={rodWeight ? linesForWeight(rodWeight) : [...ALL_LINES]}
          value={newValue}
          onChange={setNewValue}
        />
      )}

      {field === "depth" && (
        <ChipGrid
          options={depthsForStyle(currentSetup.style)}
          value={newValue}
          onChange={setNewValue}
        />
      )}

      {field === "retrieve" && (
        <ChipGrid
          options={retrievesForStyle(currentSetup.style)}
          value={newValue}
          onChange={setNewValue}
        />
      )}

      {field === "droppers" && (
        <ChipGrid
          options={["0", "1", "2", "3", "4", "5", "6"]}
          value={newValue?.toString() ?? null}
          onChange={(v) => setNewValue(parseInt(v))}
        />
      )}

      {field === "spot" && (
        <SpotPicker
          value={newValue}
          onChange={setNewValue}
          venueName={venueName}
        />
      )}

      {field === "leader" && (
        <LeaderPicker value={leader} onChange={setLeader} />
      )}

      {field === "fly" && (
        <div>
          <Label>Why? (optional — type before tapping Add)</Label>
          <Input
            placeholder="e.g. wind shifted, fish moved deeper"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5"
          />
        </div>
      )}

      {field === "fly" && (
        <FlyChangeEditor
          currentSetup={currentSetup}
          venueType={venueType}
          venueName={venueName}
          flyPos={flyPos}
          setFlyPos={setFlyPos}
          pendingFly={pendingFly}
          setPendingFly={setPendingFly}
        />
      )}

      {field !== "fly" && (
        <div>
          <Label>Why? (optional)</Label>
          <Input
            placeholder="e.g. wind shifted, fish moved deeper"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5"
          />
        </div>
      )}

      {field !== "fly" && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 min-h-[48px]" onClick={backToPicker} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="flex-1 min-h-[48px] bg-diary-change hover:bg-diary-change/90"
            onClick={handleSave}
            disabled={saving || !isReady(field, newValue, pendingFly, leader, flyPos)}
          >
            {saving ? "Saving…" : `Save · ${summary}`}
          </Button>
        </div>
      )}

      {field === "fly" && saving && (
        <div className="text-center text-sm text-muted-foreground py-2">Saving…</div>
      )}
    </div>
  );
}

// ---- helpers ----

function readField(s: CurrentSetup, f: ChangeField): any {
  switch (f) {
    case "style":    return s.style;
    case "line":     return s.line_type;
    case "depth":    return s.depth_zone;
    case "retrieve": return s.retrieve;
    case "spot":     return s.spot;
    case "leader":   return s.rig;
    case "droppers": {
      const flies = s.flies_on_cast as any;
      if (!flies || typeof flies !== "object") return 0;
      const filledCount = Object.keys(flies).filter((k) => flies[k]).length;
      return Math.max(0, filledCount - 1);
    }
    default: return null;
  }
}

function mapFieldToSetupKey(f: ChangeField): keyof CurrentSetup | null {
  switch (f) {
    case "style":    return "style";
    case "line":     return "line_type";
    case "depth":    return "depth_zone";
    case "retrieve": return "retrieve";
    case "spot":     return "spot";
    default: return null;
  }
}

function isReady(
  f: ChangeField, v: any,
  pendingFly: { pattern: string; size: number | null } | null,
  leader: LeaderValue,
  flyPos: string | null,
): boolean {
  if (f === "fly") return !!flyPos && !!pendingFly?.pattern;
  if (f === "leader") return !!leader.material && leader.length_ft != null && leader.strength_lb != null;
  if (f === "droppers") return v != null;
  return !!v;
}

function summariseChange(
  f: ChangeField, oldV: any, newV: any, flyPos: string | null,
  pendingFly: { pattern: string; size: number | null } | null,
  leader: LeaderValue,
): string {
  if (f === "fly") {
    if (!flyPos || !pendingFly?.pattern) return "fly";
    return `${flyPos} → ${pendingFly.pattern}`;
  }
  if (f === "leader") {
    if (!leader.material) return "leader";
    return `${leader.material} ${leader.length_ft}ft`;
  }
  if (newV == null || newV === "") return f;
  return `${oldV ?? "—"} → ${newV}`;
}

// ---- Sub-editors ----

function ChipGrid({ options, value, onChange }: {
  options: string[]; value: string | null; onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-lg border p-3 text-sm min-h-[48px]",
            value === opt
              ? "border-diary-change bg-diary-change/10 text-foreground"
              : "border-border hover:border-foreground/40"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function FlyChangeEditor({
  currentSetup, venueType, venueName, flyPos, setFlyPos, pendingFly, setPendingFly,
}: {
  currentSetup: CurrentSetup;
  venueType: "stillwater" | "river";
  venueName: string;
  flyPos: string | null;
  setFlyPos: (p: string | null) => void;
  pendingFly: { pattern: string; size: number | null } | null;
  setPendingFly: (p: { pattern: string; size: number | null } | null) => void;
}) {
  const flies = currentSetup.flies_on_cast as any;
  // flyCount = dropper_count + 1; fall back to filled positions, then 1 (prompt 183 §6).
  const droppersFromRod = currentSetup.dropper_count;
  const filledCount = flies ? Object.keys(flies).filter((k) => flies[k]).length : 0;
  const flyCount = droppersFromRod != null
    ? Math.max(1, droppersFromRod + 1)
    : Math.max(1, filledCount);
  const positions = positionsForFlyCount(flyCount);

  // Single-fly auto-pick (lifts up to parent so save handler sees it).
  useEffect(() => {
    if (positions.length === 1 && !flyPos) setFlyPos(positions[0]);
  }, [positions, flyPos, setFlyPos]);

  if (!flyPos) {
    return (
      <div className="space-y-2">
        <p className="smallcaps">Pick a position</p>
        {positions.map((pos) => {
          const fly = flies?.[pos];
          return (
            <button
              key={pos}
              type="button"
              onClick={() => setFlyPos(pos)}
              className="w-full rounded-lg border border-border p-3 text-left hover:border-foreground/40 hover:bg-muted/40 transition-colors flex items-center gap-3"
            >
              <div className="w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {pos}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{fly?.pattern ?? "(empty)"}</div>
                {fly?.size != null && <div className="text-xs text-muted-foreground">#{fly.size}</div>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="smallcaps">Position: {flyPos}</span>
        {positions.length > 1 && (
          <button onClick={() => setFlyPos(null)} className="text-xs text-muted-foreground underline">
            change position
          </button>
        )}
      </div>
      <FlyPicker
        value={pendingFly?.pattern ?? null}
        onChange={({ pattern, size }) => setPendingFly({ pattern, size })}
        currentStyle={currentSetup.style}
        currentLine={currentSetup.line_type}
        venueName={venueName}
        venueType={venueType}
      />
    </div>
  );
}
