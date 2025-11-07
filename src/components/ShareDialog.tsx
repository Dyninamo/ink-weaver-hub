import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, Link2, Share2, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateShareToken, buildShareUrl } from "@/utils/shareTokens";

interface ShareDialogProps {
  open: boolean;
  selectedQueryIds: string[];
  onClose: () => void;
  onShareComplete: () => void;
}

type ShareMethod = "options" | "email" | "sms";

export function ShareDialog({
  open,
  selectedQueryIds,
  onClose,
  onShareComplete,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<ShareMethod>("options");
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCopyLink = async () => {
    try {
      // Generate a share token for the selected reports
      const token = generateShareToken();
      const shareUrl = buildShareUrl(token);
      
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard",
      });
      
      onShareComplete();
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    try {
      const token = generateShareToken();
      const shareUrl = buildShareUrl(token);
      
      if (navigator.share) {
        await navigator.share({
          title: "Fishing Reports",
          text: `Check out ${selectedQueryIds.length} fishing ${
            selectedQueryIds.length === 1 ? "report" : "reports"
          }`,
          url: shareUrl,
        });
        
        onShareComplete();
      } else {
        // Fallback to copy if native share not available
        await handleCopyLink();
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast({
          title: "Share failed",
          description: "Could not share the reports",
          variant: "destructive",
        });
      }
    }
  };

  const handleSendEmail = async () => {
    if (!emailInput || !emailInput.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Call edge function to send email
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      toast({
        title: "Email sent!",
        description: `Reports sent to ${emailInput}`,
      });
      
      setEmailInput("");
      setCustomMessage("");
      setCurrentView("options");
      onShareComplete();
    } catch (error) {
      toast({
        title: "Failed to send",
        description: "Could not send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phoneInput || phoneInput.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Call edge function to send SMS
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      toast({
        title: "SMS sent!",
        description: `Reports sent to ${phoneInput}`,
      });
      
      setPhoneInput("");
      setCustomMessage("");
      setCurrentView("options");
      onShareComplete();
    } catch (error) {
      toast({
        title: "Failed to send",
        description: "Could not send SMS. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentView("options");
    setEmailInput("");
    setPhoneInput("");
    setCustomMessage("");
  };

  const handleClose = () => {
    setCurrentView("options");
    setEmailInput("");
    setPhoneInput("");
    setCustomMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentView !== "options" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -ml-2"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Share Fishing Reports
          </DialogTitle>
          <DialogDescription>
            Selected: {selectedQueryIds.length} {selectedQueryIds.length === 1 ? "report" : "reports"}
          </DialogDescription>
        </DialogHeader>

        {currentView === "options" && (
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6 hover:bg-primary/5 hover:border-primary"
              onClick={() => setCurrentView("email")}
            >
              <Mail className="h-6 w-6 text-primary" />
              <div className="text-center">
                <div className="font-semibold">Email</div>
                <div className="text-xs text-muted-foreground">Send via email</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6 hover:bg-primary/5 hover:border-primary"
              onClick={() => setCurrentView("sms")}
            >
              <MessageSquare className="h-6 w-6 text-primary" />
              <div className="text-center">
                <div className="font-semibold">SMS</div>
                <div className="text-xs text-muted-foreground">Text message</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6 hover:bg-primary/5 hover:border-primary"
              onClick={handleCopyLink}
            >
              <Link2 className="h-6 w-6 text-primary" />
              <div className="text-center">
                <div className="font-semibold">Copy Link</div>
                <div className="text-xs text-muted-foreground">Copy to clipboard</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6 hover:bg-primary/5 hover:border-primary"
              onClick={handleNativeShare}
            >
              <Share2 className="h-6 w-6 text-primary" />
              <div className="text-center">
                <div className="font-semibold">Share</div>
                <div className="text-xs text-muted-foreground">Native share menu</div>
              </div>
            </Button>
          </div>
        )}

        {currentView === "email" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="recipient@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Custom Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleSendEmail}
              disabled={isLoading || !emailInput}
              className="w-full bg-gradient-water"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </div>
        )}

        {currentView === "sms" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sms-message">Custom Message (Optional)</Label>
              <Textarea
                id="sms-message"
                placeholder="Add a personal message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleSendSMS}
              disabled={isLoading || !phoneInput}
              className="w-full bg-gradient-water"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send SMS"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
