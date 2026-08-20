/**
 * Why Use It (/why) — argument cards drawn directly from the problem
 * statement in the spec (§1). Static page.
 */
import type { Metadata } from "next";
import {
  Clock,
  DoorOpen,
  Landmark,
  MessagesSquare,
  Table2,
  UserRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Why use it",
  description:
    "Why study groups beat studying alone — and why finding one at the U is harder than it should be.",
};

const ARGUMENTS = [
  {
    icon: Landmark,
    title: "Office hours don't fit everyone",
    body: "Tutoring rooms and office hours run on fixed schedules that don't work for everyone. Your group meets when your schedules line up.",
  },
  {
    icon: DoorOpen,
    title: "Open groups beat cold approaches",
    body: "Walking up to strangers in a 300-person lecture is hard. Clicking \"Join\" on an open group isn't.",
  },
  {
    icon: UserRound,
    title: "Every section isn't equal",
    body: "Some sections get more support than others. Groups connect students across sections, so everyone has access to the same help.",
  },
  {
    icon: Table2,
    title: "No more dead spreadsheets",
    body: "A sign-up sheet nobody maintains isn't a study group. Groups here have chat, meetups, and RSVPs built in.",
  },
  {
    icon: MessagesSquare,
    title: "It's a talking point",
    body: "Asking someone to join your study group is an easy way to start a conversation. Many friendships start with a shared problem set.",
  },
];

export default function WhyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl text-ink">Why use Goldy&rsquo;s Study Buddies?</h1>
        <p className="mt-4 text-ink-muted">
          The hardest part of studying together is finding people to study with.
          That&rsquo;s the part this site handles.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ARGUMENTS.map((argument) => (
          <Card key={argument.title} className="h-full">
            <CardContent>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-light">
                <argument.icon aria-hidden className="h-5 w-5 text-maroon" />
              </span>
              <h2 className="font-display text-lg text-ink">{argument.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{argument.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
