/** This is the web page that display's our privacy policy for users */

import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Study Buddies collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 font-['Times_New_Roman']">
        <div className="mx-auto max-w-2xl">

            <h1 className="font-display text-4xl text-ink text-center">PRIVACY POLICY</h1>
            <h3 className="font-display text-1xl text-ink text-center">Last Updated: August 31, 2026</h3>

            <p className="mt-4 text-ink-muted text-left">
                This Service is an independent, non-commercial project created by University of Minnesota students and is not a registered business entity.
            </p>
            <p className="mt-4 text-ink-muted text-left">
                Welcome to our Study Buddy platform &#40;the "Service"&#41;. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website.
            </p>
            <p className="mt-4 text-ink-muted text-left">
                Please read this Privacy Policy carefully. <span className="font-bold">By accessing or using the Service, you agree to the terms of this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access the Service.</span>
            </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">1. Information We Collect</h2>
                <h2 className="mt-4 font-display text-1xl text-ink text-left">A. Sign-In via Google</h2>
                    <p className="text-ink-muted text-left">
                        The only way to sign in is &ldquo;Sign in with Google,&rdquo; using your University of Minnesota Twin Cities Google Workspace account &#40;the one ending in @umn.edu&#41;. There is no separate username or password, and <span className="font-bold">we never see, receive, or store your Google password.</span> When you sign in, we receive from Google only:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Your name.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Your @umn.edu email address.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Your Google account ID &#40;used to link your session&#41;.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        We do not request or access your Google Calendar, Google Drive, Gmail content, or any other Google service beyond basic sign-in identification. Our use and transfer of information received from Google APIs adheres to the <a target="_blank" href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" className="text-blue-500 font-bold">Google API Services User Data Policy</a>, including the Limited Use requirements. You can review or revoke this Service&rsquo;s access to your Google Account at any time at <a target="_blank" href="https://myaccount.google.com/connections?filters=3,4&hl=en" rel="noopener noreferrer" className="text-blue-500 font-bold">Google Account Permissions</a> — this is independent of deleting your account on our platform &#40;see Section 6&#41;.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        <span className="font-bold">How access is restricted.</span> After Google returns your identity, our server checks that your email address ends in &ldquo;@umn.edu&rdquo; and refuses the sign-up otherwise. Any &ldquo;choose a umn.edu account&rdquo; prompt you see from Google is only a convenience hint, not the control. An @umn.edu Google account is issued by the University to students, faculty, staff, and other affiliates; this Service does not verify your enrollment status, role, or age, and does not connect to, or exchange data with, any University system. We are not affiliated with, sponsored by, or endorsed by the University of Minnesota.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">B. User Profile & Platform Data</h2>
                    <p className="text-ink-muted text-left">
                        Once authenticated, you may choose or be required to provide additional information to facilitate matchings, including:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - <span className="font-bold">Academic Information:</span> Major, current courses, and academic interests.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - <span className="font-bold">Meetup & Schedule Data:</span> Availability, study preferences, and proposed meetup locations or times.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - <span className="font-bold">Communication Content:</span> The text of real-time chat messages and direct messages you exchange with other users. The Service has no image or file uploads.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">C. Automatically Collected Technical Data</h2>
                    <p className="text-ink-muted text-left">
                        Our infrastructure relies on third-party services to host and power the platform. We collect technical logs automatically via:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - <span className="font-bold">Vercel &#40;Hosting & Metrics&#41;:</span> IP addresses, browser types, operating systems, access times, and pages viewed directly before and after accessing the Service.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - <span className="font-bold">Supabase &#40;Database & Authentication Backend&#41;:</span> Secure authentication tokens, user IDs, query timestamps, and structural operational logs.
                    </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">2. Dynamic Data Visibility and Peer Sharing</h2>
                <h2 className="mt-4 font-display text-1xl text-ink text-left">A. Broad Internal Visibility &#40;Important Disclosure&#41;</h2>
                    <p className="text-ink-muted text-left">
                        Unlike traditional social networks, this platform is designed as an open campus directory to maximize student connection. By creating an account, you explicitly acknowledge and agree that your profile is visible to any other user signed in with a University of Minnesota Twin Cities Google account &#40;@umn.edu&#41;. This visibility is limited to your name and any profile fields you choose to complete &#40;most of which can be hidden individually in your settings&#41; — it does not include your password or Google authentication tokens, which we never possess. <span className="font-bold">Your email address is never displayed to other members</span>, though a member who already knows your @umn.edu address can use it to find your profile through the people search.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">B. Purpose of Sharing</h2>
                    <p className="text-ink-muted text-left">
                        This visibility is intended solely to allow other members to recognize classmates, coordinate schedules, and arrange academic meetups. We do not independently verify anyone&rsquo;s identity or student status.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">C. User Responsibility</h2>
                    <p className="text-ink-muted text-left">
                        You are responsible for the information you choose to post in your public profile. Because any signed-in member can view your profile, we strongly advise against posting highly sensitive personal details &#40;such as your physical home address or phone number&#41; in open text areas.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">D. Anti-Scraping and Bulk Harvesting Controls</h2>
                    <p className="text-ink-muted text-left">
                        Access to the member directory is limited to accounts that sign in with an @umn.edu Google account. We also apply the following measures to reduce the risk of data harvesting:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Message sending is rate-limited on our server to slow automated abuse.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Signed-in areas of the site &#40;including profiles and the people search&#41; are excluded from search-engine indexing.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Mass copying, automated scraping, bulk export, or programmatic harvesting of other members&rsquo; profile data is strictly prohibited by our Terms of Service and will result in immediate and permanent account termination.
                    </p>
                    
            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">3. How We Use Your Information</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We use the information we collect to:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - Restrict platform access to accounts that sign in with a University of Minnesota Twin Cities Google account &#40;@umn.edu&#41;.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - Operate, maintain, and improve the matching and chat functionalities of the platform. Facilitate peer-to-peer communication and meetup scheduling.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - Facilitate peer-to-peer communication and meetup scheduling.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - Monitor and analyze usage trends to optimize database performance via Supabase and Vercel.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - Maintain user safety, investigate harassment or platform abuse, and enforce our Terms of Service.
                </p>
                
            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">4. User Safety, Moderation, and Administrative Review</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We prioritize a safe environment for student collaboration. To ensure platform safety, we implement the following protocols:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">User Controls:</span> You can block or report another member directly within the application interface at any time.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Automated language filter.</span> Chat messages and some text fields are passed through an automated profanity filter that masks certain words before the message is stored. Whenever the filter changes a message, we automatically keep a moderation record containing both the masked version everyone saw and the original text you typed. This happens for every filtered message, not only reported ones — it is how we detect deliberate attempts to evade the filter. These records are readable by platform administrators and are retained no longer than the limit in Section 6.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Administrative Chat Review:</span> Chats are private between participants during normal use, but they are not anonymous or guaranteed confidential. To investigate a report of a Terms of Service violation &#40;harassment, threats, scams, safety concerns&#41;, or to comply with a legal request, platform administrators may access and review the relevant messages and account activity.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">5. How We Share Your Information</h2>
                <p className="mt-4 text-ink-muted text-left">
                    Aside from the intentional peer-to-peer visibility detailed in Section 2, we do not sell, rent, or trade your personal data, and we do not use it for targeted advertising or for profiling that produces legal or similarly significant effects. We share your information only with the service providers we need to run the platform:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Vercel</span> &#40;hosting&#41; and <span className="font-bold">Supabase</span> &#40;database and authentication&#41; process and store your data on our behalf.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Resend</span> &#40;email delivery&#41; sends the notification and meetup emails you have not turned off, and &#8212; if configured &#8212; an internal alert to our team when a report is filed. To send an email, Resend receives the recipient&rsquo;s email address and display name and the contents of that message &#40;a meetup email includes the meetup time and location and the names of members who have RSVP&rsquo;d; a report alert includes the reason selected and any description the reporter wrote&#41;. If email is not configured, no email is sent and Resend receives nothing.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Legal Requirements:</span> We may disclose your information if required to do so by law, court order, or a government request, or if we believe such action is necessary to protect member safety or investigate platform abuse.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">6. Data Retention and Deletion Policy</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We keep personal data only while we have a use for it. Most categories of stored data are subject to a single retention limit — currently 365 days — after which they are automatically and permanently purged by a scheduled job. The course catalog and the list of eligible email domains are kept indefinitely; they are not personal data.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Deleting your account — what happens right away.</span> When you delete your account we replace your name with &ldquo;Deleted User&rdquo; and erase your bio, academic details, links, and settings; we remove you from every group &#40;transferring or disbanding groups you managed&#41;; we cancel every pending request involving you; and we delete your meetup RSVPs, poll votes, and notifications. Your Google sign-in link is destroyed at this point, which is why deletion <span className="font-bold">cannot be undone</span> — signing in again later creates a brand-new, separate account.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Messages you already sent.</span> Messages you sent stay visible to the people and groups you sent them to, shown as coming from &ldquo;Deleted User.&rdquo; Each message is deleted about 365 days after it was originally sent.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">What we keep for up to 365 days after deletion, then permanently purge.</span> A minimal internal record that the account existed; your course list and your connection &#40;friend, study-buddy, and block&#41; records, with your identity already removed from them; and — in a separate, access-restricted store that is never shown in the app or the admin tools — your real email address. We retain the email address only to enforce account bans and prevent ban evasion, to act on abuse or safety reports filed shortly before or after a deletion, and to respond to a lawful preservation request or subpoena received during that period.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">7. Children's Privacy and Age Considerations</h2>
                <h2 className="mt-4 font-display text-1xl text-ink text-left">A. Strict COPPA Compliance</h2>
                    <p className="text-ink-muted text-left">
                        Our Service is strictly intended for individuals who are 13 years of age or older. When you sign in, you must confirm that you are at least 13 years old. We do not knowingly collect, maintain, or solicit personal information from children under the age of 13.
                    </p>
                    <p className="mt-4 text-ink-muted text-left">
                        If you are a parent or legal guardian and believe your child under 13 has created an account, please contact us immediately at the email listed at the bottom of this page. If we learn or suspect that we have inadvertently collected personal data from a child under 13, we will lock the profile and permanently delete all associated data from our Supabase backend infrastructure immediately.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">B. University Affiliation and Age</h2>
                    <p className="text-ink-muted text-left">
                        This Service authenticates users through &ldquo;Sign in with Google&rdquo; using an @umn.edu account. Google does not confirm anyone&rsquo;s age to us, and an @umn.edu account does not confirm current student status. As a result, some users of this Service — for example, students enrolled through PSEO or other dual-enrollment programs — may be under 18. Because members' names and profile information are visible to other signed-in members &#40;see Section 2&#41;, and because chat features allow direct peer-to-peer communication, users under 18 and their parents or guardians should be aware of this visibility before creating a profile or engaging in chats. We do not have any mechanism to verify a user&rsquo;s age or to restrict or flag underage accounts.
                    </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">8. Family Educational Rights and Privacy Act &#40;FERPA&#41; Disclaimer</h2>
                <p className="mt-4 text-ink-muted text-left">
                    This platform is an independent student-to-student matching tool and is not officially sponsored, endorsed, or operated by your university or college administration.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    <span className="font-bold">No Access to Official Records:</span> We do not pull, store, access, or modify official institutional academic records, grades, transcripts, GPA metrics, or official enrollment files protected under the Family Educational Rights and Privacy Act &#40;FERPA&#41;.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    <span className="font-bold">Not a school official:</span> The people who run this Service are not employees, agents, contractors, or &ldquo;school officials&rdquo; of the University of Minnesota, and the Service is not authorized by the University to act on its behalf or to receive information from any University system.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    <span className="font-bold">User-Generated Academic Data:</span> Any academic information displayed on your profile &#40;such as your major or current courses&#41; is entirely self-reported and voluntarily provided by you. It does not constitute an official educational record. The University of Minnesota does not endorse, operate, sponsor, or have administrative access to this platform, and this platform does not report, share, or transmit any user data back to the University. Any reference to &ldquo;University of Minnesota&rdquo; on this site refers only to the community it serves, not to institutional affiliation or endorsement.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">9. Your Privacy Rights</h2>
                <p className="mt-4 text-ink-muted text-left">
                    Regardless of where you live, you have the right to:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Access</span> the personal information we hold about you, and confirm whether we are processing it.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Correct</span> inaccurate profile or account information &#40;most fields you can edit yourself under Edit profile&#41;.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Delete</span> your account and the data tied to it at any time &#40;see Section 6&#41;.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Obtain a copy</span> of the profile and content data you provided, in a portable, machine-readable format.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    We do <span className="font-bold">not</span> sell your personal data, use it for targeted advertising, or use it for profiling that produces legal or similarly significant effects, so there is nothing to opt out of in those categories.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">How to make a request.</span> Email us at the address at the bottom of this page from &#8212; or naming &#8212; the @umn.edu address on your account &#40;this is how we verify the request is yours&#41;. We aim to respond within 45 days; if a request is complex we may take a reasonable extension and will tell you. There is no fee.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">If we say no.</span> If we decline a request, we will explain why. You may reply to <span className="font-bold">appeal</span> that decision and we will review it again. If you are still not satisfied, you may contact the <a target="_blank" href="https://www.ag.state.mn.us/" rel="noopener noreferrer" className="text-blue-500 font-bold">Minnesota Attorney General&rsquo;s Office</a>.
                </p>


            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">10. Security of Your Data</h2>
                <p className="mt-4 text-ink-muted text-left">
                    Your data is stored and transmitted using the security controls of our service providers &#40;Supabase, Vercel, and, for email, Resend&#41;, including encryption in transit and at rest. Access to member data on the administrative side is limited to the small team that runs the Service. No method of transmission or storage is 100% secure, and while we restrict entry to @umn.edu Google accounts, we cannot guarantee absolute security against unauthorized access or against another member misusing information you have made visible to them.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    If we become aware of a data breach affecting your personal information, we will notify affected users without unreasonable delay, and we will notify the Minnesota Attorney General&rsquo;s Office where and within the time required by Minnesota&rsquo;s data-breach-notification law &#40;Minn. Stat. § 325E.61&#41;.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">11. Changes to This Privacy Policy</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We may update this Privacy Policy from time to time. The "Last Updated" date at the top always reflects the current version. For a <span className="font-bold">material</span> change, the next time you open the app you will be shown a notice and asked to review and accept the updated documents before continuing, and we record when and which version you accept. For a minor change &#40;typos, clarifications&#41;, updating the date is the only notice. Contact us at the email below with any questions about a change.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Contact Us</h2>
            <p className="mt-4 text-ink-muted text-left">
                If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact us through our email:
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 text-blue-500 text-left font-bold">
              {CONTACT_EMAIL}
            </a>
        </div>
    </div>
  );
}