/**
 * About Us (/about) — the mission and the five founders. Static page.
 */
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "About us",
  description:
    "The student team behind Goldy's Study Buddies and why we built it.",
};

const FOUNDERS = [
  { name: "Shriyan Dey", role: "Co-founder" },
  { name: "Angad Virdi", role: "Co-founder" },
  { name: "Aadi Sharma", role: "Developer" },
  { name: "Joy Deng", role: "Developer" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl text-ink">About us</h1>
        <p className="mt-4 text-ink-muted">
          We&rsquo;re a group of UMN students who kept seeing the same thing: lecture
          halls full of people working through the same problem sets, none of them
          studying together. Office hours don&rsquo;t fit every schedule, sign-up
          spreadsheets stop being used after a few weeks, and the people you meet
          in week one are hard to find again.
        </p>
        <p className="mt-4 text-ink-muted">
          Goldy&rsquo;s Study Buddies is our fix: finding people in your course takes
          two clicks, joining a group doesn&rsquo;t require being outgoing, and
          scheduling a session doesn&rsquo;t take a long text thread. It&rsquo;s
          free, student-run, and built because we wanted it ourselves.
        </p>
      </div>

      <h2 className="mt-14 text-center font-display text-2xl text-ink">The team</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FOUNDERS.map((founder) => (
          <Card key={founder.name}>
            <CardContent className="flex flex-col items-center text-center">
              <Avatar name={founder.name} size="xl" />
              <h3 className="mt-4 font-medium text-ink">{founder.name}</h3>
              <p className="text-sm text-ink-muted">{founder.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
