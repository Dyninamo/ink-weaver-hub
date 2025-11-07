import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Location } from "@/services/adviceService";

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom marker icons
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const hotSpotIcon = createCustomIcon("hsl(var(--primary))");
const goodAreaIcon = createCustomIcon("hsl(var(--accent))");
const entryPointIcon = createCustomIcon("hsl(var(--secondary))");

const getMarkerIcon = (type: Location["type"]) => {
  switch (type) {
    case "hotSpot":
      return hotSpotIcon;
    case "goodArea":
      return goodAreaIcon;
    case "entryPoint":
      return entryPointIcon;
    default:
      return hotSpotIcon;
  }
};

interface FishingMapProps {
  locations: Location[];
  venueName: string;
}

class MapErrorBoundary extends React.Component<{ fallback?: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error('Map render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
          <p className="text-muted-foreground">Map unavailable</p>
        </div>
      );
    }
    return this.props.children as any;
  }
}

const FishingMap = ({ locations, venueName }: FishingMapProps) => {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter out locations with invalid coordinates with stronger validation
  const validLocations = useMemo(() => {
    const filtered = (locations || []).filter(
      (loc) => 
        loc.coordinates && 
        Array.isArray(loc.coordinates) && 
        loc.coordinates.length === 2 &&
        typeof loc.coordinates[0] === 'number' && 
        Number.isFinite(loc.coordinates[0]) &&
        typeof loc.coordinates[1] === 'number' && 
        Number.isFinite(loc.coordinates[1])
    );
    
    if (filtered.length !== (locations || []).length) {
      console.warn(`FishingMap: Filtered ${(locations || []).length - filtered.length} invalid locations`);
    }
    
    return filtered;
  }, [locations]);

  // Compute a reasonable initial center
  const [centerLat, centerLng] = useMemo((): [number, number] => {
    if (validLocations.length === 0) return [51.505, -0.09]; // London fallback
    const lat = validLocations.reduce((sum, loc) => sum + loc.coordinates[0], 0) / validLocations.length;
    const lng = validLocations.reduce((sum, loc) => sum + loc.coordinates[1], 0) / validLocations.length;
    return [lat, lng];
  }, [validLocations]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: true,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Invalidate size after first paint to ensure correct layout
    setTimeout(() => map.invalidateSize(), 100);
    console.log("Leaflet map initialized for:", venueName);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, [mounted, centerLat, centerLng, venueName]);

  // Update markers and bounds when locations change
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    // Clear previous markers
    layer.clearLayers();

    if (validLocations.length === 0) return;

    // Add markers
    validLocations.forEach((loc) => {
      const marker = L.marker([loc.coordinates[0], loc.coordinates[1]], {
        icon: getMarkerIcon(loc.type),
      });
      const popupHtml = `
        <div class="p-2">
          <h3 class="font-semibold text-base mb-1">${loc.name}</h3>
          <p class="text-sm text-muted-foreground mb-2">${loc.description ?? ""}</p>
          <div class="flex items-center gap-2 text-xs">
            <span class="w-3 h-3 rounded-full" style="background-color:${
              loc.type === "hotSpot"
                ? "hsl(var(--primary))"
                : loc.type === "goodArea"
                ? "hsl(var(--accent))"
                : "hsl(var(--secondary))"
            }"></span>
            <span class="capitalize">${
              loc.type === "hotSpot" ? "Hot Spot" : loc.type === "goodArea" ? "Good Area" : "Entry Point"
            }</span>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml, { closeButton: true });
      marker.addTo(layer);
    });

    // Fit to markers
    try {
      if (validLocations.length === 1) {
        const [lat, lng] = validLocations[0].coordinates;
        map.setView([lat, lng], 13, { animate: false });
      } else {
        const bounds = L.latLngBounds(validLocations.map((l) => [l.coordinates[0], l.coordinates[1]] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
      setTimeout(() => map.invalidateSize(), 100);
      console.log("Leaflet: markers updated and bounds set");
    } catch (e) {
      console.error("Leaflet: error updating bounds", e);
    }
  }, [validLocations]);

  // Show loading state before mount
  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  if (validLocations.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No valid locations available</p>
      </div>
    );
  }

  return (
    <MapErrorBoundary fallback={
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Map failed to load</p>
      </div>
    }>
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg shadow-soft"
        style={{ minHeight: "400px" }}
        aria-label={`Map for ${venueName}`}
      />
    </MapErrorBoundary>
  );
};

export default FishingMap;
