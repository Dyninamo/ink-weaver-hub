import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LeaderPicker, { EMPTY_LEADER, type LeaderValue } from "@/components/diary/LeaderPicker";
import FlyPicker from "@/components/diary/FlyPicker";
import Dial from "./Dial";
import SavedRigsBanner from "./SavedRigsBanner";
import {
  ROD_WEIGHTS,
  STYLE_OPTIONS,
  EMPTY_ROD_SETUP,
  linesForWeight,
  rodLengthInchesForWeight,
  rodMedianInchesForWeight,
  inchesLabel,
  metresLabel,
  inchesToFt,
  positionsForFlyCount,
  positionLabel,
  type RodSetupState,
  type FlyPosition,
} from "./vocabulary";
import { logEvent } from "@/services/eventLogger";

type Phase = "rod" | "line" | "leader" | "style" | "droppers" | "flies" | "spot";
const PHASES: Phase[] = ["rod", "line", "leader", "style", "droppers", "flies", "spot"];
const PHASE_LABEL: Record<Phase, string> = {
  rod: "Rod",
  line: "Line",
  leader: "Leader",
  style: "Style",
  droppers: "Droppers",
  flies: "Flies",
  spot: "Spot",
};

interface ProfileDefaults {
  rodWeight?: number | null;
  rodLengthFt?: number | null;
  lineProfile?: string | null;
  leaderId?: number | null;
  keepLimit?: number | null;
}

interface SetupWizardProps {
  userId: string;
  venueName: string;
  venueWaterType: "stillwater" | "river" | null;
  onCancel: () => void;
  onComplete: (commit: WizardCommit) => Promise<void> | void;
}

export interface WizardCommit {
  rod: RodSetupState;
  spotName: string | null;
  plan: string | null;
  keepLimit: number | null;
  savePreset: { name: string; includeFlies: boolean } | null;
}

export default function SetupWizard({
  userId,
  venueName,
  venueWaterType,
  onCancel,
  onComplete,
}: SetupWizardProps) {
  const [phase, setPhase] = useState<Phase>("rod");
  const [rodSubStep, setRodSubStep] = useState<"weight" | "length">("weight");
  const [state, setState] = useState<RodSetupState>(EMPTY_ROD_SETUP);
  const [lengthInches, setLengthInches] = useState<number | null>(null);
  const [lengthUnit, setLengthUnit] = useState<"ft" | "m">("ft");
  const [committing, setCommitting] = useState(false);

  // Spot step locals
  const [spotName, setSpotName] = useState("");
  const [plan, setPlan] = useState("");
  const [keepLimit, setKeepLimit] = useState<string>("2");
  const [savePreset, setSavePreset] = useState(false);
  const [presetIncludeFlies, setPresetIncludeFlies] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Fly picker sheet
  const [flyPickerPos, setFlyPickerPos] = useState<FlyPosition | null>(null);

  // -------- Pre-fill defaults from user_profiles --------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("user_profiles")
        .select(
          "default_rod_weight, default_rod_length_ft, default_line_profile, default_leader_id, default_keep_limit, stillwater_default_rod_weight, stillwater_default_line, river_default_rod_weight, river_default_line"
        )
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const p = (data || {}) as any;
      const wt = venueWaterType;
      const rw =
        (wt === "river" ? p.river_default_rod_weight : p.stillwater_default_rod_weight) ??
        p.default_rod_weight ??
        (wt === "river" ? 5 : 7);
      const line =
        (wt === "river" ? p.river_default_line : p.stillwater_default_line) ??
        p.default_line_profile ??
        "Floating";
      setState((s) => ({
        ...s,
        rodWeight: rw,
        rodLengthFt: p.default_rod_length_ft ?? null,
        lineProfile: linesForWeight(rw).includes(line) ? line : "Floating",
        leaderId: p.default_leader_id ?? null,
      }));
      if (p.default_rod_length_ft) {
        setLengthInches(Math.round(p.default_rod_length_ft * 12));
      } else {
        setLengthInches(rodMedianInchesForWeight(rw));
      }
      if (p.default_keep_limit != null) setKeepLimit(String(p.default_keep_limit));
    }
    load();
    return () => { cancelled = true; };
  }, [userId, venueWaterType]);

  // When weight changes, ensure length is in-range and line is valid
  useEffect(() => {
    if (state.rodWeight == null) return;
    const opts = rodLengthInchesForWeight(state.rodWeight);
    if (lengthInches == null || !opts.includes(lengthInches)) {
      setLengthInches(rodMedianInchesForWeight(state.rodWeight));
    }
    if (state.lineProfile && !linesForWeight(state.rodWeight).includes(state.lineProfile)) {
      setState((s) => ({ ...s, lineProfile: "Floating" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rodWeight]);

  // Sync lengthInches → state.rodLengthFt
  useEffect(() => {
    if (lengthInches != null) {
      setState((s) => ({ ...s, rodLengthFt: Math.round(inchesToFt(lengthInches) * 100) / 100 }));
    }
  }, [lengthInches]);

  const phaseIdx = PHASES.indexOf(phase);

  useEffect(() => { logEvent("wizard.phase_enter", { phase, rodSubStep }); }, [phase, rodSubStep]);

  function applyPreset(rod: RodSetupState, hasFlies: boolean) {
    setState((s) => ({
      ...s,
      ...rod,
      // ensure shape sanity
      flyCount: (rod.flyCount as any) ?? 2,
      flies: rod.flies ?? {},
    }));
    // Pre-fill length: prefer preset's value, else the new weight's median, else null.
    if (rod.rodLengthFt) {
      setLengthInches(Math.round(rod.rodLengthFt * 12));
    } else if (rod.rodWeight != null) {
      setLengthInches(rodMedianInchesForWeight(rod.rodWeight));
    } else {
      setLengthInches(null);
    }
    logEvent("wizard.preset_applied", { hasFlies, rodWeight: rod.rodWeight, line: rod.lineProfile });
    if (hasFlies) setPhase("spot");
    else setPhase("flies");
    toast.success("Rig applied — pick a spot to start");
  }

  // -------- Per-phase Next-enabled rules --------
  const canAdvance = (() => {
    switch (phase) {
      case "rod":
        if (rodSubStep === "weight") return state.rodWeight != null;
        return state.rodLengthFt != null;
      case "line": return !!state.lineProfile;
      case "leader": return true; // optional — LeaderPicker stores partial
      case "style": return true;  // skip allowed
      case "droppers": return state.flyCount >= 1;
      case "flies": {
        const positions = positionsForFlyCount(state.flyCount);
        return positions.every((pos) => state.flies[pos]?.name);
      }
      case "spot":
        // Spot is optional on Home sessions — there's no real water to anchor it to.
        if (venueName === "Home") return true;
        return spotName.trim().length > 0;
    }
  })();

  function goNext() {
    if (phase === "rod" && rodSubStep === "weight") {
      setRodSubStep("length");
      return;
    }
    const next = PHASES[phaseIdx + 1];
    if (next) {
      setPhase(next);
      if (next === "rod") setRodSubStep("weight");
    }
  }

  function goBack() {
    if (phase === "rod" && rodSubStep === "length") {
      setRodSubStep("weight");
      return;
    }
    const prev = PHASES[phaseIdx - 1];
    if (prev) {
      setPhase(prev);
      if (prev === "rod") setRodSubStep("length");
    } else {
      onCancel();
    }
  }

  async function handleStart() {
    if (committing) return;
    setCommitting(true);
    try {
      logEvent("wizard.commit", {
        rod_weight: state.rodWeight,
        rod_length_ft: state.rodLengthFt,
        line: state.lineProfile,
        style: state.style,
        fly_count: state.flyCount,
        saved_preset: savePreset,
      });
      await onComplete({
        rod: state,
        spotName: spotName.trim() || null,
        plan: plan.trim() || null,
        keepLimit: keepLimit ? parseInt(keepLimit, 10) : null,
        savePreset: savePreset
          ? {
              name: presetName.trim() || `${state.style ?? "Rig"} · ${state.flyCount}-fly · ${state.lineProfile ?? ""}`.trim(),
              includeFlies: presetIncludeFlies,
            }
          : null,
      });
    } finally {
      setCommitting(false);
    }
  }

  // -------- Rendering helpers --------
  const lengthOptionsInches = useMemo(() => {
    if (state.rodWeight == null) return [];
    return rodLengthInchesForWeight(state.rodWeight);
  }, [state.rodWeight]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-xs font-medium text-muted-foreground" aria-current="step">
          {phaseIdx + 1}/{PHASES.length} · {PHASE_LABEL[phase]}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      {/* Saved rigs banner only on first phase — placed above RigSoFar so it's first in view */}
      {phase === "rod" && rodSubStep === "weight" && (
        <SavedRigsBanner
          userId={userId}
          venueWaterType={venueWaterType}
          onApply={(p) => applyPreset(p.rod, p.hasFlies)}
        />
      )}

      {/* RigSoFar */}
      <RigSoFarCard state={state} />

      {/* Phase body */}
      <div className="min-h-[280px]">
        {phase === "rod" && rodSubStep === "weight" && (
          <RodWeightStep value={state.rodWeight} onChange={(v) => setState((s) => ({ ...s, rodWeight: v }))} />
        )}
        {phase === "rod" && rodSubStep === "length" && state.rodWeight != null && (
          <RodLengthStep
            options={lengthOptionsInches}
            valueInches={lengthInches}
            unit={lengthUnit}
            onUnitChange={setLengthUnit}
            onChange={setLengthInches}
          />
        )}

        {phase === "line" && state.rodWeight != null && (
          <LineStep
            options={linesForWeight(state.rodWeight)}
            value={state.lineProfile}
            onChange={(v) => setState((s) => ({ ...s, lineProfile: v }))}
          />
        )}

        {phase === "leader" && (
          <LeaderPicker
            value={leaderValueFromState(state)}
            onChange={(v) => setState((s) => ({
              ...s,
              leaderId: v.leader_id ?? null,
              leaderMaterial: (v.material as any) ?? null,
              leaderLengthFt: v.length_ft ?? null,
              leaderStrengthLb: v.strength_lb ?? null,
            }))}
            prefillUserId={userId}
          />
        )}

        {phase === "style" && (
          <StyleStep
            value={state.style}
            onChange={(v) => setState((s) => ({ ...s, style: v }))}
          />
        )}

        {phase === "droppers" && (
          <DroppersStep
            value={state.flyCount}
            onChange={(v) => setState((s) => ({ ...s, flyCount: v as any, flies: trimFlies(s.flies, v) }))}
          />
        )}

        {phase === "flies" && (
          <FliesStep
            flyCount={state.flyCount}
            flies={state.flies}
            onPick={(pos) => setFlyPickerPos(pos)}
          />
        )}

        {phase === "spot" && (
          <SpotStep
            spotName={spotName} setSpotName={setSpotName}
            plan={plan} setPlan={setPlan}
            keepLimit={keepLimit} setKeepLimit={setKeepLimit}
            savePreset={savePreset} setSavePreset={setSavePreset}
            presetIncludeFlies={presetIncludeFlies} setPresetIncludeFlies={setPresetIncludeFlies}
            presetName={presetName} setPresetName={setPresetName}
            defaultPresetName={`${state.style ?? "Rig"} · ${state.flyCount}-fly · ${state.lineProfile ?? ""}`}
          />
        )}
      </div>

      {/* Footer */}
      <div className="pt-2">
        {phase === "spot" ? (
          <>
            <Button
              onClick={handleStart}
              disabled={!canAdvance || committing}
              className="w-full min-h-[52px] text-base font-medium"
            >
              {committing ? "Starting…" : "Start fishing"}
            </Button>
            {!canAdvance && !committing && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                {venueName === "Home"
                  ? "Pick all rod fields above to start."
                  : "Add a spot to start (e.g. South bank, Boat 7)."}
              </p>
            )}
          </>
        ) : (
          <div className="flex gap-2">
            {phase === "style" && (
              <Button variant="ghost" onClick={goNext} className="flex-1 min-h-[44px]">
                Skip
              </Button>
            )}
            <Button
              onClick={goNext}
              disabled={!canAdvance}
              className="flex-1 min-h-[52px] text-base"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Fly picker sheet */}
      <Sheet open={flyPickerPos != null} onOpenChange={(o) => !o && setFlyPickerPos(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{flyPickerPos ? positionLabel(flyPickerPos) : "Pick a fly"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {flyPickerPos && (
              <FlyPicker
                value={state.flies[flyPickerPos]?.name ?? null}
                currentStyle={state.style}
                currentLine={state.lineProfile}
                venueName={venueName}
                onChange={(res) => {
                  setState((s) => ({
                    ...s,
                    flies: { ...s.flies, [flyPickerPos]: { name: res.pattern, size: res.size } },
                  }));
                  setFlyPickerPos(null);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------- Helpers ----------

function leaderValueFromState(s: RodSetupState): LeaderValue {
  return {
    ...EMPTY_LEADER,
    leader_id: s.leaderId,
    material: s.leaderMaterial as any,
    length_ft: s.leaderLengthFt,
    strength_lb: s.leaderStrengthLb,
  };
}

function trimFlies(flies: RodSetupState["flies"], newCount: number): RodSetupState["flies"] {
  const allowed = new Set(positionsForFlyCount(newCount));
  const out: RodSetupState["flies"] = {};
  (Object.entries(flies) as [FlyPosition, any][]).forEach(([k, v]) => {
    if (allowed.has(k)) out[k] = v;
  });
  return out;
}

// ---------- RigSoFar ----------

function RigSoFarCard({ state }: { state: RodSetupState }) {
  const items: { k: string; v: string }[] = [];
  if (state.rodWeight) items.push({ k: "Rod", v: `${state.rodWeight}#${state.rodLengthFt ? ` · ${state.rodLengthFt.toFixed(1)}ft` : ""}` });
  if (state.lineProfile) items.push({ k: "Line", v: state.lineProfile });
  if (state.leaderMaterial) items.push({ k: "Leader", v: `${state.leaderMaterial}${state.leaderLengthFt ? ` · ${state.leaderLengthFt}ft` : ""}${state.leaderStrengthLb ? ` · ${state.leaderStrengthLb}lb` : ""}` });
  if (state.style) items.push({ k: "Style", v: state.style });
  if (state.flyCount) items.push({ k: "Cast", v: `${state.flyCount} fl${state.flyCount === 1 ? "y" : "ies"}` });
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {items.map((i) => (
          <span key={i.k}><span className="text-muted-foreground">{i.k}:</span> <span className="font-medium">{i.v}</span></span>
        ))}
      </div>
    </div>
  );
}

// ---------- Step components ----------

function RodWeightStep({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Rod weight</h2>
      <p className="text-sm text-muted-foreground mb-3">What weight rod are you using?</p>
      <div className="grid grid-cols-4 gap-2">
        {ROD_WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            aria-pressed={value === w}
            className={cn(
              "min-h-[56px] rounded-lg border text-base font-medium transition-all",
              value === w
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-primary/50"
            )}
          >
            {w}#
          </button>
        ))}
      </div>
    </div>
  );
}

function RodLengthStep({
  options, valueInches, unit, onUnitChange, onChange,
}: {
  options: number[];
  valueInches: number | null;
  unit: "ft" | "m";
  onUnitChange: (u: "ft" | "m") => void;
  onChange: (inches: number) => void;
}) {
  const dialOptions = options.map((inches) => ({
    value: inches,
    label: unit === "ft" ? inchesLabel(inches) : metresLabel(inches).replace(" m", ""),
  }));
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Rod length</h2>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["ft", "m"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onUnitChange(u)}
              className={cn("px-3 py-1 transition-colors", unit === u ? "bg-primary text-primary-foreground" : "bg-card")}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <Dial
        options={dialOptions}
        value={valueInches}
        onChange={onChange}
        ariaLabel="Rod length"
        ariaValueText={(v) => unit === "ft" ? inchesLabel(v) : metresLabel(v)}
      />
      <div className="text-center mt-2 text-sm text-muted-foreground">
        {valueInches != null && (unit === "ft" ? inchesLabel(valueInches) : metresLabel(valueInches))}
      </div>
    </div>
  );
}

function LineStep({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Line</h2>
      <p className="text-sm text-muted-foreground mb-3">Which line are you fishing?</p>
      <div className="space-y-2">
        {options.map((line) => (
          <button
            key={line}
            type="button"
            onClick={() => onChange(line)}
            aria-pressed={value === line}
            className={cn(
              "w-full min-h-[52px] rounded-lg border text-left px-4 font-medium transition-all flex items-center justify-between",
              value === line
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-primary/50"
            )}
          >
            <span>{line}</span>
            {value === line && <Check className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function StyleStep({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Style</h2>
      <p className="text-sm text-muted-foreground mb-3">How are you fishing?</p>
      <div className="grid grid-cols-3 gap-2">
        {STYLE_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={value === s}
            className={cn(
              "min-h-[56px] rounded-lg border text-sm font-medium px-2 transition-all",
              value === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-primary/50"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function DroppersStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const opts = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">How many flies?</h2>
      <p className="text-sm text-muted-foreground mb-3">Including the point fly.</p>
      <Dial
        options={opts}
        value={value}
        onChange={onChange}
        ariaLabel="Fly count"
        ariaValueText={(v) => v === 1 ? "Single fly" : `${v} flies`}
      />
      <div className="text-center mt-2 text-sm text-muted-foreground">
        {value === 1 ? "Single fly" : `${value} flies`}
      </div>
    </div>
  );
}

function FliesStep({
  flyCount, flies, onPick,
}: {
  flyCount: number;
  flies: RodSetupState["flies"];
  onPick: (pos: FlyPosition) => void;
}) {
  const positions = positionsForFlyCount(flyCount);
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Flies on the cast</h2>
      <p className="text-sm text-muted-foreground mb-3">Tap a position to pick a fly.</p>
      <div className="space-y-2">
        {positions.map((pos) => {
          const fly = flies[pos];
          return (
            <button
              key={pos}
              type="button"
              onClick={() => onPick(pos)}
              className="w-full min-h-[60px] rounded-lg border border-border bg-card px-4 py-3 text-left flex items-center justify-between hover:border-primary/50 transition-colors"
            >
              <div>
                <div className="text-xs text-muted-foreground">{positionLabel(pos)}</div>
                <div className={cn("text-sm font-medium mt-0.5", !fly?.name && "italic text-muted-foreground")}>
                  {fly?.name ? `${fly.name}${fly.size ? ` #${fly.size}` : ""}` : "Tap to pick a fly"}
                </div>
              </div>
              {fly?.name && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpotStep(props: {
  spotName: string; setSpotName: (v: string) => void;
  plan: string; setPlan: (v: string) => void;
  keepLimit: string; setKeepLimit: (v: string) => void;
  savePreset: boolean; setSavePreset: (v: boolean) => void;
  presetIncludeFlies: boolean; setPresetIncludeFlies: (v: boolean) => void;
  presetName: string; setPresetName: (v: string) => void;
  defaultPresetName: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Where on the venue?</Label>
        <Input
          value={props.spotName}
          onChange={(e) => props.setSpotName(e.target.value.slice(0, 80))}
          placeholder="Boat 7 / South bank / Dam wall…"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label>Today's plan</Label>
        <Textarea
          value={props.plan}
          onChange={(e) => props.setPlan(e.target.value)}
          placeholder="Static buzzers under indicator until risers"
          rows={3}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label>Keep limit</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={props.keepLimit}
          onChange={(e) => props.setKeepLimit(e.target.value)}
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1">0 = catch &amp; release</p>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="save-preset" className="cursor-pointer">Save this rig as a preset?</Label>
          <Switch id="save-preset" checked={props.savePreset} onCheckedChange={props.setSavePreset} />
        </div>
        {props.savePreset && (
          <div className="space-y-3 pt-2 border-t">
            <RadioGroup
              value={props.presetIncludeFlies ? "flies" : "rig"}
              onValueChange={(v) => props.setPresetIncludeFlies(v === "flies")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="rig" id="rig-only" />
                <Label htmlFor="rig-only" className="cursor-pointer">Rig only</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="flies" id="rig-flies" />
                <Label htmlFor="rig-flies" className="cursor-pointer">Rig + flies</Label>
              </div>
            </RadioGroup>
            <Input
              value={props.presetName}
              onChange={(e) => props.setPresetName(e.target.value)}
              placeholder={props.defaultPresetName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
