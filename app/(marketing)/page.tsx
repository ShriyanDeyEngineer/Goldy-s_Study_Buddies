/**
 * The home page (/) — hero, "How it works" in three steps, features, and
 * a closing CTA. Static; copy leads with the big intro STEM courses
 * because CSE freshmen are the primary audience (spec §1) — but nothing
 * here excludes anyone else.
 */
import Link from "next/link";
import {
  CalendarClock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GopherLogo } from "@/components/gopher-logo";

const STEPS = [
  {
    title: "Verify your UMN email",
    body: "Sign up with your @umn.edu address (or UMN Google) — everyone here is a real U of M student.",
  },
  {
    title: "Pick your courses",
    body: "Tell us what you're taking — PHYS 1301W, MATH 1371, CSCI 1133, anything. We'll show you who's studying what.",
  },
  {
    title: "Join or create a group",
    body: "Hop into an open group instantly, request a closed one, or start your own and invite classmates.",
  },
];

const FEATURES = [
  {
    icon: Users,
    title: "Groups for your exact course",
    body: "Not \"STEM study group\" — a group for your section of Chem 1061, with people taking the same exams.",
  },
  {
    icon: MessageCircle,
    title: "Built-in group chat",
    body: "Every group gets a realtime chat. No \"what's everyone's number?\" spreadsheet required.",
  },
  {
    icon: CalendarClock,
    title: "Meetups that fit your schedule",
    body: "Schedule sessions online or in person, RSVP, and add them to Google Calendar in one tap.",
  },
  {
    icon: Vote,
    title: "Find a time that works",
    body: "Availability polls show which slot works for the most people — no back-and-forth.",
  },
  {
    icon: Sparkles,
    title: "Study buddies, 1-on-1",
    body: "Prefer one partner over a crowd? Flip on study-buddy mode and match by shared classes.",
  },
  {
    icon: ShieldCheck,
    title: "Students only, privacy first",
    body: "UMN-verified accounts, per-field profile privacy, and blocking that actually blocks.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-maroon text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:py-28">
          <GopherLogo className="mb-6 h-16 w-16 text-gold" />
          <h1 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
            Never study alone at the U again.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Find study partners and join study groups for your exact UMN courses —
            from Calc I to orgo. Free, built by students, for students.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="secondary" size="lg">
              <Link href="/register">Get started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:py-20">
        <h2 className="text-center font-display text-3xl text-ink">How it works</h2>
        <p className="mx-auto mt-2 max-w-md text-center text-ink-muted">
          Three steps between you and a group that gets it.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent>
                  <span
                    aria-hidden="true"
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gold font-display text-lg text-maroon"
                  >
                    {index + 1}
                  </span>
                  <h3 className="font-display text-lg text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-center font-display text-3xl text-ink">
            Everything a study group needs
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-light">
                  <feature.icon aria-hidden className="h-5 w-5 text-maroon" />
                </span>
                <div>
                  <h3 className="font-medium text-ink">{feature.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
        <h2 className="font-display text-3xl text-ink">
          Your study group is already on campus.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-ink-muted">
          They just haven&rsquo;t met you yet. Break the ice — even a &ldquo;hey&rdquo; works.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/register">Find your study buddies</Link>
        </Button>
      </section>
    </>
  );
}
