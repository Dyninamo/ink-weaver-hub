import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Location } from "@/services/adviceService";

// Fix for default marker icons in React-Leaflet
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

// Component to handle map bounds after map is ready
function MapBoundsHandler({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.whenReady || locations.length === 0) return;

    // Use whenReady to ensure map is fully initialized
    map.whenReady(() => {
      try {
        if (locations.length === 1) {
          const [lat, lng] = locations[0].coordinates;
          map.setView([lat, lng], 13, { animate: false });
        } else {
          const bounds = L.latLngBounds(
            locations.map((loc) => [loc.coordinates[0], loc.coordinates[1]])
          );
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
        
        // Small delay to ensure tiles are loaded
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
        
        console.log("Map bounds set successfully");
      } catch (error) {
        console.error("Error setting map bounds:", error);
      }
    });
  }, [map, locations]);

  return null;
}

// Delayed wrapper to ensure map context is ready
function DelayedMapBoundsHandler({ locations }: { locations: Location[] }) {
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  if (!ready) return null;
  
  return <MapBoundsHandler locations={locations} />;
}

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

  // Client-only rendering guard
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

  // Log locations on mount
  useEffect(() => {
    if (mounted && validLocations.length > 0) {
      console.log(`FishingMap mounted: ${validLocations.length} valid locations`, validLocations.slice(0, 3));
    }
  }, [mounted, validLocations]);

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

  // Calculate center point from all valid locations
  const centerLat =
    validLocations.reduce((sum, loc) => sum + loc.coordinates[0], 0) / validLocations.length;
  const centerLng =
    validLocations.reduce((sum, loc) => sum + loc.coordinates[1], 0) / validLocations.length;

  return (
    <MapErrorBoundary fallback={
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Map failed to load</p>
      </div>
    }>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={12}
        whenReady={() => console.log("Map ready for:", venueName)}
        className="w-full h-full rounded-lg shadow-soft"
        style={{ minHeight: "400px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DelayedMapBoundsHandler locations={validLocations} />
        {validLocations.map((location, index) => (
          <Marker
            key={index}
            position={[location.coordinates[0], location.coordinates[1]]}
            icon={getMarkerIcon(location.type)}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-base mb-1">{location.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {location.description}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        location.type === "hotSpot"
                          ? "hsl(var(--primary))"
                          : location.type === "goodArea"
                          ? "hsl(var(--accent))"
                          : "hsl(var(--secondary))",
                    }}
                  />
                  <span className="capitalize">
                    {location.type === "hotSpot"
                      ? "Hot Spot"
                      : location.type === "goodArea"
                      ? "Good Area"
                      : "Entry Point"}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </MapErrorBoundary>
  );
};

export default FishingMap;
