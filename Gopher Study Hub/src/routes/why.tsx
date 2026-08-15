import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/site/PublicHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/why")({
  head: () => ({
    meta: [
      { title: "Why use Goldy's Study Buddies — UMN study groups that work" },
      {
        name: "description",
        content:
          "Studying with classmates beats studying alone. See why UMN students use Goldy's Study Buddies to find groups, schedule meetups, and stay on top of hard courses.",
      },
      { property: "og:title", content: "Why use Goldy's Study Buddies" },
      {
        property: "og:description",
        content: "Better grades, less isolation, and a group chat that actually helps you study.",
      },
    ],
  }),
  component: Why,
});

const REASONS = [
  {
    title: "You retain more when you explain it",
    body: "Talking through a proof or a lab writeup forces you to notice the parts you only half understand. A group turns passive rereading into actual practice.",
  },
  {
    title: "Hard courses get less scary",
    body: "Organic chem and 2000-level CS feel very different when four other people are confused about the same slide. Nobody's behind if everybody's working on it together.",
  },
  {
    title: "Deadlines stop sneaking up",
    body: "A scheduled Thursday meetup at Walter is a commitment. Studying 'sometime this week' is not.",
  },
  {
    title: "You meet people in a 300-person lecture",
    body: "Big classes make it hard to talk to anyone. Joining a group is a low-stakes way in — you already have something to talk about.",
  },
  {
    title: "Notes fill in your gaps",
    body: "Missed a lecture, zoned out during a derivation, lost the handout? Somebody in your group has it.",
  },
  {
    title: "It's genuinely free",
    body: "No premium tier, no ads, no reselling your data. It's a student project that exists because we needed it.",
  },
];

function Why() {
  return (
    <div className="min-h-screen bg-cream">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-4xl text-ink">Why use it</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          Study groups aren&apos;t a study hack — they&apos;re just how most people learn hard
          material. The hard part is finding one. That&apos;s the part we fixed.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {REASONS.map((reason) => (
            <Card key={reason.title} className="shadow-[var(--shadow-card)]">
              <CardContent className="pt-6">
                <h2 className="text-xl text-ink">{reason.title}</h2>
                <p className="mt-2 text-sm text-ink-muted">{reason.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 rounded-xl bg-maroon px-6 py-10 text-center text-white">
          <h2 className="text-2xl text-gold">Your class already has people looking.</h2>
          <p className="mt-2 text-white/85">Takes about four minutes to set up.</p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/auth" search={{ mode: "register" }}>
              Sign up with your UMN email
            </Link>
          </Button>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
