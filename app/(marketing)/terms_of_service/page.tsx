/** This is the web page that display's our terms and conditions for users */

import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "More legal materials.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 font-['Times_New_Roman']">
        <div className="mx-auto max-w-2xl">

            <h1 className="font-display text-4xl text-ink text-center">TERMS & CONDITIONS</h1>
            <h3 className="font-display text-1xl text-ink text-center">Last Updated: August 31, 2026</h3>

            <p className="mt-4 text-ink-muted text-left">
                This Service is an independent, non-commercial project created by University of Minnesota students and is not a registered business entity, and is not officially sponsored, endorsed, or operated by the University of Minnesota.
            </p>
            <p className="mt-4 text-ink-muted text-left">
                Please read these Terms of Service "Terms" carefully before using Study Buddies &#40;the "Service"&#41;. <span className="font-bold">BY CREATING AN ACCOUNT OR OTHERWISE ACCESSING THE SERVICE, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE, DO NOT USE THE SERVICE.</span>
            </p>
            <p className="mt-4 text-ink-muted text-left">
                These Terms should be read together with our <a target="_self" href="/privacy_policy" className="text-blue-500 font-bold">Privacy Policy</a>, which explains how we collect and use your information.
            </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">1. Eligibility and Account Registration</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Google Sign-In Only.</span> The Service is accessed exclusively through "Sign in with Google" using your University of Minnesota Twin Cities &#40;@umn.edu&#41; Google Workspace account. There is no separate username/password system. Our server checks that your account's email address ends in "@umn.edu" and refuses the sign-up otherwise.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">What the @umn.edu check does and does not mean.</span> An @umn.edu Google account is issued by the University to students, faculty, staff, and other affiliates. We verify only that your account's email domain is umn.edu. We do not verify your enrollment status, your role at the University, or your identity, and this Service is not connected to any University system. You should use your own judgment when deciding whether to share information with, or meet, another user.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">One Account Per Person.</span> You may not create or maintain more than one account, and you may not create an account on behalf of another person.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Accuracy of Information.</span> You agree that any information you provide &#40;profile details, academic information, availability&#41; is accurate and that you will keep it reasonably up to date.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Age.</span> The Service authenticates users through "Sign in with Google," which does not verify age to us. When you create an account you must confirm that you are at least 13 years old; if you are under 13 you may not use the Service &#40;see our Privacy Policy, Section 7&#41;. If you are between 13 and 18, please review the Privacy Policy's disclosures about profile visibility and chat features with a parent or guardian before using the Service.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">2. The Service</h2>
                <p className="mt-4 text-ink-muted text-left">
                    The Service allows people with a University of Minnesota Twin Cities Google account &#40;@umn.edu&#41; to create a profile, be matched with peers for study groups, and communicate via in-platform chat to coordinate meetups. The Service is provided for <span className="font-bold">academic coordination purposes only</span> and is not a general-purpose social network or dating platform.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">3. Acceptable Use</h2>
                <p className="mt-4 text-ink-muted text-left">
                    By using the Service, <span className="font-bold">you agree that you will not:</span>
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Impersonate another person or misrepresent your identity, major, courses, or academic affiliation.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Harass, threaten, stalk, or abuse another user, on or off the platform.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Use the Service to solicit, advertise, or sell products or services unrelated to academic study coordination.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Attempt to scrape, bulk-download, mass-export, or programmatically harvest other users' contact information or profile data &#40;see our Privacy Policy, Section 2D&#41;. Doing so will result in immediate and permanent account termination.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Attempt to bypass, disable, or interfere with the Service's authentication, rate-limiting, or security systems.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Post another person's private contact information &#40;phone number, home address, etc.&#41; without their consent.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Post or link to content that infringes someone else's copyright, trademark, or other intellectual-property rights &#40;see Section 4&#41;.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Post, share, or link to content that is illegal under United States or Minnesota law, including threats of violence, non-consensual intimate imagery, or content that sexually exploits, endangers, or sexualizes a minor.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    - Use the Service for any other unlawful purpose, or in violation of any applicable University of Minnesota policy or student conduct code that applies to you.
                </p>
                <p className="mt-4 text-ink-muted text-left font-bold">We reserve the right to suspend or terminate any account that violates these Terms, with or without notice, at our sole discretion.</p>

                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Child safety.</span> We have zero tolerance for content or conduct that sexually exploits or endangers a minor. We report suspected child sexual abuse material to the National Center for Missing &amp; Exploited Children &#40;NCMEC&#41; CyberTipline and cooperate with law enforcement. We may preserve account information and content connected to any report or investigation, including after an account has been deleted.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">4. User Content</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Ownership.</span> You retain ownership of any content you post &#40;profile information, chat messages, etc.&#41;. By posting content, you grant us a limited license to store, display, and transmit that content solely for the purpose of operating the Service.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Responsibility.</span> You are solely responsible for the content you post. We apply an automated language filter to chat messages and to certain text fields, but we do not otherwise review content before it is posted, and we are not responsible for the accuracy, legality, or appropriateness of user-submitted content.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Removal.</span> We may remove content or restrict an account at any time if we reasonably believe it violates these Terms or applicable law.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Copyright.</span> Do not post or link to content that infringes someone else&rsquo;s copyright or other intellectual-property rights. If you believe content on the Service infringes your copyright, email us at the address at the bottom of these Terms with: your contact information, identification of the work you say is infringed, the location of the infringing material on the Service &#40;enough for us to find it&#41;, and a statement that you have a good-faith belief the use is not authorized. We will remove or disable access to material we determine is infringing, and we terminate the accounts of users who repeatedly infringe. If your content was removed and you believe that was a mistake, email us and we will review it. &#40;We are working on registering a designated copyright agent with the U.S. Copyright Office; until then, please use the email address below.&#41;
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">5. Safety, Reporting, and Moderation</h2>
                <p className="mt-4 text-ink-muted text-left">
                    You may block or report another user directly within the Service at any time.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    We reserve the right to review chat logs and other account activity when investigating a reported violation of these Terms, as described in our Privacy Policy, Section 4.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    We are not responsible for the conduct of any user, on or off the platform, including at in-person meetups arranged through the Service. <span className="font-bold">You are solely responsible for your own safety when meeting other users in person, and we strongly encourage meeting in public, well-lit campus locations, especially for a first meetup.</span>
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">6. Third-Party Services</h2>
                <p className="mt-4 text-ink-muted text-left">
                    The Service relies on the following third-party providers to operate:
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Google —</span> for authentication &#40;"Sign in with Google"&#41;.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Supabase —</span> for database and authentication backend infrastructure.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Vercel —</span> for hosting.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Resend —</span> for delivering notification and meetup emails &#40;when email is configured&#41;.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    Your use of these providers' underlying services is also subject to their own terms and privacy policies. We are not responsible for outages, data handling, or policy changes made by these third parties.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">7. Disclaimers</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED</span>, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or secure, or that any match, meetup, or interaction arranged through the Service will be safe, successful, or appropriate.
                </p>
                <p className="mt-4 text-ink-muted text-left font-bold">
                    This Service is run as an independent student project without a dedicated support team, uptime guarantee, or service-level commitment.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    We have no obligation to maintain, update, correct, or provide support for the Service, and we may change, suspend, limit, or discontinue the Service or any part of it at any time, for any reason, without notice or liability to you.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">8. Limitation of Liability</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">TO THE FULLEST EXTENT PERMITTED BY LAW</span>, the creators of this Service will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, arising out of or related to your use of the Service — including but not limited to harm arising from interactions, meetups, or communications with other users. Because this Service is offered free of charge and operated as an independent, non-commercial student project, our total liability for any claim relating to the Service is limited to the fullest extent permitted under Minnesota law.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">9. Indemnification</h2>
                <p className="mt-4 text-ink-muted text-left">
                    You agree to indemnify and hold harmless the creators of this Service from any claims, damages, losses, or expenses &#40;including reasonable attorneys' fees&#41; arising out of your use of the Service, your violation of these Terms, or your interactions with other users.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">10. Account Termination</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">By You.</span> You may delete your account at any time. Deletion immediately removes your name and profile details, removes you from all groups, and destroys your sign-in link, so it <span className="font-bold">cannot be undone</span>. Messages you already sent remain visible to their recipients as coming from &ldquo;Deleted User,&rdquo; and a limited residual record &#40;including your email address&#41; is retained for a period and then permanently purged. See Privacy Policy, Section 6 for the full details and timelines.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">By Us.</span> We may suspend or terminate your account at any time, with or without cause or notice, including for violations of Section 3 &#40;Acceptable Use&#41;.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">11. Changes to These Terms</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We may update these Terms, the Privacy Policy, and the Community Guidelines from time to time. The "Last Updated" date above always reflects the current version. For a <span className="font-bold">material</span> change, the next time you open the app you will be shown a short notice and asked to review and accept the updated documents before you can continue using the Service; we record when and which version you accept. For a minor change &#40;typos, clarifications&#41;, updating the date is the only notice. If you do not accept a required update, you may stop using the Service and delete your account.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">12. Governing Law and Disputes</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Governing law.</span> These Terms are governed by the laws of the State of Minnesota, without regard to its conflict-of-law principles, and without prejudice to any consumer-protection rights you may have under the laws of your place of residence.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Talk to us first.</span> We are a small student team and we would rather resolve problems directly. Before starting any court action, you agree to first contact us at the email below with a description of the issue and what you would like us to do, and to give us at least 45 days to try to resolve it. Many issues can be handled this way.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Where disputes are heard.</span> If a dispute is not resolved informally, it must be brought exclusively in the state or federal courts located in Hennepin County, Minnesota, and you and we consent to the personal jurisdiction of those courts. &#40;This does not prevent either party from seeking an injunction or other equitable relief for matters such as intellectual-property misuse or unauthorized access.&#41;
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">No class actions.</span> To the fullest extent permitted by law, any claim relating to the Service must be brought in your individual capacity, and not as a plaintiff or class member in any purported class, consolidated, or representative proceeding.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Time limit.</span> Any claim relating to the Service must be filed within one &#40;1&#41; year after it arises, or it is permanently barred, unless a longer period is required by applicable law.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">13. General</h2>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Entire agreement.</span> These Terms, together with the Privacy Policy and Community Guidelines, are the entire agreement between you and us about the Service and replace any prior understanding.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Severability.</span> If any provision is found unenforceable, the rest stays in effect and the unenforceable provision is applied to the maximum extent permitted.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">No waiver.</span> If we do not enforce a provision, that is not a waiver of our right to enforce it later.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Assignment.</span> You may not transfer your account or your rights under these Terms. We may transfer ours to a successor that agrees to be bound by these Terms.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Feedback.</span> If you send us ideas or suggestions about the Service, we may use them without any obligation or payment to you.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Force majeure.</span> We are not responsible for any failure or delay caused by events beyond our reasonable control, including outages of the third-party services in Section 6.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    <span className="font-bold">Survival.</span> Sections 4 &#40;User Content&#41;, 5 &#40;Safety&#41;, 7 &#40;Disclaimers&#41;, 8 &#40;Limitation of Liability&#41;, 9 &#40;Indemnification&#41;, 12 &#40;Governing Law and Disputes&#41;, and this Section 13 survive termination of your account.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">Contact Us</h2>
            <p className="mt-4 text-ink-muted text-left">
                If you have any questions about these Terms, please contact us through our email:
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 text-blue-500 text-left font-bold">
              {CONTACT_EMAIL}
            </a>
        </div>
    </div>
  );
}