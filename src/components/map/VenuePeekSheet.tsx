import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Navigation, ChevronRight } from 'lucide-react';
import { ARCHETYPE_LABELS, REGIONS, STILLWATER_TYPES, VenuePin } from './types';

interface Props {
  venue: VenuePin | null;
  onClose: () => void;
}

export default function VenuePeekSheet({ venue, onClose }: Props) {
  const navigate = useNavigate();
  if (!venue) return null;

  const isStill = venue.water_type_id != null && STILLWATER_TYPES.has(venue.water_type_id);
  const archetypeFriendly = venue.archetype ? ARCHETYPE_LABELS[venue.archetype] ?? venue.archetype.replace(/_/g, ' ') : null;
  const region = venue.region_id != null ? REGIONS.find((r) => r.id === venue.region_id)?.label : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;

  return (
    <Sheet open={!!venue} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl border-t p-0"
        style={{ background: 'var(--paper-50)', borderColor: 'var(--paper-200)' }}
      >
        <SheetTitle className="sr-only">{venue.full_name}</SheetTitle>
        <SheetDescription className="sr-only">Venue details and quick actions</SheetDescription>
        <div className="venue-detail-surface" style={{ minHeight: 0 }}>
          <div className="venue-hero" style={{ borderBottom: 'none', paddingBottom: 'var(--space-3)' }}>
            {archetypeFriendly && <div className="archetype">{archetypeFriendly}</div>}
            <h1 style={{ fontSize: 22, marginTop: 4 }}>{venue.full_name}</h1>
            <div className="meta">
              {isStill ? 'Stillwater' : 'River'}
              {venue.county ? ` · ${venue.county}` : ''}
              {region ? ` · ${region}` : ''}
              {venue.acreage != null ? ` · ${venue.acreage} ac` : ''}
            </div>
            <div className="tags">
              {venue.is_day_ticket && <span className="venue-tag">Day ticket</span>}
              {venue.is_season && <span className="venue-tag">Season</span>}
              {venue.is_syndicate && <span className="venue-tag">Syndicate</span>}
              {venue.is_club && <span className="venue-tag">Club</span>}
              {venue.is_private && <span className="venue-tag">Private</span>}
            </div>
          </div>

          <div className="px-5 pb-5 grid grid-cols-2 gap-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="map-control-btn wide"
              style={{ height: 44, justifyContent: 'center' }}
            >
              <Navigation className="h-4 w-4 mr-1.5" /> Directions
            </a>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/venue/${venue.venue_id}`);
              }}
              className="map-control-btn wide active"
              style={{ height: 44, justifyContent: 'center' }}
            >
              Open detail <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
