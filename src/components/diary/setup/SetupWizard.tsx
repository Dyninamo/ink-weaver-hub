import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RigSoFarCard, RodWeightStep, RodLengthStep, LineStep, StyleStep, DroppersStep, FliesStep } from "./wizardSteps";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LeaderPicker, { EMPTY_LEADER, type LeaderValue } from "@/components/diary/LeaderPicker";
import FlyPicker from "@/components/diary/FlyPicker";
import {
  EMPTY_ROD_SETUP,
  linesForWeight,
  rodLengthInchesForWeight,
  rodMedianInchesForWeight,
  inchesToFt,
  positionsForFlyCount,
  positionLabel,
  type RodSetupState,
  type FlyPosition,
} from "./vocabulary";
import { logEvent } from "@/services/eventLogger";
import ChooserView from "./ChooserView";
import SaveRigPromptDialog from "./SaveRigPromptDialog";
import { readPresetRod, isPresetComplete, isPresetRow, buildCommitPayload, type PresetRow } from "./presetSchema";

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
  // 205 §10.2 — null until profile loads (or stays null if no default set).
  const [keepLimit, setKeepLimit] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Synchronous double-fire guard. See prompt 203 §2.
  const commitInFlightRef = useRef(false);
  // Records dialog disposition so onOpenChange's outside-click branch only
  // fires when neither button was clicked.
  const dialogDispositionRef = useRef<null | "save" | "skip">(null);

  // Fly picker sheet
  const [flyPickerPos, setFlyPickerPos] = useState<FlyPosition | null>(null);

  // Chooser state
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [mode, setMode] = useState<"choose" | "wizard">("choose");
  // Per prompt 204 §4.1 — non-null. Default "new" before chooser flips it.
  const [path, setPath] = useState<"existing" | "new">("new");

  // Save-prompt dialog
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [savePromptIncludeFlies, setSavePromptIncludeFlies] = useState(false);

  // -------- Combined startup fetch (parallel) — 204 §8.2 --------
  const loadPresets = useCallback(async () => {
    setPresetsLoaded(false);
    setPresetError(null);
    const { data, error } = await supabase
      .from("user_presets")
      .select("id, name, rod, water_type, include_flies, last_used_at")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(8);
    if (error) {
      setPresetError(error.message || "Failed to load saved rigs");
      setPresetsLoaded(true);
      setMode("wizard");
      setPath("new");
      logEvent("wizard.chooser_skipped", { reason: "fetch_error", error: error.message });
      toast.error("Couldn't load saved rigs — starting fresh setup");
      return;
    }
    const rows = ((data ?? []) as any[]).filter(isPresetRow);
    const filtered = rows.filter((p) => !p.water_type || p.water_type === venueWaterType);
    setPresets(filtered);
    setPresetsLoaded(true);
    if (filtered.length === 0) {
      setMode("wizard");
      setPath("new");
      logEvent("wizard.chooser_skipped", { reason: "no_presets" });
    } else {
      logEvent("wizard.chooser_shown", { count: filtered.length });
    }
  }, [userId, venueWaterType]);

  // Re-run guard — once loaded for this (userId, venueWaterType), don't refetch
  // automatically. goBack() can call loadPresets() explicitly.
  const presetFetchOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const [profileResult] = await Promise.all([
        supabase
          .from("user_profiles")
          .select(
            "default_rod_weight, default_rod_length_ft, default_line_profile, default_leader_id, default_keep_limit, stillwater_default_rod_weight, stillwater_default_line, river_default_rod_weight, river_default_line"
          )
          .eq("id", userId)
          .maybeSingle(),
        presetFetchOnceRef.current ? Promise.resolve(null) : loadPresets(),
      ]);
      if (cancelled) return;
      presetFetchOnceRef.current = true;

      const p = (profileResult.data || {}) as any;
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
      setProfileLoaded(true);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [userId, venueWaterType, loadPresets]);

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

  // 204 §4.2 — wizard.mounted only fires inside the wizard fork.
  useEffect(() => {
    if (mode === "wizard") {
      logEvent("wizard.mounted", { path });
      return () => logEvent("wizard.unmounted", { path });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === "choose") {
      logEvent("wizard.chooser_mounted", null);
      return () => logEvent("wizard.chooser_unmounted", null);
    }
  }, [mode]);

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
    setPhase("flies");
    // 204 §5.2 — defer toast until next paint so the phase change lands first.
    requestAnimationFrame(() => toast.success("Rig applied — pick your flies"));
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
      // First phase. If presets exist, drop back to chooser & refetch.
      if (presets.length > 0) {
        setMode("choose");
        setPath("new");
        setState(EMPTY_ROD_SETUP);
        setLengthInches(null);
        setPhase("rod");
        setRodSubStep("weight");
        // 204 §5.4 — refetch on chooser return.
        presetFetchOnceRef.current = false;
        void loadPresets();
      } else {
        onCancel();
      }
    }
  }

  async function handleStart() {
    if (commitInFlightRef.current) return;
    if (!profileLoaded) {
      toast.message("Loading profile…");
      return;
    }
    // 204 §2 — existing-rig path: skip the dialog to avoid duplicate-rig spam.
    if (path === "existing") {
      logEvent("wizard.save_prompt_skipped", { reason: "existing_path" });
      void doCommit(null);
      return;
    }
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
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    setCommitting(true);
    try {
      logEvent("wizard.commit", buildCommitPayload({
        state, path, skipped_wizard: false, saved_preset: !!savePreset,
      }));
      await onComplete({
        rod: state,
        spotName: null,
        plan: null,
        keepLimit: keepLimit ? parseInt(keepLimit, 10) : null,
        savePreset,
      });
    } finally {
      setCommitting(false);
    }
  }

  // Chooser handlers ----------------------------------------------------

  async function handlePickExisting(p: PresetRow) {
    setPath("existing");
    void supabase
      .from("user_presets")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", p.id);
    const rod = readPresetRod(p.rod);
    const complete = isPresetComplete(rod);
    const hasFlies = !!p.include_flies && complete;

    logEvent("wizard.chooser_picked_existing", {
      preset_id: p.id,
      had_flies: hasFlies,
      skipped_wizard: hasFlies,
      preset_complete: complete,
      include_flies_flag: !!p.include_flies,
    });

    if (hasFlies) {
      if (commitInFlightRef.current) return;
      if (!profileLoaded) {
        toast.message("Loading profile…");
        return;
      }
      commitInFlightRef.current = true;
      setCommitting(true);
      try {
        logEvent("wizard.commit", buildCommitPayload({
          state: rod, path: "existing", skipped_wizard: true, saved_preset: false,
        }));
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

    // Incomplete or include_flies=false → fill remaining flies in the wizard.
    applyPreset(rod, false);
    setMode("wizard");
  }

  function handleChooserCancel() {
    logEvent("wizard.chooser_cancelled", { existing_count: presets.length });
    onCancel();
  }

  // -------- Rendering helpers --------
  const lengthOptionsInches = useMemo(() => {
    if (state.rodWeight == null) return [];
    return rodLengthInchesForWeight(state.rodWeight);
  }, [state.rodWeight]);

  return (
    <div className="space-y-4">
      {mode === "choose" && !presetsLoaded && (
        <div className="space-y-6 py-8 flex flex-col items-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">Loading your saved rigs…</p>
        </div>
      )}

      {mode === "choose" && presetsLoaded && (
        <ChooserView
          presets={presets}
          onCancel={handleChooserCancel}
          onPickExisting={handlePickExisting}
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

          <SaveRigPromptDialog
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
            name={savePromptName}
            onNameChange={setSavePromptName}
            includeFlies={savePromptIncludeFlies}
            onIncludeFliesChange={setSavePromptIncludeFlies}
            onSkip={() => {
              if (dialogDispositionRef.current !== null) return;
              dialogDispositionRef.current = "skip";
              setSavePromptOpen(false);
              logEvent("wizard.save_prompt_dismissed", { reason: "skip" });
              void doCommit(null);
            }}
            onSave={() => {
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
          />
        </>
      )}
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

// Step components live in ./wizardSteps
