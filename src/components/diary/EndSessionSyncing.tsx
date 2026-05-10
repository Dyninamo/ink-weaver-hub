import { useEffect, useState } from "react";

interface EndSessionSyncingProps {
  onComplete: () => void;
  isOnline: boolean;
  serverDone: boolean;
  serverError: string | null;
  onRetry: () => void;
}

type RowStatus = "done" | "active" | "pending" | "queued";

const ROWS: { label: string }[] = [
  { label: "GPS trail captured" },
  { label: "Events saved locally" },
  { label: "Transcript stored" },
  { label: "Syncing to cloud" },
  { label: "Session summary written" },
];

function ChecklistRow({ status, label }: { status: RowStatus; label: string }) {
  let icon: string;
  let iconColor: string;
  let textColor: string;
  let iconClass = "ec-check-icon";

  if (status === "done") {
    icon = "✓";
    iconColor = "var(--event-catch-dark)";
    textColor = "var(--ink-900)";
  } else if (status === "active") {
    icon = "…";
    iconColor = "var(--rose-500)";
    textColor = "var(--ink-700)";
    iconClass = "ec-check-icon ec-check-icon-pulse";
  } else if (status === "queued") {
    icon = "⋯";
    iconColor = "var(--event-lost)";
    textColor = "var(--ink-700)";
  } else {
    icon = "◦";
    iconColor = "var(--ink-300)";
    textColor = "var(--ink-500)";
  }

  return (
    <div className="ec-check-row">
      <span className={iconClass} style={{ color: iconColor }}>
        {icon}
      </span>
      <span style={{ color: textColor }}>{label}</span>
    </div>
  );
}

export default function EndSessionSyncing({
  onComplete,
  isOnline,
  serverDone,
  serverError,
  onRetry,
}: EndSessionSyncingProps) {
  const [step, setStep] = useState(0);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(1), 400));
    timers.push(setTimeout(() => setStep(2), 900));
    timers.push(setTimeout(() => setStep(3), 1500));
    timers.push(setTimeout(() => setStep(4), 2100));
    timers.push(setTimeout(() => setStep(5), isOnline ? 2800 : 2100));
    timers.push(setTimeout(() => setStep(6), isOnline ? 3200 : 2600));
    timers.push(setTimeout(() => setAnimDone(true), isOnline ? 3300 : 2700));
    return () => timers.forEach(clearTimeout);
  }, [isOnline]);

  // Advance only when BOTH the animation has finished AND the server has confirmed.
  useEffect(() => {
    if (animDone && serverDone && !serverError) onComplete();
  }, [animDone, serverDone, serverError, onComplete]);

  if (serverError) {
    return (
      <div className="ec-syncing">
        <div className="ec-syncing-inner">
          <div className="smallcaps ec-syncing-preline">Couldn't save the session</div>
          <h2 className="ec-syncing-headline">{serverError}</h2>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium min-h-[44px]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ec-syncing">
      <div className="ec-syncing-inner">
        <div className="smallcaps ec-syncing-preline">Saving your session…</div>
        <div className="ec-spinner" aria-hidden />
        <h2 className="ec-syncing-headline">Flushing events and trail</h2>

        <div className="ec-checklist">
          {ROWS.map((row, idx) => {
            let status: RowStatus;
            if (!isOnline && idx === 3) {
              status = "queued";
            } else if (step > idx + 1) {
              status = "done";
            } else if (step === idx + 1) {
              status = "active";
            } else {
              status = "pending";
            }
            return <ChecklistRow key={row.label} status={status} label={row.label} />;
          })}
        </div>

        {!isOnline && (
          <div className="ec-offline-strip">
            Saved locally. Will sync when back online.
          </div>
        )}

        {animDone && !serverDone && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Still syncing… one moment.
          </p>
        )}
      </div>
    </div>
  );
}
