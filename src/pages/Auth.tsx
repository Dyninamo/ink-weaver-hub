import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fish } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
  mobile: z.string().trim().regex(/^\+\d{10,15}$/, { 
    message: "Please enter a valid mobile number with country code (e.g., +447XXX)" 
  }),
});

const signInSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      mobile: formData.get("mobile") as string,
    };

    try {
      // Validate inputs
      const validated = signUpSchema.parse(data);

      // Sign up with Supabase
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            mobile_number: validated.mobile,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast({
            title: "Email already registered",
            description: "This email is already in use. Please sign in instead.",
            variant: "destructive",
          });
        } else if (signUpError.message.includes("Password")) {
          toast({
            title: "Password too weak",
            description: "Password must be at least 8 characters with a mix of letters and numbers.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign up failed",
            description: signUpError.message || "Unable to create account. Please try again.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Update user profile with mobile number
        const { error: profileError } = await supabase
          .from("user_profiles")
          .update({ mobile_number: validated.mobile })
          .eq("id", authData.user.id);

        if (profileError) {
          console.error("Profile update error:", profileError);
        }

        toast({
          title: "Account created!",
          description: "Welcome to Fishing Advice. Redirecting to dashboard...",
        });

        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          title: "Validation error",
          description: "Please check your inputs and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Network error",
          description: "Unable to sign up. Please check your connection and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    try {
      const validated = signInSchema.parse(data);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message || "Invalid email or password. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "Redirecting to dashboard...",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Network error",
          description: "Unable to sign in. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-water rounded-full mb-4">
            <Fish className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Fishing Advice</h1>
          <p className="text-muted-foreground">AI-powered fishing insights</p>
        </div>

        <Card className="shadow-medium">
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-water"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                  <CardDescription>
                    Create an account to start receiving personalized fishing advice
                  </CardDescription>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-mobile">Mobile Number</Label>
                    <Input
                      id="signup-mobile"
                      name="mobile"
                      type="tel"
                      placeholder="+447XXXXXXXXX"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Include country code (e.g., +44 for UK)
                    </p>
                    {errors.mobile && (
                      <p className="text-sm text-destructive">{errors.mobile}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="At least 8 characters"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters long
                    </p>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-water"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating your account..." : "Create Account"}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="text-center mt-6">
          <Button variant="link" onClick={() => navigate("/")} className="text-muted-foreground">
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
