import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { SessionEvent } from "@/services/diaryService";

export interface SessionRod {
  id: string;
  session_id: string;
  rod_index: number;
  name: string | null;
  rod_weight: number | null;
  line_name: string | null;
  style: string | null;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}

interface RodPickerSheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  events: SessionEvent[];
  activeRodIndex: number;
  onSwitchRod: (rod: SessionRod) => void;
  onSetupNewRod: () => void;
}

function fmtRange(startISO: string, endISO: string | null): string {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date();
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${endISO ? fmt(end) : "now"}`;
}

export default function RodPickerSheet({
  open,
  onClose,
  sessionId,
  events,
  activeRodIndex,
  onSwitchRod,
  onSetupNewRod,
}: RodPickerSheetProps) {
  const [rods, setRods] = useState<SessionRod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("session_rods" as any)
        .select("*")
        .eq("session_id", sessionId)
        .order("rod_index");
      if (!error && data) setRods(data as unknown as SessionRod[]);
      setLoading(false);
    })();
  }, [open, sessionId]);

  // Tally events per rod
  const tallies = useMemo(() => {
    const t: Record<number, { caught: number; lost: number; blank: number }> = {};
    for (const e of events) {
      const idx = (e as any).rod_index ?? 1;
      if (!t[idx]) t[idx] = { caught: 0, lost: 0, blank: 0 };
      if (e.event_type === "catch") t[idx].caught++;
      else if (e.event_type === "got_away") t[idx].lost++;
      else if (e.event_type === "blank") t[idx].blank++;
    }
    return t;
  }, [events]);

  const isMobile = useIsMobile();

  const body = (
    <>
      <div className="space-y-2 mt-3 max-h-[60vh] overflow-y-auto">
        {loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Loading rods…
          </p>
        )}

        {!loading && rods.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No rods set up yet.
          </p>
        )}

        {rods.map((rod) => {
          const t = tallies[rod.rod_index] ?? { caught: 0, lost: 0, blank: 0 };
          const isActive = rod.rod_index === activeRodIndex;
          const subtitle = [
            rod.rod_weight ? `#${rod.rod_weight}` : null,
            rod.line_name,
            rod.style,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <button
              key={rod.id}
              type="button"
              onClick={() => onSwitchRod(rod)}
              disabled={isActive}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                isActive
                  ? "border-foreground/60 bg-muted/40"
                  : "border-border hover:border-foreground/40 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {rod.name || `Rod ${rod.rod_index}`}
                    {isActive && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        active
                      </span>
                    )}
                  </div>
                  {subtitle && (
                    <div className="text-xs text-muted-foreground truncate">
                      {subtitle}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0 text-right">
                  <div className="flex gap-2">
                    <span>{t.caught}c</span>
                    <span>{t.lost}l</span>
                    <span>{t.blank}b</span>
                  </div>
                  <div>{fmtRange(rod.started_at, rod.ended_at)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSetupNewRod}
        className={cn(
          "w-full mt-3 rounded-xl border-2 border-dashed border-border",
          "h-12 text-sm font-medium hover:bg-muted/30 transition-colors"
        )}
      >
        + Set up a new rod
      </button>
    </>
  );

  // Desktop (≥768px) — render as a centered Dialog rather than a bottom sheet.
  // Per prompt 149 §3.
  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Switch rod</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Switch rod</SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
