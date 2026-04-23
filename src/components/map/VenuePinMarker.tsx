import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import { STILLWATER_TYPES, VenuePin } from './types';

interface Props {
  map: MLMap | null;
  venues: VenuePin[];
  selectedId: string | null;
  onSelect: (v: VenuePin) => void;
}

// Render N HTML markers for venues. Recreated when filtered list changes.
export default function VenuePinMarkers({ map, venues, selectedId, onSelect }: Props) {
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear previous
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    venues.forEach((v) => {
      const el = document.createElement('div');
      const isStill = v.water_type_id != null && STILLWATER_TYPES.has(v.water_type_id);
      const sizeClass =
        v.stillwater_size_class === 'large' ? 'large' :
        v.stillwater_size_class === 'small' ? 'small' : '';
      el.className = `venue-pin ${isStill ? '' : 'river'} ${sizeClass} ${selectedId === v.venue_id ? 'selected' : ''}`.trim();
      el.innerHTML = `<div class="vp-dot"></div>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(v);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([v.longitude, v.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, venues, selectedId, onSelect]);

  return null;
}
