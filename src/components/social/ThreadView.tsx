import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart, Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ThreadViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  profileId: string;
  cardSummary: {
    display_name: string;
    venue_name: string;
    session_date: string;
    n_fish: number;
  };
}

interface Reply {
  reply_id: string;
  profile_id: string;
  display_name: string;
  body: string;
  created_at: string;
  reactionCount: number;
  userReacted: boolean;
}

const ThreadView = ({ open, onOpenChange, cardId, profileId, cardSummary }: ThreadViewProps) => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetchReplies();
  }, [open, cardId]);

  const fetchReplies = async () => {
    setLoading(true);

    const { data: replyData } = await supabase
      .from("card_replies")
      .select("reply_id, profile_id, body, created_at, user_profiles!card_replies_profile_id_fkey(display_name)")
      .eq("card_id", cardId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (!replyData) { setLoading(false); return; }

    // Fetch reactions for all replies
    const replyIds = replyData.map((r) => r.reply_id);
    let reactionMap = new Map<string, { count: number; userReacted: boolean }>();

    if (replyIds.length > 0) {
      const { data: reactions } = await supabase
        .from("card_reactions")
        .select("reply_id, profile_id")
        .in("reply_id", replyIds);

      if (reactions) {
        reactions.forEach((r) => {
          if (!r.reply_id) return;
          const existing = reactionMap.get(r.reply_id) || { count: 0, userReacted: false };
          existing.count++;
          if (r.profile_id === profileId) existing.userReacted = true;
          reactionMap.set(r.reply_id, existing);
        });
      }
    }

    setReplies(
      replyData.map((r) => ({
        reply_id: r.reply_id,
        profile_id: r.profile_id,
        display_name: (r as any).user_profiles?.display_name ?? "Unknown",
        body: r.body,
        created_at: r.created_at,
        reactionCount: reactionMap.get(r.reply_id)?.count || 0,
        userReacted: reactionMap.get(r.reply_id)?.userReacted || false,
      }))
    );
    setLoading(false);

    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);

    // Optimistic
    const optimistic: Reply = {
      reply_id: `temp-${Date.now()}`,
      profile_id: profileId,
      display_name: "You",
      body: text.trim(),
      created_at: new Date().toISOString(),
      reactionCount: 0,
      userReacted: false,
    };
    setReplies((prev) => [...prev, optimistic]);
    const sentText = text.trim();
    setText("");

    const { error } = await supabase.from("card_replies").insert({
      card_id: cardId,
      profile_id: profileId,
      body: sentText,
    });

    if (error) {
      setReplies((prev) => prev.filter((r) => r.reply_id !== optimistic.reply_id));
    } else {
      fetchReplies();
    }
    setSending(false);

    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 150);
  };

  const toggleReplyReaction = async (reply: Reply) => {
    const wasReacted = reply.userReacted;
    // Optimistic
    setReplies((prev) =>
      prev.map((r) =>
        r.reply_id === reply.reply_id
          ? { ...r, userReacted: !wasReacted, reactionCount: r.reactionCount + (wasReacted ? -1 : 1) }
          : r
      )
    );

    if (wasReacted) {
      const { data: existing } = await supabase
        .from("card_reactions")
        .select("reaction_id")
        .eq("reply_id", reply.reply_id)
        .eq("profile_id", profileId)
        .single();

      if (existing) {
        await supabase.from("card_reactions").delete().eq("reaction_id", existing.reaction_id);
      }
    } else {
      await supabase.from("card_reactions").insert({
        card_id: cardId,
        reply_id: reply.reply_id,
        profile_id: profileId,
        emoji: "heart",
      });
    }
  };

  const formattedDate = format(new Date(cardSummary.session_date + "T12:00:00"), "d MMM yyyy");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
          <SheetTitle>Thread</SheetTitle>
        </SheetHeader>

        {/* Original card summary */}
        <div className="px-4 py-3 bg-muted/30 border-b border-border shrink-0">
          <p className="text-sm font-medium text-foreground">{cardSummary.display_name}</p>
          <p className="text-xs text-muted-foreground">
            {cardSummary.venue_name} · {formattedDate} · {cardSummary.n_fish} fish
          </p>
        </div>

        {/* Replies */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : replies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No replies yet. Start the conversation!</p>
          ) : (
            replies.map((reply) => (
              <div key={reply.reply_id} className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">{reply.display_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(reply.created_at), "d MMM, HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-foreground">{reply.body}</p>
                <button
                  onClick={() => toggleReplyReaction(reply)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Heart className={cn("h-3.5 w-3.5", reply.userReacted && "fill-red-500 text-red-500")} />
                  {reply.reactionCount > 0 && <span>{reply.reactionCount}</span>}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Reply input */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex gap-2">
          <Input
            placeholder="Type a reply…"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            maxLength={500}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <Button size="icon" disabled={!text.trim() || sending} onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ThreadView;
