import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { forgotPasswordSchema } from "@/lib/validation";
import { Wordmark } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Send yourself a password reset link for your Goldy's Study Buddies account.",
      },
      { property: "og:title", content: "Reset your password" },
      { property: "og:description", content: "Get back into your Goldy's Study Buddies account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your email address.");
      return;
    }
    setError(null);
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-line bg-white px-4 py-4">
        <Link to="/">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your UMN email and we&apos;ll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-sm text-ink-muted">
                If an account exists for {email}, a reset link is on its way. The link expires in
                one hour.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div>
                  <Label htmlFor="forgot-email">UMN email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="gopher001@umn.edu"
                    required
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  Send reset link
                </Button>
              </form>
            )}
            <p className="mt-6 text-center text-sm">
              <Link to="/auth" className="text-maroon underline">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
