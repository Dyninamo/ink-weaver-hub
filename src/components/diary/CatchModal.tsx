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
import { ArrowLeft, ArrowRight, Check, Ruler, Weight } from "lucide-react";
import { cn } from "@/lib/utils";
import FlyPicker from "./FlyPicker";
import {
  addEvent,
  type CurrentSetup,
  SPECIES_LIST,
  DEFAULT_SPECIES,
  formatWeight,
  convertLengthToWeight,
  FRIENDLY_LINE_NAMES,
} from "@/services/diaryService";
import { retrievesForStyle, depthsForStyle } from "@/services/styleRules";
import { toast } from "sonner";

interface CatchModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  venueType: "stillwater" | "river";
  venueName: string;
  currentSetup: CurrentSetup;
  lastSpecies: string | null;
  lastRigPosition: string | null;
  lastFlySize: number | null;
  eventCount: number;
  onSaved: (event: any, setupChanged?: boolean, newSetup?: CurrentSetup) => void;
  latestWeather?: {
    temp: number;
    wind_speed: number;
    wind_dir: string;
    pressure: number;
    conditions?: string;
  } | null;
}

const RIG_POSITIONS = ["Point", "Top dropper", "Middle dropper", "Bob fly"];

type MeasurementMode = "weight" | "length";

export default function CatchModal({
  open,
  onClose,
  sessionId,
  venueType,
  venueName,
  currentSetup,
  lastSpecies,
  lastRigPosition,
  lastFlySize,
  eventCount,
  onSaved,
  latestWeather,
}: CatchModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Species (persistent across catches)
  const [species, setSpecies] = useState(
    lastSpecies || DEFAULT_SPECIES[venueType] || "Rainbow"
  );

  // Step 1: Weight or Length
  const [measureMode, setMeasureMode] = useState<MeasurementMode>("weight");
  const [weightLb, setWeightLb] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [lengthInches, setLengthInches] = useState("");

  // Step 2: Fly
  const [flyPattern, setFlyPattern] = useState<string | null>(null);

  // Step 3: Fly Size
  const [flySize, setFlySize] = useState<number | null>(lastFlySize);

  // Step 4: Rig Position (carry forward)
  const [rigPosition, setRigPosition] = useState<string | null>(
    lastRigPosition || "Point"
  );

  // Step 5: Retrieve (style-pruned chip row, editable per-catch)
  const allowedRetrieves = retrievesForStyle(currentSetup.style);
  const [retrieve, setRetrieve] = useState<string | null>(
    currentSetup.retrieve && allowedRetrieves.includes(currentSetup.retrieve)
      ? currentSetup.retrieve
      : allowedRetrieves[0] ?? null
  );

  // Step 6: Depth zone (style-pruned, editable per-catch — defaults to rig value)
  const allowedDepths = depthsForStyle(currentSetup.style);
  const [depthZone, setDepthZone] = useState<string | null>(
    currentSetup.depth_zone && allowedDepths.includes(currentSetup.depth_zone)
      ? currentSetup.depth_zone
      : allowedDepths[0] ?? null
  );

  // Step 7: Line (carry forward — triggers implicit change detection)
  const [lineType, setLineType] = useState<string | null>(
    currentSetup.line_type
  );

  // Notes
  const [notes, setNotes] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSpecies(lastSpecies || DEFAULT_SPECIES[venueType] || "Rainbow");
      setMeasureMode("weight");
      setWeightLb("");
      setWeightOz("");
      setLengthInches("");
      setFlyPattern(null);
      setFlySize(lastFlySize);
      setRigPosition(lastRigPosition || "Point");
      setRetrieve(
        currentSetup.retrieve && allowedRetrieves.includes(currentSetup.retrieve)
          ? currentSetup.retrieve
          : allowedRetrieves[0] ?? null
      );
      setDepthZone(
        currentSetup.depth_zone && allowedDepths.includes(currentSetup.depth_zone)
          ? currentSetup.depth_zone
          : allowedDepths[0] ?? null
      );
      setLineType(currentSetup.line_type);
      setNotes("");
    }
  }, [open]);

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        if (measureMode === "weight") {
          const f = parseFloat(weightLb);
          return !isNaN(f) && f > 0;
        }
        return lengthInches !== "";
      case 2: return flyPattern !== null;
      default: return true;
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Calculate weight/length
      let finalLb = 0;
      let finalOz = 0;
      let finalLength: number | null = null;

      if (measureMode === "weight") {
        const f = parseFloat(weightLb);
        if (!isNaN(f)) {
          finalLb = Math.floor(f);
          finalOz = Math.round((f - finalLb) * 16);
        }
      } else if (measureMode === "length" && lengthInches) {
        finalLength = parseFloat(lengthInches);
        const converted = convertLengthToWeight(finalLength, species);
        finalLb = converted.lb;
        finalOz = converted.oz;
      }

      const weightDisplay = formatWeight(finalLb, finalOz);

      // Check for implicit change: line differs from current setup
      const lineChanged = lineType !== currentSetup.line_type && lineType !== null;

      const event = await addEvent({
        session_id: sessionId,
        event_type: "catch",
        event_time: new Date().toISOString(),
        sort_order: eventCount + 1,
        species,
        weight_lb: finalLb,
        weight_oz: finalOz,
        weight_display: weightDisplay,
        length_inches: finalLength,
        measurement_mode: measureMode,
        fly_pattern: flyPattern,
        fly_size: flySize,
        rig_position: rigPosition,
        retrieve: retrieve,
        line_type: lineType,
        style: currentSetup.style,
        rig: currentSetup.rig,
        flies_on_cast: currentSetup.flies_on_cast,
        spot: currentSetup.spot,
        depth_zone: currentSetup.depth_zone,
        event_temp: latestWeather?.temp ?? null,
        event_wind_speed: latestWeather?.wind_speed ?? null,
        event_wind_dir: latestWeather?.wind_dir ?? null,
        event_pressure: latestWeather?.pressure ?? null,
        event_conditions: latestWeather?.conditions ?? null,
      });

      toast.success(`${weightDisplay} ${species} logged!`);

      // If line changed, ask about updating setup
      if (lineChanged) {
        const newSetup: CurrentSetup = { ...currentSetup, line_type: lineType };
        onSaved(event, true, newSetup);
      } else {
        onSaved(event);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save catch");
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = 5;
  const stepLabels = ["Weight", "Fly", "Position", "Retrieve", "Line"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px] p-0 gap-0">
        {/* Header with species pill */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <DialogTitle className="text-lg font-diary">Log Catch</DialogTitle>
            <div className="flex gap-1 flex-wrap justify-end max-w-[260px]">
              {SPECIES_LIST.map((s) => (
                <Button
                  key={s}
                  variant={species === s ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8 px-2"
                  onClick={() => setSpecies(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1 mb-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i + 1 <= step ? "bg-diary-catch" : "bg-muted"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Step {step} of {totalSteps}: {stepLabels[step - 1]}
          </p>
        </div>

        {/* Step content */}
        <div className="p-4 min-h-[200px]">
          {/* STEP 1: Weight / Length */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2 justify-center">
                <Button
                  variant={measureMode === "weight" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeasureMode("weight")}
                  className="min-h-[44px]"
                >
                  <Weight className="h-4 w-4 mr-1" /> Weight
                </Button>
                <Button
                  variant={measureMode === "length" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeasureMode("length")}
                  className="min-h-[44px]"
                >
                  <Ruler className="h-4 w-4 mr-1" /> Length
                </Button>
              </div>

              {measureMode === "weight" ? (
                <div className="px-2">
                  <div className="flex items-baseline gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="—"
                      value={weightLb}
                      onChange={(e) => {
                        // Accept "2.5" → store lb as integer + oz from fraction
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        setWeightLb(v);
                        const f = parseFloat(v);
                        if (!isNaN(f)) {
                          const lb = Math.floor(f);
                          const oz = Math.round((f - lb) * 16);
                          setWeightOz(String(oz));
                        } else {
                          setWeightOz("");
                        }
                      }}
                      className="tabular-weight-input"
                      autoFocus
                    />
                    <div className="tabular-weight-unit">lb</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter as decimal — e.g. 2.5 = 2 lb 8 oz
                  </p>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-32">
                    <Label className="text-center block">Inches</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="6"
                      max="36"
                      step="0.5"
                      placeholder="inches"
                      value={lengthInches}
                      onChange={(e) => setLengthInches(e.target.value)}
                      className="text-center text-2xl font-mono h-14"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Fly Pattern (FlyPicker now also collects size + qualifiers) */}
          {step === 2 && (
            <FlyPicker
              value={flyPattern}
              onChange={({ pattern, size }) => {
                setFlyPattern(pattern);
                if (size != null) setFlySize(size);
                // Auto-advance — FlyPicker now collects size, so jump to Position (step 3).
                setStep(3);
              }}
              currentStyle={currentSetup.style}
              currentLine={currentSetup.line_type}
              venueName={venueName}
              venueType={venueType}
              required
            />
          )}

          {/* STEP 3: Rig Position (CARRY FORWARD) */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Rig Position</Label>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  CARRY FORWARD
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {RIG_POSITIONS.map((pos) => (
                  <Button
                    key={pos}
                    variant={rigPosition === pos ? "default" : "outline"}
                    className="min-h-[44px]"
                    onClick={() => setRigPosition(pos)}
                  >
                    {pos}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Retrieve (CARRY FORWARD) */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Retrieve</Label>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  CARRY FORWARD
                </span>
              </div>
              {currentSetup.retrieve && (
                <p className="text-sm text-muted-foreground">
                  Current: <strong>{currentSetup.retrieve}</strong>
                </p>
              )}
              <DiaryAutocomplete
                label=""
                value={retrieve}
                options={[]}
                onChange={setRetrieve}
                placeholder="Change retrieve or keep current..."
              />
              <p className="text-xs text-muted-foreground text-center">
                Tap "Keep &amp; Next" to keep current retrieve
              </p>
            </div>
          )}

          {/* STEP 5: Line (CARRY FORWARD — triggers implicit change) */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line</Label>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  CARRY FORWARD
                </span>
              </div>
              {currentSetup.line_type && (
                <p className="text-sm text-muted-foreground">
                  Current: <strong>{currentSetup.line_type}</strong>
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {FRIENDLY_LINE_NAMES.map((line) => (
                  <Button
                    key={line}
                    variant={lineType === line ? "default" : "outline"}
                    size="sm"
                    className="min-h-[44px] text-xs"
                    onClick={() => setLineType(line)}
                  >
                    {line}
                  </Button>
                ))}
              </div>
              {lineType && lineType !== currentSetup.line_type && (
                <p className="text-xs text-amber-500 text-center">
                  ⚠ Line changed from {currentSetup.line_type} — you'll be asked to update your setup
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="p-4 pt-2 flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="min-h-[44px]">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {step < totalSteps ? (
            <>
              {step >= 3 && (
                <Button
                  variant="ghost"
                  className="flex-1 min-h-[44px]"
                  onClick={() => setStep(step + 1)}
                >
                  Keep &amp; Next →
                </Button>
              )}
              <Button
                className="flex-1 min-h-[44px]"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
              >
                {step < 3 ? "Next" : "Change & Next"} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <button
              type="button"
              className="event-cta flex-1"
              data-tone="catch"
              data-active={!saving}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : `Save · ${species}${parseFloat(weightLb) > 0 ? ` ${weightLb} lb` : lengthInches ? ` ${lengthInches}"` : ""}`}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
