import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "@/components/site/PublicHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — Goldy's Study Buddies" },
      {
        name: "description",
        content:
          "Goldy's Study Buddies is a student-run project helping University of Minnesota students find classmates to study with.",
      },
      { property: "og:title", content: "About Goldy's Study Buddies" },
      {
        property: "og:description",
        content: "A student-built way for UMN classmates to find each other and study together.",
      },
    ],
  }),
  component: About,
});

const TEAM = [
  {
    name: "Priya Raghavan",
    role: "Co-founder, product",
    blurb:
      "Senior in computer science. Spent a whole semester of CSCI 2021 studying alone before finding a group in the last two weeks — and immediately wished she'd found it in week one.",
  },
  {
    name: "Marcus Ellingson",
    role: "Co-founder, engineering",
    blurb:
      "Fourth-year in math education. Ran informal review sessions in Vincent Hall and kept losing track of who was coming, which is basically why the meetup feature exists.",
  },
  {
    name: "Hana Okafor",
    role: "Community & support",
    blurb:
      "Junior in psychology. Handles reports, questions, and the occasional group that needs a new manager. Answers most emails within a day.",
  },
];

function About() {
  return (
    <div className="min-h-screen bg-cream">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl text-ink">About us</h1>
        <p className="mt-4 text-lg text-ink-muted">
          Goldy&apos;s Study Buddies started in a Keller Hall lounge in 2023, after three of us
          realized we&apos;d all been in the same 300-person lecture for a full semester without
          ever speaking. The class was hard. Studying alone made it harder.
        </p>
        <p className="mt-4 text-ink-muted">
          So we built the thing we wanted: a place where you put in your courses, and the people in
          those same courses are right there. No algorithm, no feed, no pressure to be interesting.
          Just a group chat, a study time, and someone to compare answers with.
        </p>
        <p className="mt-4 text-ink-muted">
          We keep it to verified @umn.edu accounts on purpose. It should feel like walking into a
          room full of classmates, not the open internet. We&apos;re students too — this is free,
          it&apos;s not a startup, and we&apos;re not selling anything.
        </p>

        <h2 className="mt-14 text-3xl text-ink">The team</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {TEAM.map((person) => (
            <Card key={person.name} className="shadow-[var(--shadow-card)]">
              <CardContent className="pt-6">
                <h3 className="text-lg text-ink">{person.name}</h3>
                <p className="text-sm font-medium text-maroon">{person.role}</p>
                <p className="mt-3 text-sm text-ink-muted">{person.blurb}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="mt-14 text-3xl text-ink">Get in touch</h2>
        <p className="mt-3 text-ink-muted">
          Questions, bugs, or a group that needs help? Email{" "}
          <a className="font-medium text-maroon underline" href="mailto:hello@goldystudybuddies.org">
            hello@goldystudybuddies.org
          </a>
          . For reports or account issues, use{" "}
          <a
            className="font-medium text-maroon underline"
            href="mailto:support@goldystudybuddies.org"
          >
            support@goldystudybuddies.org
          </a>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
