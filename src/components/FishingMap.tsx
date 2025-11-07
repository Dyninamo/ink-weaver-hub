import { useEffect } from "react";
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

// Component to fit bounds to markers
function FitBounds({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;

    const bounds = L.latLngBounds(
      locations.map((loc) => [loc.coordinates[0], loc.coordinates[1]])
    );

    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [locations, map]);

  return null;
}

interface FishingMapProps {
  locations: Location[];
  venueName: string;
}

const FishingMap = ({ locations, venueName }: FishingMapProps) => {
  if (locations.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No locations available</p>
      </div>
    );
  }

  // Calculate center point from all locations
  const centerLat =
    locations.reduce((sum, loc) => sum + loc.coordinates[0], 0) / locations.length;
  const centerLng =
    locations.reduce((sum, loc) => sum + loc.coordinates[1], 0) / locations.length;

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={12}
      className="w-full h-full rounded-lg shadow-soft"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds locations={locations} />
      {locations.map((location, index) => (
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
  );
};

export default FishingMap;
