import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Fish, CheckCircle, Loader2, Pencil, Trash2, Share2, Star, Wind, Thermometer, Cloud } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import FishLogger from "@/components/FishLogger";

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

const DiaryEntry = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [entry, setEntry] = useState<any>(null);
  const [fishRecords, setFishRecords] = useState<FishRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const addFishMode = (location.state as any)?.addFish === true;

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [entryRes, fishRes] = await Promise.all([
        supabase.from("diary_entries").select("*").eq("id", id).single(),
        supabase.from("diary_fish").select("*").eq("diary_entry_id", id).order("fish_number", { ascending: true }),
      ]);

      if (entryRes.error) throw entryRes.error;
      setEntry(entryRes.data);
      setFishRecords((fishRes.data as FishRecord[]) || []);
    } catch (err) {
      console.error("Error loading diary entry:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load diary entry." });
      navigate("/diary");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("diary_entries").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Entry deleted" });
      navigate("/diary");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!entry) return null;

  // Parse weather
  const weather = entry.weather_override || entry.weather_auto;

  // Find heaviest fish
  const heaviestId = fishRecords.reduce<string | null>((best, f) => {
    if (!best) return f.id;
    const bestFish = fishRecords.find((r) => r.id === best);
    const totalOzCurrent = (f.weight_lb || 0) * 16 + (f.weight_oz || 0);
    const totalOzBest = ((bestFish?.weight_lb || 0) * 16) + ((bestFish?.weight_oz || 0));
    return totalOzCurrent > totalOzBest ? f.id : best;
  }, null);

  // Has any weight at all?
  const hasWeights = fishRecords.some((f) => f.weight_lb || f.weight_oz);

  const formatWeight = (lb: number | null, oz: number | null) => {
    if (!lb && !oz) return null;
    const parts = [];
    if (lb) parts.push(`${lb}lb`);
    if (oz) parts.push(`${oz}oz`);
    return parts.join(" ");
  };

  const formatTime12 = (t: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "pm" : "am";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m}${ampm}`;
  };

  // Sort fish by time, then fish_number
  const sortedFish = [...fishRecords].sort((a, b) => {
    if (a.time_caught && b.time_caught) return a.time_caught.localeCompare(b.time_caught);
    if (a.time_caught) return -1;
    if (b.time_caught) return 1;
    return a.fish_number - b.fish_number;
  });

  const keptCount = fishRecords.filter((f) => f.kept_or_released === "Kept").length;
  const releasedCount = fishRecords.filter((f) => f.kept_or_released === "Released").length;

  // Parse JSONB arrays safely
  const parseJsonArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };

  const methodsList = parseJsonArray(entry.methods_used);
  const fliesList = parseJsonArray(entry.flies_used);
  const spotsList = parseJsonArray(entry.spots_fished);
  const linesList = parseJsonArray(entry.lines_used);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/diary")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{entry.venue}</h1>
              <p className="text-sm text-white/80">
                {format(new Date(entry.trip_date), "EEEE d MMMM yyyy")}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Fish className="w-6 h-6" />
              <span className="text-3xl font-bold">{entry.total_fish}</span>
              <span className="text-white/80 text-sm">fish</span>
            </div>
            {(keptCount > 0 || releasedCount > 0) && (
              <div className="text-sm text-white/70">
                {releasedCount > 0 && `${releasedCount} released`}
                {keptCount > 0 && releasedCount > 0 && " · "}
                {keptCount > 0 && `${keptCount} kept`}
              </div>
            )}
            {weather && (
              <div className="ml-auto flex items-center gap-2 text-sm text-white/80">
                {weather.temperature != null && (
                  <span className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5" />
                    {weather.temperature}°C
                  </span>
                )}
                {weather.windSpeed != null && (
                  <span className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5" />
                    {weather.windDirection && `${weather.windDirection} `}{weather.windSpeed}mph
                  </span>
                )}
                {weather.conditions && (
                  <span className="flex items-center gap-1">
                    <Cloud className="w-3.5 h-3.5" />
                    {weather.conditions}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 pb-24">
        {/* Add Fish mode */}
        {addFishMode && (
          <>
            <FishLogger diaryEntryId={id!} venue={entry.venue} venueType={entry.venue_type || "stillwater"} onUpdate={fetchData} />
            <Button
              onClick={() => {
                toast({ title: "Entry saved!", description: `${entry.total_fish} fish logged.` });
                navigate(`/diary/${id}`, { replace: true });
              }}
              className="w-full bg-gradient-water text-white hover:opacity-90 py-6 text-base"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Save & Finish
            </Button>
          </>
        )}

        {/* Fish Timeline */}
        {!addFishMode && sortedFish.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Catch Timeline</h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[22px] top-3 bottom-3 w-px bg-border" />

              <div className="space-y-3">
                {sortedFish.map((f, idx) => {
                  const isHeaviest = hasWeights && f.id === heaviestId && (f.weight_lb || f.weight_oz);
                  const weight = formatWeight(f.weight_lb, f.weight_oz);
                  const time = formatTime12(f.time_caught);

                  return (
                    <div key={f.id} className="relative flex gap-3 pl-0">
                      {/* Timeline dot */}
                      <div className="relative z-10 flex flex-col items-center shrink-0 w-[44px]">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${isHeaviest ? "bg-accent" : "bg-primary"}`} />
                      </div>

                      {/* Card */}
                      <Card className={`flex-1 p-3 ${isHeaviest ? "border-accent/40 bg-accent/5" : ""}`}>
                        {/* Time label */}
                        {time && (
                          <p className="text-xs text-muted-foreground mb-1">{time}</p>
                        )}
                        {!time && (
                          <p className="text-xs text-muted-foreground mb-1">Fish #{f.fish_number}</p>
                        )}

                        {/* Species + weight */}
                        <p className="font-semibold text-card-foreground">
                          🐟 {f.species}
                          {weight && <span className="ml-1.5 text-primary">{weight}</span>}
                          {isHeaviest && <Star className="inline w-4 h-4 ml-1.5 text-accent fill-accent" />}
                        </p>

                        {/* Technique line */}
                        {(f.fly || f.method || f.line || f.retrieve) && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {[
                              f.fly && `${f.fly}${f.fly_size ? ` (${f.fly_size})` : ""}${f.fly_colour ? ` ${f.fly_colour}` : ""}`,
                              f.line && `${f.line} line`,
                              f.retrieve,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        )}

                        {/* Location + outcome */}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[
                            f.spot && `📍 ${f.spot}`,
                            f.depth,
                            f.kept_or_released,
                          ].filter(Boolean).join(" · ")}
                        </p>

                        {/* Notes */}
                        {f.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-muted pl-2">
                            "{f.notes}"
                          </p>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty fish state */}
        {!addFishMode && sortedFish.length === 0 && (
          <Card className="p-8 text-center">
            <Fish className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No individual fish logged for this trip.</p>
            <Button
              variant="outline"
              onClick={() => navigate(`/diary/${id}`, { state: { addFish: true } })}
            >
              Add Fish Records
            </Button>
          </Card>
        )}

        {/* Trip Summary */}
        {!addFishMode && (methodsList.length > 0 || fliesList.length > 0 || spotsList.length > 0 || linesList.length > 0 || entry.notes) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Trip Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {methodsList.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Methods: </span>
                  <span className="text-foreground">{methodsList.join(", ")}</span>
                </div>
              )}
              {fliesList.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Flies: </span>
                  <span className="text-foreground">{fliesList.join(", ")}</span>
                </div>
              )}
              {spotsList.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Spots: </span>
                  <span className="text-foreground">{spotsList.join(", ")}</span>
                </div>
              )}
              {linesList.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Lines: </span>
                  <span className="text-foreground">{linesList.join(", ")}</span>
                </div>
              )}
              {entry.fishing_type && (
                <div>
                  <span className="text-muted-foreground">Type: </span>
                  <span className="text-foreground">{entry.fishing_type}</span>
                </div>
              )}
              {entry.notes && (
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="text-foreground whitespace-pre-wrap">{entry.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {!addFishMode && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/diary/${id}`, { state: { addFish: true } })}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Add Fish
            </Button>
            <Button variant="outline" className="flex-1" disabled>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive border-destructive/30">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this diary entry and all {fishRecords.length} fish records. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </main>
    </div>
  );
};

export default DiaryEntry;
