import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Mail, Send, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SessionEvent } from "@/services/diaryService";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  venueId: string | null;
  venueName: string;
  returnEmail: string;
  events: SessionEvent[];
  defaultAnglerName?: string | null;
  onSent?: () => void;
}

function fmtTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtWeight(c: SessionEvent): string {
  if (c.weight_display) return c.weight_display;
  if (c.weight_lb != null || c.weight_oz != null) {
    return `${c.weight_lb ?? 0}lb ${c.weight_oz ?? 0}oz`;
  }
  return "—";
}

export default function VenueReturnDialog({
  open,
  onClose,
  sessionId,
  venueId,
  venueName,
  returnEmail,
  events,
  defaultAnglerName,
  onSent,
}: Props) {
  const [anglerName, setAnglerName] = useState(defaultAnglerName ?? "");
  const [membership, setMembership] = useState("");
  const [includeGps, setIncludeGps] = useState(true);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const catches = useMemo(
    () => events.filter((e) => e.event_type === "catch"),
    [events]
  );

  // Areas aggregate
  const areas = useMemo(() => {
    const m = new Map<string, { catches: number; blanks: number; first?: string; last?: string }>();
    for (const e of events) {
      const spot = e.spot ?? "Unspecified";
      const entry = m.get(spot) ?? { catches: 0, blanks: 0 };
      if (e.event_type === "catch") entry.catches += 1;
      if (e.event_type === "blank") entry.blanks += 1;
      if (!entry.first) entry.first = e.event_time;
      entry.last = e.event_time;
      m.set(spot, entry);
    }
    return Array.from(m.entries());
  }, [events]);

  async function handleSend() {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "submit-venue-return",
        {
          body: {
            session_id: sessionId,
            venue_id: venueId,
            angler_name: anglerName.trim() || undefined,
            membership_no: membership.trim() || undefined,
            include_gps: includeGps,
            note: note.trim() || undefined,
          },
        }
      );

      if (error) throw error;

      if (data?.status === "sent") {
        toast.success(`Return sent to ${venueName}`);
        onSent?.();
        onClose();
      } else if (data?.status === "already_reported") {
        toast.info("This session has already been reported");
        onClose();
      } else if (data?.status === "no_return_email") {
        toast.error(`${venueName} has no return email on file`);
      } else if (data?.status === "failed") {
        toast.error("Failed to send — please try again");
      } else {
        toast.success("Return sent");
        onSent?.();
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-diary">
            <Mail className="h-5 w-5 text-primary" />
            Send return to {venueName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Sending to <span className="font-mono">{returnEmail}</span>
          </p>

          {/* Angler details */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="angler-name" className="text-xs">Your name</Label>
              <Input
                id="angler-name"
                value={anglerName}
                onChange={(e) => setAnglerName(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="membership" className="text-xs">Membership #</Label>
              <Input
                id="membership"
                value={membership}
                onChange={(e) => setMembership(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What will be sent
            </p>

            {/* Catches */}
            <div>
              <p className="text-xs font-medium mb-1">
                Catches ({catches.length})
              </p>
              {catches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No fish recorded.
                </p>
              ) : (
                <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
                  {catches.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-2 py-1 border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-muted-foreground">
                          {fmtTime(c.event_time)}
                        </span>{" "}
                        <span className="font-medium">
                          {c.species ?? "—"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · {fmtWeight(c)}
                        </span>
                        {c.fly_pattern && (
                          <span className="text-muted-foreground">
                            {" "}· {c.fly_pattern}
                          </span>
                        )}
                        <div className="text-muted-foreground/80 truncate">
                          {c.spot ?? "Unspecified spot"}
                          {includeGps && c.latitude && c.longitude && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px]">
                              <MapPin className="h-2.5 w-2.5" />
                              {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Areas */}
            {areas.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Areas fished</p>
                <div className="space-y-0.5 text-xs">
                  {areas.map(([spot, info]) => (
                    <div key={spot} className="flex justify-between gap-2">
                      <span className="truncate">{spot}</span>
                      <span className="text-muted-foreground shrink-0">
                        {info.catches} fish
                        {info.first && info.last && (
                          <> · {fmtTime(info.first)}–{fmtTime(info.last)}</>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GPS toggle */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="gps-toggle" className="text-sm cursor-pointer">
                Include GPS coordinates
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Helps the venue understand where fish were caught
              </p>
            </div>
            <Switch
              id="gps-toggle"
              checked={includeGps}
              onCheckedChange={setIncludeGps}
            />
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="return-note" className="text-xs">
              Note (optional)
            </Label>
            <Textarea
              id="return-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else you'd like to share?"
              rows={2}
              className="mt-1 resize-none"
            />
          </div>

          {/* Disclosure */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong>Not shared:</strong> private per-catch notes, retrieve style,
            voice transcripts, and blank-event detail at non-caught spots.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={onClose}
              disabled={sending}
            >
              Not this time
            </Button>
            <Button
              className={cn(
                "flex-1 min-h-[44px]",
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Send return
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
