// AskGhillieOverlay — mid-session "Ask the ghillie" affordance.
// Per prompt 148 §2 + prompt 187 (chip fly_name validation against catalogue).
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/services/eventLogger";
import type {
  CurrentSetup,
  FishingSession,
  SessionEvent,
  WeatherSnapshot,
} from "@/services/diaryService";

interface ChipAction {
  category: string;
  label: string;
  detail?: string;
  fly_name?: string;
}

interface GhillieAnswer {
  narrative: string;
  chips?: ChipAction[];
  confidence?: "high" | "medium" | "low";
}

interface Props {
  session: FishingSession;
  events: SessionEvent[];
  currentSetup: CurrentSetup;
  rodWeight?: number | null;
  latestWeather: WeatherSnapshot | null;
  onClose: () => void;
}

function elapsedLabel(startIso?: string | null) {
  if (!startIso) return "—";
  const ms = Math.max(0, Date.now() - new Date(startIso).getTime());
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function AskGhillieOverlay({
  session,
  events,
  currentSetup,
  rodWeight,
  latestWeather,
  onClose,
}: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<GhillieAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-loaded snapshot of the local flies catalogue for chip validation.
  const [flyCatalogue, setFlyCatalogue] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("flies").select("name, aliases").then(({ data, error: fErr }) => {
      if (cancelled || fErr) {
        if (fErr) console.warn("Could not preload flies catalogue:", fErr);
        if (!cancelled) setFlyCatalogue(new Set());
        return;
      }
      const set = new Set<string>();
      for (const r of (data ?? []) as Array<{ name: string; aliases: string[] | null }>) {
        if (r.name) set.add(r.name.toLowerCase());
        for (const a of (r.aliases ?? [])) if (a) set.add(a.toLowerCase());
      }
      setFlyCatalogue(set);
    });
    return () => { cancelled = true; };
  }, []);

  const tally = events.filter((e) => e.event_type === "catch").length;
  const elapsed = elapsedLabel(session.start_time || session.created_at);

  // Validate swap_in chips against catalogue. Drop unmatched ones; older
  // payloads pre-187 lack fly_name and are kept (can't validate).
  const validatedChips = useMemo(() => {
    if (!answer?.chips) return [];
    if (!flyCatalogue) return answer.chips;
    const valid: ChipAction[] = [];
    for (const c of answer.chips) {
      if (c.category === "swap_in") {
        const name = c.fly_name;
        if (!name) {
          valid.push(c);
          continue;
        }
        if (flyCatalogue.has(name.toLowerCase())) {
          valid.push(c);
        } else {
          void logEvent("warning", {
            context: "ghillie_chip_no_fly_match",
            chip_label: c.label,
            chip_fly_name: name,
          }, session.id ?? undefined);
        }
      } else {
        valid.push(c);
      }
    }
    return valid;
  }, [answer?.chips, flyCatalogue, session.id]);

  async function handleAsk() {
    const q = question.trim();
    if (q.length < 3) {
      setError("Ask a slightly longer question.");
      return;
    }
    setLoading(true);
    setError(null);
    setAnswer(null);

    const ctxBits: string[] = [];
    if (rodWeight) ctxBits.push(`rod ${rodWeight}#`);
    if (currentSetup.style) ctxBits.push(`style ${currentSetup.style}`);
    if (currentSetup.line_type) ctxBits.push(`line ${currentSetup.line_type}`);
    if (currentSetup.retrieve) ctxBits.push(`retrieve ${currentSetup.retrieve}`);
    ctxBits.push(`tally ${tally}`);
    ctxBits.push(`elapsed ${elapsed}`);
    const enriched = `[mid-session: ${ctxBits.join(", ")}] ${q}`;

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("ask-ghillie", {
        body: {
          question: enriched,
          surface: "mid_session",
          venue_name: session.venue_name,
          venue_id: (session as any).venue_id ?? null,
          venue_type: (session as any).venue_type ?? null,
          session_id: session.id ?? null,
          weather_snapshot: latestWeather ?? null,
        },
      });
      if (invokeErr) throw invokeErr;
      const payload = (data ?? {}) as Partial<GhillieAnswer> & { error?: string };
      if (payload.error) throw new Error(payload.error);
      setAnswer({
        narrative: payload.narrative || "Sorry, I couldn't generate an answer right now.",
        chips: payload.chips,
        confidence: payload.confidence,
      });
      void logEvent(
        "ghillie.asked",
        { surface: "mid_session", session_id: session.id, length: q.length },
        session.id ?? undefined,
      );
    } catch (err: any) {
      console.error("ask-ghillie failed", err);
      let isMisconfigured = false;
      try {
        const ctx = err?.context;
        const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
        if (body?.error === "service_misconfigured") isMisconfigured = true;
      } catch { /* swallow */ }
      setError(
        isMisconfigured
          ? "The ghillie is offline for maintenance. Please try again later, or contact support if the problem persists."
          : err?.message || "Couldn't reach the ghillie. Try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  }

  const droppedCount = (answer?.chips?.length ?? 0) - validatedChips.length;

  return (
    <div className="p-4 space-y-4 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={onClose} aria-label="Close" className="p-2 -ml-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Ask the ghillie</h2>
      </div>

      <div className="bg-muted/50 px-3 py-2 rounded-md text-xs flex flex-wrap gap-x-3 gap-y-1">
        {session.venue_name && (
          <span><strong>Venue:</strong> {session.venue_name}</span>
        )}
        {rodWeight != null && <span><strong>Rod:</strong> {rodWeight}#</span>}
        {currentSetup.style && <span><strong>Style:</strong> {currentSetup.style}</span>}
        {currentSetup.line_type && <span><strong>Line:</strong> {currentSetup.line_type}</span>}
        <span><strong>Caught:</strong> {tally}</span>
        <span><strong>Elapsed:</strong> {elapsed}</span>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Should I switch to a sinking line for the next hour?"
        rows={3}
        maxLength={500}
        className="w-full rounded-md border bg-background p-3 text-sm"
      />

      <Button
        onClick={handleAsk}
        disabled={!question.trim() || loading}
        className="w-full min-h-[48px]"
      >
        {loading ? "Asking…" : "Ask the ghillie"}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {answer && (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-sm">
            {answer.narrative}
          </div>
          {validatedChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {validatedChips.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex flex-col items-start rounded-full border px-3 py-1.5 text-xs bg-background"
                  title={c.detail}
                >
                  <strong>{c.label}</strong>
                  {c.detail && <span className="text-muted-foreground">{c.detail}</span>}
                </span>
              ))}
            </div>
          )}
          {droppedCount > 0 && (
            <p className="text-[11px] text-muted-foreground italic mt-1">
              {droppedCount} suggestion{droppedCount === 1 ? "" : "s"} hidden — pattern not in your fly catalogue yet.
            </p>
          )}
          {answer.confidence && (
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Confidence · {answer.confidence}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
