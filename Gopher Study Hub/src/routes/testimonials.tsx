import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/site/PublicHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "Testimonials — Goldy's Study Buddies" },
      {
        name: "description",
        content:
          "UMN students on what changed after they joined a study group: better exams, less isolation, and classmates who actually show up.",
      },
      { property: "og:title", content: "What UMN students say about Goldy's Study Buddies" },
      {
        property: "og:description",
        content: "Real stories from students who stopped studying alone.",
      },
    ],
  }),
  component: Testimonials,
});

const QUOTES = [
  {
    quote:
      "I joined a CSCI 2021 group two days before the first midterm out of pure panic. We met in Keller for three hours, and I went from guessing on the assembly questions to actually finishing early.",
    name: "Devin M.",
    detail: "Junior, Computer Science",
  },
  {
    quote:
      "CHEM 1062 was the first class that made me feel dumb. Turns out four other people in my group felt exactly the same way about the equilibrium unit. We got through it together.",
    name: "Sofia L.",
    detail: "Sophomore, Biology",
  },
  {
    quote:
      "As a transfer student I didn't know a single person on campus. My STAT 3011 group is now the reason I have people to get coffee with.",
    name: "Amara O.",
    detail: "Junior, Statistics",
  },
  {
    quote:
      "The meetup RSVPs are the underrated part. Before this, group study meant six texts and three people showing up. Now I know who's coming.",
    name: "Ben T.",
    detail: "Senior, Mechanical Engineering",
  },
  {
    quote:
      "I run the group for my PSY 3001 section. Being able to approve who joins keeps it small enough that we actually get through the material.",
    name: "Katie R.",
    detail: "Junior, Psychology",
  },
  {
    quote:
      "Honestly I just wanted someone to compare answers with at 1am. Got that, plus a B+ in a class I was ready to drop.",
    name: "Jordan P.",
    detail: "Sophomore, Economics",
  },
];

function Testimonials() {
  return (
    <div className="min-h-screen bg-cream">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-4xl text-ink">Testimonials</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          What students told us after a semester of not studying alone.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {QUOTES.map((item) => (
            <Card key={item.name} className="shadow-[var(--shadow-card)]">
              <CardContent className="pt-6">
                <Quote className="h-6 w-6 text-gold" aria-hidden="true" />
                <blockquote className="mt-3 text-ink">{item.quote}</blockquote>
                <footer className="mt-4 text-sm">
                  <span className="font-medium text-maroon">{item.name}</span>
                  <span className="text-ink-muted"> — {item.detail}</span>
                </footer>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "register" }}>
              Join them
            </Link>
          </Button>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
