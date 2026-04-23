import { useNavigate } from "react-router-dom";
import type { FishingSession, SessionEvent } from "@/services/diaryService";

interface EndSessionViewProps {
  session: FishingSession;
  events: SessionEvent[];
  anglerName?: string | null;
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="end-stat">
      <div className="end-stat-num" style={{ color }}>
        {String(n).padStart(2, "0")}
      </div>
      <div className="smallcaps end-stat-label">{label}</div>
    </div>
  );
}

function formatDuration(mins: number | null): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EndSessionView({
  session,
  events,
  anglerName,
}: EndSessionViewProps) {
  const navigate = useNavigate();
  const caughtCount = events.filter((e) => e.event_type === "catch").length;
  const lostCount = events.filter((e) => e.event_type === "got_away").length;
  const blankCount = events.filter((e) => e.event_type === "blank").length;

  const duration = formatDuration(session.duration_minutes);

  return (
    <div className="end-screen">
      <div className="end-screen-glow" aria-hidden />
      <div className="end-screen-inner">
        <div className="smallcaps-lg end-thanks">
          {anglerName ? `Thank you · ${anglerName}` : "Thank you"}
        </div>

        <h2 className="end-title">That's a wrap.</h2>

        <div className="end-stats-grid">
          <Stat n={caughtCount} label="Caught" color="var(--event-catch-dark)" />
          <Stat n={lostCount} label="Lost" color="var(--event-lost)" />
          <Stat n={blankCount} label="Blanks" color="var(--event-blank)" />
        </div>

        {session.venue_name && (
          <div className="end-meta">
            {session.venue_name} · {duration}
          </div>
        )}

        <p className="end-tagline">Tight lines. Safely inked.</p>

        <button
          type="button"
          className="end-new-session"
          onClick={() => navigate("/diary/new")}
        >
          New session
        </button>
      </div>
    </div>
  );
}
