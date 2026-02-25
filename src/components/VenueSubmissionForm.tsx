import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, MapPin, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";

interface VenueSubmissionFormProps {
  initialName: string;
  userLocation: { lat: number; lng: number; source: string } | null;
  onSubmitted: (venue: { venue_id: string; name: string; water_type_id: number; region_id: number; county: string | null; latitude: number | null; longitude: number | null; level: string; full_name: string; parent_id: string | null; session_count: number; display_context: string | null; search_text: string; river_name: string | null }) => void;
  onSelectExisting: (venueId: string) => void;
  onCancel: () => void;
}

interface County {
  county_id: number;
  county_name: string;
  region_id: number;
  country: string;
}

interface Region {
  region_id: number;
  region_name: string;
  country: string | null;
}

interface SimilarVenue {
  venue_id: string;
  name: string;
  county: string | null;
  level: string;
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function stringSimilarity(a: string, b: string): boolean {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al.includes(bl) || bl.includes(al);
}

export default function VenueSubmissionForm({
  initialName,
  userLocation,
  onSubmitted,
  onSelectExisting,
  onCancel,
}: VenueSubmissionFormProps) {
  const { user } = useAuth();

  const [name, setName] = useState(initialName);
  const [waterType, setWaterType] = useState<"stillwater" | "river" | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [resolvingPostcode, setResolvingPostcode] = useState(false);
  const [resolvedLat, setResolvedLat] = useState<number | null>(null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(null);
  const [resolvedCounty, setResolvedCounty] = useState<string | null>(null);
  const [resolvedRegionId, setResolvedRegionId] = useState<number | null>(null);
  const [resolvedRegionName, setResolvedRegionName] = useState<string | null>(null);
  const [resolvedCountry, setResolvedCountry] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<"postcode" | "gps" | null>(null);

  // Manual county/region selection (when not inferred)
  const [counties, setCounties] = useState<County[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedCountyId, setSelectedCountyId] = useState<number | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);

  // Duplicate check
  const [similarVenues, setSimilarVenues] = useState<SimilarVenue[]>([]);
  const [duplicateOverridden, setDuplicateOverridden] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load counties & regions
  useEffect(() => {
    supabase.from("counties").select("county_id, county_name, region_id, country").order("county_name").then(({ data }) => {
      if (data) setCounties(data);
    });
    supabase.from("regions").select("region_id, region_name, country").order("sort_order").then(({ data }) => {
      if (data) setRegions(data);
    });
  }, []);

  // Duplicate check on name change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (name.trim().length < 3) {
      setSimilarVenues([]);
      return;
    }
    setDuplicateOverridden(false);
    debounceRef.current = setTimeout(async () => {
      setCheckingDuplicates(true);
      const { data } = await supabase
        .from("venues_new")
        .select("venue_id, name, county, level")
        .ilike("name", `%${name.trim()}%`)
        .limit(5);

      if (data) {
        const matches = data.filter((v) => stringSimilarity(v.name, name.trim()));
        setSimilarVenues(matches as SimilarVenue[]);
      }
      setCheckingDuplicates(false);
    }, 500);
  }, [name]);

  // County selection → infer region
  useEffect(() => {
    if (selectedCountyId != null) {
      const c = counties.find((c) => c.county_id === selectedCountyId);
      if (c) {
        setSelectedRegionId(c.region_id);
        setResolvedCountry(c.country);
      }
    }
  }, [selectedCountyId, counties]);

  const inferredRegionId = resolvedRegionId ?? selectedRegionId;
  const inferredCounty = resolvedCounty ?? counties.find((c) => c.county_id === selectedCountyId)?.county_name ?? null;
  const inferredRegionName = resolvedRegionName ?? regions.find((r) => r.region_id === inferredRegionId)?.region_name ?? null;
  const inferredCountry = resolvedCountry ?? "England";
  const inferredLat = resolvedLat;
  const inferredLng = resolvedLng;

  const showCountyDropdown = !resolvedCounty;
  const showRegionDropdown = !resolvedRegionId && !selectedCountyId;
  const filteredCounties = selectedRegionId
    ? counties.filter((c) => c.region_id === selectedRegionId)
    : counties;

  const canSubmit = name.trim().length > 0 && waterType != null && !submitting && (similarVenues.length === 0 || duplicateOverridden);

  const handlePostcodeResolve = async () => {
    const pc = postcode.trim();
    if (!pc) return;
    if (!UK_POSTCODE_REGEX.test(pc)) {
      setPostcodeError("Invalid postcode — try again");
      return;
    }
    setPostcodeError(null);
    setResolvingPostcode(true);
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      const json = await res.json();
      if (json.status === 200 && json.result) {
        setResolvedLat(json.result.latitude);
        setResolvedLng(json.result.longitude);
        setLocationSource("postcode");

        // Match admin_district to counties
        const district = json.result.admin_district;
        if (district) {
          const match = counties.find((c) => c.county_name.toLowerCase() === district.toLowerCase());
          if (match) {
            setResolvedCounty(match.county_name);
            setResolvedRegionId(match.region_id);
            setResolvedCountry(match.country);
            const region = regions.find((r) => r.region_id === match.region_id);
            if (region) setResolvedRegionName(region.region_name);
          }
        }
      } else {
        setPostcodeError("Invalid postcode — try again");
      }
    } catch {
      setPostcodeError("Failed to look up postcode");
    } finally {
      setResolvingPostcode(false);
    }
  };

  const handleUseGps = () => {
    if (userLocation) {
      setResolvedLat(userLocation.lat);
      setResolvedLng(userLocation.lng);
      setLocationSource("gps");
    }
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit || !waterType) return;
    setSubmitting(true);

    try {
      const venueId = `USR-${crypto.randomUUID().slice(0, 8)}`;
      const waterTypeId = waterType === "stillwater" ? 1 : 3;
      const regionId = inferredRegionId || 6;
      const searchText = [name.trim(), inferredCounty, inferredRegionName].filter(Boolean).join(" ").toLowerCase();

      const { error: venueError } = await supabase.from("venues_new").insert({
        venue_id: venueId,
        name: name.trim(),
        full_name: name.trim(),
        level: waterType,
        water_type_id: waterTypeId,
        region_id: regionId,
        country: inferredCountry,
        county: inferredCounty,
        latitude: inferredLat,
        longitude: inferredLng,
        search_text: searchText,
        is_searchable: true,
        is_active: true,
        source: "user_submitted",
        source_id: user.id,
        has_reports: false,
        has_passport: false,
        has_diary: false,
        session_count: 0,
      });
      if (venueError) throw venueError;

      // Record submission
      await supabase.from("user_venue_submissions").insert({
        user_id: user.id,
        venue_id: venueId,
        submitted_name: name.trim(),
        submitted_water_type: waterType,
        submitted_county: inferredCounty,
        submitted_postcode: postcode.trim() || null,
        submitted_latitude: inferredLat,
        submitted_longitude: inferredLng,
        status: "pending",
      });

      // Auto-favourite
      await supabase.from("user_venue_favourites").insert({ user_id: user.id, venue_id: venueId });

      toast.success(`Added ${name.trim()}`);

      onSubmitted({
        venue_id: venueId,
        name: name.trim(),
        full_name: name.trim(),
        level: waterType,
        water_type_id: waterTypeId,
        region_id: regionId,
        county: inferredCounty,
        latitude: inferredLat,
        longitude: inferredLng,
        parent_id: null,
        session_count: 0,
        display_context: null,
        search_text: searchText,
        river_name: null,
      });
    } catch (err: any) {
      console.error("Submit venue failed:", err);
      toast.error(err.message || "Failed to add venue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-foreground">Add a water</h3>
      </div>

      {/* Name */}
      <div>
        <Label>Venue name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pitsford Water"
          className="mt-1.5"
        />
      </div>

      {/* Water type */}
      <div>
        <Label>Water type *</Label>
        <div className="flex gap-2 mt-1.5">
          {(["stillwater", "river"] as const).map((wt) => (
            <Button
              key={wt}
              variant={waterType === wt ? "default" : "outline"}
              size="sm"
              className="flex-1 min-h-[44px] capitalize"
              onClick={() => setWaterType(waterType === wt ? null : wt)}
            >
              {wt}
            </Button>
          ))}
        </div>
      </div>

      {/* Location (expandable) */}
      <div>
        <button
          type="button"
          className="text-sm text-primary hover:underline flex items-center gap-1"
          onClick={() => setShowLocation(!showLocation)}
        >
          {showLocation ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Add approximate location (optional)
        </button>

        {showLocation && (
          <div className="mt-2 space-y-3 pl-1">
            {/* GPS shortcut */}
            {userLocation && !locationSource && (
              <button
                type="button"
                className="text-xs text-primary hover:underline flex items-center gap-1"
                onClick={handleUseGps}
              >
                <MapPin className="w-3 h-3" /> Use my current location
              </button>
            )}

            {locationSource === "gps" && resolvedLat != null && (
              <p className="text-xs text-muted-foreground">📍 Using your GPS location</p>
            )}

            {/* Postcode */}
            {locationSource !== "gps" && (
              <div className="flex gap-2">
                <Input
                  value={postcode}
                  onChange={(e) => { setPostcode(e.target.value); setPostcodeError(null); }}
                  placeholder="e.g. NN11 3DL"
                  className="flex-1 h-9 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handlePostcodeResolve()}
                />
                <Button size="sm" onClick={handlePostcodeResolve} disabled={resolvingPostcode || !postcode.trim()} className="h-9">
                  {resolvingPostcode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Look up"}
                </Button>
              </div>
            )}
            {postcodeError && <p className="text-xs text-destructive">{postcodeError}</p>}

            {resolvedCounty && resolvedRegionName && (
              <p className="text-xs text-muted-foreground">📍 Located in {resolvedCounty}, {resolvedRegionName}</p>
            )}
          </div>
        )}
      </div>

      {/* County dropdown (if not inferred) */}
      {showCountyDropdown && (
        <div>
          <Label className="text-sm">County (optional)</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5"
            value={selectedCountyId ?? ""}
            onChange={(e) => setSelectedCountyId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select county...</option>
            {filteredCounties.map((c) => (
              <option key={c.county_id} value={c.county_id}>{c.county_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Region dropdown (if no county known) */}
      {showRegionDropdown && (
        <div>
          <Label className="text-sm">Region (optional)</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5"
            value={selectedRegionId ?? ""}
            onChange={(e) => setSelectedRegionId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select region...</option>
            {regions.map((r) => (
              <option key={r.region_id} value={r.region_id}>{r.region_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Duplicate matches */}
      {similarVenues.length > 0 && !duplicateOverridden && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Did you mean one of these?</p>
            {similarVenues.map((v) => (
              <button
                key={v.venue_id}
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/60 text-sm"
                onClick={() => onSelectExisting(v.venue_id)}
              >
                <span className="font-medium">{v.name}</span>
                {v.county && <span className="text-muted-foreground"> — {v.county}</span>}
              </button>
            ))}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDuplicateOverridden(true)}>
                No, add as new
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full min-h-[48px] text-base"
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
        ) : (
          `Add ${name.trim() || "venue"}`
        )}
      </Button>
    </div>
  );
}
