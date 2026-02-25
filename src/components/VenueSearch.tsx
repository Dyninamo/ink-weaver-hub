import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, X, Star, ChevronRight, ChevronDown, ArrowRight, Loader2 } from "lucide-react";
import { format, addDays, nextSaturday, isSaturday, isSunday } from "date-fns";

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

const VenueSearch = ({ onAdviceRequest, isLoading = false }: VenueSearchProps) => {
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

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load water types on mount
  useEffect(() => {
    supabase.from("water_types").select("water_type_id, water_type").then(({ data }) => {
      if (data) setWaterTypes(data);
    });
  }, []);

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
        .select("venue_id, name, full_name, level, water_type_id, region_id, county, river_name, latitude, longitude, parent_id, session_count, display_context, search_text")
        .eq("is_searchable", true)
        .eq("is_active", true)
        .ilike("search_text", `%${debouncedSearch}%`)
        .order("session_count", { ascending: false })
        .limit(50);

      // Apply water type filter
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

  // Group results: rivers as expandable parents, everything else as flat items
  const groupedResults = useMemo(() => {
    const rivers: VenueResult[] = [];
    const flat: VenueResult[] = [];

    for (const r of results) {
      if (r.level === "river") {
        rivers.push(r);
      } else {
        flat.push(r);
      }
    }

    // Combine: rivers first, then flat items, max 15
    const combined: VenueResult[] = [...rivers, ...flat].slice(0, 15);
    return combined;
  }, [results]);

  const handleExpandRiver = async (river: VenueResult) => {
    const id = river.venue_id;
    if (expandedRivers.has(id)) {
      setExpandedRivers((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    setLoadingRivers((prev) => new Set(prev).add(id));
    // Fetch sections
    const { data: sections } = await supabase
      .from("venues_new")
      .select("venue_id, name, full_name, level, water_type_id, region_id, county, river_name, latitude, longitude, parent_id, session_count, display_context, search_text")
      .eq("parent_id", id)
      .eq("is_active", true)
      .order("name");

    let allChildren = (sections as VenueResult[]) || [];

    // Fetch beats for each section
    const sectionIds = allChildren.filter((c) => c.level === "section").map((c) => c.venue_id);
    if (sectionIds.length > 0) {
      const { data: beats } = await supabase
        .from("venues_new")
        .select("venue_id, name, full_name, level, water_type_id, region_id, county, river_name, latitude, longitude, parent_id, session_count, display_context, search_text")
        .in("parent_id", sectionIds)
        .eq("is_active", true)
        .order("name");

      if (beats) allChildren = [...allChildren, ...(beats as VenueResult[])];
    }

    setRiverChildren((prev) => ({ ...prev, [id]: allChildren }));
    setExpandedRivers((prev) => new Set(prev).add(id));
    setLoadingRivers((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
    if (key === "today") {
      d = today;
    } else if (key === "tomorrow") {
      d = addDays(today, 1);
    } else {
      // This weekend = next Saturday
      d = isSaturday(today) ? today : isSunday(today) ? addDays(today, 6) : nextSaturday(today);
    }
    setSelectedDate(d);
    setActiveQuickDate(key);
  };

  const handleSubmit = () => {
    if (!selectedVenue || !selectedDate) return;
    onAdviceRequest(selectedVenue.venue_id, selectedVenue.name, format(selectedDate, "yyyy-MM-dd"));
  };

  // Highlight matching text
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

  const renderResultRow = (venue: VenueResult, indent = 0) => {
    const isRiver = venue.level === "river";
    const isExpanded = expandedRivers.has(venue.venue_id);
    const isLoadingChildren = loadingRivers.has(venue.venue_id);

    return (
      <button
        key={venue.venue_id}
        type="button"
        className={cn(
          "w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-start gap-3 min-h-[56px]",
          indent === 1 && "pl-10",
          indent === 2 && "pl-16"
        )}
        onClick={() => (isRiver ? handleExpandRiver(venue) : handleSelectVenue(venue))}
      >
        <Star className="w-5 h-5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
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
      </button>
    );
  };

  // -- SELECTED STATE --
  if (selectedVenue) {
    return (
      <div className="space-y-6">
        {/* Selected venue card */}
        <div className="border border-border rounded-lg p-4 flex items-start gap-3">
          <Star className="w-5 h-5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground">{selectedVenue.name}</div>
            <div className="text-sm text-muted-foreground">{renderContextLine(selectedVenue)}</div>
          </div>
          <Button variant="link" size="sm" onClick={handleChangeVenue} className="flex-shrink-0 text-primary">
            Change
          </Button>
        </div>

        {/* Date picker */}
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
              onSelect={(d) => {
                setSelectedDate(d);
                setActiveQuickDate(null);
              }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Get Advice button */}
        <Button
          onClick={handleSubmit}
          disabled={!selectedDate || isLoading}
          className="w-full bg-gradient-water text-white hover:opacity-90 text-lg py-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Get Advice
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    );
  }

  // -- SEARCH STATE --
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
            onClick={() => {
              setSearchText("");
              setResults([]);
            }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(
            [
              { mode: "all" as const, label: "All" },
              { mode: "stillwater" as const, label: "Stillwater ▾" },
              { mode: "river" as const, label: "River ▾" },
              { mode: "nearme" as const, label: "Near me" },
            ] as const
          ).map((chip) => (
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

        {/* Sub-type chips */}
        {filterMode === "stillwater" && (
          <div className="flex gap-2 overflow-x-auto pb-1 pl-4 scrollbar-hide">
            {STILLWATER_SUBTYPES.map((st) => (
              <button
                key={st.id}
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors min-h-[32px]",
                  subTypeFilter === st.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setSubTypeFilter(subTypeFilter === st.id ? null : st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
        {filterMode === "river" && (
          <div className="flex gap-2 overflow-x-auto pb-1 pl-4 scrollbar-hide">
            {RIVER_SUBTYPES.map((st) => (
              <button
                key={st.id}
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors min-h-[32px]",
                  subTypeFilter === st.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setSubTypeFilter(subTypeFilter === st.id ? null : st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
                  {/* River children */}
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
