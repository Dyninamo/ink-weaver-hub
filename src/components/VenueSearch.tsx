import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Search, X, Star, ChevronRight, ChevronDown, ArrowRight, Loader2 } from "lucide-react";
import { format, addDays, nextSaturday, isSaturday, isSunday, formatDistanceToNow } from "date-fns";

interface VenueSearchProps {
  onAdviceRequest: (venueId: string, venueName: string, date: string) => void;
  isLoading?: boolean;
}

interface VenueResult {
  venue_id: string;
  name: string;
  full_name: string;
  level: string;
  water_type_id: number;
  region_id: number;
  county: string | null;
  river_name: string | null;
  latitude: number | null;
  longitude: number | null;
  parent_id: string | null;
  session_count: number;
  display_context: string | null;
  search_text: string;
}

interface WaterType {
  water_type_id: number;
  water_type: string;
}

interface FavouriteRow {
  venue_id: string;
  created_at: string;
  venues_new: VenueResult | null;
}

interface HistoryRow {
  id: string;
  venue_id: string;
  action: string;
  created_at: string;
  venues_new: VenueResult | null;
}

const STILLWATER_IDS = [1, 2, 7];
const RIVER_IDS = [3, 4, 5, 6];

const STILLWATER_SUBTYPES = [
  { id: 1, label: "Small Stillwater" },
  { id: 2, label: "Large Reservoir" },
  { id: 7, label: "Loch/Lough" },
];

const RIVER_SUBTYPES = [
  { id: 4, label: "Chalkstream" },
  { id: 3, label: "Freestone" },
  { id: 5, label: "Spate" },
  { id: 6, label: "Limestone" },
];

type FilterMode = "all" | "stillwater" | "river" | "nearme";

const VENUE_SELECT_FIELDS = "venue_id, name, full_name, level, water_type_id, region_id, county, river_name, latitude, longitude, parent_id, session_count, display_context, search_text";

const VenueSearch = ({ onAdviceRequest, isLoading = false }: VenueSearchProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [waterTypes, setWaterTypes] = useState<WaterType[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [subTypeFilter, setSubTypeFilter] = useState<number | null>(null);
  const [expandedRivers, setExpandedRivers] = useState<Set<string>>(new Set());
  const [riverChildren, setRiverChildren] = useState<Record<string, VenueResult[]>>({});
  const [loadingRivers, setLoadingRivers] = useState<Set<string>>(new Set());

  // Selection state
  const [selectedVenue, setSelectedVenue] = useState<VenueResult | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [activeQuickDate, setActiveQuickDate] = useState<string | null>(null);

  // Favourites & history
  const [favouritedIds, setFavouritedIds] = useState<Set<string>>(new Set());
  const [favouriteVenues, setFavouriteVenues] = useState<VenueResult[]>([]);
  const [showAllFavourites, setShowAllFavourites] = useState(false);
  const [historyVenues, setHistoryVenues] = useState<{ venue: VenueResult; timestamp: string }[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load water types on mount
  useEffect(() => {
    supabase.from("water_types").select("water_type_id, water_type").then(({ data }) => {
      if (data) setWaterTypes(data);
    });
  }, []);

  // Load favourites & history
  useEffect(() => {
    if (!user) return;

    const loadFavourites = async () => {
      const { data } = await supabase
        .from("user_venue_favourites")
        .select(`venue_id, created_at, venues_new (${VENUE_SELECT_FIELDS})`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        const rows = data as unknown as FavouriteRow[];
        const ids = new Set(rows.map((r) => r.venue_id));
        setFavouritedIds(ids);

        const venues = rows
          .filter((r) => r.venues_new)
          .map((r) => r.venues_new!)
          .sort((a, b) => (b.session_count || 0) - (a.session_count || 0));
        setFavouriteVenues(venues);
      }
    };

    const loadHistory = async () => {
      const { data } = await supabase
        .from("user_venue_history")
        .select(`id, venue_id, action, created_at, venues_new (${VENUE_SELECT_FIELDS})`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        const rows = data as unknown as HistoryRow[];
        // Deduplicate by venue_id, keep most recent
        const seen = new Set<string>();
        const deduped: { venue: VenueResult; timestamp: string }[] = [];
        for (const r of rows) {
          if (!seen.has(r.venue_id) && r.venues_new) {
            seen.add(r.venue_id);
            deduped.push({ venue: r.venues_new, timestamp: r.created_at });
          }
          if (deduped.length >= 5) break;
        }
        setHistoryVenues(deduped);
      }
    };

    loadFavourites();
    loadHistory();
  }, [user]);

  // Debounce search
  useEffect(() => {
    if (searchText.length < 2) {
      setDebouncedSearch("");
      setResults([]);
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Search query
  useEffect(() => {
    if (!debouncedSearch) return;

    const doSearch = async () => {
      setIsSearching(true);
      let query = supabase
        .from("venues_new")
        .select(VENUE_SELECT_FIELDS)
        .eq("is_searchable", true)
        .eq("is_active", true)
        .ilike("search_text", `%${debouncedSearch}%`)
        .order("session_count", { ascending: false })
        .limit(50);

      const activeIds = getActiveWaterTypeIds();
      if (activeIds) {
        query = query.in("water_type_id", activeIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Venue search error:", error);
        setResults([]);
      } else {
        setResults((data as VenueResult[]) || []);
      }
      setIsSearching(false);
    };

    doSearch();
  }, [debouncedSearch, filterMode, subTypeFilter]);

  const getActiveWaterTypeIds = useCallback((): number[] | null => {
    if (subTypeFilter !== null) return [subTypeFilter];
    if (filterMode === "stillwater") return STILLWATER_IDS;
    if (filterMode === "river") return RIVER_IDS;
    return null;
  }, [filterMode, subTypeFilter]);

  const waterTypeName = useCallback(
    (id: number) => waterTypes.find((wt) => wt.water_type_id === id)?.water_type || "",
    [waterTypes]
  );

  // Filter favourites/history by active water type filter
  const filteredFavourites = useMemo(() => {
    const ids = getActiveWaterTypeIds();
    if (!ids) return favouriteVenues;
    return favouriteVenues.filter((v) => ids.includes(v.water_type_id));
  }, [favouriteVenues, getActiveWaterTypeIds]);

  const filteredHistory = useMemo(() => {
    const ids = getActiveWaterTypeIds();
    if (!ids) return historyVenues;
    return historyVenues.filter((h) => ids.includes(h.venue.water_type_id));
  }, [historyVenues, getActiveWaterTypeIds]);

  const groupedResults = useMemo(() => {
    const rivers: VenueResult[] = [];
    const flat: VenueResult[] = [];
    for (const r of results) {
      if (r.level === "river") rivers.push(r);
      else flat.push(r);
    }
    return [...rivers, ...flat].slice(0, 15);
  }, [results]);

  const handleExpandRiver = async (river: VenueResult) => {
    const id = river.venue_id;
    if (expandedRivers.has(id)) {
      setExpandedRivers((prev) => { const next = new Set(prev); next.delete(id); return next; });
      return;
    }

    setLoadingRivers((prev) => new Set(prev).add(id));
    const { data: sections } = await supabase
      .from("venues_new")
      .select(VENUE_SELECT_FIELDS)
      .eq("parent_id", id)
      .eq("is_active", true)
      .order("name");

    let allChildren = (sections as VenueResult[]) || [];
    const sectionIds = allChildren.filter((c) => c.level === "section").map((c) => c.venue_id);
    if (sectionIds.length > 0) {
      const { data: beats } = await supabase
        .from("venues_new")
        .select(VENUE_SELECT_FIELDS)
        .in("parent_id", sectionIds)
        .eq("is_active", true)
        .order("name");
      if (beats) allChildren = [...allChildren, ...(beats as VenueResult[])];
    }

    setRiverChildren((prev) => ({ ...prev, [id]: allChildren }));
    setExpandedRivers((prev) => new Set(prev).add(id));
    setLoadingRivers((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  // Star toggle
  const toggleFavourite = async (venueId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;

    const wasFavourited = favouritedIds.has(venueId);

    // Optimistic update
    setFavouritedIds((prev) => {
      const next = new Set(prev);
      if (wasFavourited) next.delete(venueId);
      else next.add(venueId);
      return next;
    });

    if (wasFavourited) {
      // Remove from favourites list
      setFavouriteVenues((prev) => prev.filter((v) => v.venue_id !== venueId));
    }

    try {
      if (wasFavourited) {
        const { error } = await supabase
          .from("user_venue_favourites")
          .delete()
          .eq("user_id", user.id)
          .eq("venue_id", venueId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_venue_favourites")
          .insert({ user_id: user.id, venue_id: venueId });
        if (error) throw error;

        // Add to favourites list if we have the venue data
        const venueData = results.find((r) => r.venue_id === venueId)
          || Object.values(riverChildren).flat().find((r) => r.venue_id === venueId)
          || historyVenues.find((h) => h.venue.venue_id === venueId)?.venue;
        if (venueData) {
          setFavouriteVenues((prev) => [venueData, ...prev]);
        }
      }
    } catch (err) {
      console.error("Toggle favourite failed:", err);
      // Revert
      setFavouritedIds((prev) => {
        const next = new Set(prev);
        if (wasFavourited) next.add(venueId);
        else next.delete(venueId);
        return next;
      });
      toast({ variant: "destructive", title: "Error", description: "Failed to update favourite." });
    }
  };

  const handleSelectVenue = (venue: VenueResult) => {
    setSelectedVenue(venue);
    setSearchText("");
    setResults([]);
  };

  const handleChangeVenue = () => {
    setSelectedVenue(null);
    setActiveQuickDate(null);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleFilterMode = (mode: FilterMode) => {
    if (mode === "nearme") {
      toast({ title: "Coming soon", description: "Location-based search will be available soon." });
      return;
    }
    if (filterMode === mode) {
      setFilterMode("all");
      setSubTypeFilter(null);
    } else {
      setFilterMode(mode);
      setSubTypeFilter(null);
    }
  };

  const handleQuickDate = (key: string) => {
    const today = new Date();
    let d: Date;
    if (key === "today") d = today;
    else if (key === "tomorrow") d = addDays(today, 1);
    else d = isSaturday(today) ? today : isSunday(today) ? addDays(today, 6) : nextSaturday(today);
    setSelectedDate(d);
    setActiveQuickDate(key);
  };

  const handleSubmit = () => {
    if (!selectedVenue || !selectedDate) return;
    onAdviceRequest(selectedVenue.venue_id, selectedVenue.name, format(selectedDate, "yyyy-MM-dd"));
  };

  const highlightMatch = (text: string) => {
    if (!debouncedSearch || debouncedSearch.length < 2) return text;
    const idx = text.toLowerCase().indexOf(debouncedSearch.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-primary">{text.slice(idx, idx + debouncedSearch.length)}</span>
        {text.slice(idx + debouncedSearch.length)}
      </>
    );
  };

  const renderContextLine = (venue: VenueResult) => {
    const parts: string[] = [];
    if (venue.display_context) parts.push(venue.display_context);
    else if (venue.river_name) parts.push(venue.river_name);
    if (venue.county) parts.push(venue.county);
    const wt = waterTypeName(venue.water_type_id);
    if (wt) parts.push(wt);
    return parts.join(" — ");
  };

  const renderStar = (venueId: string, e?: React.MouseEvent) => {
    const isFav = favouritedIds.has(venueId);
    return (
      <button
        type="button"
        className="flex-shrink-0 mt-0.5"
        onClick={(ev) => toggleFavourite(venueId, ev)}
        aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
      >
        <Star
          className={cn(
            "w-5 h-5 transition-colors",
            isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"
          )}
        />
      </button>
    );
  };

  const renderResultRow = (venue: VenueResult, indent = 0) => {
    const isRiver = venue.level === "river";
    const isExpanded = expandedRivers.has(venue.venue_id);
    const isLoadingChildren = loadingRivers.has(venue.venue_id);

    return (
      <div
        key={venue.venue_id}
        className={cn(
          "w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-start gap-3 min-h-[56px] cursor-pointer",
          indent === 1 && "pl-10",
          indent === 2 && "pl-16"
        )}
        onClick={() => (isRiver ? handleExpandRiver(venue) : handleSelectVenue(venue))}
      >
        {renderStar(venue.venue_id)}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate text-sm">
            {highlightMatch(venue.name)}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {renderContextLine(venue)}
          </div>
        </div>
        {isRiver && (
          <div className="flex-shrink-0 mt-1">
            {isLoadingChildren ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    );
  };

  // -- SELECTED STATE --
  if (selectedVenue) {
    return (
      <div className="space-y-6">
        <div className="border border-border rounded-lg p-4 flex items-start gap-3">
          {renderStar(selectedVenue.venue_id)}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground">{selectedVenue.name}</div>
            <div className="text-sm text-muted-foreground">{renderContextLine(selectedVenue)}</div>
          </div>
          <Button variant="link" size="sm" onClick={handleChangeVenue} className="flex-shrink-0 text-primary">
            Change
          </Button>
        </div>

        <div className="space-y-3">
          <p className="font-medium text-foreground">When are you fishing?</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: "today", label: "Today" },
              { key: "tomorrow", label: "Tomorrow" },
              { key: "weekend", label: "This weekend" },
            ].map((q) => (
              <button
                key={q.key}
                type="button"
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors min-h-[36px]",
                  activeQuickDate === q.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
                onClick={() => handleQuickDate(q.key)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { setSelectedDate(d); setActiveQuickDate(null); }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!selectedDate || isLoading}
          className="w-full bg-gradient-water text-white hover:opacity-90 text-lg py-6"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
          ) : (
            <>Get Advice<ArrowRight className="w-5 h-5 ml-2" /></>
          )}
        </Button>
      </div>
    );
  }

  // -- DEFAULT / SEARCH STATE --
  const showDefaultState = !debouncedSearch;

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name, river, region, or postcode..."
          className="pl-10 pr-10 h-12 text-base"
        />
        {searchText && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchText(""); setResults([]); }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([
            { mode: "all" as const, label: "All" },
            { mode: "stillwater" as const, label: "Stillwater ▾" },
            { mode: "river" as const, label: "River ▾" },
            { mode: "nearme" as const, label: "Near me" },
          ] as const).map((chip) => (
            <button
              key={chip.mode}
              type="button"
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors min-h-[36px]",
                filterMode === chip.mode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              onClick={() => handleFilterMode(chip.mode)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {filterMode === "stillwater" && (
          <div className="flex gap-2 overflow-x-auto pb-1 pl-4 scrollbar-hide">
            {STILLWATER_SUBTYPES.map((st) => (
              <button key={st.id} type="button" className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors min-h-[32px]",
                subTypeFilter === st.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
              )} onClick={() => setSubTypeFilter(subTypeFilter === st.id ? null : st.id)}>
                {st.label}
              </button>
            ))}
          </div>
        )}
        {filterMode === "river" && (
          <div className="flex gap-2 overflow-x-auto pb-1 pl-4 scrollbar-hide">
            {RIVER_SUBTYPES.map((st) => (
              <button key={st.id} type="button" className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors min-h-[32px]",
                subTypeFilter === st.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
              )} onClick={() => setSubTypeFilter(subTypeFilter === st.id ? null : st.id)}>
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Default state: Favourites + Recent */}
      {showDefaultState && (
        <div className="space-y-6 pt-2">
          {/* Favourites */}
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              Your Favourites
            </h3>
            {filteredFavourites.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
                <Star className="w-4 h-4 text-muted-foreground/30" />
                Star venues to save them here
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(showAllFavourites ? filteredFavourites : filteredFavourites.slice(0, 6)).map((venue) => (
                    <Card
                      key={venue.venue_id}
                      className="p-3 cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => handleSelectVenue(venue)}
                    >
                      <div className="flex items-start gap-2">
                        {renderStar(venue.venue_id)}
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground text-sm truncate">{venue.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{renderContextLine(venue)}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {filteredFavourites.length > 6 && !showAllFavourites && (
                  <button
                    type="button"
                    className="text-xs text-primary mt-2 hover:underline"
                    onClick={() => setShowAllFavourites(true)}
                  >
                    Show all ({filteredFavourites.length})
                  </button>
                )}
              </>
            )}
          </div>

          {/* Recent */}
          {filteredHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent</h3>
              <div className="border border-border rounded-lg divide-y divide-border">
                {filteredHistory.map((h) => (
                  <div
                    key={h.venue.venue_id}
                    className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-start gap-3 min-h-[56px] cursor-pointer"
                    onClick={() => handleSelectVenue(h.venue)}
                  >
                    {renderStar(h.venue.venue_id)}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate text-sm">{h.venue.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{renderContextLine(h.venue)}</div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                      {formatDistanceToNow(new Date(h.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {debouncedSearch && (
        <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No venues found for &lsquo;{debouncedSearch}&rsquo;</p>
              <p className="text-xs mt-2 text-primary/70">Can&apos;t find your water? Add it →</p>
            </div>
          ) : (
            <>
              {groupedResults.map((venue) => (
                <div key={venue.venue_id}>
                  {renderResultRow(venue)}
                  {venue.level === "river" &&
                    expandedRivers.has(venue.venue_id) &&
                    riverChildren[venue.venue_id]?.map((child) => {
                      const indent = child.level === "beat" ? 2 : 1;
                      return renderResultRow(child, indent);
                    })}
                </div>
              ))}
              {results.length > 15 && (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                  Refine your search to see more results
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VenueSearch;
