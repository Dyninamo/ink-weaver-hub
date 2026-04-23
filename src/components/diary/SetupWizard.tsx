import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardResult {
  rod_weight: number | null;
  rod_length_ft: number | null;
  line_id: number | null;
  line_name: string | null;
  line_profile: string | null;
  leader_id: number | null;
  tippet_length_ft: number | null;
  tippet_strength: number | null;
  tippet_unit: string | null;
  style: string | null;
  dropper_count: number;
  flies_on_cast: any | null;
  spot_name: string | null;
  keep_limit: number | null;
  size_mode: string;
  size_units: string;
}

interface FlyLine {
  id: number; name: string; density: string | null;
  min_rod_weight: number; max_rod_weight: number;
  water_types: string[]; sink_rate_ips: number | null;
}
interface Leader {
  id: number; brand: string | null; type: string | null;
  length_ft: number | null; breaking_strain_lb: number | null;
  min_rod_weight: number; max_rod_weight: number; water_types: string[];
}
interface Tippet {
  id: number; brand: string | null; strength: number | null;
  unit: string | null; breaking_strain_lb: number | null;
  min_rod_weight: number; max_rod_weight: number;
}

interface SetupWizardProps {
  venueName: string;
  venueType: "stillwater" | "river";
  onComplete: (result: WizardResult) => void;
  onBack: () => void;
}

const ROD_WEIGHTS = [3, 4, 5, 6, 7, 8, 9, 10];
const ROD_LENGTHS = [8, 8.5, 9, 9.5, 10, 10.5, 11];
const STYLES = ["Buzzer", "Dry", "Dry-Dropper", "Euro Nymph", "Lure", "Lure + Nymph", "Nymph", "Nymph/Buzzer", "Wet"];
const STEP_LABELS = ["Venue", "Rod", "Line", "Leader", "Tippet", "Style", "Droppers", "Flies", "Final"];

function positionsFor(n: number): string[] {
  if (n <= 1) return ["Point"];
  if (n === 2) return ["Point", "Top"];
  if (n === 3) return ["Point", "Middle", "Top"];
  return ["Point", ...Array.from({ length: n - 2 }, (_, i) => `Dropper ${i + 1}`), "Top"];
}

export default function SetupWizard({ venueName, venueType, onComplete, onBack }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [lines, setLines] = useState<FlyLine[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [tippets, setTippets] = useState<Tippet[]>([]);

  // Picks
  const [rodWeight, setRodWeight] = useState<number | null>(null);
  const [rodLength, setRodLength] = useState<number | null>(9);
  const [lineId, setLineId] = useState<number | null>(null);
  const [profile, setProfile] = useState<"WF" | "DT">("WF");
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [tippetLen, setTippetLen] = useState<number | null>(null);
  const [tippetStrength, setTippetStrength] = useState<number | null>(null);
  const [tippetUnit, setTippetUnit] = useState<"lb" | "x">("lb");
  const [style, setStyle] = useState<string | null>(null);
  const [droppers, setDroppers] = useState<number>(2);
  const [fliesOnCast, setFliesOnCast] = useState<Record<string, string>>({});
  const [spot, setSpot] = useState("");
  const [keepLimit, setKeepLimit] = useState<number>(0);
  const [sizeMode, setSizeMode] = useState<"weight" | "length">("weight");
  const [sizeUnits, setSizeUnits] = useState<string>("lb");

  // Load reference data once
  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: ld }, { data: tp }] = await Promise.all([
        supabase.from("fly_lines").select("*").eq("active", true).order("order_hint"),
        supabase.from("leaders").select("*").eq("active", true).order("order_hint"),
        supabase.from("tippets").select("*").eq("active", true).order("order_hint"),
      ]);
      setLines((l || []) as any);
      setLeaders((ld || []) as any);
      setTippets((tp || []) as any);
    })();
  }, []);

  const linesForRod = useMemo(() => {
    if (!rodWeight) return lines;
    return lines.filter(
      (l) =>
        rodWeight >= l.min_rod_weight &&
        rodWeight <= l.max_rod_weight &&
        l.water_types.includes(venueType)
    );
  }, [lines, rodWeight, venueType]);

  const leadersForRod = useMemo(() => {
    if (!rodWeight) return leaders;
    return leaders.filter(
      (l) =>
        rodWeight >= l.min_rod_weight &&
        rodWeight <= l.max_rod_weight &&
        (!l.water_types?.length || l.water_types.includes(venueType))
    );
  }, [leaders, rodWeight, venueType]);

  const tippetsForRod = useMemo(() => {
    if (!rodWeight) return tippets;
    return tippets.filter(
      (t) =>
        rodWeight >= t.min_rod_weight &&
        rodWeight <= t.max_rod_weight &&
        (!t.unit || t.unit === tippetUnit)
    );
  }, [tippets, rodWeight, tippetUnit]);

  const positions = positionsFor(droppers);
  const selectedLine = lines.find((l) => l.id === lineId);

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!venueName;
      case 2: return rodWeight !== null;
      case 3: return lineId !== null;
      case 4: return leaderId !== null;
      case 5: return true; // skippable
      case 6: return true; // skippable
      case 7: return droppers >= 1;
      case 8: return true;
      case 9: return true;
      default: return false;
    }
  }
  const canSkip = step === 5 || step === 6;

  function handleNext() {
    if (step < 9) setStep(step + 1);
    else handleFinish();
  }

  function handleSkip() {
    if (step === 5) { setTippetLen(null); setTippetStrength(null); }
    if (step === 6) { setStyle(null); }
    setStep(step + 1);
  }

  function handleFinish() {
    onComplete({
      rod_weight: rodWeight,
      rod_length_ft: rodLength,
      line_id: lineId,
      line_name: selectedLine?.name ?? null,
      line_profile: venueType === "river" ? profile : null,
      leader_id: leaderId,
      tippet_length_ft: tippetLen,
      tippet_strength: tippetStrength,
      tippet_unit: tippetStrength != null ? tippetUnit : null,
      style,
      dropper_count: droppers,
      flies_on_cast: Object.keys(fliesOnCast).length ? fliesOnCast : null,
      spot_name: spot.trim() || null,
      keep_limit: keepLimit,
      size_mode: sizeMode,
      size_units: sizeUnits,
    });
  }

  return (
    <div className="wizard-shell">
      <div className="wizard-inner">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => (step === 1 ? onBack() : setStep(step - 1))}
            className="p-2 -ml-2 rounded-md hover:bg-paper-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="wizard-banner">{venueName} · {venueType}</div>
        </div>

        {/* Progress ribbon */}
        <div className="wizard-progress">
          {STEP_LABELS.map((_, i) => {
            const n = i + 1;
            const cls = n === step ? "pill active" : n < step ? "pill done" : "pill";
            return (
              <button
                key={n}
                className={cls}
                onClick={() => n < step && setStep(n)}
                aria-label={`Step ${n}`}
              />
            );
          })}
        </div>

        {/* STEP 1 — Venue */}
        {step === 1 && (
          <>
            <div className="step-title">Where are you?</div>
            <div className="step-sub">{venueName} — {venueType}. Continue to set up your rod.</div>
          </>
        )}

        {/* STEP 2 — Rod */}
        {step === 2 && (
          <>
            <div className="step-title">Your rod</div>
            <div className="step-sub">Line weight (#) and length determine which lines and leaders fit.</div>
            <div className="step-field">
              <div className="smallcaps">Weight</div>
              <div className="chip-grid">
                {ROD_WEIGHTS.map((w) => (
                  <button
                    key={w}
                    className={cn("chip", rodWeight === w && "selected")}
                    onClick={() => setRodWeight(w)}
                  >
                    #{w}
                  </button>
                ))}
              </div>
            </div>
            <div className="step-field">
              <div className="smallcaps">Length (ft)</div>
              <div className="chip-grid">
                {ROD_LENGTHS.map((l) => (
                  <button
                    key={l}
                    className={cn("chip", rodLength === l && "selected")}
                    onClick={() => setRodLength(l)}
                  >
                    {l}'
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* STEP 3 — Line */}
        {step === 3 && (
          <>
            <div className="step-title">Choose a line</div>
            <div className="step-sub">
              Filtered for #{rodWeight} {venueType}. {linesForRod.length} options.
            </div>
            <div className="step-field">
              <div className="smallcaps">Density</div>
              <div className="chip-grid">
                {linesForRod.map((l) => (
                  <button
                    key={l.id}
                    className={cn("chip", lineId === l.id && "selected")}
                    onClick={() => setLineId(l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            {venueType === "river" && (
              <div className="step-field">
                <div className="smallcaps">Profile</div>
                <div className="chip-grid">
                  {(["WF", "DT"] as const).map((p) => (
                    <button
                      key={p}
                      className={cn("chip", profile === p && "selected")}
                      onClick={() => setProfile(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP 4 — Leader */}
        {step === 4 && (
          <>
            <div className="step-title">Leader</div>
            <div className="step-sub">{leadersForRod.length} suitable for #{rodWeight}.</div>
            <div className="step-field">
              <div className="chip-grid">
                {leadersForRod.map((l) => (
                  <button
                    key={l.id}
                    className={cn("chip compact", leaderId === l.id && "selected")}
                    onClick={() => setLeaderId(l.id)}
                  >
                    {[l.brand, l.type, l.length_ft ? `${l.length_ft}'` : null,
                      l.breaking_strain_lb ? `${l.breaking_strain_lb}lb` : null]
                      .filter(Boolean).join(" · ")}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* STEP 5 — Tippet (skippable) */}
        {step === 5 && (
          <>
            <div className="step-title">Tippet</div>
            <div className="step-sub">Fine section between leader and fly. Skip for tapered-leader-only rigs.</div>
            <div className="step-field">
              <div className="smallcaps">Length</div>
              <div className="chip-grid">
                {[2, 3, 4, 5, 6].map((ft) => (
                  <button key={ft} className={cn("chip", tippetLen === ft && "selected")} onClick={() => setTippetLen(ft)}>
                    {ft} ft
                  </button>
                ))}
              </div>
            </div>
            <div className="step-field">
              <div className="smallcaps flex items-center justify-between">
                <span>Strength</span>
                <div className="segmented">
                  <button className={tippetUnit === "lb" ? "active" : ""} onClick={() => setTippetUnit("lb")}>lb</button>
                  <button className={tippetUnit === "x" ? "active" : ""} onClick={() => setTippetUnit("x")}>X</button>
                </div>
              </div>
              <div className="chip-grid">
                {tippetsForRod.length > 0 ? tippetsForRod.map((t) => (
                  <button
                    key={t.id}
                    className={cn("chip compact", tippetStrength === t.strength && "selected")}
                    onClick={() => setTippetStrength(Number(t.strength))}
                  >
                    {t.strength} {tippetUnit}
                  </button>
                )) : <p className="text-xs text-muted-foreground col-span-full">No tippets match this combination.</p>}
              </div>
            </div>
          </>
        )}

        {/* STEP 6 — Style (skippable) */}
        {step === 6 && (
          <>
            <div className="step-title">Style</div>
            <div className="step-sub">How are you fishing? You can change this any time.</div>
            <div className="step-field">
              <div className="chip-grid">
                {STYLES.map((s) => (
                  <button key={s} className={cn("chip compact", style === s && "selected")} onClick={() => setStyle(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* STEP 7 — Droppers */}
        {step === 7 && (
          <>
            <div className="step-title">Droppers</div>
            <div className="step-sub">How many flies on the cast?</div>
            <div className="step-field">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={cn("chip dropper-chip", droppers === n && "selected")}
                    onClick={() => setDroppers(n)}
                  >
                    <span className="num">{n}</span>
                    <span className="smallcaps">
                      {n === 1 ? "Single" : n === 2 ? "Double" : n === 3 ? "Team" : `Cast of ${n}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* STEP 8 — Flies */}
        {step === 8 && (
          <>
            <div className="step-title">Flies on the cast</div>
            <div className="step-sub">Optional — name each position. You can also fill these in when logging catches.</div>
            <div className="step-field space-y-3">
              {positions.map((pos) => (
                <div key={pos}>
                  <div className="smallcaps">{pos}</div>
                  <Input
                    value={fliesOnCast[pos] || ""}
                    onChange={(e) => setFliesOnCast({ ...fliesOnCast, [pos]: e.target.value })}
                    placeholder="e.g. Diawl Bach #14"
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* STEP 9 — Final */}
        {step === 9 && (
          <>
            <div className="step-title">Final touches</div>
            <div className="step-sub">A spot name, your keep limit, and how you'll size fish.</div>

            <div className="step-field">
              <div className="smallcaps">Spot (optional)</div>
              <Input
                value={spot}
                onChange={(e) => setSpot(e.target.value)}
                placeholder="e.g. Lodge Bay, North Bank"
                className="mt-1.5"
              />
            </div>

            <div className="step-field">
              <div className="smallcaps">Keep limit</div>
              <div className="chip-grid">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={cn("chip", keepLimit === n && "selected")}
                    onClick={() => setKeepLimit(n)}
                  >
                    {n === 5 ? "5+" : n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                First {keepLimit} catches default to Kept; the rest to Released. Editable per catch.
              </p>
            </div>

            <div className="step-field">
              <div className="smallcaps flex items-center justify-between">
                <span>Size mode</span>
                <div className="segmented">
                  <button className={sizeMode === "weight" ? "active" : ""} onClick={() => { setSizeMode("weight"); setSizeUnits("lb"); }}>Weight</button>
                  <button className={sizeMode === "length" ? "active" : ""} onClick={() => { setSizeMode("length"); setSizeUnits("in"); }}>Length</button>
                </div>
              </div>
              <div className="chip-grid mt-2">
                {(sizeMode === "weight" ? ["lb", "kg"] : ["in", "cm"]).map((u) => (
                  <button key={u} className={cn("chip", sizeUnits === u && "selected")} onClick={() => setSizeUnits(u)}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky footer */}
      <div className="wizard-footer">
        <div className="inner">
          <button
            className="wizard-btn"
            onClick={() => (step === 1 ? onBack() : setStep(step - 1))}
          >
            Back
          </button>
          {canSkip && (
            <button className="wizard-btn skip" onClick={handleSkip}>
              Skip
            </button>
          )}
          <button
            className="wizard-btn primary"
            onClick={handleNext}
            disabled={!canAdvance()}
          >
            {step === 9 ? "Start fishing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
