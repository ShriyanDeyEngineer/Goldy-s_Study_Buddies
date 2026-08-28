/** This is the web page that displays our community rules and guidelines for users */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Rules & Guidelines",
  description:
    "Guidelines that every user must follow in order to be able to use this website.",
};

const CONTACT_EMAIL = "goldysstudybuddies@gmail.com";

export default function CommunityRulesGuidelinesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 font-['Times_New_Roman']">
        <div className="mx-auto max-w-2xl">

            <h1 className="font-display text-4xl text-ink text-center">COMMUNITY RULES &amp; GUIDELINES</h1>

            <br></br>
            <br></br>

            <p className="mt-4 text-ink-muted text-left">
              Goldy&rsquo;s Study Buddies works because everyone here is in the same position &mdash; trying to get through the same courses with a little help. These guidelines describe what we expect from every member. They apply everywhere on the platform: your profile, group chats, direct messages, availability polls, and any meetup you arrange through the site. Following them is a condition of having an account. They sit alongside our Terms of Service, which is the formal agreement between you and us; where the two overlap, the Terms control.
            </p>

            <h2 className="font-display text-2xl text-ink text-left">Be the student you say you are</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Your account is yours alone. Use a name your classmates would actually recognize, keep your listed courses, major, and graduation year accurate, and don&rsquo;t create a second account or sign in on someone else&rsquo;s behalf. People decide whether to join your group or meet you in person based on what your profile says. Inaccurate information isn&rsquo;t a small thing here &mdash; it&rsquo;s the basis of someone else&rsquo;s decision.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Keep your group work honest</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Study groups are for learning together: working through practice problems, explaining concepts to each other, comparing notes, and preparing for exams. They are not for sharing exam questions, distributing solutions to graded assignments, passing off shared work as your own individual work, or completing someone else&rsquo;s assignment for them. Every course sets its own rules about collaboration, and those rules govern &mdash; what&rsquo;s perfectly fine in one class may violate another class&rsquo;s syllabus. When you aren&rsquo;t sure where the line falls, ask your instructor before you post, not after. Using this platform to violate the University&rsquo;s academic integrity policy can cost you a great deal more than your account here.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Treat every member with respect</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Disagree about an answer, not about a person. Harassment, threats, slurs, sexual harassment, and personal attacks have no place here, and neither does shutting someone out of a group because of their race, religion, gender, sexual orientation, disability, nationality, age, or any other part of who they are. This applies in group chats, in direct messages, and in person at meetups arranged through the platform. Leaving the site doesn&rsquo;t leave the rules behind.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">This is a study platform, not a dating app</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Goldy&rsquo;s Study Buddies exists to help you find people to study with. Asking a study partner out, sending romantic or sexual messages, or continuing to message someone who hasn&rsquo;t written back is not what this is for. If someone tells you they aren&rsquo;t interested &mdash; in a conversation, in a group, in anything &mdash; that is the end of it. If they don&rsquo;t respond at all, treat that as the same answer.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Meet up safely</h2>
                <p className="mt-4 text-ink-muted text-left">
                  For a first meetup with someone you haven&rsquo;t met before, pick a public place on or near campus &mdash; a library floor, a study lounge, a coffee shop. Tell a friend or roommate where you&rsquo;re going and when you expect to be back. You are never obligated to meet somewhere that makes you uncomfortable, to stay longer than you want to, or to explain why you&rsquo;re leaving. If a meetup feels wrong, leave, and then report it. Trust that instinct: we would far rather hear about a meetup that turned out to be fine than not hear about one that didn&rsquo;t.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Show up, or say that you can&rsquo;t</h2>
                <p className="mt-4 text-ink-muted text-left">
                  When you RSVP to a meetup, other people plan around your answer &mdash; sometimes reserving a room, sometimes deciding whether to hold the session at all. Update your RSVP as soon as your plans change, and give as much notice as you can manage. If you know you&rsquo;re done with a group, leave it rather than sitting in the roster and never responding. A seat that&rsquo;s marked taken but never used is worse for everyone than an open one.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">If you manage a group, manage it fairly</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Managers approve join requests, remove members, set the group&rsquo;s capacity, and can disband the group entirely. That is real authority over other people&rsquo;s study plans. Approve and deny requests based on whether someone fits the group, not on who they are. Don&rsquo;t remove a member to settle a personal disagreement. And if you&rsquo;re stepping away from a group, leave it properly so that it passes to another member, rather than letting it sit unmanaged while people wait on approvals that will never come.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Respect privacy, including your own</h2>
                <p className="mt-4 text-ink-muted text-left">
                  What gets said in a group chat or a direct message stays there. Don&rsquo;t screenshot conversations and repost them, don&rsquo;t forward someone&rsquo;s messages to people they didn&rsquo;t choose to share them with, and don&rsquo;t collect, copy, or export other members&rsquo; information &mdash; including assembling contact lists out of profiles you happen to be able to see. On your own side, think twice before putting your phone number, your home or dorm address, or your full class schedule into an open text field. Every signed-in student can view your profile, and most fields can be hidden individually in your settings if you would rather not share them.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Report problems, and report them honestly</h2>
                <p className="mt-4 text-ink-muted text-left">
                  If someone breaks these rules, report them. If you would simply rather not interact with someone, blocking removes them from your search results, cancels any pending requests between the two of you, and stops them from messaging you. You don&rsquo;t need a reason, and they aren&rsquo;t told. When you file a report, we may review the relevant conversation in order to understand what happened, as described in our Privacy Policy. Report what actually happened: filing false reports to push someone out of a group or a course is itself a violation of these guidelines, and it makes it slower for us to act on the real ones.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">How we enforce these rules</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Most problems end with a conversation. When they don&rsquo;t, we may remove content, remove someone from a group, suspend an account, or ban it outright, depending on what happened and whether it has happened before. Threats, harassment, and anything that puts another student&rsquo;s physical safety at risk skip the gradual part. Suspended and banned accounts lose access to the platform, and where a situation calls for it we may refer conduct to the University or to law enforcement. We are a small student team rather than a full-time moderation staff, so we get to reports as quickly as we can &mdash; clear, specific reports help us move faster.
                </p>

            <h2 className="font-display text-2xl text-ink text-left">Questions about these guidelines</h2>
                <p className="mt-4 text-ink-muted text-left">
                  These guidelines will change as the platform grows and as we learn what actually comes up. If something here is unclear, if you think one of these rules is wrong, or if you need to reach us about something that doesn&rsquo;t fit neatly into a report, email us at:
                </p>

            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 text-blue-500 text-left font-bold">
              {CONTACT_EMAIL}
            </a>

        </div>
    </div>
  );
}
