import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/site/PublicHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MailCheck, BookOpen, Users, MessageCircle, CalendarDays, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Goldy's Study Buddies — Find UMN study groups for your classes" },
      {
        name: "description",
        content:
          "Verified @umn.edu students find study partners and join course study groups at the University of Minnesota. Chat, schedule meetups, never study alone.",
      },
      { property: "og:title", content: "Goldy's Study Buddies — Find UMN study groups for your classes" },
      {
        property: "og:description",
        content:
          "Verified @umn.edu students find study partners and join course study groups at the University of Minnesota. Chat, schedule meetups, never study alone.",
      },
    ],
  }),
  component: Home,
});

const STEPS = [
  {
    icon: MailCheck,
    title: "Verify your UMN email",
    body: "Sign up with your @umn.edu address so everyone in a group is a real classmate.",
  },
  {
    icon: BookOpen,
    title: "Pick your courses",
    body: "Add the classes you're taking this semester — PHYS 1301W, CSCI 1133, whatever's kicking you.",
  },
  {
    icon: Users,
    title: "Join or create a group",
    body: "Hop into an open group instantly, or start your own and invite people from your section.",
  },
];

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Group chat that keeps up",
    body: "Messages land instantly for everyone online, and the full history is waiting when you get back.",
  },
  {
    icon: CalendarDays,
    title: "Meetups people actually attend",
    body: "Schedule online or in person, RSVP in one tap, and add it to your calendar before you forget.",
  },
  {
    icon: Search,
    title: "Find people in your section",
    body: "Search classmates, see who shares your courses, and send an invite without cold-approaching anyone.",
  },
];

function Home() {
  return (
    <div className="min-h-screen bg-cream">
      <PublicHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-maroon uppercase">
              For University of Minnesota students
            </p>
            <h1 className="mt-4 text-4xl leading-tight text-ink sm:text-6xl">
              Never study alone at the U again.
            </h1>
            <p className="mt-5 text-lg text-ink-muted">
              Week three hits, the lecture hall goes quiet, and suddenly nobody knows anybody.
              Goldy&apos;s Study Buddies puts you in a group for your exact course — with people
              who are stuck on the same problem set.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "register" }}>
                  Get started
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-line bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl text-ink">How it works</h2>
            <p className="mt-2 text-ink-muted">Three steps, about four minutes.</p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Card className="h-full shadow-[var(--shadow-card)]">
                    <CardContent className="pt-6">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold-light text-maroon-dark">
                        <step.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-xl text-ink">
                        {index + 1}. {step.title}
                      </h3>
                      <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl text-ink">What you get</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="h-full shadow-[var(--shadow-card)]">
                <CardContent className="pt-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-maroon text-white">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-xl text-ink">{feature.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-maroon py-16 text-white">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl text-gold">Break the ice — even a &ldquo;hey&rdquo; works.</h2>
            <p className="mt-3 text-white/85">
              Somebody in your class is about to post &ldquo;anyone want to go over chapter
              7?&rdquo; It might as well be you.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link to="/auth" search={{ mode: "register" }}>
                Create your account
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
