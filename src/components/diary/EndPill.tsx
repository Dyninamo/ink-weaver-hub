// Persistent floating "End session" pill. Mounted at ActiveSessionShell level
// with z-[60] so it sits above any phase content (CatchFlow sticky CTA, etc.).
// Visibility is controlled by the shell — this component is dumb.

interface EndPillProps {
  onEndSession: () => void;
  eventCount?: number;
}

export default function EndPill({ onEndSession, eventCount }: EndPillProps) {
  return (
    <button
      type="button"
      aria-label="End session"
      onClick={onEndSession}
      className="end-session-pill"
      style={{ zIndex: 60 }}
    >
      End session{eventCount && eventCount > 0 ? ` · ${eventCount} logged` : ""}
    </button>
  );
}
