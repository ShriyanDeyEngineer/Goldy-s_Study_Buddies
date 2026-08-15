import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PASSWORD_RULES, loginSchema, registerSchema } from "@/lib/validation";

const searchSchema = z.object({
  mode: z.enum(["signin", "register"]).catch("signin"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Goldy's Study Buddies" },
      {
        name: "description",
        content:
          "Sign in or create an account with your @umn.edu email to join University of Minnesota study groups.",
      },
      { property: "og:title", content: "Sign in to Goldy's Study Buddies" },
      { property: "og:description", content: "UMN students only. Free to join." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.id}
            className={
              ok
                ? "flex items-center gap-1.5 text-green-700"
                : "flex items-center gap-1.5 text-ink-muted"
            }
          >
            {ok ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "register">(search.mode);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-line bg-white px-4 py-4">
        <Link to="/" aria-label="Goldy's Study Buddies home">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              University of Minnesota students only — we verify your @umn.edu address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(value) => setTab(value as "signin" | "register")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="register">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <SignInForm redirect={search.redirect} navigate={navigate} />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SignInForm({
  redirect,
  navigate,
}: {
  redirect?: string | undefined;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("email not confirmed")
          ? "Confirm your email first — check your inbox for the verification link."
          : "That email and password don't match. Try again.",
      );
      return;
    }
    toast.success("Signed in");
    const safe = redirect && redirect.startsWith("/") ? redirect : "/dashboard";
    navigate({ to: safe });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div>
        <Label htmlFor="signin-email">UMN email</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="gopher001@umn.edu"
          required
        />
      </div>
      <div>
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Sign in
      </Button>
      <p className="text-center text-sm text-ink-muted">
        <Link to="/forgot-password" className="text-maroon underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setBusy(false);
    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? "There's already an account with that email. Try signing in."
          : signUpError.message,
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-lg border border-line bg-gold-light/50 p-4 text-sm text-ink">
        <p className="font-medium">Check your inbox.</p>
        <p className="mt-1 text-ink-muted">
          We sent a verification link to {email}. Click it to finish setting up your account — the
          link is good for 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div>
        <Label htmlFor="register-email">UMN email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="gopher001@umn.edu"
          required
        />
        <p className="mt-1 text-xs text-ink-muted">Must end in @umn.edu.</p>
      </div>
      <div>
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PasswordChecklist value={password} />
      </div>
      <div>
        <Label htmlFor="register-confirm">Confirm password</Label>
        <Input
          id="register-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Create account
      </Button>
    </form>
  );
}
