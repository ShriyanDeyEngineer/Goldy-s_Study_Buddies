/** This is the web page that display's our privacy policy for users */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Goldy's Study Buddies collects, uses, and protects your information.",
};

const CONTACT_EMAIL = "goldysstudybuddies@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 font-['Times_New_Roman']">
        <div className="mx-auto max-w-2xl">

            <h1 className="font-display text-4xl text-ink text-center">PRIVACY POLICY</h1>
            <h3 className="font-display text-1xl text-ink text-center">Last Updated: August 19, 2026</h3>

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
                <h2 className="mt-4 font-display text-1xl text-ink text-left">A. Information Provided via Single Sign-On &#40;SSO&#41;</h2>
                    <p className="text-ink-muted text-left">
                        To ensure a secure environment restricted to verified members of the University of Minnesota community, you must log in using your official university credentials via UMN's Single Sign-On &#40;SSO&#41; and Duo two-factor authentication. <span className="font-bold">We never see, receive, or store your university password.</span> Authentication is handled entirely by UMN's identity provider, which passes us a secure authentication token confirming your identity, along with the following attributes:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Official Name &#40;First and Last name&#41;.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Institutional Email Address &#40;your .edu email&#41;.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - University Affiliation UMN's Duo/SSO system is governed by the University's own privacy practices, not this policy. You can review those at <a target="_blank" href="https://twin-cities.umn.edu/privacy" className="text-blue-500 font-bold">UMN's Privacy Statement</a>. Additional info can be found at <a target="_blank" href="https://melphomebase.umn.edu/internet-identity-e-mail" className="text-blue-500 font-bold">UMN's Internet Identity & Email Policy</a>.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">B. Sign-In via Google</h2>
                    <p className="text-ink-muted text-left">
                        Authentication is provided through Sign in with Google, using your University of Minnesota Google Workspace &#40;.edu&#41; account. When you sign in, we request the following minimal scopes from your Google Account:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Your name.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Your .edu email address
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Your Google account ID &#40;used to link your session&#41; We do not request or access your Google Calendar, Google Drive, Gmail content, or any other Google service beyond basic sign-in identification. Our use and transfer of information received from Google APIs adheres to the <a target="_blank" href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-500 font-bold">Google API Services User Data Policy</a>, including the Limited Use requirements. You can review or revoke this Service's access to your Google Account at any time at <a target="_blank" href="https://myaccount.google.com/connections?filters=3,4&hl=en" className="text-blue-500 font-bold">Google Account Permissions</a> — this is independent of deleting your account on our platform &#40;see Section 6&#41;.
                    </p>
                
                <h2 className="mt-4 font-display text-1xl text-ink text-left">C. User Profile & Platform Data</h2>
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
                        - <span className="font-bold">Communication Content:</span> Real-time chat messages, text, and media exchanged with other users within the platform's chat features.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">D. Automatically Collected Technical Data</h2>
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
                        Unlike traditional social networks, this platform is designed as an open campus directory to maximize student connection. By creating an account, you explicitly acknowledge and agree that your contact information &#40;including your official name and university email address&#41; is visible to any other user who is successfully logged into the website via verified university credentials from your institution. This visibility is limited to your name, university email, and any profile fields you choose to complete — it does not include authentication credentials, which we never possess.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">B. Purpose of Sharing</h2>
                    <p className="text-ink-muted text-left">
                        This exposure is intended solely to allow verified peers to directly coordinate schedules, verify your student identity, and establish off-platform contact for academic meetups.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">C. User Responsibility</h2>
                    <p className="text-ink-muted text-left">
                        You are responsible for the information you choose to post in your public profile. Because any authenticated student can view your contact details, we strongly advise against posting highly sensitive personal details &#40;such as your physical home address or phone number&#41; in open text areas.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">D. Anti-Scraping and Bulk Harvesting Controls</h2>
                    <p className="text-ink-muted text-left">
                        While access to the directory is restricted to users with verified university credentials, we recognize the risk of data harvesting. To protect student privacy:
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - We employ automated database rate-limiting and firewalls to detect and block abnormal profile viewing patterns.
                    </p>
                    <p className="mt-2 text-ink-muted text-left">
                        - Mass copying, automated scraping, or exporting of student contact lists from this platform is strictly prohibited and constitutes a violation of our Terms of Service. Doing so will result in immediate and permanent account termination.
                    </p>
                    
            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">3. How We Use Your Information</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We use the information we collect to:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - Authenticate your identity and restrict platform access exclusively to active, verified university students.
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
                    - <span className="font-bold">User Controls:</span> Users have the right and ability to block or report other students directly within the application interface at any time.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Administrative Chat Review:</span> To investigate reported violations of our Terms of Service &#40;such as harassment, threats, scams, or safety concerns&#41;, platform administrators explicitly reserve the right to access and review chat transcripts and logs. Chats are not entirely private from administrators if a safety report is flagged. A note on chat privacy: Chats on this platform are private between participants during normal use, but they are not anonymous or guaranteed confidential. If a chat is reported for a Terms of Service violation, platform administrators may review the relevant chat logs to investigate.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">5. How We Share Your Information</h2>
                <p className="mt-4 text-ink-muted text-left">
                    Aside from the intentional peer-to-peer visibility detailed in Section 2, we do not sell, rent, or trade your personal data. We share your information only with essential service providers:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Cloud Infrastructure Providers:</span> Your data is processed and securely hosted using Vercel &#40;for frontend deployment&#41; and Supabase &#40;for database management and authentication&#41;.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Legal Requirements:</span> We may disclose your information if required to do so by law, court order, or a government request, or if we believe such action is necessary to protect student safety or investigate platform abuse.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">6. Data Retention and Deletion Policy</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We practice data minimization and do not hold onto student records longer than operationally necessary:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Account Deletion:</span> If you choose to delete your account, your profile data, match history, and chat logs will be permanently deleted immediately from our live database systems. This action is irreversible.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Account Inactivity Purge:</span> Any user account that remains completely inactive for more than 24 consecutive months will be flagged as abandoned and its associated profile and chat information will be automatically and permanently purged from our Supabase database.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">7. Children's Privacy and Age Considerations</h2>
                <h2 className="mt-4 font-display text-1xl text-ink text-left">A. Strict COPPA Compliance</h2>
                    <p className="text-ink-muted text-left">
                        Our Service is strictly intended for individuals who are 13 years of age or older. We do not knowingly collect, maintain, or solicit personal information from children under the age of 13.
                    </p>
                    <p className="mt-4 text-ink-muted text-left">
                        If you are a parent or legal guardian and believe your child under 13 has bypassed our university verification mechanics and created an account, please contact us immediately at the email listed at the bottom of this page. If we learn or suspect that we have inadvertently collected personal data from a child under 13, we will lock the profile and permanently delete all associated data from our Supabase backend infrastructure immediately.
                    </p>

                <h2 className="mt-4 font-display text-1xl text-ink text-left">B. University Affiliation and Age</h2>
                    <p className="text-ink-muted text-left">
                        This Service authenticates users through UMN's SSO system, which we do not control and which does not confirm age to us. As a result, some users of this Service — for example, students enrolled through PSEO or other dual-enrollment programs — may be under 18. Because authenticated users' names, university email addresses, and profile information are visible to other verified members of the community &#40;see Section 2&#41;, and because chat features allow direct peer-to-peer communication, users under 18 and their parents or guardians should be aware of this visibility before creating a profile or engaging in chats. We do not have a separate verification mechanism to restrict or flag underage accounts beyond standard UMN SSO enrollment status.
                    </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">8. Family Educational Rights and Privacy Act &#42;FERPA&#41; Disclaimer</h2>
                <p className="mt-4 text-ink-muted text-left">
                    This platform is an independent student-to-student matching tool and is not officially sponsored, endorsed, or operated by your university or college administration.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    <span className="font-bold">No Access to Official Records:</span> We do not pull, store, access, or modify official institutional academic records, grades, transcripts, GPA metrics, or official enrollment files protected under the Family Educational Rights and Privacy Act &#40;FERPA&#41;.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    <span className="font-bold">User-Generated Academic Data:</span> Any academic information displayed on your profile &#40;such as your major or current courses&#41; is entirely self-reported and voluntarily provided by you. It does not constitute an official educational record. The University of Minnesota does not endorse, operate, sponsor, or have administrative access to this platform, and this platform does not report, share, or transmit any user data back to the University. Any reference to "University of Minnesota" on this site refers only to the community it serves, not to institutional affiliation or endorsement.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">9. Your Privacy Rights</h2>
                <p className="mt-4 text-ink-muted text-left">
                    You have the right to:
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Access</span> the personal information we hold about you.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Correct</span> inaccurate profile or account information.
                </p>
                <p className="mt-2 text-ink-muted text-left">
                    - <span className="font-bold">Delete</span> your account and associated data at any time &#40;see Section 6&#41; To exercise any of these rights, email us at the address listed in Section 11 with your request and the university email associated with your account. We will respond within 30 days.
                </p>


            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">10. Security of Your Data</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We employ industry-standard security protocols through Supabase and Vercel to protect your data during transit and at rest. However, please remember that no method of transmission over the Internet or electronic storage is 100% secure. While we restrict entry to verified university credentials, we cannot guarantee absolute security against unauthorized access or account compromise by authenticated peers.
                </p>
                <p className="mt-4 text-ink-muted text-left">
                    In the event of a data breach affecting your personal information, we will notify affected users and, where required, the Minnesota Attorney General's Office, in accordance with Minnesota's data breach notification law &#40;Minn. Stat. § 325E.61&#41;.
                </p>

            <br></br>
            <br></br>

            <h2 className="font-display text-2xl text-ink text-left">11. Changes to This Privacy Policy</h2>
                <p className="mt-4 text-ink-muted text-left">
                    We may update this Privacy Policy from time to time. We will notify you of any material changes by updating the "Last Updated" date at the top of this policy and, where appropriate, posting a prominent notice on the platform website.
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