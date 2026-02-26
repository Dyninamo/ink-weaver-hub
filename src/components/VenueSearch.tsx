import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Search, X, Star, ChevronRight, ChevronDown, ArrowRight, Loader2, MapPin, Navigation, AlertCircle } from "lucide-react";
import { format, addDays, nextSaturday, isSaturday, isSunday, formatDistanceToNow } from "date-fns";
import { haversineDistanceMiles } from "@/utils/distance";
import VenueSubmissionForm from "@/components/VenueSubmissionForm";

interface VenueSearchProps {
  onAdviceRequest: (venueId: string, venueName: string, date: string) => void;
  isLoading?: boolean;
  loadingMessage?: string;
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

interface VenueWithDistance extends VenueResult {
  distance?: number;
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

interface UserLocation {
  lat: number;
  lng: number;
  source: "gps" | "manual";
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

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

type FilterMode = "all" | "stillwater" | "river" | "nearme";

const VENUE_SELECT_FIELDS = "venue_id, name, full_name, level, water_type_id, region_id, county, river_name, latitude, longitude, parent_id, session_count, display_context, search_text";

const VenueSearch = ({ onAdviceRequest, isLoading = false, loadingMessage = "" }: VenueSearchProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [previousSearchText, setPreviousSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Favourites & history
  const [favouritedIds, setFavouritedIds] = useState<Set<string>>(new Set());
  const [favouriteVenues, setFavouriteVenues] = useState<VenueResult[]>([]);
  const [showAllFavourites, setShowAllFavourites] = useState(false);
  const [historyVenues, setHistoryVenues] = useState<{ venue: VenueResult; timestamp: string }[]>([]);

  // Near me / location state
  const [nearMeActive, setNearMeActive] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(25);
  const nominatimLastCall = useRef(0);

  // Add-a-water form
  const [showAddForm, setShowAddForm] = useState(false);

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
      setSearchError(null);
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
        setSearchError("Unable to search — check your connection");
        setResults([]);
      } else {
        setResults((data as VenueResult[]) || []);
      }
      setIsSearching(false);
    };

    doSearch();
  }, [debouncedSearch, filterMode, subTypeFilter]);

  const retrySearch = () => {
    setSearchError(null);
    if (debouncedSearch) {
      setDebouncedSearch("");
      setTimeout(() => setDebouncedSearch(searchText), 50);
    }
  };

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

  // --- Distance helpers ---
  const addDistanceToVenue = useCallback(
    (venue: VenueResult): VenueWithDistance => {
      if (!userLocation || !nearMeActive || venue.latitude == null || venue.longitude == null) {
        return venue;
      }
      return {
        ...venue,
        distance: haversineDistanceMiles(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude),
      };
    },
    [userLocation, nearMeActive]
  );

  const applyDistanceFilter = useCallback(
    (venues: VenueWithDistance[]): VenueWithDistance[] => {
      if (!nearMeActive || !userLocation) return venues;
      return venues
        .filter((v) => v.distance != null && v.distance <= selectedRadius)
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    },
    [nearMeActive, userLocation, selectedRadius]
  );

  // Filter favourites/history by active water type filter + distance
  const filteredFavourites = useMemo(() => {
    const ids = getActiveWaterTypeIds();
    let favs = ids ? favouriteVenues.filter((v) => ids.includes(v.water_type_id)) : favouriteVenues;
    const withDist = favs.map(addDistanceToVenue);
    return nearMeActive && userLocation ? applyDistanceFilter(withDist) : withDist;
  }, [favouriteVenues, getActiveWaterTypeIds, addDistanceToVenue, applyDistanceFilter, nearMeActive, userLocation]);

  const filteredHistory = useMemo(() => {
    const ids = getActiveWaterTypeIds();
    let hist = ids ? historyVenues.filter((h) => ids.includes(h.venue.water_type_id)) : historyVenues;
    if (nearMeActive && userLocation) {
      return hist
        .map((h) => ({ ...h, venue: addDistanceToVenue(h.venue) as VenueWithDistance }))
        .filter((h) => h.venue.distance != null && h.venue.distance <= selectedRadius)
        .sort((a, b) => (a.venue.distance ?? Infinity) - (b.venue.distance ?? Infinity));
    }
    return hist.map((h) => ({ ...h, venue: addDistanceToVenue(h.venue) as VenueWithDistance }));
  }, [historyVenues, getActiveWaterTypeIds, addDistanceToVenue, nearMeActive, userLocation, selectedRadius, applyDistanceFilter]);

  const groupedResults = useMemo(() => {
    const withDist = results.map(addDistanceToVenue);
    const filtered = nearMeActive && userLocation ? applyDistanceFilter(withDist) : withDist;

    const rivers: VenueWithDistance[] = [];
    const flat: VenueWithDistance[] = [];
    for (const r of filtered) {
      if (r.level === "river") rivers.push(r);
      else flat.push(r);
    }
    return [...rivers, ...flat].slice(0, 15);
  }, [results, addDistanceToVenue, applyDistanceFilter, nearMeActive, userLocation]);

  // --- Near me handlers ---
  const handleNearMeTap = () => {
    if (nearMeActive) {
      setNearMeActive(false);
      setShowManualLocation(false);
      setLocationError(null);
      return;
    }

    if (userLocation) {
      setNearMeActive(true);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: "gps",
        });
        setNearMeActive(true);
        setLocating(false);
      },
      () => {
        setShowManualLocation(true);
        setNearMeActive(true);
        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const resolveManualLocation = async () => {
    const input = manualLocationInput.trim();
    if (!input) return;
    setLocationError(null);
    setResolvingLocation(true);

    try {
      if (UK_POSTCODE_REGEX.test(input)) {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(input)}`);
        const json = await res.json();
        if (json.status === 200 && json.result) {
          setUserLocation({ lat: json.result.latitude, lng: json.result.longitude, source: "manual" });
          setShowManualLocation(false);
          setManualLocationInput("");
        } else {
          setLocationError("Invalid postcode — try again");
        }
      } else {
        const now = Date.now();
        const wait = Math.max(0, 1000 - (now - nominatimLastCall.current));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        nominatimLastCall.current = Date.now();

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&countrycodes=gb&format=json&limit=1`,
          { headers: { "User-Agent": "FishingIntelligenceApp/1.0" } }
        );
        const json = await res.json();
        if (json.length > 0) {
          setUserLocation({ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon), source: "manual" });
          setShowManualLocation(false);
          setManualLocationInput("");
        } else {
          setLocationError("Location not found — try a postcode");
        }
      }
    } catch {
      setLocationError("Failed to resolve location");
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleUseGpsFallback = () => {
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude, source: "gps" });
        setShowManualLocation(false);
        setLocating(false);
      },
      () => {
        setLocationError("GPS not available — please enter a location");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

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

    setFavouritedIds((prev) => {
      const next = new Set(prev);
      if (wasFavourited) next.delete(venueId);
      else next.add(venueId);
      return next;
    });

    if (wasFavourited) {
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

        const venueData = results.find((r) => r.venue_id === venueId)
          || Object.values(riverChildren).flat().find((r) => r.venue_id === venueId)
          || historyVenues.find((h) => h.venue.venue_id === venueId)?.venue;
        if (venueData) {
          setFavouriteVenues((prev) => [venueData, ...prev]);
        }
      }
    } catch (err) {
      console.error("Toggle favourite failed:", err);
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
    setPreviousSearchText(searchText);
    setIsTransitioning(true);
    setAdviceError(null);
    // Fade out results, then set venue
    setTimeout(() => {
      setSelectedVenue(venue);
      setSearchText("");
      setResults([]);
      // Trigger date picker fade in
      setTimeout(() => {
        setShowDatePicker(true);
        setIsTransitioning(false);
      }, 50);
    }, 150);
  };

  const handleChangeVenue = () => {
    setShowDatePicker(false);
    setIsTransitioning(true);
    setAdviceError(null);
    setTimeout(() => {
      setSelectedVenue(null);
      setSearchText(previousSearchText);
      setIsTransitioning(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }, 200);
  };

  const handleFilterMode = (mode: FilterMode) => {
    if (mode === "nearme") {
      handleNearMeTap();
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
    today.setHours(0, 0, 0, 0);
    let d: Date;
    if (key === "today") d = today;
    else if (key === "tomorrow") d = addDays(today, 1);
    else {
      // "weekend": Saturday. If today is Saturday or Sunday, use today.
      d = isSaturday(today) || isSunday(today) ? today : nextSaturday(today);
    }
    setSelectedDate(d);
    setActiveQuickDate(key);
  };

  const handleCalendarSelect = (d: Date | undefined) => {
    setSelectedDate(d);
    setActiveQuickDate(null); // Clear chip highlight when calendar is used
  };

  const handleSubmit = () => {
    if (!selectedVenue || !selectedDate) return;
    setAdviceError(null);
    onAdviceRequest(selectedVenue.venue_id, selectedVenue.name, format(selectedDate, "yyyy-MM-dd"));
  };

  // Allow parent to signal errors via a callback — we detect via isLoading going false with no navigation
  // For now, we track adviceError via the parent passing error state or we use a simple approach

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

  const renderContextLine = (venue: VenueWithDistance) => {
    const parts: string[] = [];
    if (venue.display_context) parts.push(venue.display_context);
    else if (venue.river_name) parts.push(venue.river_name);
    if (venue.county) parts.push(venue.county);
    const wt = waterTypeName(venue.water_type_id);
    if (wt) parts.push(wt);
    if (nearMeActive && venue.distance != null) {
      parts.push(`${venue.distance.toFixed(1)} miles`);
    }
    return parts.join(" — ");
  };

  const renderStar = (venueId: string) => {
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

  const renderResultRow = (venue: VenueWithDistance, indent = 0) => {
    const isRiver = venue.level === "river";
    const isExpanded = expandedRivers.has(venue.venue_id);
    const isLoadingChildren = loadingRivers.has(venue.venue_id);

    return (
      <div
        key={venue.venue_id}
        role="option"
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

  // -- ADD-A-WATER FORM --
  if (showAddForm) {
    return (
      <div className="space-y-3">
        <VenueSubmissionForm
          initialName={searchText || debouncedSearch}
          userLocation={userLocation}
          onSubmitted={(venue) => {
            setShowAddForm(false);
            setFavouritedIds((prev) => new Set(prev).add(venue.venue_id));
            setFavouriteVenues((prev) => [venue, ...prev]);
            handleSelectVenue(venue);
          }}
          onSelectExisting={(venueId) => {
            setShowAddForm(false);
            const found = results.find((r) => r.venue_id === venueId)
              || favouriteVenues.find((v) => v.venue_id === venueId);
            if (found) handleSelectVenue(found);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  // -- SELECTED STATE --
  if (selectedVenue) {
    const venueWithDist = addDistanceToVenue(selectedVenue);
    return (
      <div className={cn("space-y-6 transition-all duration-200", isTransitioning && "opacity-0")}>
        {/* Selected venue card */}
        <div className="border border-border rounded-lg p-4 flex items-start gap-3 transition-all duration-200">
          {renderStar(selectedVenue.venue_id)}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground">{selectedVenue.name}</div>
            <div className="text-sm text-muted-foreground">{renderContextLine(venueWithDist)}</div>
          </div>
          <Button variant="link" size="sm" onClick={handleChangeVenue} className="flex-shrink-0 text-primary" disabled={isLoading}>
            Change
          </Button>
        </div>

        {/* Date picker section */}
        <div className={cn(
          "space-y-3 transition-all duration-200",
          showDatePicker ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          isLoading && "pointer-events-none opacity-60"
        )}>
          <p className="text-sm text-muted-foreground">When are you fishing?</p>
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
                disabled={isLoading}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Advice error */}
        {adviceError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{adviceError}</span>
              <Button variant="outline" size="sm" onClick={handleSubmit} className="ml-3 flex-shrink-0">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Get Advice button */}
        <div className="space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={!selectedDate || isLoading}
            aria-busy={isLoading}
            className={cn(
              "w-full text-lg py-6 transition-all duration-200",
              selectedDate && !isLoading
                ? "bg-gradient-water text-white hover:opacity-90"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{loadingMessage || "Processing..."}</>
            ) : !selectedDate ? (
              "Select a date"
            ) : (
              <>Get Advice<ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
          {isLoading && (
            <p className="text-xs text-muted-foreground text-center">
              This typically takes 2–5 seconds...
            </p>
          )}
        </div>
      </div>
    );
  }

  // -- DEFAULT / SEARCH STATE --
  const showDefaultState = !debouncedSearch;

  return (
    <div className={cn("space-y-3 transition-all duration-200", isTransitioning && "opacity-0")}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name, river, region, or postcode..."
          className="pl-10 pr-10 h-12 text-base"
          aria-label="Search venues"
        />
        {searchText && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchText(""); setResults([]); setSearchError(null); }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search error */}
      {searchError && (
        <div className="text-sm text-destructive flex items-center gap-2 px-1">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{searchError}</span>
          <button type="button" className="text-primary hover:underline text-sm font-medium" onClick={retrySearch}>
            Retry
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div className="space-y-2" role="group" aria-label="Filter by water type">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([
            { mode: "all" as const, label: "All" },
            { mode: "stillwater" as const, label: "Stillwater ▾" },
            { mode: "river" as const, label: "River ▾" },
            { mode: "nearme" as const, label: nearMeActive ? (userLocation ? "Near me ✓" : "Near me") : locating ? "Locating..." : "Near me" },
          ] as const).map((chip) => (
            <button
              key={chip.mode}
              type="button"
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors min-h-[36px] flex items-center gap-1.5",
                chip.mode === "nearme" && nearMeActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : filterMode === chip.mode && chip.mode !== "nearme"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              onClick={() => handleFilterMode(chip.mode)}
              disabled={chip.mode === "nearme" && locating}
            >
              {chip.mode === "nearme" && locating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {chip.mode === "nearme" && !locating && <MapPin className="w-3.5 h-3.5" />}
              {chip.label}
            </button>
          ))}
        </div>

        {/* Radius chips */}
        {nearMeActive && userLocation && (
          <div className="flex gap-2 overflow-x-auto pb-1 pl-4 scrollbar-hide">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors min-h-[32px]",
                  selectedRadius === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setSelectedRadius(r)}
              >
                {r} mi
              </button>
            ))}
          </div>
        )}

        {/* Manual location entry */}
        {nearMeActive && showManualLocation && !userLocation && (
          <div className="border border-border rounded-lg p-3 space-y-2">
            {navigator.geolocation && (
              <button
                type="button"
                className="text-xs text-primary hover:underline flex items-center gap-1"
                onClick={handleUseGpsFallback}
                disabled={locating}
              >
                <Navigation className="w-3 h-3" />
                {locating ? "Locating..." : "Use my current location"}
              </button>
            )}
            <div className="flex gap-2">
              <Input
                value={manualLocationInput}
                onChange={(e) => { setManualLocationInput(e.target.value); setLocationError(null); }}
                placeholder="Enter postcode or town name"
                className="flex-1 h-9 text-sm"
                onKeyDown={(e) => e.key === "Enter" && resolveManualLocation()}
              />
              <Button
                size="sm"
                onClick={resolveManualLocation}
                disabled={resolvingLocation || !manualLocationInput.trim()}
                className="h-9"
              >
                {resolvingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
              </Button>
            </div>
            {locationError && (
              <p className="text-xs text-destructive">{locationError}</p>
            )}
          </div>
        )}

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
                {nearMeActive && userLocation
                  ? "No favourites within this radius"
                  : "Star venues to save them here"}
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
      {debouncedSearch && !searchError && (
        <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto" role="listbox">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="text-muted-foreground">
                <p>We don&apos;t have &ldquo;{debouncedSearch}&rdquo; yet</p>
                <p className="text-xs mt-1">Add it to our database and start fishing</p>
              </div>
              <Button onClick={() => setShowAddForm(true)} className="mx-auto">
                Add {debouncedSearch}
              </Button>
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
                      return renderResultRow(addDistanceToVenue(child), indent);
                    })}
                </div>
              ))}
              {results.length > 15 && (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                  Refine your search to see more results
                </div>
              )}
              <div className="px-4 py-3 text-center">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShowAddForm(true)}
                >
                  Can&apos;t find your water? Add it →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VenueSearch;
