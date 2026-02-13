import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Fish, BookOpen, Plus, LogOut, Thermometer, Wind, Filter, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DiaryEntry {
  id: string;
  venue: string;
  trip_date: string;
  total_fish: number;
  total_kept: number;
  total_released: number;
  best_method: string | null;
  best_fly: string | null;
  best_spot: string | null;
  fishing_type: string | null;
  is_competition: boolean;
  weather_auto: any;
  weather_override: any;
}

const PAGE_SIZE = 20;

const Diary = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [venueFilter, setVenueFilter] = useState("__all__");
  const [venues, setVenues] = useState<string[]>([]);

  // Stats
  const [totalTrips, setTotalTrips] = useState(0);
  const [totalFish, setTotalFish] = useState(0);
  const [uniqueVenues, setUniqueVenues] = useState(0);

  const fetchEntries = useCallback(async (offset = 0, append = false) => {
    try {
      let query = supabase
        .from("diary_entries")
        .select("id, venue, trip_date, total_fish, total_kept, total_released, best_method, best_fly, best_spot, fishing_type, is_competition, weather_auto, weather_override")
        .order("trip_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (venueFilter !== "__all__") {
        query = query.eq("venue", venueFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const results = (data as DiaryEntry[]) || [];
      setHasMore(results.length === PAGE_SIZE);

      if (append) {
        setEntries((prev) => [...prev, ...results]);
      } else {
        setEntries(results);
      }
    } catch (err) {
      console.error("Error loading diary entries:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load diary entries." });
    }
  }, [venueFilter, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("diary_entries")
        .select("venue, total_fish");

      if (error) throw error;
      if (data) {
        setTotalTrips(data.length);
        setTotalFish(data.reduce((sum, d: any) => sum + (d.total_fish || 0), 0));
        const venueSet = new Set(data.map((d: any) => d.venue));
        setUniqueVenues(venueSet.size);
        setVenues(Array.from(venueSet).sort());
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchEntries(0), fetchStats()]);
      setIsLoading(false);
    };
    load();
  }, [user, fetchEntries, fetchStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchEntries(0), fetchStats()]);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await fetchEntries(entries.length, true);
    setIsLoadingMore(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const getWeather = (entry: DiaryEntry) => {
    return entry.weather_override || entry.weather_auto;
  };

  const parseJsonArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Diary</h1>
              <p className="text-sm text-white/80">Your fishing journal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center font-semibold">
                {getUserInitials()}
              </div>
            )}
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/dashboard")}>
            <Fish className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button variant="ghost" className="text-foreground font-semibold border-b-2 border-primary rounded-none">
            <BookOpen className="w-4 h-4 mr-2" />
            My Diary
          </Button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : entries.length === 0 && venueFilter === "__all__" ? (
          /* Empty state */
          <Card className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Your fishing journal awaits</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Log your trips, track what works, and build your personal fishing database.
              </p>
              <Button onClick={() => navigate("/diary/new")} className="bg-gradient-water text-white hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Log Your First Trip
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Stats bar */}
            {totalTrips > 0 && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
                <span className="font-medium text-foreground">{totalTrips} trips</span>
                <span>•</span>
                <span>{totalFish} fish</span>
                <span>•</span>
                <span>{uniqueVenues} venues</span>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}

            {/* Filters */}
            {venues.length > 1 && (
              <div className="mb-4">
                <Select value={venueFilter} onValueChange={setVenueFilter}>
                  <SelectTrigger className="w-full sm:w-56 bg-card">
                    <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All venues" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="__all__">All venues</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* No results for filter */}
            {entries.length === 0 && venueFilter !== "__all__" && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No entries for {venueFilter}.</p>
                <Button variant="link" onClick={() => setVenueFilter("__all__")} className="mt-2">
                  Show all venues
                </Button>
              </Card>
            )}

            {/* Entry cards */}
            <div className="space-y-3">
              {entries.map((entry) => {
                const weather = getWeather(entry);
                const best = [entry.best_fly, entry.best_spot, entry.best_method].filter(Boolean);
                const kept = entry.total_kept || 0;
                const released = entry.total_released || 0;
                const total = entry.total_fish || 0;
                const keptPct = total > 0 ? (kept / total) * 100 : 0;
                const releasedPct = total > 0 ? (released / total) * 100 : 0;

                return (
                  <Card
                    key={entry.id}
                    className="p-4 cursor-pointer hover:shadow-medium transition-all border-border active:scale-[0.99]"
                    onClick={() => navigate(`/diary/${entry.id}`)}
                  >
                    {/* Row 1: Venue + fish count */}
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-card-foreground text-base">{entry.venue}</h3>
                      <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-sm font-semibold shrink-0">
                        <span>{total} fish</span>
                        <span>🐟</span>
                      </div>
                    </div>

                    {/* Row 2: Date */}
                    <p className="text-sm text-muted-foreground mb-2">
                      {format(new Date(entry.trip_date), "EEEE d MMMM yyyy")}
                    </p>

                    {/* Row 3: Best */}
                    {best.length > 0 && (
                      <p className="text-sm text-foreground mb-2">
                        <span className="text-muted-foreground">Best: </span>
                        {best.join(" • ")}
                      </p>
                    )}

                    {/* Row 4: Weather */}
                    {weather && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        {weather.conditions && <span>{weather.conditions.includes("Clear") || weather.conditions.includes("Sunny") ? "☀️" : weather.conditions.includes("Rain") ? "🌧️" : weather.conditions.includes("Cloud") || weather.conditions.includes("Overcast") ? "☁️" : "🌤️"}</span>}
                        {weather.temperature != null && (
                          <span className="flex items-center gap-0.5">
                            <Thermometer className="w-3 h-3" />
                            {weather.temperature}°C
                          </span>
                        )}
                        {weather.windSpeed != null && (
                          <span className="flex items-center gap-0.5">
                            <Wind className="w-3 h-3" />
                            {weather.windDirection && `${weather.windDirection} `}{weather.windSpeed}mph
                          </span>
                        )}
                      </div>
                    )}

                    {/* Row 5: Kept/released bar */}
                    {total > 0 && (
                      <div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted mb-1">
                          {released > 0 && (
                            <div className="bg-primary transition-all" style={{ width: `${releasedPct}%` }} />
                          )}
                          {kept > 0 && (
                            <div className="bg-accent transition-all" style={{ width: `${keptPct}%` }} />
                          )}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          {released > 0 && <span>{released} released</span>}
                          {kept > 0 && <span>{kept} kept</span>}
                        </div>
                      </div>
                    )}

                    {/* Competition badge */}
                    {entry.is_competition && (
                      <span className="inline-block mt-2 bg-accent/10 text-accent text-xs px-2 py-0.5 rounded font-medium">
                        🏆 Competition
                      </span>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && entries.length > 0 && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full sm:w-auto"
                >
                  {isLoadingMore ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}

            {/* Desktop new entry */}
            <div className="hidden md:block mt-6">
              <Button onClick={() => navigate("/diary/new")} className="bg-gradient-water text-white hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                New Entry
              </Button>
            </div>
          </>
        )}
      </main>

      {/* FAB */}
      {!isLoading && (
        <button
          onClick={() => navigate("/diary/new")}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-medium flex items-center justify-center hover:opacity-90 transition-opacity md:hidden z-50"
          aria-label="Add new diary entry"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Diary;
