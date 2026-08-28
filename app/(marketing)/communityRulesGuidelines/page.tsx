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
            <h3 className="font-display text-1xl text-ink text-center">Last Updated: August 28, 2026</h3>

            <p className="mt-4 text-ink-muted text-left">
              Goldy&rsquo;s Study Buddies works because everyone here is in the same position trying to get through the same courses with a little help. These guidelines describe what we expect from every member. They apply everywhere on the platform: your profile, group chats, direct messages, availability polls, and any meetup you arrange through the site. <strong>Following them is a condition of having an account.</strong> They sit alongside our <a target="_self" href="/terms_of_service" className="text-blue-500 font-bold">Terms of Service</a>, which is the formal agreement between you and us; where the two overlap, the Terms control.
            </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Be the student you say you are</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Your account is yours alone. Use a name your classmates would actually recognize, keep your listed courses, major, and graduation year accurate, and do not create a second account or sign in on someone else&rsquo;s behalf. People decide whether to join your group or meet you in person based on what your profile says. Inaccurate information is not a small thing here, it is the basis of someone else&rsquo;s decision.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Keep your group work honest</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Study groups are for learning together: working through practice problems, explaining concepts to each other, comparing notes, and preparing for exams. They are not for sharing exam questions, distributing solutions to graded assignments, passing off shared work as your own individual work, or completing someone else&rsquo;s assignment for them. Every course sets its own rules about collaboration. What is perfectly fine in one class may violate another class&rsquo;s syllabus. When you are not sure where the line falls, ask your instructor before you post, not after. Using this platform to violate the University&rsquo;s academic integrity policy can cost you more than just your account here.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Treat every member with respect</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Disagree about an answer, not about a person. Harassment, threats, slurs, sexual harassment, and personal attacks have no place here, and neither does shutting someone out of a group because of their race, religion, gender, sexual orientation, disability, nationality, age, or any other part of who they are. This applies in group chats, in direct messages, and in person at meetups arranged through the platform. Leaving the site does not leave the rules behind.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">This is a study platform, not a dating app</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Goldy&rsquo;s Study Buddies exists to help you find people to study with. Asking a study partner out, sending romantic or sexual messages, or continuing to message someone who has not written back is not what this is for. If someone tells you they are not interested, in a conversation, in a group, or in anything at all, that is the end of it. If they do not respond at all, treat that as the same answer.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Meet up safely</h2>
                <p className="mt-4 text-ink-muted text-left">
                  For a first meetup with someone you have not met before, pick a public place on or near campus: a library floor, a study lounge, a coffee shop, etc. Tell a friend or roommate where you are going and when you expect to be back. You are never obligated to meet somewhere that makes you uncomfortable, to stay longer than you want to, or to explain why you are leaving. If a meetup feels wrong, leave, and then report it. Trust your instincts.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Show up, or say that you can&rsquo;t</h2>
                <p className="mt-4 text-ink-muted text-left">
                  When you RSVP to a meetup, other people plan around your answer, sometimes reserving a room or sometimes deciding whether to hold the session at all. Update your RSVP as soon as your plans change, and give as much notice as you can manage. If you know you are done with a group, leave it rather than sitting in the roster and never responding. A seat that is marked taken but never used is worse for everyone than an open one.
                </p>
              
            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">If you manage a group, manage it fairly</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Managers approve join requests, remove members, set the group&rsquo;s capacity, and can disband the group entirely. That is real authority over other people&rsquo;s study plans. Approve and deny requests based on whether someone fits the group, not on who they are. Do not remove a member to settle a personal disagreement. And if you are stepping away from a group, leave it so that it passes to another member, rather than letting it sit unmanaged while people wait on approvals that will never come.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Respect privacy, including your own</h2>
                <p className="mt-4 text-ink-muted text-left">
                  What gets said in a group chat or a direct message stays there. Do not screenshot conversations and repost them, do not forward someone&rsquo;s messages to people they did not choose to share them with, and do not collect, copy, or export other members&rsquo; information. On your own side, think twice before putting your phone number, your home or dorm address, or your full class schedule into an open text field. Every signed-in student can view your profile, and most fields can be hidden individually in your settings if you would rather not share them.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Report problems, and report them honestly</h2>
                <p className="mt-4 text-ink-muted text-left">
                  If someone breaks these rules, report them. If you would simply rather not interact with someone, blocking removes them from your search results, cancels any pending requests between the two of you, and stops them from messaging you. You do not need a reason, and they are not told. When you file a report, we may review the relevant conversation in order to understand what happened, as described in our Privacy Policy. Report what actually happened: filing false reports to push someone out of a group or a course is itself a violation of these guidelines, and it makes it slower for us to act on the real ones. Additionally, false reports can result in consequences for the reporter.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">How we enforce these rules</h2>
                <p className="mt-4 text-ink-muted text-left">
                  Most problems end with a conversation. When they do not, we may remove content, remove someone from a group, suspend an account, or ban it outright, depending on what happened and whether it has happened before. Threats, harassment, and anything that puts another student&rsquo;s physical safety at risk skips the gradual part. Suspended and banned accounts lose access to the platform, and where a situation calls for it we may refer conduct to the University or to law enforcement. <strong>We are a small student team</strong> rather than a full time moderation staff, so we will try to reports as quickly as we can. <strong>Clear, specific reports help us move faster.</strong>
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Questions about these guidelines</h2>
                <p className="mt-4 text-ink-muted text-left">
                  These guidelines may change as the platform grows and changes. You will see when these rules have been updated when you are logging in or signing up. If something here is unclear, if you think one of these rules is wrong, or if you need to reach us about something that does not fit neatly into a report, email us at:
                </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 text-blue-500 text-left font-bold">
              {CONTACT_EMAIL}
            </a>

        </div>
    </div>
  );
}
