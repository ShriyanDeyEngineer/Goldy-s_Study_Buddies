# Master Build Prompt — Study Buddies

> Copy everything below the line into a fresh AI coding session to have the
> entire website built from scratch. It is written to be self-contained: an AI
> with no other context should be able to produce a working, deployable app.

---

## THE PROMPT

You are building a complete, production-ready web application from scratch.
Follow this specification precisely. Do not substitute technologies. Where this
document states an exact number, limit, or rule, implement it exactly.

---

### 1. Product

**Name:** Study Buddies

**One-liner:** A website for University of Minnesota students to find study
partners and create or join study groups for their specific courses.

**Primary audience:** Students in the **College of Science and Engineering
(CSE)**. The large intro STEM courses — physics, chemistry, calculus,
intro CS — are where students struggle most and where study groups pay off
fastest, so the course catalog, seed data, and marketing copy should lead with
those. The platform must still work for any UMN student in any college; CSE is
the beachhead, not a restriction. Never block or hide the product from
non-CSE students.

**The problem it solves:**
- Students — especially freshmen and transfers — struggle to find people to
  study with after the first two weeks of a semester, when lecture-hall
  socializing dies off.
- Office hours and tutoring rooms run on fixed schedules that don't fit
  everyone, and attendance collapses late in the term.
- Shy students will not cold-approach classmates in a 300-person lecture, but
  they will join an open study group.
- Not every section of a course gets the same TA support; groups connect
  students across sections.
- Professors resort to sign-up spreadsheets that nobody maintains.

**Target users:** Verified University of Minnesota students only. Every account
must be tied to a confirmed `@umn.edu` email address. The system must be
designed so that adding a second university later is a configuration change
(one database row), never a code change.

**Tone and personality:** Warm, encouraging, student-to-student. Not corporate.
Copy should sound like a helpful classmate, e.g. "Find your study buddies!
again," "Break the ice — even a 'hey' works." Never use fake urgency or
growth-hack language.

---

### 2. Technology stack — use exactly this

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 15**, App Router | TypeScript, React Server Components + Server Actions |
| Language | **TypeScript**, strict mode | No `any` without justification |
| Styling | **Tailwind CSS v4** | CSS-first `@theme` config, not a JS config file |
| Components | **shadcn/ui style** on Radix primitives | Hand-rolled in `components/ui/`, not a dependency |
| Forms/validation | **Zod** | One schema per form, shared by client and server |
| Backend | **Supabase** | Postgres, Auth, Realtime, Storage — no separate API server |
| Auth | **Supabase Auth** — email/password **and** Google SSO | Both are required; see §5.2 |
| Hosting | **Vercel** | `main` branch → production, PRs → preview deploys |
| Icons | **lucide-react** | |
| Dates | **date-fns** | |
| Toasts | **sonner** | |
| Tests | **Vitest** | Unit tests for all pure logic and validation |
| Email (optional) | **Resend** | Must be fully optional — see §10 |

**Explicitly do NOT use:** a separate Python/FastAPI/Express backend, Celery,
Redis, Prisma or any ORM, Firebase, or a state-management library like Redux.
Next.js Server Actions plus Supabase cover every requirement. Server state that
needs client interactivity uses React hooks; there is no global client store.

**Architectural rule:** Reads happen in Server Components using the user's
Supabase session. Writes go through Server Actions that validate with Zod, then
either write directly (simple cases) or call a Postgres function (anything with
a correctness invariant — see §7).

---

### 3. How to write the code — you are on a student team

Write every file as though you are one developer on a five-person student team,
handing your work to teammates who are **still learning**. Some of them have
never used TypeScript, React, or SQL. They must be able to open any file, read
it top to bottom, and understand what it does and why — without asking you.

This is a hard requirement, not a stylistic preference. Code that works but
cannot be understood by the team is a failed deliverable.

**Every file starts with a header comment** explaining, in plain English:
what this file is, what part of the product it powers, and when a teammate
would need to touch it. Example:

```ts
/**
 * Study group creation form.
 *
 * This is the page a student sees after picking a course and clicking
 * "Create a group." It collects the group name, size limit, whether the
 * group is open or invite-approved, and who to invite right away.
 *
 * When the form is submitted it calls the createGroup server action
 * (lib/actions/groups.ts), which does the real work in the database.
 *
 * Touch this file if you want to change what the creation form asks for.
 */
```

**Every function gets a comment** stating what it does, what it takes in, what
it gives back, and — most importantly — *why it exists*. If the function
enforces a product rule, state the rule in plain English:

```ts
/**
 * Decides which label the join button should show for one student
 * looking at one group.
 *
 * The rules, in order of priority:
 *   - If the group was disbanded, nothing can be done → "Unavailable"
 *   - If you run the group → "Manager"       (you're already in it)
 *   - If you're a member → "Member"           (you're already in it)
 *   - If you asked to join and are waiting → "Requested"
 *   - If the group hit its size limit → "Full"
 *   - Otherwise → "Join" for open groups, "Request to join" for closed ones
 *
 * Order matters: a member of a full group should see "Member", not "Full".
 */
```

**Comment the SQL heavily.** Migrations and database functions are the part of
the codebase teammates will find most foreign. Every table gets a comment
saying what it stores in plain language. Every database function gets a comment
block explaining the rule it protects and *why it lives in the database instead
of the app* (short version: so two people clicking at the same moment can never
break it).

**Explain the "why", not the obvious "what".** Do not write
`// increment the counter` above `count++`. Do write a comment explaining why a
group's member count is re-checked at approval time, or why friendships are
stored with the smaller user ID first.

**Flag the non-obvious.** Anywhere a teammate would reasonably ask "wait, why is
it done this way?", answer it in a comment before they have to ask. Especially:
security rules, anything about privacy, anything involving timezones, and
anything that looks redundant but is not.

**Additional conventions:**
- Descriptive names over short ones. `pendingJoinRequests`, not `pjr`.
- No commented-out dead code, ever. Delete it; git remembers.
- No `TODO` without a name and a sentence of context.
- Prefer a few well-named small functions over one long clever one.
- When you make a judgment call the spec left open, write a one-line comment
  saying what you chose and why, and note it in the README.
- Keep a `docs/GLOSSARY.md` defining the product's terms — manager, open group,
  closed group, study buddy, meetup, availability poll — for teammates who
  join later.

---

### 4. Design system

Build a University of Minnesota–themed design system. Do not use the official
UMN logo, the Goldy Buddies mascot artwork, or any university trademark — use
the school colors and an original simple buddies-silhouette SVG instead. Include
a visible footer disclaimer: "Not officially affiliated with the University of
Minnesota."

**Color tokens:**

| Token | Hex | Use |
|---|---|---|
| maroon | `#7A0019` | Primary brand, headers, primary buttons |
| maroon-dark | `#5B0013` | Hover states, footer |
| gold | `#FFCC33` | Accents, CTAs, focus rings |
| gold-light | `#FFDE7A` | Badges, subtle highlights |
| cream | `#FFFAF0` | Page background |
| surface | `#FFFFFF` | Cards |
| ink | `#1A1A1A` | Body text |
| ink-muted | `#6B6B6B` | Secondary text |
| line | `#EDE6DC` | Borders |
| success / warning / danger | `#16A34A` / `#D97706` / `#DC2626` | Semantic |

**Contrast rule:** Never place gold text on cream — it fails WCAG AA. On maroon
use white or gold. All interactive elements must meet 4.5:1 contrast.

**Typography:** Headings use a serif display face (DM Serif Display). Body and
UI use Inter, 16px base. Load both via `next/font/google`. Only two font
weights: 400 and 500/600 for emphasis.

**Component style:** Border radius `0.75rem`. Cards are white with a 1px `line`
border and a soft shadow. Primary button = maroon background, white text, gold
focus ring. Secondary = gold background, maroon text.

**Every list, page, and panel must have three designed states:** loading
(skeleton), empty (illustration + a primary action that fixes the emptiness),
and error (message + retry). Empty states are not optional — write real,
encouraging copy for each one.

**Responsive:** Mobile-first. Must be verified working at 375px, 768px, 1024px,
and 1440px. On mobile the top nav collapses to a bottom row of links.

**Accessibility:** WCAG 2.1 AA. Everything keyboard-navigable, visible gold
focus rings, `aria-label` on all icon-only buttons, proper form labels, and
`aria-live` on chat message lists.

---

### 5. Complete feature specification

Implement all of the following. Numbers and limits are requirements.

#### 5.1 Public marketing pages

- **Home (`/`)** — hero with headline and two CTAs (Get started → register,
  See how it works → anchor); a three-step "How it works" section (Verify your
  UMN email → Pick your courses → Join or create a group); a features section;
  and a closing CTA. Statically rendered for SEO and speed.
- **About Us (`/about`)** — mission plus founder cards.
- **Why Use It (`/why`)** — argument cards drawn from the problem statement in §1.
- **Testimonials (`/testimonials`)** — real quotes when available; until then an
  empty state inviting the visitor to be among the first users.
- A **shared header** on every public page containing the logo, links to the
  three subpages, and **Sign in / Sign up** buttons.
- A **footer** with team contact emails, page links, and the affiliation disclaimer.
- Include `sitemap.xml` and `robots.txt`. Public pages are indexable; every
  authenticated route is disallowed.

#### 5.2 Accounts and authentication

Two sign-in methods are **both required**. Every login and registration screen
must offer both, clearly separated.

**Method 1 — email and password:**
- Registration requires an email ending in `@umn.edu` (case-insensitive) and a
  user-chosen password.
- **Password policy:** minimum 12 characters, and must contain at least one
  uppercase letter, one lowercase letter, one digit, and one special character.
  Show a **live checklist** on the registration form where each rule turns green
  as it is satisfied. When a submission fails, the error must list *exactly* the
  unmet rules — no more, no fewer.
- Email verification is **required** before the account can be used. The
  verification link expires after **24 hours**. Provide a resend option and a
  clear error screen for expired or already-used links.
- Password reset by emailed link. The "forgot password" response must be
  identical whether or not the account exists (no account enumeration).

**Method 2 — "Continue with UMN Google" (required, not optional):**
- Implement Google SSO through Supabase Auth's Google provider.
- Request the Google hosted-domain hint (`hd=umn.edu`) so the account chooser
  surfaces university accounts first, but **never trust that hint as the
  security boundary** — a user can bypass it.
- The real enforcement is the database trigger described below. If a student
  signs in with a personal Gmail account, the trigger rejects the signup and the
  app must show the friendly "Only @umn.edu accounts can join" message — never a
  raw database error.
- SSO users skip email verification (Google already verified the address) and go
  straight to onboarding.
- Document in `SETUP.md` exactly how to create the Google Cloud OAuth client and
  paste its ID and secret into Supabase, since the app cannot function without
  this configured.

**Shared rules:**
- Login failures must return an identical generic message ("Email or password is
  incorrect.") regardless of whether the email exists or the password was wrong.
  Never reveal which field failed.
- Sessions are cookie-based and refreshed by middleware on every request.
- **The domain restriction must be enforced in the database**, via a trigger on
  the auth users table checking against a `universities` allow-list table — not
  only in form validation, and not only in the OAuth hint. This single trigger
  is what covers both sign-in methods at once, and what makes multi-university
  support a configuration change.

#### 5.3 Onboarding (first login only)

A three-step wizard, shown once, that collects: display name (required, 1–50
chars), college, major, class standing, graduation month and year, current
courses (multi-select, skippable), and optionally a bio and profile picture.
Users cannot reach the rest of the app until a display name exists. The wizard
must be refresh-safe.

Every field except the display name is optional and clearly marked so. Do not
gate progress on optional answers.

#### 5.4 Dashboard (`/dashboard`)

The signed-in home. It must show:

1. **My study groups** — cards with group name, course code, member count vs.
   capacity, open/closed badge, and the next scheduled meetup if any.
2. **Your courses** — each enrolled course with its count of available groups
   and a "Find a group" action.
3. **Explore courses** — the most active courses by group count, plus a link to
   the full catalog. If no groups exist anywhere yet, show an empty state
   inviting the user to create the very first one.
4. **A search box** for finding people by username or email (minimum 2
   characters, maximum 100).
5. **Suggested people** — up to **10** users, ranked so that people who share at
   least one current course appear **before** people who merely share a
   graduation year. Users who share neither must never appear.

#### 5.5 Course catalog

- A searchable, filterable list of courses (search by department code, number,
  or name; filter by department and by college). Each row shows its count of
  active study groups.
- **"Add a missing course"** — any student may add a course (department code,
  number, name). Courses are unique per `(university, department, number)`;
  adding a duplicate should route the user to the existing course rather than
  erroring confusingly.
- A **course detail page** listing every active study group for that course,
  each with a smart join button, plus a prominent "Create a group for this
  course" action.

**Seed data — accuracy rules.** Seed the database with real, verifiable UMN
courses. **The College of Science and Engineering first-year core must all be
present**, since CSE freshmen are the primary audience:

- `CSE 1001` — First Year Experience (the required CSE freshman seminar)
- Calculus, all three placement tracks: `MATH 1371`/`1372` (CSE track),
  `MATH 1271`/`1272` (general), `MATH 1571H`/`1572H` (honors)
- Physics: `PHYS 1301W`, `PHYS 1302W`
- Chemistry lecture **and** its separately-registered lab: `CHEM 1061`/`1065`,
  `CHEM 1062`/`1066`
- Intro programming, both tracks: `CSCI 1133` (CS majors) and `CSCI 1113`
  (C/C++, taken by most other engineering majors), plus `CSCI 1913` and
  `EE 1301`
- `WRIT 1301` — University Writing

Then add common second-year CSE courses (`MATH 2373`/`2374`/`2243`/`2263`,
`CSCI 2011`, `CSCI 2021`, `AEM 2011`, `ME 2011`, `EE 2301`, `STAT 3021`),
science courses (`BIOL 1009`, `CHEM 2301`, `PHYS 1201W`/`1202W`), and the large
gen-ed lectures CSE students still take (`PSY 1001`, `ECON 1101`/`1102`,
`SOC 1001`, `PHIL 1001`).

**Do not invent course numbers.** You do not have access to the live UMN
registrar catalog, and a database full of plausible-but-fake courses is worse
than a small accurate one, because students will not find their real classes and
will not trust the app. Therefore:

1. Seed only courses you are confident are real (the list above and similar).
2. Build an **admin bulk-import** path — a script or admin-only page that
   ingests a CSV of `department_code,course_number,course_name` — so the team
   can load the full catalog for Summer 2026, Fall 2026, and Spring 2027 by
   exporting it from the registrar's Class Search. Document the CSV format and
   the import command in `SETUP.md`.
3. The student-facing "Add a missing course" feature covers the long tail in the
   meantime. Make sure it is easy to find from the catalog's empty search state.

Optionally support a `term` label on courses (e.g. `Fall 2026`) so the same
course can exist across terms; if you implement it, keep uniqueness scoped to
`(university, department, number, term)` and default the UI to the current term.

#### 5.6 Creating a study group

Reachable only with a course selected. The creation form collects:

- **Name** — 1–100 characters, must be unique within that course.
- **Capacity** — an integer between **2 and 50** inclusive (default 8).
- **Mode** — `open` (anyone joins instantly) or `closed` (the manager approves
  requests). Explain the difference in the UI.
- **Optional invitations** — a picker of classmates to invite immediately. The
  picker must only offer users who are **currently enrolled in that course**,
  and may select at most `capacity − 1` people. Re-validate this server-side.

The creator automatically becomes the group's **manager** and its first member.
Invited users receive a notification and can accept or decline.

Per-field validation errors must be shown inline, one message per invalid field.

Let students make their own groups for classes that don't exist in the website. They are required to write the Course and the Course number for any group that they create. We do this because our website might not have all the existing UMN course that students want to make study groups for. Therefore, we should allow students to make their own courses if it doesn't exist on the website already.

#### 5.7 Joining a group

- **Open group with space:** the user joins immediately and lands in the group.
- **Closed group:** the user submits a join request; the manager is notified.
  A second identical request must be rejected as a duplicate — exactly one
  pending request may exist per (group, user).
- The user may withdraw their own pending request.
- **Full group:** joining is refused with a clear "this group is full" message.
- The join control is a **state machine** rendering exactly one of: `Join`,
  `Request to join`, `Requested ✓` (withdrawable), `Member`, `Manager`, `Full`,
  or `Unavailable`. Existing members must never see a join option.

#### 5.8 The group page

Non-members see only a preview: name, course, member count, manager, mode, and
the join control. Chat, meetup details, and member emails are hidden from them.

Members see three panels — **Chat**, **Meetups**, and **Members** — laid out
side by side on desktop and stacked/tabbed on mobile.

**Group chat:**
- Realtime delivery to all connected members within ~2 seconds.
- Messages are 1–2,000 characters. Show a live character counter that turns red
  past the limit and blocks sending. Never persist an over-limit message.
- Full history persisted and displayed in strict chronological order with date
  separators. A member who was offline simply sees everything on their next
  visit — no separate offline queue is needed.
- Own messages right-aligned in maroon; others left-aligned with sender name
  and avatar. Auto-scroll to newest, with a "New messages ↓" pill if the user
  has scrolled up.

**Meetups:**
- Any member may schedule one. Required: title (1–100 chars), a date and time
  **in the future**, a format (`online` or `in person`), and — conditionally — a
  **meeting link** if online or a **physical location** if in person. Report a
  distinct inline error for every invalid field simultaneously.
- Store timestamps in UTC; display in the viewer's local timezone.
- **RSVP** with three states: Attending, Maybe, Can't make it. Show a live count
  of attendees. The count must always equal the number of members whose most
  recent status is "attending" — compute it, never let a stored counter drift.
- **Upcoming vs. past is derived from the scheduled time at query time.** Do not
  build a background job to flip a status column.
- An **"Add to Google Calendar"** button that opens a prefilled calendar event.
  Use a plain calendar template URL — do not require OAuth or an API key.
- The creator or the manager may cancel a meetup, optionally with a reason;
  all members are notified and the card is visually struck through.
- **Availability poll (When2Meet-style):** a member may open a poll proposing
  several candidate time slots; each member marks which slots work for them; the
  group page displays the slot with the most availability so the group can
  convert it into a real meetup in one click. Build this natively — do **not**
  embed or depend on When2Meet, Calendly, or any third-party scheduling service,
  which would require external accounts and break the single-sign-in experience.

**Members panel:**
- Member list with avatars, names, and a crown on the manager.
- The manager additionally sees pending join requests here with Approve / Deny.
- The manager may remove any member (with confirmation); the removed person is
  notified.
- Every member has a **Leave group** action with a confirmation dialog that
  explains the consequence.

#### 5.9 Group management (manager only)

A separate settings page, reachable only by the manager. Non-managers requesting
it must receive a 404 — do not reveal that the page exists.

- Rename the group (uniqueness re-checked within the course).
- Switch between open and closed mode. **Switching closed → open must
  automatically approve pending requests, oldest first, until capacity is
  reached.** Approve exactly `min(pending, remaining capacity)` — never exceed
  capacity.
- **Disband the group** behind a typed-name confirmation. Disbanding must, in a
  single transaction: remove all members, cancel all future meetups, decline all
  pending requests, and notify everyone.

**Manager succession:** if the manager leaves a group that still has members,
transfer the manager role to the **longest-tenured remaining member**, breaking
ties by the earliest account creation date. If the manager is the last member,
the group is disbanded.

#### 5.10 Finding people — search, filters, and study buddies

- **Search** users by display name or email, case-insensitive substring, minimum
  2 characters. Never display anyone's email address in results — matching on it
  is a server-side convenience only.
- **Suggestions** as specified in §5.4 item 5.

**Filters.** The people-search page and the study-buddy discovery page share one
filter panel. All filters are optional, combinable, and applied **server-side**.
Available dimensions:

| Filter | Behavior |
|---|---|
| **Course** | Multi-select from the catalog. Matches users with that course in their *current* list. |
| **Major** | Multi-select from the majors present in the data. |
| **College** | Multi-select (CSE, CLA, Carlson, CBS, CFANS, Design, Education, Nursing, other). |
| **Class standing** | Multi-select: freshman, sophomore, junior, senior, graduate. |
| **Graduation year** | Multi-select or range. |
| **Study-buddy availability** | Toggle: only show students open to 1-on-1 study buddies. |

Filter behavior requirements:
- Filters are reflected in the URL query string so a filtered view can be
  bookmarked, shared, and restored on refresh (e.g. `?course=…&college=cse`).
- Show the active filters as removable chips, plus a "Clear all" action.
- Show the result count, and an empty state that suggests loosening filters when
  a combination returns nothing.
- Results remain ranked by shared courses first, exactly as suggestions are.
- Blocked users never appear in any filtered result, in either direction.

**Filters must never become a privacy side-channel.** This is a hard rule. A
user who has hidden a field (§5.11) must not be findable by filtering on that
field. Concretely: if a student hides their major, they are excluded from
`major=` filter results entirely — the system must not return them while merely
omitting the value from the display, because their presence in the result set
would itself leak the hidden answer. Implement this exclusion in the same
database function that applies the filter, and unit-test it.

**Do not collect or filter on gender, race, or any other protected
characteristic.** Study-group matching works on courses, major, and schedule;
adding demographic filters creates harassment and discrimination risk without
improving matches. Students who want control over exactly who joins their group
already have it: create a closed group and approve members individually.

**Study buddy mode:** a user may toggle themselves "available for study buddy
sessions." The discovery page lists available students using the filter panel
above, ranked by shared classes. Users send a buddy request; accepting creates a
mutual connection, and both parties are notified. Either may disconnect later.

#### 5.11 User profiles

A profile displays: profile picture, display name, **college**, major, **class
standing**, bio (max 500 characters), current classes, classes already taken,
planned future classes, graduation month and year, friend count, member-since
date, and up to **5** social media links (each a valid http(s) URL).

- **Per-field privacy:** the owner can independently hide their college, major,
  class standing, bio, graduation date, social links, and each of the three
  class lists. **Hidden fields must be stripped server-side** — they must be
  absent from the API response entirely, not merely hidden with CSS — and must
  also exclude the user from the corresponding filter (§5.10).
- **Profile picture upload:** JPEG or PNG only, maximum **5 MB**. Validate the
  MIME type on the server, not just the file extension. Reject violations with a
  message naming the accepted formats and size.
- Viewing another user's profile offers: add friend, send message, block, and
  report. Viewing your own offers: edit profile.
- If a save fails, the user's unsaved input must be preserved so they can retry
  without retyping.

#### 5.12 Friends, messaging, and blocking

- **Friend requests:** send, accept, or decline. Accepting creates a mutual
  connection atomically — both users appear in each other's list, or neither
  does. Declining is silent: the sender is not notified. A duplicate pending
  request is rejected. Show the friend count on each profile.
- **Direct messages:** realtime one-to-one threads, same 2,000-character limit
  as group chat, with persisted history in chronological order. The conversation
  list shows the latest message and an **unread count** per conversation, which
  clears when the thread is opened.
- **Blocking** must, in one atomic operation: remove any existing friendship,
  cancel pending requests in both directions, remove any buddy connection, and
  thereafter prevent the blocked user from viewing the blocker's profile,
  sending them messages, or sending them requests. Blocked users must also
  disappear from each other's search results, filters, and suggestions. Provide
  an unblock action.

#### 5.13 Notifications

An in-app notification system with a header bell showing a live unread badge, a
dropdown of the latest items, and a full notifications page with "mark all as
read." Clicking a notification marks it read and navigates to the relevant page.

Notification types: group invitation, invitation accepted, join request
received, join request approved, join request denied, request cancelled because
the group filled, removed from group, group disbanded, manager role
transferred, meetup created, meetup cancelled, friend request, friend request
accepted, buddy request, buddy request accepted.

#### 5.14 Reporting and moderation

- Any user may report another. The report form requires a **reason category**
  from a fixed list (harassment, spam, inappropriate content, impersonation,
  academic dishonesty, other) and accepts an optional description up to 1,000
  characters.
- Display a visible disclaimer that submitting false or abusive reports may
  result in action against the reporter's own account, and show an on-screen
  confirmation once submitted.
- Reports are stored for team review, and emailed to an admin address if email
  is configured.
- Accounts carry a status of `active`, `suspended`, or `banned`. A suspended or
  banned user is blocked from the application with an explanatory screen and a
  sign-out button, and is excluded from search, filters, suggestions, and
  discovery. Include an `is_admin` flag on accounts for future moderation
  tooling.

---

### 6. Data model

Create these tables in Postgres. Every table must have row-level security
enabled. All identifiers are UUIDs. **Every table and non-obvious column gets a
SQL comment explaining what it holds, per §3.**

| Table | Purpose / key columns |
|---|---|
| `universities` | `name`, `email_domain` (unique), `is_active`. The domain allow-list. |
| `profiles` | 1:1 with the auth user. Display name (≤50), email, college, major, class standing, bio (≤500), graduation month/year, avatar URL, social links (JSON array ≤5), privacy flags (JSON), study-buddy availability, account status, `is_admin`, onboarded-at, last-login, timestamps. |
| `courses` | University, department code, number, name, optional term, `is_active`, created-by. Unique on (university, department, number[, term]). |
| `user_courses` | User, course, and an enrollment type of `current`, `taken`, or `future`. Unique per triple. |
| `study_groups` | Course, name, manager, mode (`open`/`closed`), capacity (2–50), member count, status (`active`/`inactive`/`archived`/`disbanded`), last-activity, timestamps. Unique on (course, name). |
| `study_group_members` | Group, user, joined-at. Unique per pair. `joined_at` drives manager succession. |
| `join_requests` | Group, user, status, timestamps. **A partial unique index must permit only one `pending` row per (group, user).** |
| `group_invitations` | Group, invited user, inviter, status. Same one-pending-row constraint. |
| `meetups` | Group, creator, title, scheduled-at (timestamptz), format, location, meeting link, cancelled flag, cancellation reason. A CHECK constraint must require a meeting link when online and a location when in person. |
| `meetup_attendance` | Meetup, user, status (`attending`/`maybe`/`not_attending`). Unique per pair. |
| `availability_polls` / `availability_slots` / `availability_votes` | The When2Meet-style poll: a poll per group, its candidate time slots, and one vote row per (slot, user). |
| `group_messages` | Group, sender, content (≤2,000), created-at. Indexed on (group, created-at). |
| `direct_messages` | Sender, recipient, content (≤2,000), read flag, created-at. Indexed for thread lookup and unread counts. |
| `friends` | Two user columns stored in **canonical order** with a `CHECK (user_id_a < user_id_b)` constraint so a friendship can never be double-stored. |
| `friend_requests` | Sender, recipient, status. One pending row per ordered pair. |
| `study_buddy_requests` / `study_buddy_connections` | Same shapes as friends. |
| `blocks` | Blocker, blocked. Unique per pair. |
| `reports` | Reporter, reported user, category, description, status, resolution. |
| `notifications` | Recipient, type, JSON payload, read-at, created-at. |

Index the columns the filter panel queries — college, major, class standing,
graduation year — so filtered searches stay fast as the user base grows.

**Seed data:** one university (University of Minnesota / `umn.edu`) and the
verified courses described in §5.5.

---

### 7. Correctness rules — enforce these in the database, not in UI code

This is the most important section. Implement every state transition below as a
`SECURITY DEFINER` Postgres function that locks the relevant group row
(`SELECT … FOR UPDATE`) before reading or writing. Revoke direct
insert/update/delete on the affected tables from clients so these functions are
the only write path. The application layer calls them; it never reimplements
their logic.

Each function must raise a short machine-readable error code (e.g.
`GROUP_FULL`, `NAME_TAKEN`, `NOT_MANAGER`, `DUPLICATE_REQUEST`) that the app
maps to friendly text. Raw database errors must never reach the user.

The invariants that must hold under concurrent access:

1. **Capacity** — a group's member count may never exceed its capacity, under
   any interleaving of joins, approvals, and mode switches.
2. **Approval re-check** — capacity is re-verified at the moment of approval. If
   the group filled up while a request was pending, cancel that request and tell
   the manager the group is now full.
3. **Duplicate requests** — at most one pending join, friend, or buddy request
   may exist between any pair at any time.
4. **Manager-only actions** — approve, deny, remove member, edit, and disband
   are refused for anyone but the manager, and leave the group's state
   completely unchanged when refused.
5. **Manager succession** — determined by earliest `joined_at`, tie-broken by
   earliest account creation. Deterministic, never random.
6. **Disband completeness** — afterwards: zero members, zero pending requests,
   all future meetups cancelled, everyone notified. All in one transaction.
7. **Closed → open** — approves exactly `min(pending, remaining capacity)`
   requests, oldest first, never exceeding capacity.
8. **Message limits** — no message over 2,000 characters is ever persisted, in
   group chat or direct messages.
9. **Block completeness** — a single block action removes the friendship,
   cancels pending requests both directions, removes any buddy connection, and
   blocks profile viewing, messaging, and future requests. All conditions hold
   simultaneously.
10. **Profile privacy** — hidden fields are absent from query results for other
    users, and hidden fields exclude the user from the matching filter (§5.10).
    Enforce this in a database view or function, so that even a direct API call
    cannot read or infer a hidden field.
11. **Lock ordering** — whenever a function must lock more than one row, always
    lock the **group row first**, then request/invitation rows. Consistent
    ordering prevents deadlocks between concurrent manager actions.

**Row-level security:** members-only tables (group messages, meetups,
attendance, availability votes) must be readable only by that group's members.
Direct messages and notifications are readable only by their
participants/recipient. Because realtime subscriptions respect RLS, this also
governs what the websocket can deliver — never rely on client-side filtering for
access control.

---

### 8. Realtime

Use Supabase Realtime database-change subscriptions, filtered server-side:

- Group chat: new messages in the open group.
- Direct messages: new messages addressed to the current user.
- Notifications: new notifications for the current user, driving the bell badge.

Requirements: de-duplicate by message id (a user's own send may arrive both from
the insert response and the broadcast); subscribe on mount and **unsubscribe on
unmount**; and render each realtime panel exactly **once** in the component tree
— never render one copy for desktop and a hidden copy for mobile, since that
opens duplicate subscriptions. Use CSS to reflow a single instance instead.

---

### 9. Known pitfalls — avoid these specifically

These are real bugs that occur when building this application. Prevent each one,
and leave a short comment at each guard explaining what it prevents.

1. **Implicit form submission.** Pressing Enter in a text input submits the
   surrounding form. In the multi-step onboarding wizard this silently submits
   from step 1 and skips the remaining steps. Intercept Enter and make it
   advance to the next step instead; only the explicit finish button submits.
2. **Button type defaults.** A `<button>` inside a form defaults to
   `type="submit"`. Your shared Button component must default to
   `type="button"`; every genuine submit button declares `type="submit"`
   explicitly.
3. **Invalid nesting.** Never place an interactive element (input, button)
   inside another button — it is invalid HTML and causes hydration errors.
4. **Redirect loops.** If a session exists but its profile row does not,
   redirecting to the login page will bounce back forever because middleware
   sends signed-in users to the app. Render a "sign out and start over" screen
   instead.
5. **Unvalidated route params in query filters.** Any URL parameter interpolated
   into a database filter string must be validated as a UUID first. This applies
   to the new filter query strings too — validate and whitelist every filter
   value before it reaches SQL.
6. **Stale closures in realtime handlers.** Cache lookups (e.g. resolving a
   message sender's name) in a ref, so the subscription callback sees current
   data and does not refetch the same profile repeatedly.
7. **Counter drift.** Derive attendance counts from the underlying rows rather
   than incrementing a stored column that can desynchronize.
8. **Timezone confusion.** A `datetime-local` input yields wall-clock text with
   no timezone. Convert to a UTC instant in the browser before submitting;
   never let the server's timezone silently reinterpret it.
9. **Leaking database errors.** Map every error code to friendly copy. A user
   should never see "duplicate key value violates unique constraint …".
10. **OAuth trust.** Do not treat the Google `hd` domain hint as security. The
    database trigger is the only real gate; make sure its rejection surfaces as
    the friendly domain message, not a generic failure.

---

### 10. Configuration and optional integrations

Everything optional must degrade silently, never crash. Specifically, if no
email API key is configured, the app runs fully on in-app notifications with
email sending as a no-op.

Required environment variables: the Supabase project URL, the public anon key,
the server-only service role key, and the site URL. Google SSO requires its
provider credentials configured in the Supabase dashboard (not in the app's
environment). Optional: the email provider key, sender address, and admin email.
Provide a `.env.example` documenting each with a comment explaining what it is
and where to find it. The service-role key must never be imported into
client-reachable code.

---

### 11. Testing and verification

- **Unit tests (Vitest)** covering: the password policy (including that it
  reports exactly the unmet rules), email-domain validation, every form schema,
  the conditional meetup validation, profile-privacy stripping, **filter
  construction including the rule that hidden fields exclude a user from that
  filter**, the join-button state machine, calendar-link generation, and
  error-code mapping. Test the exact boundaries: 2,000 vs 2,001 characters,
  capacity 2 and 50 vs 1 and 51, graduation years at the range edges.
- **Database invariant tests** — a SQL script that creates test users, exercises
  the functions from §7 concurrently, asserts each invariant, and rolls back.
- Before declaring completion, run and pass: the test suite, a TypeScript
  typecheck with zero errors, and a production build with zero errors. Then
  actually run the app and click through the primary flow — register (both by
  password and by Google), verify, onboard, create a group, join it as a second
  user, chat, filter for people, and schedule a meetup — confirming there are no
  console errors.

---

### 12. Deliverables

1. A working application meeting every requirement above.
2. Ordered, idempotent SQL migration files plus a seed file, runnable in a fresh
   Supabase project, commented per §3.
3. A `SETUP.md` runbook: creating the Supabase project, running the migrations,
   the exact auth settings to configure (password policy matching §5.2, email
   confirmation on, 24-hour link expiry, redirect URLs), **the full Google OAuth
   client setup**, the course CSV bulk-import instructions, environment
   variables, and deploying to Vercel.
4. A `QA.md` manual test checklist covering every feature.
5. A `GLOSSARY.md` defining the product's domain terms for new teammates.
6. A README explaining the project, the stack, how to run it locally, and every
   judgment call you made where the spec was ambiguous.
7. Clear, logically grouped commits.

**Build order:** scaffold and design system → database schema, RLS, and
functions → validation and server actions → public pages and auth (both
methods) → onboarding and dashboard → courses and groups → chat and meetups →
profiles, search, and filters → friends, messaging, and moderation → tests →
documentation.

If any requirement is ambiguous, choose the option that is simpler to operate,
cheaper to run, and safer for user data — and note the decision in the README.
