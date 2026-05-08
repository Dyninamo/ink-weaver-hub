import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type LeaderMaterial = "nylon" | "copolymer" | "mono" | "fluoro" | "furled";

export interface LeaderValue {
  material: LeaderMaterial | null;
  length_ft: number | null;     // canonical feet
  strength_lb: number | null;   // canonical lb
  leader_id: number | null;     // best-effort catalogue match
}

export const EMPTY_LEADER: LeaderValue = {
  material: null,
  length_ft: 15,
  strength_lb: 6,
  leader_id: null,
};

const MATERIALS: LeaderMaterial[] = ["nylon", "copolymer", "mono", "fluoro", "furled"];
const FT_OPTIONS = [6, 9, 12, 15, 18, 21, 24, 27];
const M_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];
const LB_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
const LB_TO_X: Record<number, string> = {
  2: "7X", 3: "6X", 4: "5X", 5: "5X", 6: "4X",
  8: "3X", 10: "2X", 12: "1X", 15: "0X", 20: "0X+",
};

const mToFt = (m: number) => Math.round(m * 3.2808 * 10) / 10;
const ftToM = (ft: number) => Math.round((ft / 3.2808) * 10) / 10;

interface Props {
  value: LeaderValue;
  onChange: (v: LeaderValue) => void;
  /** When true, attempt to pre-fill from the user's most recent prior session (only if value is still default). */
  prefillUserId?: string;
}

export default function LeaderPicker({ value, onChange, prefillUserId }: Props) {
  const [lengthUnit, setLengthUnit] = useState<"ft" | "m">("ft");
  const [strengthUnit, setStrengthUnit] = useState<"lb" | "X">("lb");
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill from prior session
  useEffect(() => {
    if (!prefillUserId || prefilled || value.material) return;
    setPrefilled(true);
    (async () => {
      const { data } = await supabase
        .from("fishing_sessions")
        .select("leader_material, leader_length_ft, leader_strength_lb")
        .eq("user_id", prefillUserId)
        .not("leader_material", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.leader_material) {
        const next: LeaderValue = {
          material: data.leader_material as LeaderMaterial,
          length_ft: data.leader_length_ft ?? 15,
          strength_lb: data.leader_strength_lb ?? 6,
          leader_id: null,
        };
        const id = await resolveLeaderId(next);
        onChange({ ...next, leader_id: id });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillUserId]);

  // Best-effort catalogue lookup whenever the tuple changes
  async function resolveLeaderId(v: LeaderValue): Promise<number | null> {
    if (!v.material || v.length_ft == null || v.strength_lb == null) return null;
    const { data } = await supabase
      .from("leaders")
      .select("id")
      .eq("active", true)
      .eq("material", v.material)
      .eq("length_ft", v.length_ft)
      .eq("breaking_strain_lb", v.strength_lb)
      .limit(2);
    return data && data.length === 1 ? data[0].id : null;
  }

  async function update(patch: Partial<LeaderValue>) {
    const next = { ...value, ...patch };
    const id = await resolveLeaderId(next);
    onChange({ ...next, leader_id: id });
  }

  const lengthDisplay = useMemo(() => {
    if (value.length_ft == null) return null;
    return lengthUnit === "ft" ? value.length_ft : ftToM(value.length_ft);
  }, [value.length_ft, lengthUnit]);

  const lengthOptions = lengthUnit === "ft" ? FT_OPTIONS : M_OPTIONS;
  const disabled = !value.material;

  return (
    <div className="space-y-3 rounded-md border border-input p-3">
      {/* Material chips */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Leader material *</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {MATERIALS.map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={value.material === m ? "default" : "outline"}
              onClick={() => update({ material: m })}
              className="capitalize min-h-[36px]"
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      {/* Length */}
      <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Length</Label>
          <div className="flex gap-1 text-xs">
            {(["ft", "m"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setLengthUnit(u)}
                className={`px-2 py-0.5 rounded ${lengthUnit === u ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {lengthOptions.map((opt) => {
            const ftVal = lengthUnit === "ft" ? opt : mToFt(opt);
            const isSelected = lengthDisplay === opt;
            return (
              <Button
                key={opt}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => update({ length_ft: ftVal })}
                className="min-h-[36px] min-w-[44px]"
              >
                {opt}
                {lengthUnit === "m" ? "m" : ""}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Strength */}
      <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Breaking strain</Label>
          <div className="flex gap-1 text-xs">
            {(["lb", "X"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setStrengthUnit(u)}
                className={`px-2 py-0.5 rounded ${strengthUnit === u ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {LB_OPTIONS.map((lb) => {
            const isSelected = value.strength_lb === lb;
            const label = strengthUnit === "lb" ? `${lb}lb` : LB_TO_X[lb];
            return (
              <Button
                key={lb}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => update({ strength_lb: lb })}
                className="min-h-[36px] min-w-[44px]"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
