/**
 * Testimonials (/testimonials).
 *
 * We don't have real quotes yet, and the spec (and basic honesty) forbids
 * inventing them — so this page IS its own empty state: an invitation to
 * be among the first users. When real quotes arrive, add them to the
 * TESTIMONIALS array and the empty state disappears automatically.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "What UMN students say about Goldy's Study Buddies.",
};

/** Real quotes only — never marketing-invented ones. Each needs the
 *  student's permission before it ships. */
const TESTIMONIALS: { quote: string; attribution: string }[] = [];

export default function TestimonialsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl text-ink">Testimonials</h1>
        <p className="mt-4 text-ink-muted">Real words from real Gophers.</p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        {TESTIMONIALS.length === 0 ? (
          <EmptyState
            title="No testimonials yet — you could be the first"
            description="We just launched. Join, find your people, and if it helps you through a midterm, tell us — your words could be the ones that convince the next student not to study alone."
            action={
              <Button asChild variant="secondary">
                <Link href="/register">Be an early Gopher</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.attribution}>
                <CardContent>
                  <blockquote className="text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
                  <p className="mt-3 text-sm text-ink-muted">— {t.attribution}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
