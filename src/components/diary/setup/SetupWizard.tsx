import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LeaderPicker, { EMPTY_LEADER, type LeaderValue } from "@/components/diary/LeaderPicker";
import FlyPicker from "@/components/diary/FlyPicker";
import Dial from "./Dial";
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

type Phase = "rod" | "line" | "leader" | "style" | "droppers" | "flies";
const PHASES: Phase[] = ["rod", "line", "leader", "style", "droppers", "flies"];
const PHASE_LABEL: Record<Phase, string> = {
  rod: "Rod",
  line: "Line",
  leader: "Leader",
  style: "Style",
  droppers: "Droppers",
  flies: "Flies",
};

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

interface PresetRow {
  id: string;
  name: string;
  rod: RodSetupState & { id?: string };
  water_type: string | null;
  include_flies: boolean;
  last_used_at: string;
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
  const [keepLimit, setKeepLimit] = useState<string>("2");

  // Synchronous double-fire guard. Replaces the state-based `committing` flag,
  // which was racy because React batches setState within an event tick and two
  // callers in the same tick could both observe `committing === false`.
  const commitInFlightRef = useRef(false);
  // Records which path closed the dialog so onOpenChange's outside-click branch
  // only fires when neither button was clicked.
  const dialogDispositionRef = useRef<null | "save" | "skip">(null);

  // Fly picker sheet
  const [flyPickerPos, setFlyPickerPos] = useState<FlyPosition | null>(null);

  // Chooser state
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [mode, setMode] = useState<"choose" | "wizard">("choose");
  const [path, setPath] = useState<"existing" | "new" | null>(null);

  // Save-prompt dialog
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [savePromptIncludeFlies, setSavePromptIncludeFlies] = useState(false);

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

  // -------- Load presets for chooser --------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("user_presets")
        .select("id, name, rod, water_type, include_flies, last_used_at")
        .eq("user_id", userId)
        .order("last_used_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const rows = (error || !data ? [] : data) as unknown as PresetRow[];
      // Filter by stillwater/river only — never by specific venue.
      const filtered = rows.filter(
        (p) => !p.water_type || p.water_type === venueWaterType
      );
      setPresets(filtered);
      setPresetsLoaded(true);
      if (filtered.length === 0) {
        setMode("wizard");
        setPath("new");
        logEvent("wizard.chooser_skipped", { reason: "no_presets" });
      } else {
        logEvent("wizard.chooser_shown", { count: filtered.length });
      }
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

  useEffect(() => {
    if (mode === "wizard") logEvent("wizard.phase_enter", { phase, rodSubStep });
  }, [phase, rodSubStep, mode]);

  // Per prompt 201 §3.4 — mount/unmount events.
  useEffect(() => {
    logEvent("wizard.mounted", null);
    return () => logEvent("wizard.unmounted", null);
  }, []);

  function applyPreset(rod: RodSetupState, hasFlies: boolean) {
    setState((s) => ({
      ...s,
      ...rod,
      flyCount: (rod.flyCount as any) ?? 2,
      flies: rod.flies ?? {},
    }));
    if (rod.rodLengthFt) {
      setLengthInches(Math.round(rod.rodLengthFt * 12));
    } else if (rod.rodWeight != null) {
      setLengthInches(rodMedianInchesForWeight(rod.rodWeight));
    } else {
      setLengthInches(null);
    }
    logEvent("wizard.preset_applied", { hasFlies, rodWeight: rod.rodWeight, line: rod.lineProfile });
    // Always jump to flies — only chooser path that calls applyPreset is existing-no-flies.
    setPhase("flies");
    toast.success("Rig applied — pick your flies");
  }

  // -------- Per-phase Next-enabled rules --------
  const canAdvance = (() => {
    switch (phase) {
      case "rod":
        if (rodSubStep === "weight") return state.rodWeight != null;
        return state.rodLengthFt != null;
      case "line": return !!state.lineProfile;
      case "leader": return true;
      case "style": return true;
      case "droppers": return state.flyCount >= 1;
      case "flies": {
        const positions = positionsForFlyCount(state.flyCount);
        return positions.every((pos) => state.flies[pos]?.name);
      }
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
      // First phase. If presets exist, drop back to chooser.
      if (presets.length > 0) {
        setMode("choose");
        setPath(null);
        setState(EMPTY_ROD_SETUP);
        setLengthInches(null);
        setPhase("rod");
        setRodSubStep("weight");
      } else {
        onCancel();
      }
    }
  }

  async function handleStart() {
    if (commitInFlightRef.current) return;
    const defaultName = `${state.style ?? "Rig"} · ${state.flyCount}-fly · ${state.lineProfile ?? ""}`.trim();
    setSavePromptName(defaultName);
    setSavePromptIncludeFlies(false);
    dialogDispositionRef.current = null;
    setSavePromptOpen(true);
    logEvent("wizard.save_prompt_shown", {
      rod_weight: state.rodWeight,
      fly_count: state.flyCount,
      style: state.style,
      line: state.lineProfile,
      existing_preset_count: presets.length,
      path,
    });
  }

  async function doCommit(savePreset: { name: string; includeFlies: boolean } | null) {
    if (commitInFlightRef.current) return;   // ref-checked, synchronous
    commitInFlightRef.current = true;
    setCommitting(true);
    try {
      logEvent("wizard.commit", {
        rod_weight: state.rodWeight,
        rod_length_ft: state.rodLengthFt,
        line: state.lineProfile,
        style: state.style,
        fly_count: state.flyCount,
        saved_preset: !!savePreset,
        path,
        skipped_wizard: false,
      });
      await onComplete({
        rod: state,
        spotName: null,
        plan: null,
        keepLimit: keepLimit ? parseInt(keepLimit, 10) : null,
        savePreset,
      });
    } finally {
      setCommitting(false);
      // Intentionally do NOT clear commitInFlightRef — once a session commits, the
      // wizard unmounts. If you ever add a non-unmounting commit path, clear it
      // explicitly there.
    }
  }

  // -------- Rendering helpers --------
  const lengthOptionsInches = useMemo(() => {
    if (state.rodWeight == null) return [];
    return rodLengthInchesForWeight(state.rodWeight);
  }, [state.rodWeight]);

  return (
    <div className="space-y-4">
      {mode === "choose" && presetsLoaded && (
        <ChooserView
          presets={presets}
          onCancel={onCancel}
          onPickExisting={async (p) => {
            setPath("existing");
            void supabase
              .from("user_presets")
              .update({ last_used_at: new Date().toISOString() })
              .eq("id", p.id);
            const rod = readPresetRod(p.rod);
            const hasFlies = !!(
              p.include_flies &&
              rod?.flies &&
              Object.values(rod.flies).some((f: any) => !!f?.name)
            );

            logEvent("wizard.chooser_picked_existing", {
              preset_id: p.id,
              had_flies: hasFlies,
              skipped_wizard: hasFlies,
            });

            if (hasFlies) {
              setState((s) => ({
                ...s,
                ...rod,
                flyCount: (rod.flyCount as any) ?? 2,
                flies: rod.flies ?? {},
              }));
              if (rod.rodLengthFt) {
                setLengthInches(Math.round(rod.rodLengthFt * 12));
              }
              if (commitInFlightRef.current) return;
              commitInFlightRef.current = true;
              setCommitting(true);
              try {
                logEvent("wizard.commit", {
                  rod_weight: rod.rodWeight,
                  rod_length_ft: rod.rodLengthFt,
                  line: rod.lineProfile,
                  style: rod.style,
                  fly_count: rod.flyCount,
                  saved_preset: false,
                  path: "existing",
                  skipped_wizard: true,
                });
                await onComplete({
                  rod,
                  spotName: null,
                  plan: null,
                  keepLimit: keepLimit ? parseInt(keepLimit, 10) : null,
                  savePreset: null,
                });
              } finally {
                setCommitting(false);
              }
              return;
            }

            applyPreset(rod, false);
            setMode("wizard");
          }}
          onPickNew={() => {
            setPath("new");
            setMode("wizard");
            logEvent("wizard.chooser_picked_new", { existing_count: presets.length });
          }}
        />
      )}

      {mode === "wizard" && (
        <>
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

          {/* RigSoFar */}
          <RigSoFarCard state={state} />

          {/* Phase body */}
          <div className="min-h-[220px]">
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
          </div>

          {/* Footer */}
          <div className="pt-2">
            {phase === "flies" ? (
              <Button
                onClick={handleStart}
                disabled={!canAdvance || committing}
                className="w-full min-h-[48px] text-base font-medium"
              >
                {committing ? "Starting…" : "Start fishing"}
              </Button>
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
                  className="flex-1 min-h-[48px] text-base"
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

          {/* Save-this-rig prompt */}
          <AlertDialog
            open={savePromptOpen}
            onOpenChange={(open) => {
              setSavePromptOpen(open);
              if (open) return;
              if (dialogDispositionRef.current === null) {
                dialogDispositionRef.current = "skip";
                logEvent("wizard.save_prompt_dismissed", { reason: "outside_click" });
                void doCommit(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save this rig for next time?</AlertDialogTitle>
                <AlertDialogDescription>
                  Saved rigs appear at the top of the wizard so you can re-use them with one tap.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="save-prompt-name">Rig name</Label>
                  <Input
                    id="save-prompt-name"
                    value={savePromptName}
                    onChange={(e) => setSavePromptName(e.target.value)}
                    placeholder="e.g. Buzzer 3-fly stillwater"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="save-prompt-include-flies"
                    checked={savePromptIncludeFlies}
                    onCheckedChange={setSavePromptIncludeFlies}
                  />
                  <Label htmlFor="save-prompt-include-flies" className="cursor-pointer">
                    Include today's fly choices in the saved rig
                  </Label>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    if (dialogDispositionRef.current !== null) return;
                    dialogDispositionRef.current = "skip";
                    setSavePromptOpen(false);
                    logEvent("wizard.save_prompt_dismissed", { reason: "skip" });
                    void doCommit(null);
                  }}
                >
                  Skip — just start
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (dialogDispositionRef.current !== null) return;
                    dialogDispositionRef.current = "save";
                    const name = savePromptName.trim() || `${state.style ?? "Rig"} · ${state.flyCount}-fly · ${state.lineProfile ?? ""}`.trim();
                    setSavePromptOpen(false);
                    logEvent("wizard.save_prompt_accepted", {
                      name,
                      include_flies: savePromptIncludeFlies,
                    });
                    void doCommit({ name, includeFlies: savePromptIncludeFlies });
                  }}
                >
                  Save it
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

// ---------- Chooser ----------

function ChooserView({
  presets,
  onPickExisting,
  onPickNew,
  onCancel,
}: {
  presets: PresetRow[];
  onPickExisting: (p: PresetRow) => void;
  onPickNew: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Pick a rig</h3>
          <p className="text-sm text-muted-foreground">
            Tap a saved rig to use it, or create a new one from scratch.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground px-1">
          Your saved rigs
        </div>
        <div className="space-y-2">
          {presets.map((p) => {
            const rod = readPresetRod(p.rod);
            const subtitle = [
              rod.rodWeight ? `#${rod.rodWeight}` : null,
              rod.lineProfile,
              rod.style,
              `${rod.flyCount ?? "?"}-fly`,
            ].filter(Boolean).join(" · ");
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickExisting(p)}
                className="w-full text-left px-4 py-3 rounded-lg border bg-card hover:border-primary transition-colors"
              >
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <Button variant="outline" className="w-full" onClick={onPickNew}>
          Create new rig
        </Button>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

// Defensive reader for user_presets.rod — tolerates pre-203 legacy keys.
// Once the §1.3 migration is verified clean, this can be removed (prompt 205-ish).
function readPresetRod(blob: any): RodSetupState {
  const rodLengthFt =
    typeof blob?.rodLengthFt === "number"
      ? blob.rodLengthFt
      : typeof blob?.rodLength === "string"
      ? parseFloat(blob.rodLength.replace(/ft$/, ""))
      : null;
  const leaderLengthFt =
    typeof blob?.leaderLengthFt === "number"
      ? blob.leaderLengthFt
      : typeof blob?.leaderLength === "string"
      ? parseFloat(blob.leaderLength.replace(/ft$/, ""))
      : null;
  return {
    rodWeight: blob?.rodWeight ?? null,
    rodLengthFt: Number.isFinite(rodLengthFt) ? rodLengthFt : null,
    lineProfile: blob?.lineProfile ?? blob?.line ?? null,
    leaderId: blob?.leaderId ?? null,
    leaderMaterial: blob?.leaderMaterial ?? null,
    leaderLengthFt: Number.isFinite(leaderLengthFt) ? leaderLengthFt : null,
    leaderStrengthLb: blob?.leaderStrengthLb ?? null,
    style: blob?.style ?? null,
    flyCount: (blob?.flyCount ?? 2) as RodSetupState["flyCount"],
    flies: blob?.flies ?? {},
  };
}

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
              "min-h-[48px] rounded-lg border text-base font-medium transition-all",
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
              "w-full min-h-[44px] rounded-lg border text-left px-4 font-medium transition-all flex items-center justify-between",
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
              "min-h-[48px] rounded-lg border text-sm font-medium px-2 transition-all",
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
              className="w-full min-h-[52px] rounded-lg border border-border bg-card px-4 py-3 text-left flex items-center justify-between hover:border-primary/50 transition-colors"
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
