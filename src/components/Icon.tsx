/**
 * Typed wrapper around the branded UI icon PNGs in public/icons/ui/.
 * Two source sizes (64 / 128 px). Browser scales down but never up
 * past the source size.
 *
 * Usage:
 *   <Icon name="fish" size={32} srcSize={64} />
 *   <Icon name="rod" size={40} />                // defaults to 128
 */

export type IconName =
  | 'chart'
  | 'clock'
  | 'fish'
  | 'fly'
  | 'insight'
  | 'location'
  | 'report'
  | 'river'
  | 'rod'
  | 'stillwater'
  | 'trophy'
  | 'venue'
  | 'weather';

type IconSize = 64 | 128;

interface IconProps {
  name: IconName;
  size?: number;
  srcSize?: IconSize;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function Icon({
  name,
  size = 32,
  srcSize = 128,
  alt = '',
  style,
  className,
}: IconProps) {
  return (
    <img
      src={`/icons/ui/icon_${name}_${srcSize}.png`}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      style={{ display: 'block', objectFit: 'contain', ...style }}
    />
  );
}
