import { supabase } from "@/integrations/supabase/client";

// ============================================================
// TYPES
// ============================================================

export interface FishingSession {
  id: string;
  user_id: string;
  venue_name: string;
  venue_type: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  fishing_type: string | null;
  plan: string | null;
  rods: number;
  weather_temp: number | null;
  weather_wind_speed: number | null;
  weather_wind_dir: string | null;
  weather_pressure: number | null;
  weather_conditions: string | null;
  satisfaction_score: number | null;
  would_return: boolean | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  event_type: 'catch' | 'blank' | 'change' | 'got_away';
  event_time: string;
  sort_order: number;
  species: string | null;
  weight_lb: number | null;
  weight_oz: number | null;
  weight_display: string | null;
  length_inches: number | null;
  measurement_mode: string | null;
  fly_pattern: string | null;
  fly_size: number | null;
  rig_position: string | null;
  style: string | null;
  rig: string | null;
  line_type: string | null;
  retrieve: string | null;
  flies_on_cast: any | null;
  spot: string | null;
  depth_zone: string | null;
  blank_confidence: string | null;
  blank_reason: string | null;
  change_from: any | null;
  change_to: any | null;
  change_reason: string | null;
  got_away_stage: string | null;
  fly_known: boolean | null;
  size_estimate: string | null;
  event_temp: number | null;
  event_wind_speed: number | null;
  event_wind_dir: string | null;
  event_pressure: number | null;
  event_conditions: string | null;
  is_best_fish: boolean;
  photo_url: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RodSetup {
  id: string;
  user_id: string;
  name: string;
  rod_name: string | null;
  style: string | null;
  rig: string | null;
  line_type: string | null;
  retrieve: string | null;
  depth_zone: string | null;
  default_flies: any | null;
  usage_count: number;
  last_used_at: string | null;
}

// Current setup state tracked during a session
export interface CurrentSetup {
  style: string | null;
  rig: string | null;
  line_type: string | null;
  retrieve: string | null;
  flies_on_cast: any | null;
  spot: string | null;
  depth_zone: string | null;
}

// ============================================================
// SESSION CRUD
// ============================================================

export async function createSession(session: Partial<FishingSession>) {
  const { data, error } = await supabase
    .from('fishing_sessions')
    .insert(session as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSession(id: string) {
  const { data, error } = await supabase
    .from('fishing_sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as FishingSession;
}

export async function getActiveSession(userId: string) {
  const { data, error } = await supabase
    .from('fishing_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FishingSession | null;
}

export async function updateSession(id: string, updates: Partial<FishingSession>) {
  const { data, error } = await supabase
    .from('fishing_sessions')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function endSession(id: string, wrapUp: {
  satisfaction_score?: number;
  would_return?: boolean;
  notes?: string;
}) {
  const session = await getSession(id);
  const startTime = session.start_time ? new Date(session.start_time) : new Date(session.created_at);
  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  return updateSession(id, {
    ...wrapUp,
    end_time: endTime.toISOString(),
    duration_minutes: durationMinutes,
    is_active: false,
  });
}

export async function deleteSession(id: string) {
  const { error } = await supabase
    .from('fishing_sessions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listSessions(userId: string, options?: {
  venue?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('fishing_sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_active', false)
    .order('session_date', { ascending: false });

  if (options?.venue) query = query.eq('venue_name', options.venue);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { sessions: data as unknown as FishingSession[], count: count || 0 };
}

// ============================================================
// EVENT CRUD
// ============================================================

export async function addEvent(event: Partial<SessionEvent>) {
  // Auto-calculate sort_order
  const { count } = await supabase
    .from('session_events')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', event.session_id!);

  const { data, error } = await supabase
    .from('session_events')
    .insert({ ...event, sort_order: (count || 0) + 1 } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SessionEvent;
}

export async function getSessionEvents(sessionId: string) {
  const { data, error } = await supabase
    .from('session_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data as unknown as SessionEvent[];
}

export async function updateEvent(id: string, updates: Partial<SessionEvent>) {
  const { data, error } = await supabase
    .from('session_events')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase
    .from('session_events')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// SESSION STATS (calculated from events)
// ============================================================

export function calculateSessionStats(events: SessionEvent[]) {
  const catches = events.filter(e => e.event_type === 'catch');
  const blanks = events.filter(e => e.event_type === 'blank');
  const changes = events.filter(e => e.event_type === 'change');

  const totalFish = catches.length;
  const species = catches.reduce((acc, c) => {
    if (c.species) acc[c.species] = (acc[c.species] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const flies = catches.reduce((acc, c) => {
    if (c.fly_pattern) acc[c.fly_pattern] = (acc[c.fly_pattern] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const styles = catches.reduce((acc, c) => {
    if (c.style) acc[c.style] = (acc[c.style] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bestFly = Object.entries(flies).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const bestStyle = Object.entries(styles).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    totalFish,
    totalBlanks: blanks.length,
    totalChanges: changes.length,
    species,
    flies,
    styles,
    bestFly,
    bestStyle,
  };
}

// ============================================================
// REFERENCE DATA LOOKUPS (for technique tree)
// ============================================================

export async function getRefFlies(options?: { waterType?: string; topCategory?: string }) {
  let query = supabase.from('ref_flies').select('pattern_name, top_category, sub_category, hook_size_min, hook_size_max, water_type');
  if (options?.waterType) query = query.eq('water_type', options.waterType);
  if (options?.topCategory) query = query.eq('top_category', options.topCategory);
  const { data, error } = await query.order('pattern_name');
  if (error) throw error;
  return data;
}

export async function getRefRigs(options?: { style?: string; waterType?: string }) {
  let query = supabase.from('ref_rigs').select('rig_name, water_type, style, flies_on_rig, depth_zone');
  if (options?.style) query = query.eq('style', options.style);
  if (options?.waterType) query = query.eq('water_type', options.waterType);
  const { data, error } = await query.order('rig_name');
  if (error) throw error;
  return data;
}

export async function getRefRetrieves(options?: { style?: string }) {
  let query = supabase.from('ref_retrieves').select('retrieve_name, water_type, style, pace, depth_zone');
  if (options?.style) query = query.eq('style', options.style);
  const { data, error } = await query.order('retrieve_name');
  if (error) throw error;
  return data;
}

export async function getRefLines() {
  const { data, error } = await supabase
    .from('ref_lines')
    .select('line_type_code, line_family, buoyancy, sink_rate_ips, friendly_name')
    .order('line_family');
  if (error) throw error;
  return data;
}

export async function getVenueSpots(venueName: string) {
  const { data, error } = await supabase
    .from('venue_spots')
    .select('spot_name, access_type, notes')
    .eq('venue_name', venueName)
    .order('spot_name');
  if (error) throw error;
  return data;
}

export async function getRefHookSizes() {
  const { data, error } = await supabase
    .from('ref_hook_sizes')
    .select('hook_size')
    .order('hook_size');
  if (error) throw error;
  return data;
}

// ============================================================
// DEPTH ZONE NORMALISATION
// ============================================================

const DEPTH_ZONE_MAP: Record<string, string> = {
  'Surface': 'Surface',
  'Upper': 'Upper',
  'Upper water': 'Upper',
  'Upper to mid': 'Upper to mid',
  'Upper to mid water': 'Upper to mid',
  'Mid': 'Mid',
  'Mid to upper': 'Upper to mid',
  'Mid to near-bottom': 'Mid to deep',
  'Mid to bottom': 'Mid to deep',
  'Mid to deep': 'Mid to deep',
  'Near-bottom': 'Deep/Near bottom',
  'Near bottom': 'Deep/Near bottom',
  'Bottom': 'Bottom',
  'Fixed depth': 'Variable/All depths',
  'Fixed stepped depths': 'Variable/All depths',
  'Variable': 'Variable/All depths',
  'Top to bottom': 'Variable/All depths',
  'Surface and mid': 'Upper to mid',
  'Surface to bottom': 'Variable/All depths',
  'Surface to Mid': 'Upper to mid',
};

export const NORMALISED_DEPTH_ZONES = [
  'Surface',
  'Upper',
  'Upper to mid',
  'Mid',
  'Mid to deep',
  'Deep/Near bottom',
  'Bottom',
  'Variable/All depths',
];

export function normaliseDepthZone(raw: string): string {
  return DEPTH_ZONE_MAP[raw] || raw;
}

// ============================================================
// SPECIES & WEIGHT/LENGTH
// ============================================================

export const SPECIES_LIST = [
  'Rainbow',
  'Brown',
  'Brook',
  'Tiger',
  'Blue',
  'Grayling',
  'Other',
];

export const DEFAULT_SPECIES: Record<string, string> = {
  stillwater: 'Rainbow',
  river: 'Brown',
};

export function convertLengthToWeight(lengthInches: number, species: string): { lb: number; oz: number } {
  const lengthCm = lengthInches * 2.54;
  const k = species === 'Brown' ? 1.0 : 1.1;
  const weightGrams = (k * Math.pow(lengthCm, 3)) / 100000;
  const weightOzTotal = weightGrams / 28.3495;
  const lb = Math.floor(weightOzTotal / 16);
  const oz = Math.round(weightOzTotal % 16);
  return { lb, oz };
}

export function formatWeight(lb: number, oz: number): string {
  if (lb === 0 && oz === 0) return '';
  if (lb === 0) return `${oz}oz`;
  if (oz === 0) return `${lb}lb`;
  return `${lb}lb ${oz}oz`;
}

// ============================================================
// STYLES (9 top-level fishing styles)
// ============================================================

export const FISHING_STYLES = [
  'Buzzer',
  'Dry',
  'Dry-Dropper',
  'Euro Nymph',
  'Lure',
  'Lure + Nymph',
  'Nymph',
  'Nymph/Buzzer',
  'Wet',
];

// ============================================================
// FRIENDLY LINE NAMES (9 user-facing groups)
// ============================================================

export const FRIENDLY_LINE_NAMES = [
  'Floating',
  'Midge Tip',
  'Intermediate',
  'Di-3',
  'Di-5',
  'Di-7',
  'Fast Sink',
  'Shooting Head',
  'Euro Mono',
];
