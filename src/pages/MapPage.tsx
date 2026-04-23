import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft,
  Filter,
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Navigation,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VenuePin {
  venue_id: string;
  full_name: string;
  name: string;
  water_type_id: number;
  region_id: number | null;
  county: string | null;
  latitude: number;
  longitude: number;
  archetype: string | null;
  stillwater_size_class: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_day_ticket: boolean | null;
  is_season: boolean | null;
  is_syndicate: boolean | null;
  is_club: boolean | null;
  acreage: number | null;
}

const WATER_TYPE_LABEL: Record<number, string> = {
  1: "Small stillwater",
  2: "Large reservoir",
  3: "Freestone river",
  4: "Chalkstream",
  5: "Spate river",
  6: "Limestone river",
  7: "Loch / lough",
};

const REGION_LABEL: Record<number, string> = {
  1: "North East",
  2: "North West",
  3: "Yorkshire & Humber",
  4: "East Midlands",
  5: "West Midlands",
  6: "East of England",
  7: "London",
  8: "South East",
  9: "South West",
  10: "North Wales",
  11: "Mid Wales",
  12: "South Wales",
  13: "Highlands & Islands",
  14: "Lowlands",
  15: "Borders",
  16: "Northern Ireland",
};

const STILLWATER_TYPES = new Set([1, 2, 7]);
const ARCHETYPES = [
  "spate",
  "small_commercial",
  "hill_loch",
  "large_reservoir",
  "chalk_stream",
  "freestone",
  "medium_fishery",
  "limestone",
  "salmon_river",
  "lough",
];

type AccessTag = "day_ticket" | "season" | "syndicate" | "club";

function makeIcon(waterTypeId: number, sizeClass: string | null) {
  const isStill = STILLWATER_TYPES.has(waterTypeId);
  // Gild for stillwater, ink for rivers
  const fill = isStill ? "hsl(38 92% 50%)" : "hsl(220 14% 35%)";
  const ring = isStill ? "hsl(38 92% 30%)" : "hsl(220 14% 18%)";
  const size =
    sizeClass === "large" ? 16 : sizeClass === "medium" ? 13 : 10;
  return L.divIcon({
    className: "venue-pin",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${fill};
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4), 0 0 0 1px ${ring};
    "></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

export default function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);

  const [venues, setVenues] = useState<VenuePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VenuePin | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [waterFilter, setWaterFilter] = useState<"all" | "stillwater" | "river">("all");
  const [archetypeFilter, setArchetypeFilter] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<number | null>(null);
  const [accessFilter, setAccessFilter] = useState<AccessTag | null>(null);

  // Load venues once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // venues_new can have >1k rows; explicit limit
      const { data, error } = await supabase
        .from("venues_new")
        .select(
          "venue_id, full_name, name, water_type_id, region_id, county, latitude, longitude, archetype, stillwater_size_class, postcode, phone, email, website, is_day_ticket, is_season, is_syndicate, is_club, acreage"
        )
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .eq("is_active", true)
        .limit(2000);
      if (cancelled) return;
      if (!error && data) setVenues(data as VenuePin[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const m = L.map(mapRef.current, {
      center: [54.2, -3.5],
      zoom: 6,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(m);
    markerLayer.current = L.layerGroup().addTo(m);
    mapInstance.current = m;
    return () => {
      m.remove();
      mapInstance.current = null;
    };
  }, []);

  // Apply filters
  const filtered = useMemo(() => {
    return venues.filter((v) => {
      if (waterFilter === "stillwater" && !STILLWATER_TYPES.has(v.water_type_id)) return false;
      if (waterFilter === "river" && STILLWATER_TYPES.has(v.water_type_id)) return false;
      if (archetypeFilter && v.archetype !== archetypeFilter) return false;
      if (regionFilter != null && v.region_id !== regionFilter) return false;
      if (accessFilter) {
        const map: Record<AccessTag, keyof VenuePin> = {
          day_ticket: "is_day_ticket",
          season: "is_season",
          syndicate: "is_syndicate",
          club: "is_club",
        };
        if (!v[map[accessFilter]]) return false;
      }
      return true;
    });
  }, [venues, waterFilter, archetypeFilter, regionFilter, accessFilter]);

  // Render markers
  useEffect(() => {
    if (!markerLayer.current || !mapInstance.current) return;
    markerLayer.current.clearLayers();
    filtered.forEach((v) => {
      const marker = L.marker([v.latitude, v.longitude], {
        icon: makeIcon(v.water_type_id, v.stillwater_size_class),
      });
      marker.on("click", () => setSelected(v));
      markerLayer.current!.addLayer(marker);
    });
  }, [filtered]);

  function clearAll() {
    setWaterFilter("all");
    setArchetypeFilter(null);
    setRegionFilter(null);
    setAccessFilter(null);
  }

  const activeFilterCount =
    (waterFilter !== "all" ? 1 : 0) +
    (archetypeFilter ? 1 : 0) +
    (regionFilter != null ? 1 : 0) +
    (accessFilter ? 1 : 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold tracking-tight">Discover waters</h1>
          <p className="text-[11px] text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} of ${venues.length} venues`}
          </p>
        </div>
        <Button
          variant={activeFilterCount ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(true)}
        >
          <Filter className="h-4 w-4 mr-1" />
          {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filters"}
        </Button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
      </div>

      {/* Legend */}
      <div className="absolute top-16 left-3 z-[400] bg-background/95 backdrop-blur rounded-md border border-border px-2 py-1.5 text-[11px] space-y-1 shadow">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(38 92% 50%)" }} />
          <span>Stillwater</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(220 14% 35%)" }} />
          <span>River</span>
        </div>
      </div>

      {/* Peek sheet for selected venue */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[80vh] overflow-y-auto">
          {selected && <VenueDetail venue={selected} onStartSession={() => navigate("/diary/new")} />}
        </SheetContent>
      </Sheet>

      {/* Filter sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="flex-row items-center justify-between space-y-0">
            <SheetTitle>Filter venues</SheetTitle>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold"
            >
              Clear all
            </button>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            {/* Water type */}
            <FilterGroup label="Water type">
              {(["all", "stillwater", "river"] as const).map((w) => (
                <Chip
                  key={w}
                  label={w === "all" ? "All" : w === "stillwater" ? "Stillwater" : "River"}
                  active={waterFilter === w}
                  onClick={() => setWaterFilter(w)}
                />
              ))}
            </FilterGroup>

            {/* Archetype */}
            <FilterGroup label="Archetype">
              <Chip label="Any" active={archetypeFilter === null} onClick={() => setArchetypeFilter(null)} />
              {ARCHETYPES.map((a) => (
                <Chip
                  key={a}
                  label={a.replace(/_/g, " ")}
                  active={archetypeFilter === a}
                  onClick={() => setArchetypeFilter(a)}
                />
              ))}
            </FilterGroup>

            {/* Access */}
            <FilterGroup label="Access">
              <Chip label="Any" active={accessFilter === null} onClick={() => setAccessFilter(null)} />
              {(["day_ticket", "season", "syndicate", "club"] as AccessTag[]).map((a) => (
                <Chip
                  key={a}
                  label={a.replace("_", " ")}
                  active={accessFilter === a}
                  onClick={() => setAccessFilter(a)}
                />
              ))}
            </FilterGroup>

            {/* Region */}
            <FilterGroup label="Region">
              <Chip label="Any" active={regionFilter === null} onClick={() => setRegionFilter(null)} />
              {Object.entries(REGION_LABEL).map(([id, label]) => (
                <Chip
                  key={id}
                  label={label}
                  active={regionFilter === Number(id)}
                  onClick={() => setRegionFilter(Number(id))}
                />
              ))}
            </FilterGroup>

            <Button className="w-full" onClick={() => setShowFilters(false)}>
              Show {filtered.length} venue{filtered.length === 1 ? "" : "s"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VenueDetail({ venue, onStartSession }: { venue: VenuePin; onStartSession: () => void }) {
  const isStill = STILLWATER_TYPES.has(venue.water_type_id);
  const accessTags: string[] = [];
  if (venue.is_day_ticket) accessTags.push("Day ticket");
  if (venue.is_season) accessTags.push("Season");
  if (venue.is_syndicate) accessTags.push("Syndicate");
  if (venue.is_club) accessTags.push("Club");

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;

  return (
    <div className="space-y-3 pt-2">
      <div>
        <h2 className="text-lg font-semibold leading-tight">{venue.full_name}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {WATER_TYPE_LABEL[venue.water_type_id] || "Water"}
          {venue.county ? ` · ${venue.county}` : ""}
          {venue.region_id ? ` · ${REGION_LABEL[venue.region_id] ?? ""}` : ""}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className={cn(
            "text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full",
            isStill
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
          )}
        >
          {isStill ? "Stillwater" : "River"}
        </span>
        {venue.archetype && (
          <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {venue.archetype.replace(/_/g, " ")}
          </span>
        )}
        {venue.acreage != null && (
          <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {venue.acreage} ac
          </span>
        )}
        {accessTags.map((t) => (
          <span
            key={t}
            className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-foreground"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Contact rows */}
      <div className="space-y-1.5 pt-1">
        {venue.postcode && (
          <ContactRow icon={<MapPin className="h-3.5 w-3.5" />} label={venue.postcode} />
        )}
        {venue.phone && (
          <ContactRow
            icon={<Phone className="h-3.5 w-3.5" />}
            label={venue.phone}
            href={`tel:${venue.phone.replace(/\s+/g, "")}`}
          />
        )}
        {venue.email && (
          <ContactRow
            icon={<Mail className="h-3.5 w-3.5" />}
            label={venue.email}
            href={`mailto:${venue.email}`}
          />
        )}
        {venue.website && (
          <ContactRow
            icon={<Globe className="h-3.5 w-3.5" />}
            label={venue.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            href={venue.website}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant="outline" asChild>
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4 mr-1" /> Directions
          </a>
        </Button>
        <Button onClick={onStartSession}>
          <PlayCircle className="h-4 w-4 mr-1" /> Start session here
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
        Venue details from public sources. Always confirm access, ticket prices and rules with the fishery.
      </p>
    </div>
  );
}

function ContactRow({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const inner = (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
  if (!href) return inner;
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block hover:text-primary transition-colors"
    >
      {inner}
    </a>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs border transition-colors capitalize",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:border-foreground/40"
      )}
    >
      {label}
    </button>
  );
}
