import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { SessionEvent } from "@/services/diaryService";

interface ShareSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  venueName: string;
  sessionDate: string;
  venueId?: string | null;
  events: SessionEvent[];
  weatherTemp?: number | null;
  weatherWind?: string | null;
  weatherConditions?: string | null;
  method?: string | null;
  profileId: string;
}

interface GroupOption {
  group_id: string;
  name: string;
  alreadyShared: boolean;
}

const ShareSessionDialog = ({
  open, onOpenChange, sessionId, venueName, sessionDate, venueId,
  events, weatherTemp, weatherWind, weatherConditions, method, profileId,
}: ShareSessionDialogProps) => {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Compute session summary
  const catches = events.filter((e) => e.event_type === "catch");
  const totalFish = catches.length;

  const speciesMap = new Map<string, number>();
  catches.forEach((c) => {
    const sp = c.species || "Unknown";
    speciesMap.set(sp, (speciesMap.get(sp) || 0) + 1);
  });
  const speciesBreakdown = Array.from(speciesMap.entries()).map(([species, count]) => ({ species, count }));
  const speciesText = speciesBreakdown.map((s) => `${s.count} ${s.species}`).join(", ");

  // Top flies
  const flyCount = new Map<string, number>();
  catches.forEach((c) => {
    if (c.fly_pattern) flyCount.set(c.fly_pattern, (flyCount.get(c.fly_pattern) || 0) + 1);
  });
  const topFlies = Array.from(flyCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  useEffect(() => {
    if (!open) return;
    loadGroups();
  }, [open]);

  const loadGroups = async () => {
    setLoading(true);

    const { data: memberships } = await supabase
      .from("group_memberships")
      .select("group_id, social_groups(group_id, name)")
      .eq("profile_id", profileId)
      .eq("status", "active");

    const { data: existing } = await supabase
      .from("social_cards")
      .select("group_id")
      .eq("session_id", sessionId)
      .eq("profile_id", profileId);

    const sharedGroupIds = new Set((existing || []).map((e) => e.group_id));

    if (memberships) {
      setGroups(
        memberships.map((m) => ({
          group_id: m.group_id,
          name: (m as any).social_groups?.name ?? "Unknown",
          alreadyShared: sharedGroupIds.has(m.group_id),
        }))
      );
    }
    setLoading(false);
  };

  const handleShare = async () => {
    if (selected.size === 0) return;
    setSharing(true);

    const cardBase = {
      profile_id: profileId,
      session_id: sessionId,
      venue_id: venueId || null,
      venue_name: venueName,
      session_date: sessionDate,
      n_fish: totalFish,
      species_breakdown: speciesBreakdown,
      top_fly_1: topFlies[0] || null,
      top_fly_2: topFlies[1] || null,
      method: method || null,
      conditions_temp_c: weatherTemp || null,
      conditions_wind: weatherWind || null,
      conditions_weather: weatherConditions || null,
      personal_note: note.trim() || null,
    };

    const inserts = Array.from(selected).map((group_id) => ({
      ...cardBase,
      group_id,
    }));

    const { error } = await supabase.from("social_cards").insert(inserts);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: `Shared to ${selected.size} group${selected.size > 1 ? "s" : ""}` });
      setNote("");
      setSelected(new Set());
      onOpenChange(false);
    }
    setSharing(false);
  };

  const toggleGroup = (groupId: string) => {
    const next = new Set(selected);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setSelected(next);
  };

  const formattedDate = format(new Date(sessionDate + "T12:00:00"), "d MMM yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Preview */}
          <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">{venueName} — {formattedDate}</p>
            <p className="text-muted-foreground">
              {totalFish} fish{speciesText ? ` (${speciesText})` : ""}
            </p>
            {topFlies.length > 0 && (
              <p className="text-muted-foreground">Top flies: {topFlies.join(", ")}</p>
            )}
            {method && <p className="text-muted-foreground">{method}</p>}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Add a note (optional)</Label>
            <Textarea
              placeholder="How was it?"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/280</p>
          </div>

          {/* Group selection */}
          <div className="space-y-2">
            <Label>Share to:</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading groups…</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">You're not in any groups yet.</p>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.group_id} className="flex items-center gap-3">
                    <Checkbox
                      id={`share-${g.group_id}`}
                      checked={g.alreadyShared || selected.has(g.group_id)}
                      disabled={g.alreadyShared}
                      onCheckedChange={() => toggleGroup(g.group_id)}
                    />
                    <label htmlFor={`share-${g.group_id}`} className="text-sm text-foreground flex-1">
                      {g.name}
                      {g.alreadyShared && (
                        <span className="text-muted-foreground text-xs ml-2">(already shared)</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button className="w-full" disabled={selected.size === 0 || sharing} onClick={handleShare}>
            {sharing ? "Sharing…" : "Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSessionDialog;
