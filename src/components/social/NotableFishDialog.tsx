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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Star,
  Camera,
  X,
  Check,
  AlertTriangle,
  Minus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const speciesMap: Record<string, string> = {
  Rainbow: "Rainbow Trout",
  Brown: "Brown Trout",
  Brook: "Brook Trout",
  Tiger: "Tiger Trout",
  Blue: "Blue Trout",
  Grayling: "Grayling",
  Char: "Char",
  "Arctic Char": "Char",
};

const tierLabels: Record<number, { label: string; stars: number }> = {
  1: { label: "Claimed", stars: 1 },
  2: { label: "Photographed", stars: 2 },
  3: { label: "Verified", stars: 3 },
  4: { label: "Witnessed", stars: 4 },
};

interface NotableFishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  userId: string;
  venueId: string | null;
  venueName: string;
  prefillSpecies?: string | null;
}

type MeasureMode = "length" | "weight" | "both";
type UnitMode = "metric" | "imperial";
type Step = 1 | 2 | 3;

interface SubmitResult {
  fish_id: string;
  species: string;
  weight_kg: number | null;
  weight_lb: number | null;
  length_cm: number | null;
  length_in: number | null;
  plausibility_pass: boolean;
  confidence_score: number;
  verification_tier: number;
  venue_percentile: number | null;
  platform_percentile: number | null;
  is_personal_best: boolean;
  is_venue_season_record: boolean;
  is_venue_alltime_record: boolean;
  is_platform_record: boolean;
  checks: {
    location: boolean | null;
    time: boolean | null;
    edit_clean: boolean | null;
    plausibility: boolean;
    measure_in_frame: null;
  };
}

export default function NotableFishDialog({
  open,
  onOpenChange,
  sessionId,
  userId,
  venueId,
  venueName,
  prefillSpecies,
}: NotableFishDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const [measureMode, setMeasureMode] = useState<MeasureMode>("length");
  const [unitMode, setUnitMode] = useState<UnitMode>("metric");

  // Metric inputs
  const [lengthCm, setLengthCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  // Imperial inputs
  const [lengthIn, setLengthIn] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [weightOz, setWeightOz] = useState("");

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Load species
  useEffect(() => {
    if (!open) return;
    supabase
      .from("species_size_profiles")
      .select("species_name")
      .order("species_name")
      .then(({ data }) => {
        if (data) setSpeciesList(data.map((d) => d.species_name));
      });
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setResult(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setLengthCm("");
      setWeightKg("");
      setLengthIn("");
      setWeightLb("");
      setWeightOz("");
      setMeasureMode("length");
      setUnitMode("metric");
      setSubmitting(false);

      if (prefillSpecies) {
        const mapped = speciesMap[prefillSpecies] || prefillSpecies;
        setSelectedSpecies(mapped);
      } else {
        setSelectedSpecies("");
      }
    }
  }, [open, prefillSpecies]);

  // Validation
  function isStep1Valid(): boolean {
    if (!selectedSpecies) return false;
    if (measureMode === "length" || measureMode === "both") {
      const val =
        unitMode === "metric" ? parseFloat(lengthCm) : parseFloat(lengthIn);
      if (!val || val <= 0) return false;
      if (unitMode === "metric" && (val < 5 || val > 150)) return false;
      if (unitMode === "imperial" && (val < 2 || val > 60)) return false;
    }
    if (measureMode === "weight" || measureMode === "both") {
      if (unitMode === "metric") {
        const val = parseFloat(weightKg);
        if (!val || val <= 0 || val > 30) return false;
      } else {
        const lb = parseFloat(weightLb) || 0;
        const oz = parseFloat(weightOz) || 0;
        const totalLb = lb + oz / 16;
        if (totalLb <= 0 || totalLb > 66) return false;
      }
    }
    return true;
  }

  function getMetricValues() {
    let finalLengthCm: number | null = null;
    let finalWeightKg: number | null = null;

    if (measureMode === "length" || measureMode === "both") {
      finalLengthCm =
        unitMode === "metric"
          ? parseFloat(lengthCm)
          : parseFloat(lengthIn) * 2.54;
    }
    if (measureMode === "weight" || measureMode === "both") {
      if (unitMode === "metric") {
        finalWeightKg = parseFloat(weightKg);
      } else {
        const lb = parseFloat(weightLb) || 0;
        const oz = parseFloat(weightOz) || 0;
        finalWeightKg = (lb + oz / 16) * 0.453592;
      }
    }
    return { finalLengthCm, finalWeightKg };
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const { finalLengthCm, finalWeightKg } = getMetricValues();
      let photoStoragePath: string | null = null;

      // Upload photo if provided
      if (photoFile) {
        const fileName = `${userId}/${Date.now()}_${photoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("notable-fish")
          .upload(fileName, photoFile, {
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        photoStoragePath = uploadData?.path || null;
      }

      const { data, error } = await supabase.functions.invoke(
        "submit-notable-fish",
        {
          body: {
            user_id: userId,
            session_id: sessionId,
            venue_id: venueId,
            venue_name: venueName,
            species: selectedSpecies,
            length_cm: finalLengthCm,
            weight_kg: finalWeightKg,
            measurement_unit: unitMode,
            photo_storage_path: photoStoragePath,
          },
        }
      );

      if (error) throw error;
      setResult(data as SubmitResult);
      setStep(3);
      toast.success("Notable fish submitted!");
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  // Check display helpers
  const checkItems = result
    ? [
        { label: "Measurement entered", status: true as const },
        {
          label: "Plausibility passed",
          status: result.checks.plausibility as boolean,
        },
        {
          label: "Photo submitted",
          status: (photoFile !== null) as boolean,
        },
        {
          label: "Location matches venue",
          status: result.checks.location,
        },
        {
          label: "Time check",
          status: result.checks.time,
          failNote: "no EXIF timestamp",
        },
        {
          label: "No editing detected",
          status: result.checks.edit_clean,
        },
        {
          label: "Measure in frame (V2)",
          status: null as boolean | null,
        },
        {
          label: "Peer witness (ask a mate!)",
          status: null as boolean | null,
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#F59E0B]" />
            {step === 1 && "Submit Notable Fish"}
            {step === 2 && "Add a Photo"}
            {step === 3 && "Fish Submitted!"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Species + Measurement */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Species */}
            <div>
              <Label>Species</Label>
              <Select
                value={selectedSpecies}
                onValueChange={setSelectedSpecies}
              >
                <SelectTrigger className="mt-1.5 min-h-[48px]">
                  <SelectValue placeholder="Select species…" />
                </SelectTrigger>
                <SelectContent>
                  {speciesList.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Measure mode */}
            <div>
              <Label>How did you measure it?</Label>
              <div className="flex gap-2 mt-1.5">
                {(["length", "weight", "both"] as MeasureMode[]).map((m) => (
                  <Button
                    key={m}
                    variant={measureMode === m ? "default" : "outline"}
                    size="sm"
                    className="flex-1 capitalize min-h-[44px]"
                    onClick={() => setMeasureMode(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            {/* Unit toggle */}
            <div>
              <Label>Units</Label>
              <div className="flex gap-2 mt-1.5">
                {(["metric", "imperial"] as UnitMode[]).map((u) => (
                  <Button
                    key={u}
                    variant={unitMode === u ? "default" : "outline"}
                    size="sm"
                    className="flex-1 capitalize min-h-[44px]"
                    onClick={() => setUnitMode(u)}
                  >
                    {u}
                  </Button>
                ))}
              </div>
            </div>

            {/* Length input */}
            {(measureMode === "length" || measureMode === "both") && (
              <div>
                <Label>Length</Label>
                {unitMode === "metric" ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value)}
                      className="min-h-[48px]"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      cm
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={lengthIn}
                      onChange={(e) => setLengthIn(e.target.value)}
                      className="min-h-[48px]"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      inches
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Weight input */}
            {(measureMode === "weight" || measureMode === "both") && (
              <div>
                <Label>Weight</Label>
                {unitMode === "metric" ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="min-h-[48px]"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      kg
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      className="min-h-[48px] flex-1"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      lb
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={weightOz}
                      onChange={(e) => setWeightOz(e.target.value)}
                      className="min-h-[48px] w-20"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      oz
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full min-h-[48px]"
              disabled={!isStep1Valid()}
              onClick={() => setStep(2)}
            >
              Next →
            </Button>
          </div>
        )}

        {/* Step 2: Photo */}
        {step === 2 && (
          <div className="space-y-4">
            {!photoPreview ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Take photo or choose from gallery
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Fish photo"
                  className="w-full max-h-[200px] object-cover rounded-lg"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              For best verification, include a ruler or tape measure alongside
              the fish.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 min-h-[48px]"
                onClick={() => handleSubmit()}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Skip"
                )}
              </Button>
              <Button
                className="flex-1 min-h-[48px]"
                onClick={() => handleSubmit()}
                disabled={submitting || !photoFile}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && result && (
          <div className="space-y-4">
            {/* Species + measurements */}
            <div className="text-center">
              <p className="text-lg font-semibold">{result.species}</p>
              <p className="text-sm text-muted-foreground">
                {result.length_cm != null &&
                  `${result.length_cm.toFixed(1)} cm (${result.length_in?.toFixed(1)} in)`}
                {result.length_cm != null && result.weight_kg != null && "  |  "}
                {result.weight_lb != null &&
                  `${result.weight_lb.toFixed(1)} lb (${result.weight_kg?.toFixed(2)} kg)`}
              </p>
            </div>

            {/* Tier stars */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "h-6 w-6",
                      s <= result.verification_tier
                        ? "text-[#F59E0B] fill-[#F59E0B]"
                        : "text-muted"
                    )}
                  />
                ))}
              </div>
              <p className="text-sm font-medium">
                {tierLabels[result.verification_tier]?.label}
              </p>
            </div>

            {/* Confidence bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-mono">
                  {result.confidence_score}/100
                </span>
              </div>
              <Progress
                value={result.confidence_score}
                className={cn(
                  "h-2",
                  result.confidence_score >= 60
                    ? "[&>div]:bg-green-500"
                    : result.confidence_score >= 35
                    ? "[&>div]:bg-amber-500"
                    : "[&>div]:bg-muted-foreground"
                )}
              />
            </div>

            {/* Checks */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Checks
              </p>
              {checkItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {item.status === true && (
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  {item.status === false && (
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  {item.status === null && (
                    <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span>
                    {item.label}
                    {item.status === false && item.failNote && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({item.failNote})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Percentile + achievements */}
            <div className="space-y-1.5">
              {result.venue_percentile != null && (
                <p className="text-sm text-center">
                  Top {(100 - result.venue_percentile).toFixed(0)}% at{" "}
                  {venueName}
                </p>
              )}
              {result.is_personal_best && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#F59E0B]">
                  <Trophy className="h-4 w-4" /> Personal best!
                </div>
              )}
              {result.is_venue_season_record && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Trophy className="h-4 w-4" /> Venue season record!
                </div>
              )}
              {result.is_venue_alltime_record && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#F59E0B]">
                  <Trophy className="h-4 w-4 fill-[#F59E0B]" /> All-time venue
                  record!
                </div>
              )}
              {result.is_platform_record && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary">
                  <Star className="h-4 w-4 fill-primary" /> Platform species
                  record!
                </div>
              )}
            </div>

            {/* Plausibility warning */}
            {!result.plausibility_pass && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-500">
                    Plausibility Check Failed
                  </p>
                  <p className="text-muted-foreground mt-1">
                    The weight seems unusual for a {result.species} of this
                    length. The fish has been submitted but with reduced
                    confidence.
                  </p>
                </div>
              </div>
            )}

            <Button
              className="w-full min-h-[48px]"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
