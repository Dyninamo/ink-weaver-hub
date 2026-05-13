import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ARCHETYPE_FILTER_OPTIONS,
  AccessTag,
  EMPTY_FILTERS,
  MapFilters,
  REGIONS,
} from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MapFilters;
  onChange: (next: MapFilters) => void;
  matchingCount: number;
}

const ACCESS_OPTIONS: AccessTag[] = ['Day ticket', 'Season', 'Syndicate', 'Club', 'Private'];
const SIZE_OPTIONS = ['Small', 'Medium', 'Large'] as const;

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function FilterSheet({ open, onOpenChange, filters, onChange, matchingCount }: Props) {
  const clearAll = () => onChange({ ...EMPTY_FILTERS, archetypes: new Set(), sizes: new Set(), access: new Set(), regions: new Set() });

  const noneMatch = matchingCount === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl p-0 max-h-[85vh] overflow-hidden flex flex-col"
        style={{ background: 'var(--paper-50)', borderColor: 'var(--paper-200)' }}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 px-5 pt-5 pb-3">
          <SheetTitle style={{ fontFamily: 'var(--font-family)', color: 'var(--ink-900)', fontSize: 18 }}>
            Filter venues
          </SheetTitle>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--rose-700)', letterSpacing: 'var(--tracking-wider)' }}
          >
            Clear all
          </button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-5">
          <FacetGroup label="Water type">
            {(['Stillwater', 'River', 'Both'] as const).map((opt) => (
              <Chip
                key={opt}
                active={filters.waterType === opt}
                onClick={() => onChange({ ...filters, waterType: opt })}
              >
                {opt}
              </Chip>
            ))}
          </FacetGroup>

          <FacetGroup label="Archetype">
            {ARCHETYPE_FILTER_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                active={filters.archetypes.has(opt)}
                onClick={() => onChange({ ...filters, archetypes: toggleSet(filters.archetypes, opt) })}
              >
                {opt}
              </Chip>
            ))}
          </FacetGroup>

          <FacetGroup label="Size" disabled={filters.waterType === 'River'}>
            {SIZE_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                active={filters.sizes.has(opt)}
                onClick={() => onChange({ ...filters, sizes: toggleSet(filters.sizes, opt) })}
              >
                {opt}
              </Chip>
            ))}
          </FacetGroup>

          <FacetGroup label="Access">
            {ACCESS_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                active={filters.access.has(opt)}
                onClick={() => onChange({ ...filters, access: toggleSet(filters.access, opt) })}
              >
                {opt}
              </Chip>
            ))}
          </FacetGroup>

          <FacetGroup label="Region">
            {REGIONS.map((r) => (
              <Chip
                key={r.id}
                active={filters.regions.has(r.id)}
                onClick={() => onChange({ ...filters, regions: toggleSet(filters.regions, r.id) })}
              >
                {r.label}
              </Chip>
            ))}
          </FacetGroup>
        </div>

        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--paper-200)' }}>
          {noneMatch && (
            <p
              className="mb-2 text-center"
              style={{ color: 'var(--ink-500)', fontSize: 12, fontWeight: 500 }}
            >
              No venues match. Try loosening Access or Region.
            </p>
          )}
          <button
            type="button"
            disabled={noneMatch}
            onClick={() => onOpenChange(false)}
            className="w-full"
            style={{
              minHeight: 52,
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-family)',
              fontSize: 15,
              fontWeight: 600,
              background: noneMatch ? 'var(--paper-200)' : 'var(--ink-900)',
              color: noneMatch ? 'var(--ink-300)' : 'var(--paper-50)',
              border: '1px solid',
              borderColor: noneMatch ? 'var(--paper-300)' : 'var(--ink-900)',
              cursor: noneMatch ? 'not-allowed' : 'pointer',
              boxShadow: noneMatch ? 'none' : 'var(--shadow-ink)',
            }}
          >
            Show {matchingCount} venue{matchingCount === 1 ? '' : 's'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FacetGroup({ label, disabled, children }: { label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <div className="facet-label">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="facet-chip" data-active={active ? 'true' : 'false'} onClick={onClick}>
      {children}
    </button>
  );
}
