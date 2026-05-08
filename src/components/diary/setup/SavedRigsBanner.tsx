import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { RodSetupState } from "./vocabulary";

interface PresetRow {
  id: string;
  name: string;
  rod: any;
  water_type: string | null;
  include_flies: boolean;
  last_used_at: string;
}

interface SavedRigsBannerProps {
  userId: string;
  venueWaterType: string | null;
  onApply: (preset: { rod: RodSetupState; hasFlies: boolean; id: string }) => void;
}

export default function SavedRigsBanner({ userId, venueWaterType, onApply }: SavedRigsBannerProps) {
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("user_presets")
        .select("id, name, rod, water_type, include_flies, last_used_at")
        .eq("user_id", userId)
        .order("last_used_at", { ascending: false })
        .limit(8);
      if (!error && data) {
        const filtered = venueWaterType
          ? data.filter((p) => !p.water_type || p.water_type === venueWaterType)
          : data;
        setPresets(filtered as PresetRow[]);
      }
      setLoading(false);
    }
    load();
  }, [userId, venueWaterType]);

  if (loading || presets.length === 0) return null;

  function handleTap(p: PresetRow) {
    // best-effort markUsed
    supabase
      .from("user_presets")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", p.id)
      .then(() => {});
    const rod = p.rod as RodSetupState;
    const hasFlies = rod?.flies && Object.values(rod.flies).some((f: any) => !!f?.name);
    onApply({ rod, hasFlies: !!hasFlies, id: p.id });
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground px-1">Saved rigs · tap to apply</div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {presets.map((p) => {
          const rod = p.rod || {};
          const subtitle = `${rod.flyCount ?? "?"}-fly ${rod.style ?? "—"}`;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleTap(p)}
              className={cn(
                "shrink-0 px-3 py-2 rounded-lg border bg-card text-left",
                "hover:border-primary transition-colors min-w-[140px]"
              )}
            >
              <div className="text-sm font-medium truncate max-w-[180px]">{p.name}</div>
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
