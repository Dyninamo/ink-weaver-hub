import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  venueName: string;
  venueId: string;
  sessionId: string;
  contactEmail: string | null;
}

export default function VenueOutreachDialog({
  open,
  onClose,
  venueName,
  venueId,
  sessionId,
  contactEmail,
}: Props) {
  const [email, setEmail] = useState(contactEmail || "");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const target = contactEmail || email.trim();
    if (!target) {
      toast.error("Please enter an email address");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-venue-report", {
        body: {
          session_id: sessionId,
          venue_id: venueId,
          ...(contactEmail ? {} : { email_override: target }),
        },
      });
      if (error) throw error;

      if (data.status === "sent") {
        toast.success("Report sent to " + venueName);
      } else if (data.status === "cooldown") {
        toast.info(venueName + " was contacted recently — skipping");
      } else if (data.status === "opted_out") {
        toast.info(venueName + " has opted out of emails");
      } else if (data.status === "failed") {
        toast.error("Failed to send — we'll try again later");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-diary">
            <Mail className="h-5 w-5 text-primary" />
            Introduce {venueName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {contactEmail ? (
            <>
              <p className="text-sm text-muted-foreground">
                We found <strong>{venueName}</strong>'s email. Send them a
                summary of your session?
              </p>
              <p className="text-sm font-mono bg-muted/50 rounded px-3 py-2">
                {contactEmail}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Want to introduce <strong>{venueName}</strong> to It's Catching?
                If you know their email, we'll send them a summary of your session.
              </p>
              <Input
                type="email"
                placeholder="venue@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={onClose}
            >
              Skip
            </Button>
            <Button
              className="flex-1 min-h-[44px]"
              onClick={handleSend}
              disabled={sending || (!contactEmail && !email.trim())}
            >
              {sending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Send Report
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
