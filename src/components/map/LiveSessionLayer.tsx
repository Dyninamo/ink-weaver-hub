import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import type { SessionEvent } from '@/services/diaryService';

interface EventGeo {
  id: string;
  type: 'catch' | 'blank' | 'change' | 'lost';
  lng: number;
  lat: number;
  time: string;
  summary: string;
}

interface Props {
  map: MLMap | null;
  events: SessionEvent[];
  /** Optional GPS for current "you are here" pulse */
  currentPosition?: [number, number] | null;
  /** Optional starting GPS dot (session start coords) */
  startPosition?: [number, number] | null;
}

const SOURCE_ID = 'live-trail-source';
const LAYER_ID = 'live-trail-line';

export default function LiveSessionLayer({ map, events, currentPosition, startPosition }: Props) {
  const markersRef = useRef<Marker[]>([]);
  const currentMarkerRef = useRef<Marker | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);

  // Build geo points from events that have coords
  const geoEvents: EventGeo[] = events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => {
      const type: EventGeo['type'] =
        e.event_type === 'got_away' ? 'lost' : (e.event_type as EventGeo['type']);
      const summary =
        e.event_type === 'catch'
          ? `${e.species ?? 'Fish'}${e.weight_display ? ` · ${e.weight_display}` : ''}`
          : e.event_type === 'change'
          ? 'Setup change'
          : e.event_type === 'blank'
          ? 'Blank'
          : 'One that got away';
      return {
        id: e.id,
        type,
        lng: e.longitude as number,
        lat: e.latitude as number,
        time: e.event_time,
        summary,
      };
    });

  // Manage line source/layer
  useEffect(() => {
    if (!map) return;
    if (!map.isStyleLoaded()) {
      const onLoad = () => sync();
      map.once('load', onLoad);
      return () => {
        map.off('load', onLoad);
      };
    }
    sync();

    function sync() {
      const coords = geoEvents.map((g) => [g.lng, g.lat] as [number, number]);
      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: coords.length >= 2
          ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }]
          : [],
      };

      const existing = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource(SOURCE_ID, { type: 'geojson', data });
        map.addLayer({
          id: LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#D26478',
            'line-width': 3,
            'line-opacity': 0.9,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(geoEvents)]);

  // Manage event markers
  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    geoEvents.forEach((g) => {
      const el = document.createElement('div');
      el.className = `event-pin ${g.type}`;
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="padding:8px 12px;font-family:var(--font-family);"><div style="font-size:11px;font-weight:600;color:var(--ink-500);text-transform:uppercase;letter-spacing:0.12em;">${new Date(
          g.time
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div style="font-size:14px;color:var(--ink-900);margin-top:2px;">${g.summary}</div></div>`
      );
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([g.lng, g.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, geoEvents]);

  // Start marker
  useEffect(() => {
    if (!map) return;
    startMarkerRef.current?.remove();
    startMarkerRef.current = null;
    if (!startPosition) return;
    const el = document.createElement('div');
    el.className = 'event-pin-start';
    startMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(startPosition)
      .addTo(map);
    return () => {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
    };
  }, [map, startPosition?.[0], startPosition?.[1]]);

  // Current "you are here" pulse
  useEffect(() => {
    if (!map) return;
    currentMarkerRef.current?.remove();
    currentMarkerRef.current = null;
    if (!currentPosition) return;
    const el = document.createElement('div');
    el.className = 'event-pin-current';
    currentMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(currentPosition)
      .addTo(map);
    return () => {
      currentMarkerRef.current?.remove();
      currentMarkerRef.current = null;
    };
  }, [map, currentPosition?.[0], currentPosition?.[1]]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map may have been removed already
      }
    };
  }, [map]);

  return null;
}
