import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl, { Map as MLMap, LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Free demo style — no token. Safe to use for Round 4.
// Swap for a custom Vintage Almanack style later if richer fidelity is wanted.
const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export interface MapShellHandle {
  map: MLMap | null;
  fitBounds: (bounds: LngLatBoundsLike, padding?: number) => void;
  flyTo: (lng: number, lat: number, zoom?: number) => void;
}

interface Props {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  onLoad?: (map: MLMap) => void;
  className?: string;
}

const MapShell = forwardRef<MapShellHandle, Props>(function MapShell(
  { initialCenter = [-3.5, 54.2], initialZoom = 5.4, onLoad, className },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useImperativeHandle(ref, () => ({
    get map() {
      return mapRef.current;
    },
    fitBounds(bounds, padding = 60) {
      mapRef.current?.fitBounds(bounds, { padding, duration: 600, maxZoom: 13 });
    },
    flyTo(lng, lat, zoom = 13) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700 });
    },
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenFreeMap · OpenStreetMap' }),
      'bottom-left'
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'bottom-right');

    map.on('load', () => {
      onLoadRef.current?.(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className ?? 'absolute inset-0'} />;
});

export default MapShell;
