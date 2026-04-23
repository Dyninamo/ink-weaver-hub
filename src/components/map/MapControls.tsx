import { ReactNode } from 'react';

interface ControlButtonProps {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  wide?: boolean;
  ariaLabel?: string;
  badge?: number;
}

export function MapControlButton({ onClick, children, active, wide, ariaLabel, badge }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`map-control-btn${wide ? ' wide' : ''}${active ? ' active' : ''}`}
    >
      {children}
      {badge && badge > 0 ? <span className="filter-badge">{badge}</span> : null}
    </button>
  );
}

interface ControlColumnProps {
  children: ReactNode;
}

export function MapControlColumn({ children }: ControlColumnProps) {
  return (
    <div
      className="absolute top-3 right-3 flex flex-col gap-2"
      style={{ zIndex: 10 }}
    >
      {children}
    </div>
  );
}

interface MapStatsProps {
  children: ReactNode;
}

export function MapStats({ children }: MapStatsProps) {
  return <div className="map-stats">{children}</div>;
}
