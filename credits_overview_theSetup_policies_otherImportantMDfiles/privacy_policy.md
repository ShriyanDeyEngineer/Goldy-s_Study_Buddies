# Privacy Policy
 
**Last Updated: August 19, 2026**
 
This Service is an independent, non-commercial project created by University of Minnesota students and is not a registered business entity.
 
Welcome to our Study Buddy platform (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website.
 
Please read this Privacy Policy carefully. By accessing or using the Service, you agree to the terms of this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access the Service.
 
---

## 1. Information We Collect
 
### A. Information Provided via Single Sign-On (SSO)
To ensure a secure environment restricted to verified members of the University of Minnesota community, you must log in using your official university credentials via UMN's Single Sign-On (SSO) and Duo two-factor authentication. **We never see, receive, or store your university password.** Authentication is handled entirely by UMN's identity provider, which passes us a secure authentication token confirming your identity, along with the following attributes:
* Official Name (First and Last name)
* Institutional Email Address (your `.edu` email)
* University Affiliation
UMN's Duo/SSO system is governed by the University's own privacy practices, not this policy. You can review those at https://twin-cities.umn.edu/privacy. Additional info can be found at https://melphomebase.umn.edu/internet-identity-e-mail

### B. Sign-In via Google
Authentication is provided through **Sign in with Google**, using your University of Minnesota Google Workspace (`.edu`) account. When you sign in, we request the following minimal scopes from your Google Account:
* Your name
* Your `.edu` email address
* Your Google account ID (used to link your session)
We do **not** request or access your Google Calendar, Google Drive, Gmail content, or any other Google service beyond basic sign-in identification. Our use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. You can review or revoke this Service's access to your Google Account at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) — this is independent of deleting your account on our platform (see Section 6).
 
*(If the Service ever requests broader scopes than basic sign-in — Calendar, Drive, Contacts, etc. — this section needs to list each scope and its specific purpose, since Google's policy requires scope-by-scope disclosure, not a general statement.)*
 
### C. User Profile & Platform Data
Once authenticated, you may choose or be required to provide additional information to facilitate matchings, including:
* **Academic Information:** Major, current courses, and academic interests.
* **Meetup & Schedule Data:** Availability, study preferences, and proposed meetup locations or times.
* **Communication Content:** Real-time chat messages, text, and media exchanged with other users within the platform's chat features.

### D. Automatically Collected Technical Data
Our infrastructure relies on third-party services to host and power the platform. We collect technical logs automatically via:
* **Vercel (Hosting & Metrics):** IP addresses, browser types, operating systems, access times, and pages viewed directly before and after accessing the Service.
* **Supabase (Database & Authentication Backend):** Secure authentication tokens, user IDs, query timestamps, and structural operational logs.
*(If the Service uses cookies or local storage beyond the SSO authentication token — e.g. for session persistence or analytics — disclose that here.)*

---

## 2. Dynamic Data Visibility and Peer Sharing
 
### A. Broad Internal Visibility (Important Disclosure)
Unlike traditional social networks, this platform is designed as an open campus directory to maximize student connection. **By creating an account, you explicitly acknowledge and agree that your contact information (including your official name and university email address) is visible to any other user who is successfully logged into the website via verified university credentials from your institution.** This visibility is limited to your name, university email, and any profile fields you choose to complete — it does not include authentication credentials, which we never possess.

### B. Purpose of Sharing
This exposure is intended solely to allow verified peers to directly coordinate schedules, verify your student identity, and establish off-platform contact for academic meetups.

### C. User Responsibility
You are responsible for the information you choose to post in your public profile. Because any authenticated student can view your contact details, we strongly advise against posting highly sensitive personal details (such as your physical home address or phone number) in open text areas.

### D. Anti-Scraping and Bulk Harvesting Controls
While access to the directory is restricted to users with verified university credentials, we recognize the risk of data harvesting. To protect student privacy:
* We employ automated database rate-limiting and firewalls to detect and block abnormal profile viewing patterns.
* Mass copying, automated scraping, or exporting of student contact lists from this platform is strictly prohibited and constitutes a violation of our Terms of Service. Doing so will result in immediate and permanent account termination.

---

## 3. How We Use Your Information
We use the information we collect to:
* Authenticate your identity and restrict platform access exclusively to active, verified university students.
* Operate, maintain, and improve the matching and chat functionalities of the platform.
* Facilitate peer-to-peer communication and meetup scheduling.
* Monitor and analyze usage trends to optimize database performance via Supabase and Vercel.
* Maintain user safety, investigate harassment or platform abuse, and enforce our Terms of Service.

---

## 4. User Safety, Moderation, and Administrative Review
We prioritize a safe environment for student collaboration. To ensure platform safety, we implement the following protocols:
* **User Controls:** Users have the right and ability to block or report other students directly within the application interface at any time.
* **Administrative Chat Review:** To investigate reported violations of our Terms of Service (such as harassment, threats, scams, or safety concerns), platform administrators explicitly reserve the right to access and review chat transcripts and logs. **Chats are not entirely private from administrators if a safety report is flagged.**
**A note on chat privacy:** Chats on this platform are private between participants during normal use, but they are not anonymous or guaranteed confidential. If a chat is reported for a Terms of Service violation, platform administrators may review the relevant chat logs to investigate. *(This notice should also be surfaced as a standalone prompt at account creation or first chat use, not only here.)*
---

## 5. How We Share Your Information
Aside from the intentional peer-to-peer visibility detailed in Section 2, we do not sell, rent, or trade your personal data. We share your information only with essential service providers:
* **Cloud Infrastructure Providers:** Your data is processed and securely hosted using **Vercel** (for frontend deployment) and **Supabase** (for database management and authentication).
* **Legal Requirements:** We may disclose your information if required to do so by law, court order, or a government request, or if we believe such action is necessary to protect student safety or investigate platform abuse.

---

## 6. Data Retention and Deletion Policy
We practice data minimization and do not hold onto student records longer than operationally necessary:
* **Account Deletion:** If you choose to delete your account, your profile data, match history, and chat logs will be **permanently deleted immediately** from our live database systems. This action is irreversible.
* **Account Inactivity Purge:** Any user account that remains completely **inactive for more than 24 consecutive months** will be flagged as abandoned and its associated profile and chat information will be automatically and permanently purged from our Supabase database.

---

## 7. Children's Privacy and Age Considerations
 
### A. Strict COPPA Compliance
Our Service is strictly intended for individuals who are **13 years of age or older**. We do not knowingly collect, maintain, or solicit personal information from children under the age of 13.
 
If you are a parent or legal guardian and believe your child under 13 has bypassed our university verification mechanics and created an account, please contact us immediately at the email listed in Section 11. If we learn or suspect that we have inadvertently collected personal data from a child under 13, we will lock the profile and permanently delete all associated data from our Supabase backend infrastructure immediately.

### B. University Affiliation and Age
This Service authenticates users through UMN's SSO system, which we do not control and which does not confirm age to us. As a result, some users of this Service — for example, students enrolled through PSEO or other dual-enrollment programs — may be under 18. Because authenticated users' names, university email addresses, and profile information are visible to other verified members of the community (see Section 2), and because chat features allow direct peer-to-peer communication, users under 18 and their parents or guardians should be aware of this visibility before creating a profile or engaging in chats. We do not have a separate verification mechanism to restrict or flag underage accounts beyond standard UMN SSO enrollment status.

---

## 8. Family Educational Rights and Privacy Act (FERPA) Disclaimer
This platform is an independent student-to-student matching tool and is not officially sponsored, endorsed, or operated by your university or college administration.
* **No Access to Official Records:** We do not pull, store, access, or modify official institutional academic records, grades, transcripts, GPA metrics, or official enrollment files protected under the Family Educational Rights and Privacy Act (FERPA).
* **User-Generated Academic Data:** Any academic information displayed on your profile (such as your major or current courses) is entirely self-reported and voluntarily provided by you. It does not constitute an official educational record.
The University of Minnesota does not endorse, operate, sponsor, or have administrative access to this platform, and this platform does not report, share, or transmit any user data back to the University. Any reference to "University of Minnesota" on this site refers only to the community it serves, not to institutional affiliation or endorsement.

---

## 9. Your Privacy Rights
You have the right to:
* **Access** the personal information we hold about you
* **Correct** inaccurate profile or account information
* **Delete** your account and associated data at any time (see Section 6)
To exercise any of these rights, email us at the address listed in Section 11 with your request and the university email associated with your account. We will respond within [insert timeframe, e.g. "30 days"].

---

## 10. Security of Your Data
We employ industry-standard security protocols through Supabase and Vercel to protect your data during transit and at rest. However, please remember that no method of transmission over the Internet or electronic storage is 100% secure. While we restrict entry to verified university credentials, we cannot guarantee absolute security against unauthorized access or account compromise by authenticated peers.
 
In the event of a data breach affecting your personal information, we will notify affected users and, where required, the Minnesota Attorney General's Office, in accordance with Minnesota's data breach notification law (Minn. Stat. § 325E.61).

---

## 11. Changes to This Privacy Policy
We may update this Privacy Policy from time to time. We will notify you of any material changes by updating the "Last Updated" date at the top of this policy and, where appropriate, posting a prominent notice on the platform website.

---
 
## 12. Contact Us
If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact the platform administrator at:
* **Email:** goldysstudybuddies@gmail.com