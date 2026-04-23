import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Navigation,
  Phone,
  PlayCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ARCHETYPE_LABELS,
  REGIONS,
  STILLWATER_TYPES,
  VenuePin,
} from '@/components/map/types';

interface MyHistory {
  sessions: number;
  caught: number;
  bestWeightLb: number | null;
}

interface FlyTier {
  name: string;
  tier: 'strong' | 'medium' | 'wtonly';
}

interface MethodWeighted {
  name: string;
  weight: number; // 0..1 normalised
  raw: number;
}

interface AdviceData {
  narrative: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  reportCount: number;
  venueTips: string[]; // venue-specific advice atoms (gild block)
  topFlies: FlyTier[];
  topMethods: MethodWeighted[];
  weather: { avgTemp: number | null; avgPrecip: number | null; avgGust: number | null };
  speciesMix: { rainbow: number; brown: number };
  recentReports: { date: string; excerpt: string; rodAvg: number | null }[];
}

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
type Season = (typeof SEASONS)[number];

function currentSeason(): Season {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Autumn';
  return 'Winter';
}

export default function VenueDetail() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState<VenuePin | null>(null);
  const [loading, setLoading] = useState(true);
  const [myHistory, setMyHistory] = useState<MyHistory | null>(null);
  const [advice, setAdvice] = useState<AdviceData | null>(null);
  const [season, setSeason] = useState<Season>(currentSeason());

  // Load venue
  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('venues_new')
        .select(
          'venue_id, name, full_name, water_type_id, region_id, county, latitude, longitude, archetype, stillwater_size_class, postcode, phone, email, website, address, is_day_ticket, is_season, is_syndicate, is_club, is_private, acreage'
        )
        .eq('venue_id', venueId)
        .maybeSingle();
      if (!cancelled) {
        setVenue((data ?? null) as unknown as VenuePin | null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  // Load my history at this venue (uses fishing_sessions matched on venue name)
  useEffect(() => {
    if (!user || !venue) {
      setMyHistory(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: sessions } = await supabase
        .from('fishing_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('venue_name', venue.full_name)
        .eq('is_active', false);
      if (cancelled) return;
      if (!sessions || sessions.length === 0) {
        setMyHistory({ sessions: 0, caught: 0, bestWeightLb: null });
        return;
      }
      const sessionIds = sessions.map((s) => s.id);
      const { data: events } = await supabase
        .from('session_events')
        .select('event_type, weight_lb, weight_oz')
        .in('session_id', sessionIds)
        .eq('event_type', 'catch');
      if (cancelled) return;
      let best = 0;
      events?.forEach((e: any) => {
        const lbs = (e.weight_lb ?? 0) + (e.weight_oz ?? 0) / 16;
        if (lbs > best) best = lbs;
      });
      setMyHistory({
        sessions: sessions.length,
        caught: events?.length ?? 0,
        bestWeightLb: best > 0 ? Math.round(best * 10) / 10 : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, venue]);

  // Load advice — pull from basic_advice + report_seasonal_fly_rankings + report_method_rankings
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    (async () => {
      const venueName = venue.full_name;
      const month = new Date().getMonth() + 1;
      const seasonKey = currentSeason().toLowerCase();

      // basic_advice → narrative
      const { data: basic } = await supabase
        .from('basic_advice')
        .select('advice_text, report_count, expected_rod_average')
        .eq('venue', venueName)
        .eq('season', seasonKey)
        .order('report_count', { ascending: false })
        .limit(1);

      // Top seasonal flies
      const { data: seasonalFlies } = await supabase
        .from('report_seasonal_fly_rankings')
        .select('fly_name, mention_count')
        .eq('venue_name', venueName)
        .eq('month', month)
        .order('rank', { ascending: true })
        .limit(8);

      // Top methods
      const { data: methods } = await supabase
        .from('report_method_rankings')
        .select('method, mention_count')
        .eq('venue_name', venueName)
        .eq('month', month)
        .order('rank', { ascending: true })
        .limit(15);

      // Recent harvested events as report excerpts (proxy for "recent reports")
      const { data: recents } = await supabase
        .from('harvested_events')
        .select('report_date, raw_text_segment')
        .eq('venue_name', venueName)
        .order('report_date', { ascending: false })
        .limit(3);

      if (cancelled) return;

      const reportCount = basic?.[0]?.report_count ?? 0;
      const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
        reportCount >= 30 ? 'HIGH' : reportCount >= 10 ? 'MEDIUM' : 'LOW';

      const flyTiers: FlyTier[] = (seasonalFlies ?? []).slice(0, 8).map((f, i) => ({
        name: f.fly_name as string,
        tier: i < 3 ? 'strong' : i < 6 ? 'medium' : 'wtonly',
      }));

      const maxMethod = methods?.length ? Math.max(...methods.map((m) => (m.mention_count as number) ?? 0)) : 0;
      const weighted: MethodWeighted[] = (methods ?? []).slice(0, 6).map((m) => ({
        name: m.method as string,
        raw: (m.mention_count as number) ?? 0,
        weight: maxMethod > 0 ? ((m.mention_count as number) ?? 0) / maxMethod : 0,
      }));

      setAdvice({
        narrative: (basic?.[0]?.advice_text as string) ?? null,
        confidence,
        reportCount,
        venueTips: [], // Source data atoms not yet wired; gild block hidden when empty per spec
        topFlies: flyTiers,
        topMethods: weighted,
        weather: { avgTemp: null, avgPrecip: null, avgGust: null }, // Placeholder until weather aggregates wired
        speciesMix: { rainbow: 0, brown: 0 },
        recentReports: (recents ?? []).map((r) => ({
          date: r.report_date as string,
          excerpt: ((r.raw_text_segment as string) ?? '').slice(0, 220),
          rodAvg: null,
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [venue]);

  const archetypeFriendly = useMemo(() => {
    if (!venue?.archetype) return null;
    return ARCHETYPE_LABELS[venue.archetype] ?? venue.archetype.replace(/_/g, ' ');
  }, [venue]);

  if (loading) {
    return (
      <div className="venue-detail-surface flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <p style={{ color: 'var(--ink-500)' }}>Loading…</p>
      </div>
    );
  }
  if (!venue) {
    return (
      <div className="venue-detail-surface flex flex-col items-center justify-center gap-3" style={{ minHeight: '100vh' }}>
        <p style={{ color: 'var(--ink-500)' }}>Venue not found</p>
        <button onClick={() => navigate('/map')} className="map-control-btn wide active" style={{ height: 40 }}>
          Back to map
        </button>
      </div>
    );
  }

  const isStill = venue.water_type_id != null && STILLWATER_TYPES.has(venue.water_type_id);
  const region = venue.region_id != null ? REGIONS.find((r) => r.id === venue.region_id)?.label : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;

  return (
    <div className="venue-detail-surface">
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 border-b"
        style={{ background: 'var(--paper-50)', borderColor: 'var(--paper-200)' }}
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
        <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--ink-500)', letterSpacing: 'var(--tracking-wider)' }}>
          Venue
        </span>
      </header>

      {/* 1. Hero */}
      <section className="venue-hero">
        {archetypeFriendly && <div className="archetype">{archetypeFriendly}</div>}
        <h1>{venue.full_name}</h1>
        <div className="meta">
          {isStill ? 'Stillwater' : 'River'}
          {venue.county ? ` · ${venue.county}` : ''}
          {region ? ` · ${region}` : ''}
          {venue.acreage != null ? ` · ${venue.acreage} ac` : ''}
        </div>
        <div className="tags">
          {venue.is_day_ticket && <span className="venue-tag gild">Day ticket</span>}
          {venue.is_season && <span className="venue-tag">Season</span>}
          {venue.is_syndicate && <span className="venue-tag">Syndicate</span>}
          {venue.is_club && <span className="venue-tag">Club</span>}
          {venue.is_private && <span className="venue-tag">Private</span>}
        </div>
      </section>

      {/* 2. My history */}
      {myHistory && myHistory.sessions > 0 && (
        <section className="venue-section">
          <h2>My history here</h2>
          <div className="my-history-grid">
            <div className="my-history-stat">
              <div className="num">{myHistory.sessions}</div>
              <div className="lbl">Sessions</div>
            </div>
            <div className="my-history-stat">
              <div className="num">{myHistory.caught}</div>
              <div className="lbl">Caught</div>
            </div>
            <div className="my-history-stat">
              <div className="num">{myHistory.bestWeightLb ?? '—'}</div>
              <div className="lbl">Best (lb)</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/diary?venue=${encodeURIComponent(venue.full_name)}`)}
            className="mt-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--rose-700)', letterSpacing: 'var(--tracking-wider)' }}
          >
            See sessions →
          </button>
        </section>
      )}

      {/* 3. What's fishing here now (advice teaser) */}
      <section className="venue-section">
        <h2>What's fishing here now</h2>
        {advice?.narrative ? (
          <>
            <p className="advice-narrative">{advice.narrative}</p>
            {advice.topFlies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {advice.topFlies.slice(0, 5).map((f) => (
                  <span key={f.name} className={`tier-fly ${f.tier}`}>
                    <span className="tier-dot" />
                    {f.name}
                  </span>
                ))}
              </div>
            )}
            <div className="advice-evidence">
              {advice.confidence} confidence · <b>{advice.reportCount}</b> reports
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>
            No narrative on file yet. Reports will appear here as they're logged.
          </p>
        )}
      </section>

      {/* 4. Ask your ghillie */}
      <section className="venue-section">
        <h2>Ask your ghillie</h2>
        <button
          type="button"
          onClick={() => navigate(`/queries?venue=${encodeURIComponent(venue.full_name)}`)}
          className="ghillie-pill"
        >
          <span style={{ color: 'var(--gild-700)', fontSize: 18 }}>?</span>
          <span>Ask about {venue.name}…</span>
        </button>
      </section>

      {/* 5. Tips specific to venue (hidden when empty per spec) */}
      {advice && advice.venueTips.length > 0 && (
        <section className="venue-section">
          <h2>Tips specific to {venue.name}</h2>
          <div className="venue-tips">
            {advice.venueTips.map((tip, i) => (
              <div key={i} className="tip-row"><span>{tip}</span></div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Top flies (full slice) */}
      {advice && advice.topFlies.length > 0 && (
        <section className="venue-section">
          <h2>Top flies</h2>
          <div className="flex flex-wrap gap-2">
            {advice.topFlies.map((f) => (
              <span key={f.name} className={`tier-fly ${f.tier}`}>
                <span className="tier-dot" />
                {f.name}
              </span>
            ))}
          </div>
          <div className="tier-legend">
            <span><span className="swatch" style={{ background: 'var(--event-catch)' }} />Strong</span>
            <span><span className="swatch" style={{ background: 'var(--gild-500)' }} />Medium</span>
            <span><span className="swatch" style={{ background: 'var(--ink-300)' }} />Water-type</span>
          </div>
        </section>
      )}

      {/* 7. Top methods · weighted bars */}
      {advice && advice.topMethods.length > 0 && (
        <section className="venue-section">
          <h2>Top methods</h2>
          {advice.topMethods.map((m) => (
            <div key={m.name} className="method-bar">
              <div className="name">{m.name}</div>
              <div className="num">{m.raw}</div>
              <div className="track">
                <div className="fill" style={{ width: `${Math.max(8, m.weight * 100)}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 8. Weather averages (placeholder when not yet wired) */}
      <section className="venue-section">
        <h2>Weather at venue</h2>
        <div className="weather-3up">
          <div className="stat">
            <div className="num">{advice?.weather.avgTemp ?? '—'}</div>
            <div className="lbl">Avg air °C</div>
          </div>
          <div className="stat">
            <div className="num">{advice?.weather.avgPrecip ?? '—'}</div>
            <div className="lbl">Avg precip mm</div>
          </div>
          <div className="stat">
            <div className="num">{advice?.weather.avgGust ?? '—'}</div>
            <div className="lbl">Avg gust mph</div>
          </div>
        </div>
      </section>

      {/* 9. Seasonal outlook tabs */}
      <section className="venue-section">
        <h2>Seasonal outlook</h2>
        <div className="season-tabs">
          {SEASONS.map((s) => (
            <button key={s} type="button" data-active={season === s} className="season-tab" onClick={() => setSeason(s)}>
              {s}
            </button>
          ))}
        </div>
        <p className="advice-narrative">
          {season} narrative for {venue.name} is forming as more reports are logged. Use the in-month tips above for current conditions.
        </p>
      </section>

      {/* 10. Recent reports */}
      {advice && advice.recentReports.length > 0 && (
        <section className="venue-section">
          <h2>Recent reports</h2>
          {advice.recentReports.map((r, i) => (
            <div key={i} className="report-excerpt">
              <div className="head">
                <span>{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {r.rodAvg != null && <span>{r.rodAvg} avg</span>}
              </div>
              <div className="body">{r.excerpt}{r.excerpt.length >= 220 ? '…' : ''}</div>
            </div>
          ))}
        </section>
      )}

      {/* 11. Contact */}
      <section className="venue-section">
        <h2>Contact</h2>
        <ContactRow icon={<MapPin className="h-4 w-4" />} label={venue.postcode ?? venue.address ?? 'Not known'} muted={!venue.postcode && !venue.address} />
        <ContactRow
          icon={<Phone className="h-4 w-4" />}
          label={venue.phone ?? 'Not known'}
          href={venue.phone ? `tel:${venue.phone.replace(/\s+/g, '')}` : undefined}
          muted={!venue.phone}
        />
        <ContactRow
          icon={<Mail className="h-4 w-4" />}
          label={venue.email ?? 'Not known'}
          href={venue.email ? `mailto:${venue.email}` : undefined}
          muted={!venue.email}
        />
        <ContactRow
          icon={<Globe className="h-4 w-4" />}
          label={venue.website ? venue.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Not known'}
          href={venue.website ?? undefined}
          muted={!venue.website}
        />
      </section>

      {/* CTAs */}
      <div className="px-5 py-4 grid grid-cols-2 gap-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="map-control-btn wide"
          style={{ height: 48, justifyContent: 'center' }}
        >
          <Navigation className="h-4 w-4 mr-2" /> Directions
        </a>
        <button
          type="button"
          onClick={() => navigate(`/diary/new?venue=${encodeURIComponent(venue.full_name)}`)}
          className="map-control-btn wide active"
          style={{ height: 48, justifyContent: 'center' }}
        >
          <PlayCircle className="h-4 w-4 mr-2" /> Start session
        </button>
      </div>

      {/* 12. Data on file footer */}
      <section className="venue-section" style={{ borderBottom: 'none' }}>
        <h2>Data on file</h2>
        <p style={{ color: 'var(--ink-500)', fontSize: 12, lineHeight: 1.55 }}>
          Venue details from public sources and contributed reports.
          {advice?.reportCount ? ` Currently ${advice.reportCount} report${advice.reportCount === 1 ? '' : 's'} feed this page.` : ''}
          {' '}Always confirm access, ticket prices and rules with the fishery.
        </p>
      </section>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  href,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  muted?: boolean;
}) {
  const content = (
    <>
      <span className="icon">{icon}</span>
      <span className={muted ? 'muted' : ''}>{label}</span>
      <ChevronRight className="h-4 w-4 chev" />
    </>
  );
  if (!href || muted) {
    return <div className="contact-row" style={{ cursor: 'default' }}>{content}</div>;
  }
  return (
    <a className="contact-row" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
      {content}
    </a>
  );
}
