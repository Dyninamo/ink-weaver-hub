import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Sparkles,
  Send,
  Trash2,
  RotateCcw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ChipAction {
  category: "swap_in" | "change_line" | "retrieve" | "spot" | "method";
  label: string;
  detail?: string;
}

interface UserQueryRow {
  query_id: string;
  question: string;
  answer_narrative: string | null;
  answer_chips: ChipAction[] | null;
  confidence: string | null;
  venue_name: string | null;
  created_at: string;
}

const SUGGESTIONS = [
  "Best fly for my home water this evening?",
  "Slow weekend dry-fly tactic in mild wind?",
  "A small reservoir I haven't fished — where to start?",
];

export default function Queries() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{
    query_id: string | null;
    narrative: string;
    chips: ChipAction[];
    confidence: string;
  } | null>(null);

  const [recent, setRecent] = useState<UserQueryRow[]>([]);
  const [selected, setSelected] = useState<UserQueryRow | null>(null);

  const greeting = `Tight lines, ${profile?.display_name?.split(" ")[0] ?? "angler"}.`;

  useEffect(() => {
    if (!user) return;
    loadRecent();
  }, [user]);

  async function loadRecent() {
    const { data, error } = await supabase
      .from("user_queries")
      .select("query_id, question, answer_narrative, answer_chips, confidence, venue_name, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      setRecent(data as unknown as UserQueryRow[]);
    }
  }

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (q.length < 3) {
      toast.error("Type a longer question");
      return;
    }
    setAsking(true);
    setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke("ask-ghillie", {
        body: {
          question: q,
          surface: "queries_tab",
          venue_id: profile?.home_venue_id ?? null,
        },
      });
      if (error) throw error;
      setAnswer({
        query_id: data.query_id ?? null,
        narrative: data.narrative,
        chips: data.chips ?? [],
        confidence: data.confidence ?? "medium",
      });
      setQuestion("");
      loadRecent();
    } catch (err) {
      toast.error((err as Error).message || "Couldn't reach the guide");
    } finally {
      setAsking(false);
    }
  }

  async function reaskWithToday(q: UserQueryRow) {
    setSelected(null);
    await ask(q.question);
  }

  async function deleteQuery(id: string) {
    const { error } = await supabase.from("user_queries").delete().eq("query_id", id);
    if (error) {
      toast.error("Couldn't delete");
      return;
    }
    toast.success("Deleted");
    setSelected(null);
    loadRecent();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-4 pb-12">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Ask the Ghillie</h1>
        </div>

        {/* Greeting */}
        <p className="text-sm text-muted-foreground italic">{greeting}</p>

        {/* Ask pill */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Sparkles className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
              placeholder="Ask about flies, lines, spots…"
              className="pl-9"
              disabled={asking}
            />
          </div>
          <Button type="submit" disabled={asking || question.trim().length < 3} aria-label="Send question">
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {/* Suggestions */}
        {!answer && !asking && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Try one of these
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="text-left text-sm rounded-lg border border-border bg-card hover:bg-muted/40 px-3 py-2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Asking placeholder */}
        {asking && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="h-2 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-2 w-2/3 bg-muted animate-pulse rounded" />
              <div className="h-2 w-1/2 bg-muted animate-pulse rounded" />
              <p className="text-xs text-muted-foreground pt-1">The Ghillie is thinking…</p>
            </CardContent>
          </Card>
        )}

        {/* Latest answer */}
        {answer && !asking && (
          <AnswerCard
            narrative={answer.narrative}
            chips={answer.chips}
            confidence={answer.confidence}
          />
        )}

        {/* Recent journal */}
        {recent.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Recent questions
            </p>
            <div className="space-y-1.5">
              {recent.map((r) => (
                <button
                  key={r.query_id}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/40 px-3 py-2 transition-colors"
                >
                  <p className="text-sm font-medium line-clamp-2">{r.question}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(r.created_at)}
                    {r.confidence && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{r.confidence} confidence</span>
                      </>
                    )}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm overflow-y-auto">
            <div className="max-w-[420px] mx-auto p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Close">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-base font-semibold">Saved question</h2>
              </div>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">You asked</p>
                  <p className="text-sm font-medium italic">"{selected.question}"</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(selected.created_at).toLocaleString("en-GB")}
                  </p>
                </CardContent>
              </Card>

              {selected.answer_narrative && (
                <AnswerCard
                  narrative={selected.answer_narrative}
                  chips={selected.answer_chips ?? []}
                  confidence={selected.confidence ?? "medium"}
                />
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => reaskWithToday(selected)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Re-ask with today's weather
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this question?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteQuery(selected.query_id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerCard({
  narrative,
  chips,
  confidence,
}: {
  narrative: string;
  chips: ChipAction[];
  confidence: string;
}) {
  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">
              Ghillie says
            </span>
          </div>
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full",
              confidence === "high"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : confidence === "low"
                ? "bg-muted text-muted-foreground"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            )}
          >
            {confidence}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{narrative}</p>
        {chips.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Try this
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip, i) => (
                <span
                  key={i}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs border inline-flex items-center gap-1",
                    chip.category === "swap_in"
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                      : chip.category === "change_line"
                      ? "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-400"
                      : chip.category === "retrieve"
                      ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                      : chip.category === "spot"
                      ? "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-400"
                      : "border-border text-foreground"
                  )}
                  title={chip.detail}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
