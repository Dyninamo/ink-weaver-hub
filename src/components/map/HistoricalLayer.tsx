import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';

export interface HistoricalSession {
  id: string;
  date: string; // ISO
  catches: number;
  /** Sorted event coords (line geometry). May be empty. */
  trail: [number, number][];
  /** Subset of trail points that were catches — used for catch-only pin overlay. */
  catchPoints: [number, number][];
}

interface Props {
  map: MLMap | null;
  sessions: HistoricalSession[];
}

const PALETTE = [
  '#7A9869', // moss
  '#B8864A', // gild
  '#5A6170', // blank-grey
  '#B15A2E', // burnt orange
  '#4A6741', // ink-700
  '#97A088', // ink-300
  '#8E642E', // gild dark
  '#5E7A4E', // catch dark
  '#6B7B5C', // ink-500
  '#3A4A30', // dusk paper-300
];

export function colorForSession(idx: number): string {
  return PALETTE[idx % PALETTE.length];
}

const SOURCE_PREFIX = 'hist-trail-';

export default function HistoricalLayer({ map, sessions }: Props) {
  const markersRef = useRef<Marker[]>([]);
  const layerIdsRef = useRef<string[]>([]);

  const geoSessions = useMemo(
    () => sessions.filter((s) => s.trail.length >= 2),
    [sessions]
  );

  useEffect(() => {
    if (!map) return;

    // Remove previous layers/sources
    layerIdsRef.current.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    layerIdsRef.current = [];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const apply = () => {
      geoSessions.forEach((s, idx) => {
        const id = `${SOURCE_PREFIX}${s.id}`;
        if (map.getSource(id)) return;
        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: s.trail },
            properties: {},
          },
        });
        map.addLayer({
          id,
          type: 'line',
          source: id,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': colorForSession(idx),
            'line-width': 2.5,
            'line-opacity': 0.7,
          },
        });
        layerIdsRef.current.push(id);

        // Catch pins along the trail (use endpoints as approximation if no per-event data)
        s.trail.forEach((pt) => {
          const el = document.createElement('div');
          el.className = 'event-pin catch';
          el.style.opacity = '0.8';
          el.style.width = '10px';
          el.style.height = '10px';
          el.style.borderWidth = '2px';
          (el.style as any).background = colorForSession(idx);
          const m = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat(pt)
            .addTo(map);
          markersRef.current.push(m);
        });
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return () => {
      layerIdsRef.current.forEach((id) => {
        try {
          if (map.getLayer(id)) map.removeLayer(id);
          if (map.getSource(id)) map.removeSource(id);
        } catch {
          // ignore
        }
      });
      layerIdsRef.current = [];
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, geoSessions]);

  return null;
}
