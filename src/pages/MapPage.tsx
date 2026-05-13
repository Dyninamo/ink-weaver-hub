import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crosshair, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveSession, getSessionEvents } from '@/services/diaryService';
import type { FishingSession, SessionEvent } from '@/services/diaryService';
import MapShell, { MapShellHandle } from '@/components/map/MapShell';
import VenuePinMarkers from '@/components/map/VenuePinMarker';
import VenuePeekSheet from '@/components/map/VenuePeekSheet';
import FilterSheet from '@/components/map/FilterSheet';
import LiveSessionLayer from '@/components/map/LiveSessionLayer';
import HistoricalLayer, { HistoricalSession, colorForSession } from '@/components/map/HistoricalLayer';
import { MapControlButton, MapControlColumn, MapStats } from '@/components/map/MapControls';
import {
  EMPTY_FILTERS,
  MapFilters,
  VenuePin,
  activeFilterCount,
  filterVenues,
} from '@/components/map/types';

type Mode = 'live' | 'discovery';

export default function MapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shellRef = useRef<MapShellHandle>(null);
  const [mapReady, setMapReady] = useState(false);

  const [mode, setMode] = useState<Mode>('discovery');
  const [activeSession, setActiveSession] = useState<FishingSession | null>(null);
  const [activeEvents, setActiveEvents] = useState<SessionEvent[]>([]);

  // Discovery state
  const [venues, setVenues] = useState<VenuePin[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [selected, setSelected] = useState<VenuePin | null>(null);
  const handleSelectVenue = useCallback((v: VenuePin) => setSelected(v), []);
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  // History layer state
  const [historyOn, setHistoryOn] = useState(false);
  const [history, setHistory] = useState<HistoricalSession[]>([]);

  // Detect active session → set initial mode
  useEffect(() => {
    if (!user) {
      setMode('discovery');
      return;
    }
    let cancelled = false;
    (async () => {
      const session = await getActiveSession(user.id);
      if (cancelled) return;
      if (session) {
        setActiveSession(session as FishingSession);
        setMode('live');
        const events = await getSessionEvents(session.id);
        if (!cancelled) setActiveEvents(events);
      } else {
        setMode('discovery');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load venues for discovery mode (also used to look up active session venue coords)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('venues_new')
        .select(
          'venue_id, name, full_name, water_type_id, region_id, county, latitude, longitude, archetype, stillwater_size_class, postcode, phone, email, website, address, is_day_ticket, is_season, is_syndicate, is_club, is_private, acreage'
        )
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(2000);
      if (cancelled) return;
      if (!error && data) setVenues(data as unknown as VenuePin[]);
      setLoadingVenues(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter venues
  const filteredVenues = useMemo(() => filterVenues(venues, filters), [venues, filters]);
  const filterCount = activeFilterCount(filters);

  // Counts for stats
  const liveCatchCount = activeEvents.filter((e) => e.event_type === 'catch').length;

  // First event with coords → starting point for live mode
  const startCoords = useMemo<[number, number] | null>(() => {
    const first = activeEvents.find((e) => e.latitude != null && e.longitude != null);
    if (first?.latitude != null && first?.longitude != null) return [first.longitude, first.latitude];
    if (activeSession) {
      // Prefer venue_id (set at session creation by prompt 174). Fall back to
      // legacy name match for sessions logged before 174 landed.
      const byId = activeSession.venue_id
        ? venues.find((v) => v.venue_id === activeSession.venue_id)
        : null;
      const byName = byId
        ? null
        : venues.find((v) => v.full_name === activeSession.venue_name || v.name === activeSession.venue_name);
      const v = byId ?? byName;
      if (v) return [v.longitude, v.latitude];
    }
    return null;
  }, [activeEvents, activeSession, venues]);

  const lastEventCoords = useMemo<[number, number] | null>(() => {
    const withCoords = activeEvents.filter((e) => e.latitude != null && e.longitude != null);
    const last = withCoords[withCoords.length - 1];
    if (last?.latitude != null && last?.longitude != null) return [last.longitude, last.latitude];
    return null;
  }, [activeEvents]);

  // Auto-fit when entering live mode
  useEffect(() => {
    if (mode !== 'live' || !mapReady) return;
    const map = shellRef.current?.map;
    if (!map) return;
    const coords: [number, number][] = activeEvents
      .filter((e) => e.latitude != null && e.longitude != null)
      .map((e) => [e.longitude as number, e.latitude as number]);
    if (startCoords) coords.push(startCoords);
    if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: 14, duration: 600 });
    } else if (coords.length >= 2) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 600, maxZoom: 15 }
      );
    }
  }, [mode, mapReady, activeEvents, startCoords]);

  // Load history sessions when toggled on (this venue, or visible bbox)
  useEffect(() => {
    if (!historyOn || !user) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const venueName = activeSession?.venue_name;
      let sessionQuery = supabase
        .from('fishing_sessions')
        .select('id, session_date, venue_name, venue_id')
        .eq('user_id', user.id)
        .eq('is_active', false)
        .order('session_date', { ascending: false })
        .limit(20);
      // Prefer venue_id (immune to name typos / casing / alias drift). Only
      // fall back to venue_name if the active session itself has no venue_id.
      if (activeSession?.venue_id) {
        sessionQuery = sessionQuery.eq('venue_id', activeSession.venue_id);
      } else if (venueName) {
        sessionQuery = sessionQuery.eq('venue_name', venueName);
      }
      const { data: sessions } = await sessionQuery;
      if (cancelled || !sessions || sessions.length === 0) {
        if (!cancelled) setHistory([]);
        return;
      }
      const sessionIds = sessions.map((s) => s.id);
      const { data: events } = await supabase
        .from('session_events')
        .select('session_id, event_type, latitude, longitude, sort_order, event_time')
        .in('session_id', sessionIds)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const grouped: Record<string, { latitude: number; longitude: number; isCatch: boolean }[]> = {};
      events?.forEach((e: any) => {
        if (e.latitude == null || e.longitude == null) return;
        if (!grouped[e.session_id]) grouped[e.session_id] = [];
        grouped[e.session_id].push({
          latitude: e.latitude,
          longitude: e.longitude,
          isCatch: e.event_type === 'catch',
        });
      });
      const built: HistoricalSession[] = sessions
        .map((s) => {
          const pts = grouped[s.id] ?? [];
          return {
            id: s.id,
            date: s.session_date,
            catches: pts.filter((p) => p.isCatch).length,
            trail: pts.map((p) => [p.longitude, p.latitude] as [number, number]),
            catchPoints: pts
              .filter((p) => p.isCatch)
              .map((p) => [p.longitude, p.latitude] as [number, number]),
          };
        })
        .filter((h) => h.trail.length >= 2);
      setHistory(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [historyOn, user, activeSession?.venue_name]);

  // Controls
  const handleFitAll = useCallback(() => {
    const map = shellRef.current?.map;
    if (!map) return;
    if (mode === 'live') {
      const coords: [number, number][] = activeEvents
        .filter((e) => e.latitude != null && e.longitude != null)
        .map((e) => [e.longitude as number, e.latitude as number]);
      if (startCoords) coords.push(startCoords);
      if (coords.length === 0) return;
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 500, maxZoom: 15 }
      );
    } else {
      // Discovery — fit to UK
      map.fitBounds(
        [
          [-8.5, 49.8],
          [1.8, 60.9],
        ],
        { padding: 40, duration: 500 }
      );
    }
  }, [mode, activeEvents, startCoords]);

  const handleRecenter = useCallback(() => {
    const map = shellRef.current?.map;
    if (!map) return;
    const target = mode === 'live' ? lastEventCoords ?? startCoords : null;
    if (target) {
      map.flyTo({ center: target, zoom: 14, duration: 500 });
    } else {
      map.flyTo({ center: [-3.5, 54.2], zoom: 5.4, duration: 500 });
    }
  }, [mode, lastEventCoords, startCoords]);

  const totalHistoryCatches = history.reduce((acc, h) => acc + h.catches, 0);

  return (
    <div className="venue-detail-surface relative" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
        style={{ background: 'var(--paper-50)', borderColor: 'var(--paper-200)', zIndex: 20 }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="map-control-btn"
          style={{ width: 36, height: 36 }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold tracking-tight" style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-family)' }}>
            {mode === 'live' ? activeSession?.venue_name ?? 'Live session' : 'Discover waters'}
          </h1>
          <p className="text-[11px]" style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-family)' }}>
            {mode === 'live'
              ? `Live · ${liveCatchCount} caught · ${activeEvents.length} events`
              : loadingVenues
              ? 'Loading…'
              : `${filteredVenues.length} of ${venues.length} venues`}
          </p>
        </div>
      </header>

      {/* Map area */}
      <div className="flex-1 relative">
        <MapShell ref={shellRef} onLoad={() => setMapReady(true)} />

        {mode === 'discovery' && mapReady && (
          <VenuePinMarkers
            map={shellRef.current?.map ?? null}
            venues={filteredVenues}
            selectedId={selected?.venue_id ?? null}
            onSelect={handleSelectVenue}
          />
        )}

        {mode === 'live' && mapReady && (
          <>
            <LiveSessionLayer
              map={shellRef.current?.map ?? null}
              events={activeEvents}
              startPosition={startCoords}
              currentPosition={lastEventCoords ?? startCoords}
            />
            {historyOn && (
              <HistoricalLayer
                map={shellRef.current?.map ?? null}
                sessions={history}
              />
            )}
          </>
        )}

        {/* Top-left stats chip */}
        {mode === 'live' && (
          <MapStats>
            {historyOn ? (
              <>History · <b>{totalHistoryCatches} catches</b> · {history.length} sessions</>
            ) : (
              <>Now · <b>{liveCatchCount} fish</b> · {activeEvents.length} events</>
            )}
          </MapStats>
        )}

        {/* Top-right controls */}
        <MapControlColumn>
          <MapControlButton onClick={handleFitAll} ariaLabel="Fit all">
            <Maximize2 className="h-4 w-4" />
          </MapControlButton>

          {mode === 'live' ? (
            <MapControlButton
              onClick={() => setHistoryOn((v) => !v)}
              wide
              active={historyOn}
              ariaLabel="Toggle history"
            >
              History
            </MapControlButton>
          ) : (
            <>
              <MapControlButton
                onClick={() => setFilterOpen(true)}
                wide
                ariaLabel="Filters"
                active={filterCount > 0}
                badge={filterCount}
              >
                Filter
              </MapControlButton>
              {/* Search reserved for a future build — hide rather than ship a dead button. */}
            </>
          )}

          <MapControlButton onClick={handleRecenter} ariaLabel="Recenter">
            <Crosshair className="h-4 w-4" />
          </MapControlButton>
        </MapControlColumn>

        {/* History bottom peek */}
        {mode === 'live' && historyOn && history.length > 0 && (
          <div className="history-peek">
            {history.map((h, idx) => (
              <button
                key={h.id}
                type="button"
                className="row"
                onClick={() => navigate(`/diary/${h.id}`)}
              >
                <div className="stripe" style={{ background: colorForSession(idx) }} />
                <div>
                  <div className="body">{new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div className="meta">{h.trail.length} pinned · {h.catches} caught</div>
                </div>
                <div className="num">{h.catches}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Discovery sheets */}
      {mode === 'discovery' && (
        <>
          <VenuePeekSheet venue={selected} onClose={() => setSelected(null)} />
          <FilterSheet
            open={filterOpen}
            onOpenChange={setFilterOpen}
            filters={filters}
            onChange={setFilters}
            matchingCount={filteredVenues.length}
          />
        </>
      )}
    </div>
  );
}
