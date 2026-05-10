import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import PasswordField, { PasswordStrengthMeter, scorePassword } from "@/components/auth/PasswordField";

type AuthMode = "sign_in" | "sign_up" | "forgot";

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

  // Handle OAuth callback (Supabase appends tokens to URL hash)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN") {
          navigate(redirect, { replace: true });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [navigate, redirect]);

  // Resend cooldown ticker (30s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const resendConfirmation = async () => {
    if (!signedUpEmail || resendCooldown > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: signedUpEmail,
      options: { emailRedirectTo: window.location.origin + "/auth?redirect=" + redirect },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Confirmation email re-sent.");
    setResendCooldown(30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth",
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Check your email for a reset link.");
      return;
    }

    if (mode === "sign_up") {
      if (scorePassword(password) < 2) {
        setBusy(false);
        toast.error("Please choose a stronger password.");
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/auth?redirect=" + redirect },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      setSignedUpEmail(email);
      setResendCooldown(30);
      toast.success("Check your email to confirm your account.");
      return;
    }

    // sign_in
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    // Navigation handled by onAuthStateChange above
  };

  // OAuth removed per prompt 149 §2.1 (RN parity).

  const title = mode === "sign_in" ? "Sign In"
    : mode === "sign_up" ? "Create Account"
    : "Reset Password";

  const eyebrow = signedUpEmail
    ? "Check your inbox"
    : mode === "sign_in" ? "Welcome back"
    : mode === "sign_up" ? "Create an account"
    : mode === "forgot" ? "Reset your password"
    : "";

  return (
    <div className="auth-root">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-diary font-semibold tracking-tight text-foreground">
          It's Catching!
        </h1>
        <div
          className="mt-1 mx-auto w-16 h-px"
          style={{ background: "var(--gild-500)" }}
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-muted-foreground italic">Your pocket ghillie</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1 pb-2">
          {eyebrow && (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        </CardHeader>

        <CardContent className="space-y-4">
          {signedUpEmail ? (
            /* Post-signup: check email screen */
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  We sent a confirmation link to{" "}
                  <strong className="text-foreground">{signedUpEmail}</strong>. Tap it to finish creating your account.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resendConfirmation}
                  disabled={busy || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled
                  title="Coming with SMS Phone Auth"
                >
                  Use SMS ›
                </Button>
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => {
                  setSignedUpEmail(null);
                  setMode("sign_in");
                  setPassword("");
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Email/password form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <PasswordField
                      id="password"
                      value={password}
                      onChange={setPassword}
                      placeholder={mode === "sign_up" ? "Min 8 characters" : "Your password"}
                      autoComplete={mode === "sign_up" ? "new-password" : "current-password"}
                    />
                    {mode === "sign_up" && <PasswordStrengthMeter password={password} />}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait..." : title}
                </Button>
              </form>

              {/* Mode switching */}
              <div className="flex justify-center gap-4 text-sm">
                {mode === "sign_in" && (
                  <>
                    <button
                      className="link-rose"
                      onClick={() => setMode("sign_up")}
                    >
                      Create account
                    </button>
                    <button
                      className="text-muted-foreground hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </>
                )}
                {mode !== "sign_in" && (
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setMode("sign_in")}
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
