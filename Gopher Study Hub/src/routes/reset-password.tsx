import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_RULES, resetPasswordSchema } from "@/lib/validation";
import { Wordmark } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Goldy's Study Buddies" },
      {
        name: "description",
        content: "Set a new password for your Goldy's Study Buddies account.",
      },
      { property: "og:title", content: "Choose a new password" },
      { property: "og:description", content: "Finish resetting your account password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your password.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("That reset link has expired. Request a new one.");
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
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
            <CardTitle className="font-display text-2xl">Choose a new password</CardTitle>
            <CardDescription>
              {ready
                ? "Pick something you haven't used before."
                : "Open this page from the link in your reset email."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!ready}
                  required
                />
                <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
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
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={!ready}
                  required
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={!ready || busy}>
                Update password
              </Button>
            </form>
            <p className="mt-6 text-center text-sm">
              <Link to="/forgot-password" className="text-maroon underline">
                Request a new link
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
