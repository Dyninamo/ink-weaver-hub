import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Dial from "./Dial";
import {
  ROD_WEIGHTS,
  STYLE_OPTIONS,
  inchesLabel,
  metresLabel,
  positionsForFlyCount,
  positionLabel,
  type RodSetupState,
  type FlyPosition,
} from "./vocabulary";

export function RigSoFarCard({ state }: { state: RodSetupState }) {
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

export function RodWeightStep({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
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

export function RodLengthStep({
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

export function LineStep({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
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

export function StyleStep({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
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

export function DroppersStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

export function FliesStep({
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
