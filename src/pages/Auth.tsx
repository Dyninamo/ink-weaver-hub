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

  const oauthLogin = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/auth?redirect=" + redirect },
    });
    if (error) toast.error(error.message);
  };

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
              {/* OAuth buttons */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => oauthLogin("google")}
                  disabled={busy}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 18 18">
                    <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                    <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
                    <path d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" fill="#FBBC05"/>
                    <path d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A8 8 0 0 0 1.83 5.4l2.67 2.07A4.77 4.77 0 0 1 8.98 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => oauthLogin("apple")}
                  disabled={busy}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M12.76 1.2c-.7.84-1.85 1.49-2.98 1.4-.14-1.13.42-2.33 1.07-3.07C11.55-.4 12.8-.94 13.82-1c.12 1.18-.34 2.35-1.06 3.2zm1.05 1.63c-1.65-.1-3.06.94-3.85.94s-2-.89-3.3-.87c-1.7.03-3.26.99-4.13 2.51-1.77 3.05-.46 7.56 1.26 10.04.84 1.22 1.84 2.58 3.16 2.53 1.27-.05 1.74-.82 3.28-.82s1.96.82 3.3.79c1.37-.02 2.22-1.24 3.06-2.46.96-1.4 1.35-2.76 1.37-2.83-.03-.01-2.63-1.01-2.66-4.01-.02-2.51 2.05-3.71 2.15-3.78-1.18-1.74-3.01-1.93-3.64-1.98z" transform="translate(2,3) scale(0.85)"/>
                  </svg>
                  Continue with Apple
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

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
