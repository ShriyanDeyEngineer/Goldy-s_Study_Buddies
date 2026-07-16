# Requirements Document

## Introduction

Goldy's Study Buddies is a dynamic web platform that helps University of Minnesota students find study partners and form or join study groups for their courses. The platform addresses a common challenge at UMN: students struggle to connect with peers for collaborative learning, especially in large general education and "weed out" STEM courses where resources from instructors may be limited. Students can authenticate via their @umn.edu email, discover study groups for their classes, connect with peers, coordinate meetups, and communicate through group chat. The platform is designed to scale to other universities in the future.

## Glossary

- **Platform**: The Goldy's Study Buddies web application as a whole.
- **User**: A registered student who has authenticated with a verified @umn.edu email address.
- **Guest**: An unauthenticated visitor browsing the public-facing pages of the Platform.
- **Group_Manager**: The User who created a Study Group and holds administrative permissions over it.
- **Study_Group**: A named collection of Users organized around a specific Course for collaborative study.
- **Course**: An existing UMN class (identified by department code and course number, e.g., CSCI 1133) that a Study_Group is associated with.
- **Study_Buddy**: A one-on-one study partner connection between two Users, not tied to a specific Study_Group.
- **Meetup**: A scheduled study session (online or in-person) associated with a Study_Group.
- **Friend**: A mutual peer connection between two Users on the Platform.
- **Friend_Request**: A pending invitation from one User to another to become Friends.
- **Profile**: A User's public-facing page displaying their academic and personal information.
- **Dashboard**: The primary authenticated landing page where a User accesses Study_Groups, searches for peers, and manages their activity.
- **Auth_Service**: The Supabase-based authentication and user account management service.
- **Notification_Service**: The email delivery service (Resend or SendGrid) responsible for sending automated email notifications.
- **Chat_Service**: The realtime messaging service (Supabase Realtime) powering Study_Group chat.
- **Admin**: A privileged platform operator responsible for reviewing reports and managing account suspensions or bans.
- **Report**: A User-submitted complaint about another User's behavior on the Platform.
- **Invitation**: A direct request sent by a Group_Manager or User to another User to join a Study_Group.

---

## Requirements

### Requirement 1: Public Marketing Pages

**User Story:** As a Guest, I want to browse public pages about the Platform, so that I can understand its purpose and decide whether to sign up.

#### Acceptance Criteria

1. THE Platform SHALL display a public Home page containing navigation links to the About Us page, the Why Use This Platform page, and the Testimonials page.
2. THE Platform SHALL make the About Us page, the Why Use This Platform page, and the Testimonials page individually accessible as public pages without requiring authentication.
3. THE Platform SHALL display Sign In and Sign Up buttons in the navigation header on all public pages, including the Home, About Us, Why Use This Platform, and Testimonials pages.
4. WHEN a Guest clicks the Sign Up button, THE Platform SHALL navigate the Guest to the account registration page.
5. WHEN a Guest clicks the Sign In button, THE Platform SHALL navigate the Guest to the login page.

---

### Requirement 2: User Registration and Authentication

**User Story:** As a prospective User, I want to create an account using my UMN email and a password, so that I can access the Platform securely.

#### Acceptance Criteria

1. WHEN a Guest submits a registration form, THE Auth_Service SHALL accept only email addresses ending in `@umn.edu`.
2. IF a Guest submits a registration form with an email address that does not end in `@umn.edu`, THEN THE Auth_Service SHALL reject the submission and display an error message stating that only UMN email addresses are accepted.
3. WHEN a Guest submits a registration form, THE Auth_Service SHALL require the password to be at least 12 characters long, contain at least one uppercase letter, one lowercase letter, one digit, and one special character.
4. IF a Guest submits a password that does not meet the criteria in criterion 3, THEN THE Auth_Service SHALL reject the submission and display a message listing the unmet password requirements.
5. WHEN a Guest successfully submits a valid registration form, THE Auth_Service SHALL send a verification email to the provided @umn.edu address before activating the account, and the verification link SHALL expire after 24 hours.
6. WHEN a Guest clicks a valid, unexpired verification link, THE Auth_Service SHALL activate the account and redirect the User to the Dashboard.
7. IF a Guest clicks a verification link that has expired or has already been used, THEN THE Auth_Service SHALL display an error message and offer the Guest an option to request a new verification email.
8. WHEN a registered User submits valid login credentials, THE Auth_Service SHALL authenticate the User and redirect the User to the Dashboard.
9. IF a User submits invalid login credentials, THEN THE Auth_Service SHALL reject the login attempt and display a generic error message without revealing which field was incorrect.
10. IF a User submits invalid login credentials 5 consecutive times, THEN THE Auth_Service SHALL lock the account for 15 minutes and display a message informing the User of the temporary lockout duration.
11. WHEN an authenticated User's session has been inactive for 30 consecutive minutes, THE Auth_Service SHALL invalidate the session and require the User to log in again.

---

### Requirement 3: User Profile

**User Story:** As a User, I want to maintain a profile with my academic and personal information, so that other students can learn about me and find compatible study partners.

#### Acceptance Criteria

1. THE Platform SHALL provide each User with a Profile containing: display name (1–50 characters), profile picture, college major, current classes (optional), classes already taken, future planned classes, a brief bio (maximum 500 characters), graduation date (month and year), number of Friends, and up to 5 social media links (each a valid URL, optional).
2. WHEN a User saves changes to their own Profile, THE Platform SHALL persist the updated Profile data and display the updated values within 2 seconds.
3. WHEN a User views another User's Profile, THE Platform SHALL display all Profile fields by default unless the viewed User has explicitly hidden specific fields; fields the viewed User has hidden SHALL NOT be shown to other Users.
4. WHEN a User uploads a profile picture, THE Platform SHALL accept files in JPEG or PNG format with a maximum file size of 5 MB.
5. IF a User uploads a profile picture that exceeds 5 MB or is not in JPEG or PNG format, THEN THE Platform SHALL reject the upload and display an error message describing the accepted formats and size limit.
6. IF a User's Profile save operation fails due to a server error, THEN THE Platform SHALL display an error message and preserve the User's unsaved input so the User can retry without re-entering data.

---

### Requirement 4: Dashboard

**User Story:** As a User, I want a central Dashboard where I can see available courses, my study groups, and access key features, so that I can efficiently manage my study activity.

#### Acceptance Criteria

1. WHEN an authenticated User opens the Dashboard, THE Platform SHALL display a list of Courses that have at least one Study_Group available to join or for which a new Study_Group can be created; IF no such Courses exist, THE Platform SHALL display a message prompting the User to create the first Study_Group.
2. WHEN a User selects a Course from the Dashboard, THE Platform SHALL display available Study_Groups for that Course and options to form a new Study_Group or join an existing one.
3. THE Dashboard SHALL display the User's currently enrolled Study_Groups, each showing the group name and current member count; IF the User is not enrolled in any Study_Groups, THE Platform SHALL display a message prompting the User to join or create a group.
4. THE Dashboard SHALL provide a search control for finding other Users by username or @umn.edu email address, accepting queries of up to 100 characters, and SHALL display matching User profiles inline below the search control upon submission.
5. THE Dashboard SHALL display a list of up to 10 suggested Users, prioritizing Users who share at least one Course with the authenticated User, followed by Users with the same graduation year as the authenticated User.

---

### Requirement 5: Study Group Creation

**User Story:** As a User, I want to create a Study_Group for a Course, so that I can organize collaborative study sessions with other students.

#### Acceptance Criteria

1. WHEN a User selects a Course and chooses to form a new Study_Group, THE Platform SHALL prompt the User to enter a group name (1–100 characters), select a maximum member capacity (between 2 and 50 inclusive), select an open or closed membership mode, and optionally select Users enrolled in that Course to invite immediately (up to capacity minus 1).
2. WHEN a User submits a valid Study_Group creation form, THE Platform SHALL create the Study_Group, assign the creating User as the Group_Manager, and navigate the User to the new Study_Group's page.
3. IF a User submits a Study_Group creation form with a group name that is empty or exceeds 100 characters, or with a capacity outside the range of 2 to 50, or without a membership mode selected, THEN THE Platform SHALL reject the submission and display a per-field error message identifying each invalid input.
4. IF a User selects a Course for which a Study_Group with the same name already exists, THEN THE Platform SHALL reject the submission and display an error message indicating the name is already taken for that Course.
5. IF a User includes invited Users who are not enrolled in the selected Course, THEN THE Platform SHALL reject the submission and display an error message identifying which invitees are not enrolled in the Course.
6. WHEN a Study_Group is created with invited Users, THE Notification_Service SHALL send an email Invitation to each invited User within 60 seconds of group creation.

---

### Requirement 6: Joining a Study Group

**User Story:** As a User, I want to join an existing Study_Group, so that I can collaborate with other students in a structured group.

#### Acceptance Criteria

1. WHEN a User attempts to join an open Study_Group that has not reached its maximum member capacity, THE Platform SHALL add the User to the Study_Group within 2 seconds and display a confirmation message to the User.
2. WHEN a User attempts to join a closed Study_Group, THE Platform SHALL allow the User to submit a join request, display a confirmation that the request has been sent, and THE Notification_Service SHALL send an email notification to the Group_Manager within 60 seconds.
3. IF a User attempts to submit a join request to a closed Study_Group for which the User already has a pending join request, THEN THE Platform SHALL reject the duplicate request and display a message informing the User that a request is already pending.
4. WHEN a Group_Manager approves a join request, THE Platform SHALL add the requesting User to the Study_Group and THE Notification_Service SHALL send a confirmation email to the requesting User within 60 seconds.
5. IF a Group_Manager approves a join request but the Study_Group has reached its maximum member capacity at the time of approval, THEN THE Platform SHALL reject the addition, notify the Group_Manager that the group is now full, and cancel the pending request.
6. WHEN a Group_Manager denies a join request, THE Platform SHALL remove the pending request and THE Notification_Service SHALL send a rejection email to the requesting User within 60 seconds.
7. IF a User attempts to join a Study_Group that has reached its maximum member capacity, THEN THE Platform SHALL reject the join attempt and display a message indicating the group is full.
8. IF a User is already a member of a Study_Group, THEN THE Platform SHALL not display a join option for that Study_Group to that User.

---

### Requirement 7: Study Group Management

**User Story:** As a Group_Manager, I want to manage my Study_Group's membership and settings, so that I can maintain a productive study environment.

#### Acceptance Criteria

1. THE Platform SHALL grant the Group_Manager exclusive permission to approve or deny join requests, remove members from the Study_Group, edit the group name (1–100 characters) and membership mode, and disband the Study_Group; no other member role SHALL have these permissions.
2. WHEN a Group_Manager removes a member from the Study_Group, THE Notification_Service SHALL send an email notification to the removed member within 60 seconds.
3. WHEN a Group_Manager disbands a Study_Group, THE Platform SHALL remove all members from the group, cancel all future Meetups, decline all pending join requests, and THE Notification_Service SHALL send an email notification to all former members within 60 seconds.
4. WHEN a Group_Manager changes the Study_Group membership mode from closed to open, THE Platform SHALL immediately allow any User who is enrolled in the associated Course and has not reached the group's maximum member capacity to join without approval; all pending join requests SHALL be automatically approved if capacity allows.
5. WHEN a User who is not the Group_Manager voluntarily leaves a Study_Group, THE Platform SHALL remove that User from the group; IF the group's membership mode is open and the group has not reached its maximum capacity, the User MAY rejoin without a new request.
6. WHEN the Group_Manager voluntarily leaves a Study_Group that has at least one other member, THE Platform SHALL transfer the Group_Manager role to the member who has been in the group the longest; IF two or more members share the same join date, THE Platform SHALL select the one whose user account was created earliest.
7. IF the Group_Manager leaves a Study_Group that has no other members, THEN THE Platform SHALL disband the Study_Group.

---

### Requirement 8: Study Group Dashboard (Group Page)

**User Story:** As a Study_Group member, I want a dedicated group page where I can communicate and coordinate with other members, so that group activities are organized in one place.

#### Acceptance Criteria

1. THE Platform SHALL display a Study_Group page containing the group name, a member list showing each member's display name and the total member count, a list of upcoming scheduled Meetups, and a group chat panel.
2. WHEN a Study_Group member sends a chat message, THE Chat_Service SHALL deliver the message to all currently connected members of that Study_Group within 2 seconds.
3. THE Chat_Service SHALL persist all chat messages and display the full message history in chronological order to members when they open the Study_Group page.
4. THE Platform SHALL display each upcoming Meetup with its title, date, time, format (online or in-person), location or meeting link (as applicable), and current attendance count showing the number of members who have indicated they are attending.
5. WHEN a Study_Group member sends a chat message exceeding 2,000 characters, THE Platform SHALL reject the message and display an error indicating the character limit.
6. IF a member is not connected to the Chat_Service when a message is sent, THE Chat_Service SHALL deliver all missed messages to that member upon their next connection to the Study_Group page.

---

### Requirement 9: Meetup Scheduling

**User Story:** As a Study_Group member, I want to schedule and view Meetups, so that the group can coordinate study sessions effectively.

#### Acceptance Criteria

1. WHEN a Study_Group member creates a Meetup, THE Platform SHALL require a title (1–100 characters), a date and time in the future (formatted as YYYY-MM-DD HH:MM in the user's local timezone), a format (online or in-person), and either a physical location or a meeting link based on the selected format.
2. WHEN a Meetup is created, THE Notification_Service SHALL send an email notification to all Study_Group members within 60 seconds.
3. WHEN a Study_Group member indicates attendance for a Meetup, THE Platform SHALL record that member's attendance status as one of: Attending, Not Attending, or Maybe, and update the displayed attendance count to reflect the number of members with status Attending.
4. WHERE Google Calendar integration is enabled, THE Platform SHALL allow a User to add a Meetup to the User's Google Calendar with a single action.
5. WHEN a Meetup's scheduled date and time have passed (at or after the exact scheduled date and time in UTC), THE Platform SHALL move the Meetup from the upcoming section to a past meetups section on the Study_Group page.
6. WHEN a Meetup is cancelled by a Group_Manager, THE Notification_Service SHALL send a cancellation email to all Study_Group members within 60 seconds; the email SHALL include the Meetup title and the cancellation reason if the Group_Manager provided one.
7. IF a Study_Group member submits a Meetup creation form with a missing required field, an invalid date/time format, or a date/time in the past, THEN THE Platform SHALL reject the submission and display a per-field error message identifying each invalid input.

---

### Requirement 10: Study Buddy Discovery

**User Story:** As a User, I want to find a one-on-one study partner for any subject, so that I can get focused academic support outside of a formal group.

#### Acceptance Criteria

1. THE Platform SHALL provide a Study Buddy discovery feature accessible from the Dashboard that displays Users who have set their availability status to "available for study buddy sessions."
2. WHEN a User searches for a Study_Buddy, THE Platform SHALL filter results by subject or Course and display matching Users' display names, profile pictures, majors, and shared Courses.
3. WHEN a User sends a Study_Buddy request to another User, THE Notification_Service SHALL send an email notification to the receiving User within 60 seconds.
4. IF a User attempts to send a Study_Buddy request to a User to whom they have already sent a pending Study_Buddy request, THEN THE Platform SHALL reject the duplicate request and display a message informing the sender that a request is already pending.
5. WHEN a User accepts a Study_Buddy request, THE Platform SHALL create a Study_Buddy connection between the two Users.
6. WHEN a Study_Buddy connection is created, THE Notification_Service SHALL send a confirmation email to both the accepting User and the requesting User within 60 seconds.

---

### Requirement 11: Friend System

**User Story:** As a User, I want to send and manage Friend connections with other students, so that I can maintain a network of study peers.

#### Acceptance Criteria

1. WHEN a User sends a Friend_Request to another User, THE Notification_Service SHALL deliver an email notification to the receiving User within 60 seconds.
2. WHEN a User accepts a Friend_Request, THE Platform SHALL create a mutual Friend connection between both Users and display each User in the other's Friend list.
3. WHEN a User declines a Friend_Request, THE Platform SHALL remove the pending request without notifying the sender.
4. WHEN a User removes a Friend connection, THE Platform SHALL remove both Users from each other's Friend list as a single atomic operation.
5. WHEN a User blocks another User, THE Platform SHALL prevent the blocked User from viewing the blocking User's Profile, sending messages, or sending Friend_Requests to the blocking User; if a Friend connection or pending Friend_Request exists between the two Users, THE Platform SHALL remove the Friend connection or cancel the pending Friend_Request at the time of blocking.
6. THE Platform SHALL display the total Friend count on each User's Profile.
7. IF a User attempts to send a Friend_Request to a User to whom they have already sent a pending Friend_Request, THEN THE Platform SHALL reject the duplicate request and display a message informing the sender that a request is already pending.

---

### Requirement 12: Direct Messaging

**User Story:** As a User, I want to send direct messages to other Users, so that I can communicate privately outside of a Study_Group chat.

#### Acceptance Criteria

1. WHEN a User sends a direct message to another User who is currently online, THE Chat_Service SHALL deliver the message to the recipient within 2 seconds.
2. WHEN a User sends a direct message to another User who is currently offline, THE Chat_Service SHALL store the message and deliver it to the recipient within 2 seconds of the recipient coming online.
3. THE Chat_Service SHALL persist all direct messages and display the full message history in chronological order to both participants when they open the conversation; message history SHALL be retained for at least 365 days.
4. WHEN a User receives a direct message and is not currently viewing that conversation, THE Platform SHALL display an unread message indicator showing the count of unread messages for that conversation.
5. IF a User has blocked another User, THEN THE Platform SHALL prevent the blocked User from sending direct messages to the blocking User, and SHALL display an error message to the blocked User indicating they cannot send a message to that User.
6. WHEN a User sends a direct message exceeding 2,000 characters, THE Platform SHALL reject the message and display an error indicating the character limit.

---

### Requirement 13: User Search and Discovery

**User Story:** As a User, I want to search for and discover other students, so that I can find potential study partners and Friends.

#### Acceptance Criteria

1. WHEN a User enters at least 2 characters in the Dashboard search control and submits the query (up to 100 characters), THE Platform SHALL return User profiles whose username or @umn.edu email address contains the query as a prefix or substring, within 1 second.
2. IF the search query returns no matching User profiles, THEN THE Platform SHALL display a message indicating no results were found.
3. THE Platform SHALL display up to 10 suggested Users on the Dashboard; Users who share at least one Course with the authenticated User SHALL be shown before Users who share only the same graduation year; Users who share neither SHALL not appear in suggestions.
4. WHEN a User clicks on another User's name or profile picture, THE Platform SHALL navigate the User to that User's Profile page.

---

### Requirement 14: Report System

**User Story:** As a User, I want to report malicious or inappropriate behavior, so that the platform remains a safe and productive environment.

#### Acceptance Criteria

1. WHEN a User submits a Report against another User, THE Platform SHALL require the reporting User to select a reason category from a predefined list and optionally provide a description of 0–1000 characters.
2. WHEN a Report is submitted, THE Notification_Service SHALL send an email notification to all Admins within 60 seconds containing the reporter's identity, the reported User's identity, the selected reason category, the description, and the submission timestamp.
3. WHEN a User submits a Report, THE Platform SHALL display a disclaimer informing the reporter that submitting false or abusive reports may result in action against the reporter's account.
4. WHEN a User submits a Report, THE Platform SHALL display an on-screen confirmation message to the reporter acknowledging that the report has been received.
5. WHEN an Admin reviews a Report and determines a violation has occurred, THE Platform SHALL allow the Admin to suspend the reported User's account for a duration of 1–365 days or permanently ban the account.
6. WHEN a User's account is suspended, THE Auth_Service SHALL immediately terminate any active sessions for that User, prevent the suspended User from authenticating until the suspension period expires, and THE Notification_Service SHALL send a notification email to the suspended User within 60 seconds of the suspension action.
7. WHEN a User's account is permanently banned, THE Auth_Service SHALL immediately terminate any active sessions for that User, prevent the banned User from authenticating, and THE Notification_Service SHALL send a notification email to the banned User within 60 seconds.
8. WHEN a suspended User's suspension period expires, THE Auth_Service SHALL automatically lift the suspension and restore the User's ability to authenticate without requiring Admin intervention.

---

### Requirement 15: Inactive User and Group Handling

**User Story:** As an active User, I want the Platform to automatically manage inactive users and groups, so that I do not waste time on unresponsive peers or stale Study_Groups.

#### Acceptance Criteria

1. WHEN a User's account has had no login activity for 90 consecutive days, THE Platform SHALL send a re-engagement email to the User via the Notification_Service.
2. IF the Notification_Service fails to deliver the re-engagement email, THEN THE Platform SHALL retry delivery up to 3 times within 24 hours before marking the notification as undelivered.
3. WHEN a User's account receives a login event, THE Platform SHALL reset that User's inactivity timer to zero days regardless of whether a re-engagement email was previously sent.
4. WHEN a Study_Group has had no member activity (chat messages, Meetup creation, or attendance updates) for 60 consecutive days, THE Platform SHALL mark the Study_Group as inactive.
5. WHILE a Study_Group is marked inactive, THE Platform SHALL hide the Study_Group from new-member join searches while continuing to display it to existing members in their joined groups list.
6. WHEN a member of an inactive Study_Group performs an activity (chat message, Meetup creation, or attendance update), THE Platform SHALL remove the inactive mark from the Study_Group and restore its visibility in new-member join searches.
7. WHEN a Study_Group has been marked inactive for 30 consecutive additional days (90 days total of inactivity), THE Platform SHALL archive the Study_Group by removing all member associations and making the group inaccessible to all members.
8. WHEN a Study_Group is archived, THE Platform SHALL notify all former members via the Notification_Service with a message indicating the group has been disbanded due to inactivity.

---

### Requirement 16: Scalability and Performance

**User Story:** As a User, I want the Platform to remain responsive under high load, so that my experience is not degraded during peak usage periods such as midterms and finals.

#### Acceptance Criteria

1. THE Platform SHALL support at least 5,000 concurrent authenticated Users with a 95th-percentile server-side response time of no more than 3 seconds for authenticated page loads; IF the concurrent user count exceeds 5,000, THE Platform SHALL queue or shed excess load gracefully and display a service-degraded message rather than returning unhandled errors.
2. WHEN the Platform is extended to support additional universities, THE Platform SHALL require only configuration changes to university domain allowlists and course data sources, without changes to core application logic.
3. THE Platform SHALL use server-side caching for Course lists and suggested User results with a cache TTL of at least 1 minute and no more than 5 minutes.
