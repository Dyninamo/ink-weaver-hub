import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FishSymbol, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

const SPECIES_OPTIONS = ["Rainbow trout", "Brown trout", "Grayling", "Sea trout", "Salmon"];
const ROD_WEIGHTS = [3, 4, 5, 6, 7, 8];
const LINE_OPTIONS = ["Floating", "Midge tip", "Slow intermediate", "Fast intermediate", "Sinking"];

interface VenueResult {
  venue_id: string;
  full_name: string;
  water_type_id: number;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // B1
  const [displayName, setDisplayName] = useState(profile?.display_name || "");

  // B2 — defaults
  const [stillSpecies, setStillSpecies] = useState("Rainbow trout");
  const [stillRod, setStillRod] = useState(7);
  const [stillLine, setStillLine] = useState("Floating");
  const [riverSpecies, setRiverSpecies] = useState("Brown trout");
  const [riverRod, setRiverRod] = useState(5);
  const [riverLine, setRiverLine] = useState("Floating");
  const [sizeMode, setSizeMode] = useState<"weight" | "length">("weight");
  const [sizeUnits, setSizeUnits] = useState<"imperial" | "metric">("imperial");

  // B3 — home water
  const [venueQuery, setVenueQuery] = useState("");
  const [venueResults, setVenueResults] = useState<VenueResult[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Mark coach_stage = onboarding when entering
  useEffect(() => {
    if (!user || profile?.coach_stage !== "new") return;
    supabase
      .from("user_profiles")
      .update({ coach_stage: "onboarding" })
      .eq("id", user.id);
  }, [user, profile]);

  // Venue search debounce
  useEffect(() => {
    if (step !== 3 || venueQuery.trim().length < 2) {
      setVenueResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from("venues_new")
        .select("venue_id, full_name, water_type_id")
        .ilike("search_text", `%${venueQuery.trim()}%`)
        .eq("is_searchable", true)
        .limit(8);
      setSearching(false);
      if (!error && data) setVenueResults(data as VenueResult[]);
    }, 280);
    return () => clearTimeout(t);
  }, [venueQuery, step]);

  const canB1 = displayName.trim().length >= 2 && displayName.trim().length <= 30;

  async function saveAndNext() {
    if (!user) return;
    setSaving(true);

    const updates: Record<string, unknown> = {};

    if (step === 1) {
      updates.display_name = displayName.trim();
    } else if (step === 2) {
      updates.stillwater_default_species = stillSpecies;
      updates.stillwater_default_rod_weight = stillRod;
      updates.stillwater_default_line = stillLine;
      updates.river_default_species = riverSpecies;
      updates.river_default_rod_weight = riverRod;
      updates.river_default_line = riverLine;
      updates.default_size_mode = sizeMode;
      updates.default_size_units = sizeUnits;
    } else if (step === 3) {
      updates.home_venue_id = selectedVenue?.venue_id ?? null;
    } else if (step === 4) {
      updates.coach_stage = "done";
    }

    const { error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await refreshProfile();

    if (step === 4) {
      onComplete();
    } else {
      setStep((s) => (s + 1) as Step);
    }
  }

  const stepTitle = useMemo(() => {
    switch (step) {
      case 1: return "What should we call you?";
      case 2: return "Set your defaults";
      case 3: return "Pick your home water";
      case 4: return `Welcome, ${displayName.trim() || "angler"}.`;
    }
  }, [step, displayName]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-center gap-2">
            <FishSymbol className="h-7 w-7 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">It's Catching!</h1>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/40" : "w-4 bg-muted"
                )}
              />
            ))}
          </div>

          <h2 className="text-xl font-semibold text-center pt-1">{stepTitle}</h2>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                placeholder="e.g. Dave M"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                2-30 characters. How others will see you.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Stillwater */}
              <div className="rounded-lg border-l-4 border-l-foreground/70 border border-border p-3 space-y-2.5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Stillwater
                </div>
                <SelectChips label="Species" value={stillSpecies} options={SPECIES_OPTIONS} onSelect={setStillSpecies} />
                <SelectChips label="Rod weight" value={String(stillRod)} options={ROD_WEIGHTS.map(String)} onSelect={(v) => setStillRod(Number(v))} suffix="#" />
                <SelectChips label="Usual line" value={stillLine} options={LINE_OPTIONS} onSelect={setStillLine} />
              </div>

              {/* River — gild stripe */}
              <div className="rounded-lg border-l-4 border-l-amber-500/70 border border-border p-3 space-y-2.5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  River
                </div>
                <SelectChips label="Species" value={riverSpecies} options={SPECIES_OPTIONS} onSelect={setRiverSpecies} />
                <SelectChips label="Rod weight" value={String(riverRod)} options={ROD_WEIGHTS.map(String)} onSelect={(v) => setRiverRod(Number(v))} suffix="#" />
                <SelectChips label="Usual line" value={riverLine} options={LINE_OPTIONS} onSelect={setRiverLine} />
              </div>

              {/* Global */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <SelectChips label="Size mode" value={sizeMode} options={["weight", "length"]} onSelect={(v) => setSizeMode(v as "weight" | "length")} />
                <SelectChips label="Units" value={sizeUnits} options={["imperial", "metric"]} onSelect={(v) => setSizeUnits(v as "imperial" | "metric")} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <Label htmlFor="venue">Home water (optional)</Label>
              <Input
                id="venue"
                value={venueQuery}
                onChange={(e) => {
                  setVenueQuery(e.target.value);
                  setSelectedVenue(null);
                }}
                placeholder="Search for a water…"
                autoFocus
              />
              {searching && (
                <p className="text-xs text-muted-foreground">Searching…</p>
              )}
              {!searching && venueQuery.length >= 2 && venueResults.length === 0 && (
                <p className="text-xs text-muted-foreground">No matches yet. You can skip this.</p>
              )}
              {venueResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  {venueResults.map((v) => (
                    <button
                      key={v.venue_id}
                      type="button"
                      onClick={() => {
                        setSelectedVenue(v);
                        setVenueQuery(v.full_name);
                        setVenueResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b border-border last:border-b-0"
                    >
                      {v.full_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedVenue && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  Selected: {selectedVenue.full_name}
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                We'll surface advice for this water on your home screen.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-center py-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                You're all set. Log sessions as you fish — flies, lost takes, blanks — and we'll find the patterns.
              </p>
              <p className="text-base italic text-amber-600 dark:text-amber-400">Tight lines.</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {step > 1 && step < 4 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={saving}
              >
                Back
              </Button>
            )}
            {step === 3 && !selectedVenue && (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={saveAndNext}
                disabled={saving}
              >
                Skip
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={saveAndNext}
              disabled={saving || (step === 1 && !canB1)}
            >
              {saving ? "Saving…" : step === 4 ? "Get started" : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SelectChips({
  label,
  value,
  options,
  onSelect,
  suffix,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              value === opt
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            {opt}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}
