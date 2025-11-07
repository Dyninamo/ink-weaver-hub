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
import {
  copyShareLink,
  nativeShare,
  shareViaEmail,
  shareViaSMS,
  isNativeShareSupported,
  createShareLinks,
} from "@/services/shareService";

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
      setIsLoading(true);
      const url = await copyShareLink(selectedQueryIds);
      
      toast({
        title: "Link copied!",
        description: selectedQueryIds.length === 1 
          ? "Share link has been copied to clipboard"
          : `${selectedQueryIds.length} share links copied to clipboard`,
      });
      
      onShareComplete();
    } catch (error: any) {
      console.error('Copy link error:', error);
      toast({
        title: "Failed to copy",
        description: error.message || "Could not copy link to clipboard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      setIsLoading(true);
      await nativeShare(selectedQueryIds);
      
      toast({
        title: "Shared successfully!",
        description: "Reports have been shared",
      });
      
      onShareComplete();
    } catch (error: any) {
      // Don't show error if user cancelled
      if (error.message && !error.message.includes('cancelled')) {
        console.error('Native share error:', error);
        toast({
          title: "Share failed",
          description: error.message || "Could not share the reports",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
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
      // Create share links first
      const links = await createShareLinks(selectedQueryIds);
      const shareTokens = links.map(link => link.shareToken);
      
      // Send via email
      await shareViaEmail(shareTokens, emailInput, customMessage || undefined);
      
      toast({
        title: "Email sent!",
        description: `Reports sent to ${emailInput}`,
      });
      
      setEmailInput("");
      setCustomMessage("");
      setCurrentView("options");
      onShareComplete();
    } catch (error: any) {
      console.error('Email share error:', error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send email. Please try again.",
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
        description: "Please enter a valid phone number with country code (e.g., +447XXX)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create share links first
      const links = await createShareLinks(selectedQueryIds);
      const shareTokens = links.map(link => link.shareToken);
      
      // Send via SMS
      await shareViaSMS(shareTokens, phoneInput, customMessage || undefined);
      
      toast({
        title: "SMS sent!",
        description: `Reports sent to ${phoneInput}`,
      });
      
      setPhoneInput("");
      setCustomMessage("");
      setCurrentView("options");
      onShareComplete();
    } catch (error: any) {
      console.error('SMS share error:', error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send SMS. Please try again.",
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
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <Link2 className="h-6 w-6 text-primary" />
              )}
              <div className="text-center">
                <div className="font-semibold">Copy Link</div>
                <div className="text-xs text-muted-foreground">Copy to clipboard</div>
              </div>
            </Button>

            {isNativeShareSupported() && (
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-6 hover:bg-primary/5 hover:border-primary"
                onClick={handleNativeShare}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <Share2 className="h-6 w-6 text-primary" />
                )}
                <div className="text-center">
                  <div className="font-semibold">Share</div>
                  <div className="text-xs text-muted-foreground">Native share menu</div>
                </div>
              </Button>
            )}
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
