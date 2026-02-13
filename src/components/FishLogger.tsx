import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Pencil, Fish, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AutocompleteTagInput from "@/components/AutocompleteTagInput";

interface FishRecord {
  id: string;
  fish_number: number;
  species: string;
  weight_lb: number | null;
  weight_oz: number | null;
  method: string | null;
  fly: string | null;
  fly_size: number | null;
  fly_colour: string | null;
  line: string | null;
  depth: string | null;
  retrieve: string | null;
  spot: string | null;
  time_caught: string | null;
  kept_or_released: string;
  notes: string | null;
}

interface FishLoggerProps {
  diaryEntryId: string;
  venue: string;
  onUpdate?: () => void;
}

const SPECIES = ["Rainbow", "Brown", "Brook", "Tiger", "Other"];
const FLY_SIZES = ["8", "10", "12", "14", "16", "18"];

const DEPTHS = ["Surface", "Sub-surface", "Mid-water", "Deep", "On the drop"];

const FishLogger = ({ diaryEntryId, venue, onUpdate }: FishLoggerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [fish, setFish] = useState<FishRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [species, setSpecies] = useState("Rainbow");
  const [weightLb, setWeightLb] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [method, setMethod] = useState("");
  const [fly, setFly] = useState("");
  const [flySize, setFlySize] = useState("");
  const [flyColour, setFlyColour] = useState("");
  const [line, setLine] = useState("");
  const [depth, setDepth] = useState("");
  const [retrieve, setRetrieve] = useState("");
  const [spot, setSpot] = useState("");
  const [timeCaught, setTimeCaught] = useState("");
  const [keptOrReleased, setKeptOrReleased] = useState("Released");
  const [notes, setNotes] = useState("");

  // Sticky defaults (persist between adds)
  const stickyMethod = useRef("");
  const stickyLine = useRef("");
  const stickySpot = useRef("");

  // Reference data is now handled by AutocompleteTagInput

  // Load existing fish
  const fetchFish = useCallback(async () => {
    const { data, error } = await supabase
      .from("diary_fish")
      .select("*")
      .eq("diary_entry_id", diaryEntryId)
      .order("fish_number", { ascending: true });

    if (!error && data) setFish(data as FishRecord[]);
    setIsLoading(false);
  }, [diaryEntryId]);

  useEffect(() => {
    fetchFish();
  }, [fetchFish]);

  const resetForm = (keepSticky = true) => {
    setSpecies("Rainbow");
    setWeightLb("");
    setWeightOz("");
    setFly("");
    setFlySize("");
    setFlyColour("");
    setDepth("");
    setRetrieve("");
    setTimeCaught("");
    setKeptOrReleased("Released");
    setNotes("");
    setEditingId(null);

    if (keepSticky) {
      setMethod(stickyMethod.current);
      setLine(stickyLine.current);
      setSpot(stickySpot.current);
    } else {
      setMethod("");
      setLine("");
      setSpot("");
    }
  };

  const openForm = () => {
    resetForm(true);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    // Remember sticky values
    if (method) stickyMethod.current = method;
    if (line) stickyLine.current = line;
    if (spot) stickySpot.current = spot;

    try {
      const payload = {
        diary_entry_id: diaryEntryId,
        user_id: user.id,
        fish_number: editingId ? fish.find((f) => f.id === editingId)?.fish_number || fish.length + 1 : fish.length + 1,
        species,
        weight_lb: weightLb ? Number(weightLb) : null,
        weight_oz: weightOz ? Number(weightOz) : null,
        method: method || null,
        fly: fly || null,
        fly_size: flySize ? Number(flySize) : null,
        fly_colour: flyColour || null,
        line: line || null,
        depth: depth || null,
        retrieve: retrieve || null,
        spot: spot || null,
        time_caught: timeCaught || null,
        kept_or_released: keptOrReleased,
        notes: notes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("diary_fish")
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("diary_fish")
          .insert(payload as any);
        if (error) throw error;
      }

      await fetchFish();
      onUpdate?.();
      resetForm(true);

      if (!editingId) {
        // Keep form open for next fish
        toast({ title: `Fish #${payload.fish_number} added!` });
      } else {
        setIsFormOpen(false);
        toast({ title: "Fish updated!" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (f: FishRecord) => {
    setEditingId(f.id);
    setSpecies(f.species);
    setWeightLb(f.weight_lb?.toString() || "");
    setWeightOz(f.weight_oz?.toString() || "");
    setMethod(f.method || "");
    setFly(f.fly || "");
    setFlySize(f.fly_size?.toString() || "");
    setFlyColour(f.fly_colour || "");
    setLine(f.line || "");
    setDepth(f.depth || "");
    setRetrieve(f.retrieve || "");
    setSpot(f.spot || "");
    setTimeCaught(f.time_caught?.slice(0, 5) || "");
    setKeptOrReleased(f.kept_or_released);
    setNotes(f.notes || "");
    setIsFormOpen(true);
  };

  const handleDelete = async (fishId: string) => {
    try {
      const { error } = await supabase.from("diary_fish").delete().eq("id", fishId);
      if (error) throw error;
      await fetchFish();
      onUpdate?.();
      toast({ title: "Fish removed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const keptCount = fish.filter((f) => f.kept_or_released === "Kept").length;
  const releasedCount = fish.filter((f) => f.kept_or_released === "Released").length;

  const formatWeight = (lb: number | null, oz: number | null) => {
    if (!lb && !oz) return "";
    const parts = [];
    if (lb) parts.push(`${lb}lb`);
    if (oz) parts.push(`${oz}oz`);
    return parts.join(" ");
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "pm" : "am";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m}${ampm}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Running total */}
      {fish.length > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Fish className="w-4 h-4 text-primary" />
          {fish.length} fish logged
          <span className="text-muted-foreground">
            ({releasedCount} released{keptCount > 0 ? `, ${keptCount} kept` : ""})
          </span>
        </div>
      )}

      {/* Fish list */}
      {fish.map((f) => (
        <Card key={f.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-card-foreground">
                Fish #{f.fish_number} — {f.species}
                {(f.weight_lb || f.weight_oz) && (
                  <span className="ml-1 text-primary">{formatWeight(f.weight_lb, f.weight_oz)}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[
                  f.fly && `${f.fly}${f.fly_size ? ` (sz ${f.fly_size})` : ""}`,
                  f.method && `on ${f.method}`,
                  f.line && `${f.line} line`,
                ]
                  .filter(Boolean)
                  .join(", ") || "No details"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[
                  f.spot && `📍 ${f.spot}`,
                  formatTime(f.time_caught),
                  f.kept_or_released,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {f.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">"{f.notes}"</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {/* Add fish button / form */}
      {!isFormOpen ? (
        <Button
          onClick={openForm}
          variant="outline"
          className="w-full border-dashed border-2 py-6 text-base"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Fish
        </Button>
      ) : (
        <Card className="border-primary/30">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-card-foreground">
                {editingId ? "Edit Fish" : `Fish #${fish.length + 1}`}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setIsFormOpen(false); setEditingId(null); }}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>

            {/* Row 1: Core */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Species</Label>
                <Select value={species} onValueChange={setSpecies}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight</Label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      placeholder="lb"
                      className="h-10 pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">lb</span>
                  </div>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      value={weightOz}
                      onChange={(e) => setWeightOz(e.target.value)}
                      placeholder="oz"
                      className="h-10 pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">oz</span>
                  </div>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-2 flex items-end">
                <div className="flex items-center gap-3 h-10">
                  <Label className="text-xs whitespace-nowrap cursor-pointer" htmlFor="kept-toggle">
                    {keptOrReleased === "Kept" ? "Kept" : "Released"}
                  </Label>
                  <Switch
                    id="kept-toggle"
                    checked={keptOrReleased === "Kept"}
                    onCheckedChange={(checked) => setKeptOrReleased(checked ? "Kept" : "Released")}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: How */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <AutocompleteTagInput category="method" singleSelect value={method ? [method] : []} onChange={(v) => setMethod(v[0] || "")} placeholder="Buzzer..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fly</Label>
                <AutocompleteTagInput category="fly" singleSelect value={fly ? [fly] : []} onChange={(v) => setFly(v[0] || "")} placeholder="Diawl Bach..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Size</Label>
                <Select value={flySize} onValueChange={setFlySize}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Colour</Label>
                <Input
                  value={flyColour}
                  onChange={(e) => setFlyColour(e.target.value)}
                  placeholder="Black..."
                  className="h-10"
                  list="fly-colours"
                />
                <datalist id="fly-colours">
                  {["Black", "Olive", "Orange", "Green", "Claret", "White"].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Row 3: Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Line</Label>
                <AutocompleteTagInput category="line" singleSelect value={line ? [line] : []} onChange={(v) => setLine(v[0] || "")} placeholder="Floating..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Depth</Label>
                <Select value={depth} onValueChange={setDepth}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPTHS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retrieve</Label>
                <AutocompleteTagInput category="retrieve" singleSelect value={retrieve ? [retrieve] : []} onChange={(v) => setRetrieve(v[0] || "")} placeholder="Fig-of-8..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Spot</Label>
                <AutocompleteTagInput category="spot" venue={venue} singleSelect value={spot ? [spot] : []} onChange={(v) => setSpot(v[0] || "")} placeholder="Dam..." />
              </div>
            </div>

            {/* Row 4: When + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Time caught</Label>
                <Input type="time" value={timeCaught} onChange={(e) => setTimeCaught(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Took on the drop..."
                  className="h-10"
                />
              </div>
            </div>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-gradient-water text-white hover:opacity-90 py-5 text-base"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {editingId ? "Update Fish" : "Add Fish"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default FishLogger;
