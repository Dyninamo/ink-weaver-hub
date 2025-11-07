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
import { 
  Mail, 
  MessageSquare, 
  Link2, 
  Share2, 
  ArrowLeft, 
  Loader2, 
  Check,
  AlertCircle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  copyShareLink,
  nativeShare,
  shareViaEmail,
  shareViaSMS,
  isNativeShareSupported,
  createShareLinks,
} from "@/services/shareService";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const SMS_CHAR_LIMIT = 100;

  const handleCopyLink = async () => {
    try {
      setIsLoading(true);
      const url = await copyShareLink(selectedQueryIds);
      
      const displayUrl = selectedQueryIds.length === 1 
        ? url 
        : `${selectedQueryIds.length} share links`;
      
      toast({
        title: "✓ Link copied!",
        description: (
          <div className="space-y-2">
            <p className="text-sm">Share link has been copied to clipboard</p>
            {selectedQueryIds.length === 1 && (
              <code className="block text-xs bg-muted p-2 rounded break-all">
                {url}
              </code>
            )}
          </div>
        ),
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
        title: "✓ Shared successfully!",
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

  const validateEmail = (email: string): boolean => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email address is required");
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    
    setEmailError("");
    return true;
  };

  const validatePhone = (phone: string): boolean => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setPhoneError("Phone number is required");
      return false;
    }
    
    // Check if it starts with +
    if (!trimmedPhone.startsWith('+')) {
      setPhoneError("Phone number must include country code (e.g., +44)");
      return false;
    }
    
    // Check if it has at least 10 digits after the +
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      setPhoneError("Invalid phone number format (e.g., +447939009911)");
      return false;
    }
    
    setPhoneError("");
    return true;
  };

  const handleSendEmail = async () => {
    if (!validateEmail(emailInput)) {
      return;
    }

    setIsLoading(true);
    setEmailError("");
    
    try {
      // Create share links first
      const links = await createShareLinks(selectedQueryIds);
      const shareTokens = links.map(link => link.shareToken);
      
      // Send via email
      await shareViaEmail(shareTokens, emailInput.trim(), customMessage || undefined);
      
      toast({
        title: "✓ Email sent!",
        description: `Reports successfully sent to ${emailInput}`,
      });
      
      setEmailInput("");
      setCustomMessage("");
      setCurrentView("options");
      onShareComplete();
    } catch (error: any) {
      console.error('Email share error:', error);
      setEmailError(error.message || "Failed to send email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!validatePhone(phoneInput)) {
      return;
    }

    setIsLoading(true);
    setPhoneError("");
    
    try {
      // Create share links first
      const links = await createShareLinks(selectedQueryIds);
      const shareTokens = links.map(link => link.shareToken);
      
      // Send via SMS
      await shareViaSMS(shareTokens, phoneInput.trim(), customMessage || undefined);
      
      toast({
        title: "✓ SMS sent!",
        description: `Reports successfully sent to ${phoneInput}`,
      });
      
      setPhoneInput("");
      setCustomMessage("");
      setCurrentView("options");
      onShareComplete();
    } catch (error: any) {
      console.error('SMS share error:', error);
      setPhoneError(error.message || "Failed to send SMS. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentView("options");
    setEmailInput("");
    setPhoneInput("");
    setCustomMessage("");
    setEmailError("");
    setPhoneError("");
  };

  const handleClose = () => {
    setCurrentView("options");
    setEmailInput("");
    setPhoneInput("");
    setCustomMessage("");
    setEmailError("");
    setPhoneError("");
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
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="recipient@example.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError("");
                }}
                disabled={isLoading}
                className={emailError ? "border-destructive" : ""}
              />
              {emailError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{emailError}</AlertDescription>
                </Alert>
              )}
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
              <p className="text-xs text-muted-foreground">
                This message will be included in the email
              </p>
            </div>

            <Button
              onClick={handleSendEmail}
              disabled={isLoading || !emailInput}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Email...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        )}

        {currentView === "sms" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+447939009911"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhoneError("");
                }}
                disabled={isLoading}
                className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{phoneError}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +44 for UK, +1 for US)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-message">Custom Message (Optional)</Label>
                <span className={`text-xs ${
                  customMessage.length > SMS_CHAR_LIMIT 
                    ? "text-destructive font-semibold" 
                    : "text-muted-foreground"
                }`}>
                  {customMessage.length}/{SMS_CHAR_LIMIT}
                </span>
              </div>
              <Textarea
                id="sms-message"
                placeholder="Add a brief message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                disabled={isLoading}
                maxLength={SMS_CHAR_LIMIT}
                className={customMessage.length > SMS_CHAR_LIMIT ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Keep it brief - SMS messages have a {SMS_CHAR_LIMIT} character limit
              </p>
            </div>

            <Button
              onClick={handleSendSMS}
              disabled={isLoading || !phoneInput || customMessage.length > SMS_CHAR_LIMIT}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending SMS...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send SMS
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
