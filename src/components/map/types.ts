// Shared types for Flow 06 map.

export interface VenuePin {
  venue_id: string;
  name: string;
  full_name: string;
  water_type_id: number | null;
  region_id: number | null;
  county: string | null;
  latitude: number;
  longitude: number;
  archetype: string | null;
  stillwater_size_class: 'small' | 'medium' | 'large' | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  is_day_ticket: boolean | null;
  is_season: boolean | null;
  is_syndicate: boolean | null;
  is_club: boolean | null;
  is_private: boolean | null;
  acreage: number | null;
}

// Stillwater water_type_ids per venues_new convention (1 small SW, 2 large reservoir, 7 loch)
export const STILLWATER_TYPES = new Set([1, 2, 7]);

export const REGIONS: { id: number; label: string }[] = [
  { id: 1, label: 'North East' },
  { id: 2, label: 'North West' },
  { id: 3, label: 'Yorkshire & Humber' },
  { id: 4, label: 'East Midlands' },
  { id: 5, label: 'West Midlands' },
  { id: 6, label: 'East Anglia' },
  { id: 7, label: 'London' },
  { id: 8, label: 'South East' },
  { id: 9, label: 'South West' },
  { id: 10, label: 'North Wales' },
  { id: 11, label: 'Mid Wales' },
  { id: 12, label: 'South Wales' },
  { id: 13, label: 'Highlands & Islands' },
  { id: 14, label: 'Lowlands' },
  { id: 15, label: 'Borders' },
  { id: 16, label: 'Northern Ireland' },
];

export const ARCHETYPE_LABELS: Record<string, string> = {
  large_reservoir: 'Large reservoir',
  small_commercial: 'Small stillwater',
  medium_fishery: 'Small stillwater',
  hill_loch: 'Hill loch',
  lough: 'Hill loch',
  chalk_stream: 'Chalk stream',
  spate: 'Spate river',
  salmon_river: 'Spate river',
  freestone: 'Freestone',
  limestone: 'Freestone',
};

export const ARCHETYPE_FILTER_OPTIONS = [
  'Large reservoir',
  'Small stillwater',
  'Hill loch',
  'Chalk stream',
  'Spate river',
  'Freestone',
];

export type AccessTag = 'Day ticket' | 'Season' | 'Syndicate' | 'Club' | 'Private';

export interface MapFilters {
  waterType: 'Stillwater' | 'River' | 'Both';
  archetypes: Set<string>; // friendly labels from ARCHETYPE_FILTER_OPTIONS
  sizes: Set<'Small' | 'Medium' | 'Large'>;
  access: Set<AccessTag>;
  regions: Set<number>;
}

export const EMPTY_FILTERS: MapFilters = {
  waterType: 'Both',
  archetypes: new Set(),
  sizes: new Set(),
  access: new Set(),
  regions: new Set(),
};

export function activeFilterCount(f: MapFilters): number {
  return (
    (f.waterType !== 'Both' ? 1 : 0) +
    f.archetypes.size +
    f.sizes.size +
    f.access.size +
    f.regions.size
  );
}

export function filterVenues(venues: VenuePin[], f: MapFilters): VenuePin[] {
  return venues.filter((v) => {
    const isStill = v.water_type_id != null && STILLWATER_TYPES.has(v.water_type_id);
    if (f.waterType === 'Stillwater' && !isStill) return false;
    if (f.waterType === 'River' && isStill) return false;
    if (f.archetypes.size > 0) {
      const friendly = v.archetype ? ARCHETYPE_LABELS[v.archetype] : null;
      if (!friendly || !f.archetypes.has(friendly)) return false;
    }
    if (f.sizes.size > 0) {
      const sizeFriendly =
        v.stillwater_size_class === 'small' ? 'Small' :
        v.stillwater_size_class === 'medium' ? 'Medium' :
        v.stillwater_size_class === 'large' ? 'Large' : null;
      if (!sizeFriendly || !f.sizes.has(sizeFriendly as any)) return false;
    }
    if (f.access.size > 0) {
      const tags: AccessTag[] = [];
      if (v.is_day_ticket) tags.push('Day ticket');
      if (v.is_season) tags.push('Season');
      if (v.is_syndicate) tags.push('Syndicate');
      if (v.is_club) tags.push('Club');
      if (v.is_private) tags.push('Private');
      if (!tags.some((t) => f.access.has(t))) return false;
    }
    if (f.regions.size > 0) {
      if (v.region_id == null || !f.regions.has(v.region_id)) return false;
    }
    return true;
  });
}
