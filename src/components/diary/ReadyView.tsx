import { Fish, Circle, RefreshCw, Clock, ChevronRight, Sparkles } from "lucide-react";
import type { CurrentSetup, FishingSession, SessionEvent } from "@/services/diaryService";

interface ReadyViewProps {
  session: FishingSession;
  events: SessionEvent[];
  currentSetup: CurrentSetup;
  onCatch: () => void;
  onLost: () => void;
  onBlank: () => void;
  onChange: () => void;
  onEndSession: () => void;
  onAskGhillie: () => void;
  onVenueGreetingTap?: () => void;
}

function elapsed(startIso: string | null | undefined): string {
  if (!startIso) return "--:--";
  const start = new Date(startIso).getTime();
  const diffMs = Math.max(0, Date.now() - start);
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatFlies(flies: any): string | null {
  if (!flies) return null;
  if (typeof flies === "string") return flies;
  if (Array.isArray(flies)) {
    return flies
      .map((f) => (typeof f === "string" ? f : f?.pattern || f?.name))
      .filter(Boolean)
      .join(" · ");
  }
  if (typeof flies === "object") {
    return Object.values(flies)
      .map((v: any) => (typeof v === "string" ? v : v?.pattern))
      .filter(Boolean)
      .join(" · ");
  }
  return null;
}

function RecentBody({ event }: { event: SessionEvent }) {
  if (event.event_type === "catch") {
    return (
      <>
        <strong>{event.species || "Fish"}</strong>
        {event.weight_display ? ` · ${event.weight_display}` : ""}
        {event.fly_pattern && (
          <span className="re-meta">
            {event.fly_pattern}
            {event.fly_size ? ` #${event.fly_size}` : ""}
          </span>
        )}
      </>
    );
  }
  if (event.event_type === "blank") {
    return (
      <>
        Blank
        {event.blank_confidence ? <span className="re-meta">{event.blank_confidence}</span> : null}
      </>
    );
  }
  if (event.event_type === "change") {
    const to = event.change_to as Record<string, any> | null;
    // Prompt 233 — change_to leaves can be nested objects (e.g. { point: { pattern, size } }).
    // Flatten to a readable label; skip values that aren't stringifiable.
    const flatten = (v: any): string | null => {
      if (v == null) return null;
      if (typeof v === "object") return v.pattern ?? v.fly ?? v.name ?? null;
      return String(v);
    };
    const summary = to
      ? (Object.values(to).map(flatten).filter(Boolean).join(" · ") || "Setup change")
      : "Setup change";
    return (
      <>
        Change <span className="re-meta">{summary}</span>
      </>
    );
  }
  if (event.event_type === "got_away") {
    return (
      <>
        Lost{event.species ? ` · ${event.species}` : ""}
        {event.fly_pattern ? <span className="re-meta">{event.fly_pattern}</span> : null}
      </>
    );
  }
  return <>{event.event_type}</>;
}

export default function ReadyView({
  session,
  events,
  currentSetup,
  onCatch,
  onLost,
  onBlank,
  onChange,
  onEndSession,
  onAskGhillie,
  onVenueGreetingTap,
}: ReadyViewProps) {
  const catchCount = events.filter((e) => e.event_type === "catch").length;
  const lostCount = events.filter((e) => e.event_type === "got_away").length;
  const blankCount = events.filter((e) => e.event_type === "blank").length;
  const keepLimit = 0; // sessions.keep_limit not yet on schema; chip hidden when 0
  const keptCount = 0;

  const elapsedStr = elapsed(session.start_time || session.created_at);

  const rodLineParts = [currentSetup.style, currentSetup.rig, currentSetup.line_type, currentSetup.retrieve].filter(Boolean);
  const rodLine = rodLineParts.length > 0 ? rodLineParts.join(" · ") : null;
  const flyNames = formatFlies(currentSetup.flies_on_cast);

  const rows: Array<{
    label: string;
    hint: string;
    color: string;
    onClick: () => void;
    icon: JSX.Element;
    dotClass: string;
  }> = [
    {
      label: "Log a catch",
      hint: "Fish landed · species, weight, fly",
      color: "var(--event-catch)",
      onClick: onCatch,
      icon: <Fish className="h-5 w-5" />,
      dotClass: "catch",
    },
    {
      label: "Lost a fish",
      hint: "Stage · fly (if known)",
      color: "var(--event-lost)",
      onClick: onLost,
      icon: <Fish className="h-5 w-5" style={{ opacity: 0.5 }} />,
      dotClass: "lost",
    },
    {
      label: "Mark a blank",
      hint: "Confidence · reason",
      color: "var(--event-blank)",
      onClick: onBlank,
      icon: <Clock className="h-5 w-5" />,
      dotClass: "blank",
    },
    {
      label: "Change a fly",
      hint: "Position · pattern",
      color: "var(--gild-500)",
      onClick: onChange,
      icon: <RefreshCw className="h-5 w-5" />,
      dotClass: "change",
    },
  ];

  const recent = events.slice().reverse().slice(0, 5);

  return (
    <div className="almanack-surface" style={{ paddingBottom: 96 }}>
      {session.venue_name && (
        onVenueGreetingTap ? (
          <button
            type="button"
            onClick={onVenueGreetingTap}
            className="venue-greeting inline-flex items-center gap-1 hover:underline"
            aria-label={`Switch venue (currently ${session.venue_name})`}
          >
            at <span className="font-medium">{session.venue_name}</span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </button>
        ) : (
          <div className="venue-greeting">at {session.venue_name}</div>
        )
      )}

      {/* Hero */}
      <div className="ready-hero">
        <div className="hero-count">{String(catchCount).padStart(2, "0")}</div>
        <div className="hero-label smallcaps-lg">Fish today</div>
        <div className="hero-meta">
          <span>
            <b>{lostCount}</b> lost
          </span>
          <span>
            <b>{blankCount}</b> blanks
          </span>
          {keepLimit > 0 && (
            <span className="keep-chip">
              <b>Keep {keptCount}</b>/{keepLimit}
            </span>
          )}
          <span>
            <b>{elapsedStr}</b>
          </span>
        </div>
      </div>

      <hr className="rule" />

      {/* Rod summary */}
      {rodLine && (
        <>
          <div className="rod-summary">
            <div className="smallcaps rod-summary-label">Rod</div>
            <div>
              <div className="rod-summary-line">{rodLine}</div>
              {flyNames && <div className="rod-summary-flies">{flyNames}</div>}
            </div>
          </div>
          <hr className="rule" />
        </>
      )}

      {/* Mid-session "Ask the ghillie" affordance — gild row above the
          event-coloured ledger. Per prompt 148 §2. */}
      <div className="ledger">
        <button
          key="ask-ghillie"
          className="led-row"
          onClick={onAskGhillie}
          type="button"
          style={{ background: "color-mix(in srgb, var(--gild-500) 8%, transparent)" }}
        >
          <div className="led-stripe" style={{ background: "var(--gild-500)" }} />
          <div className="led-icon" style={{ color: "var(--gild-500)" }}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="led-body">
            <div className="led-label">Ask the ghillie</div>
            <div className="led-hint smallcaps">Mid-session advice for here, now</div>
          </div>
          <ChevronRight className="led-chev h-5 w-5" />
        </button>

        {rows.map((r) => (
          <button key={r.label} className="led-row" onClick={r.onClick} type="button">
            <div className="led-stripe" style={{ background: r.color }} />
            <div className="led-icon" style={{ color: r.color }}>
              {r.icon}
            </div>
            <div className="led-body">
              <div className="led-label">{r.label}</div>
              <div className="led-hint smallcaps">{r.hint}</div>
            </div>
            <ChevronRight className="led-chev h-5 w-5" />
          </button>
        ))}
      </div>

      {/* Recent entries */}
      {recent.length > 0 && (
        <div className="recent">
          <div className="smallcaps recent-label">Recent</div>
          {recent.map((evt) => (
            <div className="recent-entry" key={evt.id}>
              <div className="re-time">{formatTime(evt.event_time)}</div>
              <div
                className={`re-dot ${
                  evt.event_type === "catch"
                    ? "catch"
                    : evt.event_type === "blank"
                    ? "blank"
                    : evt.event_type === "got_away"
                    ? "lost"
                    : "change"
                }`}
              />
              <div className="re-body">
                <RecentBody event={evt} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* End-session pill is rendered by ActiveSessionShell at shell level
          so it persists across phase transitions (prompt 143 §1). */}
      {void onEndSession}
    </div>
  );
}
