import { useState, useMemo } from "react";
import { X, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { RecommendedFly } from "@/types/flySelector";

interface FlySelectorProps {
  flies: RecommendedFly[];
  venueName: string;
  tripDate: string;
  onClose: () => void;
}

const CATEGORY_COLOURS: Record<string, { border: string; bg: string; text: string }> = {
  Buzzer: { border: "border-l-amber-500", bg: "bg-amber-500", text: "text-amber-700 bg-amber-100" },
  Nymph: { border: "border-l-green-500", bg: "bg-green-500", text: "text-green-700 bg-green-100" },
  Lure: { border: "border-l-purple-500", bg: "bg-purple-500", text: "text-purple-700 bg-purple-100" },
  Dry: { border: "border-l-sky-500", bg: "bg-sky-500", text: "text-sky-700 bg-sky-100" },
  Wet: { border: "border-l-slate-500", bg: "bg-slate-500", text: "text-slate-700 bg-slate-100" },
  Other: { border: "border-l-neutral-400", bg: "bg-neutral-400", text: "text-neutral-700 bg-neutral-100" },
};

const PRICE_PER_FLY = 1.2;

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function FlySelector({ flies, venueName, tripDate, onClose }: FlySelectorProps) {
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(flies.map((f) => [f.rank, 1]))
  );
  const [activeVariation, setActiveVariation] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(flies.map((f) => [f.rank, null]))
  );

  const totalFlies = useMemo(
    () => Object.values(quantities).reduce((s, q) => s + q, 0),
    [quantities]
  );
  const totalCost = totalFlies * PRICE_PER_FLY;

  function adjustQty(rank: number, delta: number) {
    setQuantities((prev) => {
      const current = prev[rank] ?? 0;
      const next = current + delta;
      if (next < 0) return prev;
      if (next > 6) return prev;
      // Check minimum 12 when decreasing
      if (delta < 0) {
        const newTotal = totalFlies + delta;
        if (newTotal < 12) {
          toast({
            title: "Minimum 12 flies",
            description: "You need at least 12 flies in your selection.",
            variant: "destructive",
          });
          return prev;
        }
      }
      return { ...prev, [rank]: next };
    });
  }

  function selectVariation(rank: number, varIdx: number | null) {
    setActiveVariation((prev) => ({ ...prev, [rank]: varIdx }));
  }

  function handleConfirm() {
    toast({
      title: "Order confirmed!",
      description: `${totalFlies} flies for £${totalCost.toFixed(2)}`,
    });
    onClose();
  }

  const hasDiaryData = flies.some((f) => f.source === "diary");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold truncate">
            Your Fly Selection
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {venueName} · {formatDate(tripDate)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {hasDiaryData
              ? "Based on diary session data for this venue"
              : "Demo selection — log sessions to get personalised picks"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] shrink-0"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {flies.map((fly) => {
          const qty = quantities[fly.rank] ?? 0;
          const varIdx = activeVariation[fly.rank];
          const catStyle = CATEGORY_COLOURS[fly.category] ?? CATEGORY_COLOURS.Other;

          // Determine display name based on active variation
          const displayName =
            varIdx !== null && fly.variations[varIdx]
              ? `${fly.name} — ${fly.variations[varIdx].label}`
              : fly.name;
          const displaySize =
            varIdx !== null && fly.variations[varIdx]
              ? fly.variations[varIdx].hookSize
              : fly.hookSize;

          return (
            <div
              key={fly.rank}
              className={cn(
                "relative rounded-lg border border-border p-3 pl-4 transition-opacity",
                `border-l-4 ${catStyle.border}`,
                qty === 0 && "opacity-40"
              )}
            >
              {/* Rank badge */}
              <div className={cn(
                "absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                catStyle.bg
              )}>
                {fly.rank}
              </div>

              <div className="flex items-start gap-3">
                {/* Fly info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{displayName}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", catStyle.text)}>
                      {fly.category}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">Size {displaySize}</p>

                  {/* Source line */}
                  {fly.source === "diary" ? (
                    <p className="text-xs text-green-600">
                      Caught on {fly.catchPercent}% of {fly.useCount} sessions
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600">
                      {(fly.confidence ?? 0) >= 0.8
                        ? "Top performer in these conditions"
                        : (fly.confidence ?? 0) >= 0.5
                          ? "Consistently mentioned in reports"
                          : "Worth trying — appears in similar weeks"}
                    </p>
                  )}

                  {/* Variation chips */}
                  {fly.variations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {/* Default (original) chip */}
                      <button
                        type="button"
                        onClick={() => selectVariation(fly.rank, null)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-full border min-h-[28px] transition-colors",
                          varIdx === null
                            ? `${catStyle.bg} text-white border-transparent`
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        Original
                      </button>
                      {fly.variations.map((v, vi) => (
                        <button
                          key={vi}
                          type="button"
                          onClick={() => selectVariation(fly.rank, vi)}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded-full border min-h-[28px] transition-colors",
                            varIdx === vi
                              ? `${catStyle.bg} text-white border-transparent`
                              : "border-border text-muted-foreground hover:border-foreground/30"
                          )}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  <button
                    type="button"
                    onClick={() => adjustQty(fly.rank, -1)}
                    className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-mono font-semibold">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustQty(fly.rank, 1)}
                    className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{totalFlies} flies selected</p>
          <p className="text-xs text-muted-foreground">Est. £{totalCost.toFixed(2)}</p>
        </div>
        <Button
          onClick={handleConfirm}
          disabled={totalFlies < 12}
          className="min-h-[44px] px-6"
        >
          Confirm Order
        </Button>
      </div>
    </div>
  );
}
