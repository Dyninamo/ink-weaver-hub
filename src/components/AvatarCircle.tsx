const AVATAR_COLOURS = [
  '#4A6741', // olive
  '#6B8C60', // olive-light
  '#E8788A', // pink
  '#3A7CA5', // steel blue
  '#D4A373', // warm tan
  '#7B68A5', // muted purple
  '#C0785C', // terracotta
  '#5C8A6E', // sage
];

function hashToIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_COLOURS.length;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

interface AvatarCircleProps {
  displayName: string;
  profileId: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

const AvatarCircle = ({
  displayName,
  profileId,
  avatarUrl,
  size = 40,
  className = '',
}: AvatarCircleProps) => {
  const bg = AVATAR_COLOURS[hashToIndex(profileId)];
  const fontSize = Math.round(size * 0.4);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize,
        fontWeight: 600,
        color: '#fff',
        lineHeight: 1,
      }}
    >
      {getInitials(displayName)}
    </div>
  );
};

export default AvatarCircle;
