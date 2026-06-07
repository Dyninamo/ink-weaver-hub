/**
 * CatchFlow — single-screen full-page catch entry (prompt 142).
 *
 * Replaces the 6-step CatchModal dialog with a vertically-scrolling form.
 * The angler can fill fields in any order and tap Save once; the footer CTA
 * shows a live summary of the catch as fields are filled.
 *
 * Treats fly identity as ROD-OWNED. The position's assigned fly is read from
 * `session_rods.flies_on_cast` (set by the wizard in prompt 141). Correcting
 * the fly mid-catch writes a `change` event to `session_events` and updates
 * the rod's flies_on_cast jsonb.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/services/eventLogger";
import FlyPicker from "./FlyPicker";
import { addEvent, type WeatherSnapshot } from "@/services/diaryService";
import { retrievesForStyle, depthsForStyle } from "@/services/styleRules";
import { positionsForFlyCount, positionLabel, type FlyPosition } from "@/components/diary/setup/vocabulary";
import { parseWeight, parseLength } from "@/lib/parseSize";
import { isOfflineError } from "@/hooks/useOnlineStatus";

// -------- Species vocabulary (prompt 142 §3) --------
const SPECIES_BY_VENUE: Record<"stillwater" | "river", string[]> = {
  stillwater: ["Rainbow", "Brown Trout", "Brook Trout", "Tiger Trout", "Blue Trout"],
  river: ["Brown Trout", "Grayling", "Sea Trout", "Salmon", "Rainbow"],
};

/** Title-case "brown trout" → "Brown Trout" so prefilled defaults match canonical. */
function canonicaliseSpecies(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/\b(\w)/g, (c) => c.toUpperCase());
}

interface FlyOnCast { pattern: string; size: number | null }
type FliesOnCast = Record<string, FlyOnCast>;

interface SessionRodLite {
  id: string;
  session_id: string;
  rod_index: number;
  style: string | null;
  flies_on_cast: FliesOnCast | null;
  dropper_count: number | null;
  line_profile: string | null;
}

interface CatchFlowProps {
  sessionId: string;
  rodIndex: number;          // 0-based
  venueType: "stillwater" | "river";
  venueName: string;
  defaultSpecies?: string | null;   // from user_profiles (may be lowercased)
  carryRetrieve?: string | null;    // last known retrieve from session events
  carryDepth?: string | null;       // last known depth_zone from session events
  latestWeather?: WeatherSnapshot | null;
  onCancel: () => void;
  onSaved: () => void;
}

export default function CatchFlow({
  sessionId, rodIndex, venueType, venueName,
  defaultSpecies, carryRetrieve, carryDepth,
  latestWeather, onCancel, onSaved,
}: CatchFlowProps) {
  const [rod, setRod] = useState<SessionRodLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Derived flies map (local mutable copy so corrections don't commit until Save)
  const [localFlies, setLocalFlies] = useState<FliesOnCast>({});
  // Track corrections for change-event emission on save
  const [flyCorrections, setFlyCorrections] = useState<
    { id: string; position: string; from: FlyOnCast | null; to: FlyOnCast; reason: string }[]
  >([]);
  // Idempotent retry tracking (prompt 166)
  const [persistedCorrectionIds, setPersistedCorrectionIds] = useState<Set<string>>(new Set());
  const [rodPersisted, setRodPersisted] = useState(false);

  // Form state
  const [position, setPosition] = useState<string>("point");
  const [species, setSpecies] = useState<string | null>(null);
  const [otherSpeciesText, setOtherSpeciesText] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [measureMode, setMeasureMode] = useState<"weight" | "length">("weight");
  const [weightLbDecimal, setWeightLbDecimal] = useState("");
  const [lengthIn, setLengthIn] = useState("");
  const [retrieve, setRetrieve] = useState<string | null>(null);
  const [depthZone, setDepthZone] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"released" | "kept">("released");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  // Fly picker sheet state — null = closed
  const [pickerForPos, setPickerForPos] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // -------- Load active rod --------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("session_rods" as any)
        .select("id, session_id, rod_index, style, flies_on_cast, dropper_count, line_profile")
        .eq("session_id", sessionId)
        .eq("rod_index", rodIndex)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Couldn't load rod setup");
        onCancel();
        return;
      }
      const r = data as unknown as SessionRodLite;
      setRod(r);
      const flies = (r.flies_on_cast as FliesOnCast | null) ?? {};
      setLocalFlies(flies);
      // Default selected position: 'point' if present, else first available
      const flyCount = (r.dropper_count ?? 0) + 1;
      const positions = positionsForFlyCount(flyCount);
      const defaultPos = positions.includes("point" as FlyPosition) ? "point" : (positions[0] ?? "point");
      setPosition(defaultPos);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, rodIndex, onCancel]);

  // -------- Default species when venueType / defaultSpecies arrives --------
  useEffect(() => {
    const allowed = SPECIES_BY_VENUE[venueType];
    const canonical = canonicaliseSpecies(defaultSpecies);
    if (canonical && allowed.includes(canonical)) {
      setSpecies(canonical);
    } else {
      setSpecies(allowed[0] ?? null);
    }
  }, [venueType, defaultSpecies]);

  // -------- Default retrieve / depth from carry-forward --------
  useEffect(() => {
    if (!rod) return;
    const allowedR = retrievesForStyle(rod.style);
    const allowedD = depthsForStyle(rod.style);
    setRetrieve(carryRetrieve && allowedR.includes(carryRetrieve) ? carryRetrieve : (allowedR.length === 1 ? allowedR[0] : null));
    setDepthZone(carryDepth && allowedD.includes(carryDepth) ? carryDepth : (allowedD.length === 1 ? allowedD[0] : null));
  }, [rod, carryRetrieve, carryDepth]);

  const flyCount = (rod?.dropper_count ?? 0) + 1;
  const positions = useMemo(() => positionsForFlyCount(flyCount), [flyCount]);
  const allowedRetrieves = useMemo(() => retrievesForStyle(rod?.style), [rod?.style]);
  const allowedDepths = useMemo(() => depthsForStyle(rod?.style), [rod?.style]);

  const assignedFly: FlyOnCast | null = localFlies[position] ?? null;
  const hasFly = !!assignedFly?.pattern;

  // Hide retrieve/depth row only if pruned to a single option AND it equals the carried value.
  const hideRetrieve = allowedRetrieves.length === 1 && retrieve === allowedRetrieves[0];
  const hideDepth = allowedDepths.length === 1 && depthZone === allowedDepths[0];

  const speciesEffective = showOther ? otherSpeciesText.trim() : species;

  // Prompt 234 — shared validation. Empty is allowed (size is optional);
  // any non-empty value must pass parseWeight/parseLength.
  const weightParsed = useMemo(() => parseWeight(weightLbDecimal), [weightLbDecimal]);
  const lengthParsed = useMemo(() => parseLength(lengthIn), [lengthIn]);
  const sizeError =
    measureMode === "weight"
      ? (weightLbDecimal ? weightParsed.error : null)
      : (lengthIn ? lengthParsed.error : null);
  const sizeLabel = measureMode === "weight" ? weightParsed.display : lengthParsed.display;

  const canSave = hasFly && !!speciesEffective && !saving && !sizeError;
  const dirty = hasFly && (!!speciesEffective || !!sizeLabel || flyCorrections.length > 0 || notes.trim().length > 0);

  const ctaLabel = (() => {
    if (!speciesEffective || !sizeLabel) return "Save catch";
    return `Save · ${speciesEffective} ${sizeLabel} · ${outcome}`;
  })();

  function handleFlyPicked(pos: string, picked: { pattern: string; size: number | null }) {
    const prev = localFlies[pos] ?? null;
    const newEntry: FlyOnCast = { pattern: picked.pattern, size: picked.size ?? null };
    setLocalFlies((m) => ({ ...m, [pos]: newEntry }));
    setFlyCorrections((arr) => [
      ...arr.filter((c) => c.position !== pos),
      {
        id: crypto.randomUUID(),
        position: pos,
        from: prev,
        to: newEntry,
        reason: prev ? "catch correction" : "recovered missing fly assignment",
      },
    ]);
    logEvent("catch.fly_correction", { session_id: sessionId, position: pos, was_missing: !prev }, sessionId);
    setPickerForPos(null);
  }

  async function handleSave() {
    if (!rod || !canSave) return;
    setSaving(true);
    try {
      // 1. Build weight/length payload via shared parser (prompt 234).
      let weight_lb: number | null = null;
      let weight_oz: number | null = null;
      let length_inches: number | null = null;
      let weight_display: string | null = null;
      if (measureMode === "weight" && weightParsed.ok) {
        weight_lb = weightParsed.lb;
        weight_oz = weightParsed.oz;
        weight_display = weightParsed.display;
      } else if (measureMode === "length" && lengthParsed.ok) {
        length_inches = lengthParsed.inches;
        weight_display = lengthParsed.display;
      }

      // 2. Write the catch row FIRST. If it fails, no journal/rod state has
      //    drifted — user can retry cleanly.
      await addEvent({
        session_id: sessionId,
        event_type: "catch",
        event_time: new Date().toISOString(),
        species: speciesEffective,
        weight_lb,
        weight_oz,
        length_inches,
        measurement_mode: measureMode,
        weight_display,
        fly_pattern: localFlies[position]?.pattern ?? null,
        fly_size: localFlies[position]?.size ?? null,
        rig_position: position,
        retrieve,
        depth_zone: depthZone,
        style: rod.style,
        flies_on_cast: localFlies as any,
        notes: notes.trim() || null,
        event_temp: latestWeather?.temp ?? null,
        event_wind_speed: latestWeather?.wind_speed ?? null,
        event_wind_dir: latestWeather?.wind_dir ?? null,
        event_pressure: latestWeather?.pressure ?? null,
        event_conditions: latestWeather?.conditions ?? null,
        kept_released: outcome,
      } as any);

      // 3. Write change events for fly corrections (best-effort, idempotent).
      const newlyPersisted = new Set<string>(persistedCorrectionIds);
      for (const c of flyCorrections) {
        if (newlyPersisted.has(c.id)) continue;
        try {
          await addEvent({
            session_id: sessionId,
            event_type: "change",
            event_time: new Date().toISOString(),
            change_from: c.from ? { fly: c.from } : { fly: null },
            change_to: { fly: c.to },
            change_reason: c.reason,
            rig_position: c.position,
            fly_pattern: c.to.pattern,
            fly_size: c.to.size ?? null,
          } as any);
          newlyPersisted.add(c.id);
        } catch (changeErr: any) {
          logEvent("error", {
            context: "catch_correction_journal",
            message: changeErr?.message ?? String(changeErr),
          }, sessionId);
        }
      }
      setPersistedCorrectionIds(newlyPersisted);

      // 4. Update session_rods.flies_on_cast LAST. Non-blocking on failure.
      if (flyCorrections.length > 0 && !rodPersisted) {
        const { error: rodErr } = await supabase
          .from("session_rods" as any)
          .update({ flies_on_cast: localFlies as any })
          .eq("id", rod.id);
        if (rodErr) {
          logEvent("error", { context: "catch_rod_update", message: rodErr.message }, sessionId);
          toast.warning("Catch saved, but rod state didn't update — fix in Change next time.");
        } else {
          setRodPersisted(true);
        }
      }

      logEvent("catch.saved", {
        session_id: sessionId,
        rod_index: rodIndex,
        position,
        species: speciesEffective,
        measurement_mode: measureMode,
        weight_lb,
        weight_oz,
        length_inches,
        retrieve,
        depth_zone: depthZone,
        outcome,
        fly_corrections: flyCorrections.length,
        persisted_corrections: newlyPersisted.size,
      }, sessionId);
      toast.success("Catch saved");
      onSaved();
    } catch (err: any) {
      logEvent("error", { context: "catch_save", message: err?.message ?? String(err) }, sessionId);
      console.error("Catch save failed:", err);
      if (err?.queued) {
        toast.success("Saved offline — will sync when you're back online");
        onSaved();
      } else if (isOfflineError(err)) {
        toast.error("Couldn't save — you're offline. Tap to retry.");
      } else {
        toast.error(err?.message || "Failed to save catch");
      }
      // Don't dismiss — preserve user input.
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (dirty) setConfirmDiscard(true);
    else onCancel();
  }

  if (loading || !rod) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading rod…</p>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="max-w-[440px] mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <div className="h-1 bg-diary-catch" />
          <div className="flex items-center gap-2 p-3">
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold font-diary">Log a catch</h1>
          </div>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* 1. Position picker — only for multi-fly rigs */}
          {flyCount > 1 && (
            <section role="radiogroup" aria-label="Rig position">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Position</h2>
              <div className="space-y-1.5">
                {positions.map((pos) => {
                  const fly = localFlies[pos];
                  const selected = pos === position;
                  const missing = !fly?.pattern;
                  return (
                    <button
                      key={pos}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setPosition(pos);
                        if (missing) setPickerForPos(pos);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors min-h-[48px]",
                        selected ? "bg-primary/5 border-primary" : "bg-card border-border hover:border-primary/40",
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{positionLabel(pos as FlyPosition)}</span>
                        <span className={cn("text-xs italic", missing ? "text-amber-600" : "text-muted-foreground")}>
                          {missing
                            ? "No fly set — tap to assign"
                            : `${fly!.pattern}${fly!.size ? ` #${fly!.size}` : ""}`}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. AssignedFlyCard / missing-fly recovery */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Fly</h2>
            {hasFly ? (
              <button
                type="button"
                onClick={() => setPickerForPos(position)}
                className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-border bg-card hover:border-primary/40 text-left min-h-[48px]"
              >
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{positionLabel(position as FlyPosition)}</span>
                  <span className="text-base font-medium">
                    {assignedFly!.pattern}{assignedFly!.size ? ` #${assignedFly!.size}` : ""}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : (
              <div role="alert" className="rounded-lg border border-amber-500/60 bg-amber-50 dark:bg-amber-950/20 p-3">
                <button
                  type="button"
                  onClick={() => setPickerForPos(position)}
                  className="w-full text-left flex items-start gap-2"
                >
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-100">No fly assigned to this position</span>
                    <span className="text-xs text-amber-700 dark:text-amber-300">Tap to set the fly before saving</span>
                  </div>
                </button>
              </div>
            )}
          </section>

          {/* 3. Species */}
          <section role="radiogroup" aria-label="Species" aria-required="true">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Species</h2>
            <div className="flex flex-wrap gap-2">
              {SPECIES_BY_VENUE[venueType].map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={!showOther && species === s}
                  onClick={() => { setSpecies(s); setShowOther(false); }}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm border min-h-[44px]",
                    !showOther && species === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/40",
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={showOther}
                onClick={() => { setShowOther(true); }}
                className={cn(
                  "px-3 py-2 rounded-full text-sm border min-h-[44px]",
                  showOther
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary/40",
                )}
              >
                Other
              </button>
            </div>
            {showOther && (
              <input
                type="text"
                maxLength={40}
                value={otherSpeciesText}
                onChange={(e) => setOtherSpeciesText(e.target.value)}
                placeholder="Species name…"
                autoFocus
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </section>

          {/* 4. Measure-by + numeric input */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Size</h2>
            <div role="radiogroup" aria-label="Measurement mode" className="flex rounded-md border overflow-hidden mb-2 text-sm">
              {(["weight", "length"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={measureMode === m}
                  onClick={() => {
                    setMeasureMode(m);
                    if (m === "weight") setLengthIn("");
                    else setWeightLbDecimal("");
                  }}
                  className={cn(
                    "flex-1 px-3 py-2 capitalize transition-colors min-h-[44px]",
                    measureMode === m ? "bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            {measureMode === "weight" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={weightLbDecimal}
                  onChange={(e) => setWeightLbDecimal(e.target.value)}
                  aria-invalid={!!sizeError}
                  className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-xl md:text-2xl font-mono text-center"
                />
                <span className="text-base text-muted-foreground">lb</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={lengthIn}
                  onChange={(e) => setLengthIn(e.target.value)}
                  aria-invalid={!!sizeError}
                  className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-xl md:text-2xl font-mono text-center"
                />
                <span className="text-base text-muted-foreground">in</span>
              </div>
            )}
            {sizeError && (
              <p className="mt-1 text-xs text-destructive">{sizeError}</p>
            )}
          </section>

          {/* 5. Retrieve */}
          {!hideRetrieve && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Retrieve</h2>
              <div className="flex flex-wrap gap-2">
                {allowedRetrieves.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRetrieve(r)}
                    className={cn(
                      "px-3 py-2 rounded-full text-sm border min-h-[44px]",
                      retrieve === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/40",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 6. Depth zone */}
          {!hideDepth && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Depth</h2>
              <div className="flex flex-wrap gap-2">
                {allowedDepths.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepthZone(d)}
                    className={cn(
                      "px-3 py-2 rounded-full text-sm border min-h-[44px]",
                      depthZone === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/40",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 7. Outcome */}
          <section role="radiogroup" aria-label="Outcome">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Outcome</h2>
            <div className="flex rounded-md border overflow-hidden text-sm">
              {(["released", "kept"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={outcome === o}
                  onClick={() => setOutcome(o)}
                  className={cn(
                    "flex-1 px-3 py-2 capitalize transition-colors min-h-[44px]",
                    outcome === o ? "bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </section>

          {/* 8. Notes */}
          <section>
            <button
              type="button"
              onClick={() => setNotesOpen((o) => !o)}
              className="text-sm text-muted-foreground underline"
            >
              {notesOpen ? "Hide note" : "Add a note (optional)"}
            </button>
            {notesOpen && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={3}
                className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </section>
        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t">
          <div className="max-w-[440px] mx-auto p-3 flex gap-2">
            <Button variant="outline" onClick={handleBack} className="min-h-[52px]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              aria-disabled={!canSave}
              disabled={!canSave}
              className="flex-1 min-h-[52px] text-sm font-medium"
            >
              {saving ? "Saving…" : ctaLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Fly picker sheet */}
      <Sheet open={pickerForPos != null} onOpenChange={(o) => !o && setPickerForPos(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{pickerForPos ? positionLabel(pickerForPos as FlyPosition) : "Pick a fly"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {pickerForPos && (
              <FlyPicker
                value={localFlies[pickerForPos]?.pattern ?? null}
                currentStyle={rod.style}
                currentLine={rod.line_profile}
                venueName={venueName}
                onChange={(res) => handleFlyPicked(pickerForPos, res)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Discard confirm */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this catch?</AlertDialogTitle>
            <AlertDialogDescription>
              Your entries will be lost. Fly corrections aren't committed until you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
