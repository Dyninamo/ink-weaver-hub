import type { FishingSession, SessionEvent } from "@/services/diaryService";

interface EndSessionConfirmProps {
  session: FishingSession;
  events: SessionEvent[];
  activeRod: {
    rodWeight: number | null;
    rodLengthFt: number | null;
    line: string | null;
  };
  onCancel: () => void;
  onConfirm: () => void;
}

function computeDuration(startIso: string | null): string {
  if (!startIso) return "—";
  const startMs = new Date(startIso).getTime();
  const nowMs = Date.now();
  const mins = Math.max(0, Math.round((nowMs - startMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EndSessionConfirm({
  session,
  events,
  activeRod,
  onCancel,
  onConfirm,
}: EndSessionConfirmProps) {
  const caught = events.filter((e) => e.event_type === "catch").length;
  const lost = events.filter((e) => e.event_type === "got_away").length;
  const blanks = events.filter((e) => e.event_type === "blank").length;

  const duration = computeDuration(session.start_time);
  const spot = (session as any).spot_name as string | null | undefined;

  const contextLine = [
    session.venue_name,
    spot || null,
    duration,
  ]
    .filter(Boolean)
    .join(" · ");

  const rigLine = [
    activeRod.rodWeight != null ? `${activeRod.rodWeight}#` : null,
    activeRod.rodLengthFt != null ? `${activeRod.rodLengthFt}ft` : null,
    activeRod.line || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="end-confirm">
      <div className="end-confirm-inner">
        <div className="smallcaps end-confirm-preline">End session?</div>
        <h2 className="end-confirm-headline">Finish up and wrap the page.</h2>
        <p className="end-confirm-body">
          Voice hotwords will stop. GPS tracking will stop. Your session syncs
          and you're back on idle.
        </p>

        <div className="end-confirm-band">
          <div className="end-confirm-tallies">
            <div className="end-confirm-tally">
              <div
                className="end-confirm-tally-num"
                style={{ color: "var(--event-catch-dark)" }}
              >
                {caught} caught
              </div>
              <div className="smallcaps end-confirm-tally-label">CAUGHT</div>
            </div>
            <div className="end-confirm-tally">
              <div
                className="end-confirm-tally-num"
                style={{ color: "var(--event-lost)" }}
              >
                {lost} lost
              </div>
              <div className="smallcaps end-confirm-tally-label">LOST</div>
            </div>
            <div className="end-confirm-tally">
              <div
                className="end-confirm-tally-num"
                style={{ color: "var(--event-blank)" }}
              >
                {blanks} blanks
              </div>
              <div className="smallcaps end-confirm-tally-label">BLANKS</div>
            </div>
          </div>

          {contextLine && (
            <>
              <div className="end-confirm-divider" />
              <div className="smallcaps end-confirm-context">{contextLine}</div>
            </>
          )}

          {rigLine && (
            <>
              <div className="end-confirm-divider" />
              <div className="smallcaps end-confirm-context">{rigLine}</div>
            </>
          )}
        </div>

        <button
          type="button"
          className="end-confirm-primary"
          onClick={onConfirm}
        >
          End session
        </button>
        <button
          type="button"
          className="end-confirm-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
