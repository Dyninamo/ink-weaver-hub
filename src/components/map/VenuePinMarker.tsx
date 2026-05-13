import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import { STILLWATER_TYPES, VenuePin } from './types';

interface Props {
  map: MLMap | null;
  venues: VenuePin[];
  selectedId: string | null;
  onSelect: (v: VenuePin) => void;
}

export default function VenuePinMarkers({ map, venues, selectedId, onSelect }: Props) {
  const markersRef = useRef<Marker[]>([]);
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Effect 1: create / replace markers ONLY when the venue list or map changes.
  // selectedId is intentionally NOT a dep here.
  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    elsRef.current.clear();

    venues.forEach((v) => {
      const el = document.createElement('div');
      const isStill = v.water_type_id != null && STILLWATER_TYPES.has(v.water_type_id);
      const sizeClass =
        v.stillwater_size_class === 'large' ? 'large' :
        v.stillwater_size_class === 'small' ? 'small' : '';
      el.className = `venue-pin ${isStill ? '' : 'river'} ${sizeClass}`.trim();
      el.innerHTML = `<div class="vp-dot"></div>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(v);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([v.longitude, v.latitude])
        .addTo(map);
      markersRef.current.push(marker);
      elsRef.current.set(v.venue_id, el);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      elsRef.current.clear();
    };
  }, [map, venues, onSelect]);

  // Effect 2: toggle .selected class only — no DOM rebuild.
  useEffect(() => {
    elsRef.current.forEach((el, id) => {
      if (id === selectedId) el.classList.add('selected');
      else el.classList.remove('selected');
    });
  }, [selectedId]);

  return null;
}
