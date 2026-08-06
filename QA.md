# QA — manual test checklist

Run through this before every release. Each line is a checkbox: mark it,
and if it fails, file it with the steps that broke it. "U1/U2/U3" means
distinct test accounts (use `yourname+1@umn.edu` style aliases).

## Marketing & SEO

- [ ] `/` renders: hero, two CTAs (Get started → /register, See how it
      works → scrolls to the section), 3-step how-it-works, features,
      closing CTA.
- [ ] `/about`, `/why`, `/testimonials` render; testimonials shows the
      "be the first" empty state.
- [ ] Header links + Sign in/Sign up work on all four pages; footer shows
      team, contact, and the "not officially affiliated" disclaimer.
- [ ] `/sitemap.xml` lists only public pages; `/robots.txt` disallows
      /dashboard, /groups, /people, /messages, etc.
- [ ] Everything usable at 375px, 768px, 1024px, 1440px.

## Registration — email & password

- [ ] Live checklist: each of the 5 rules flips green as you type.
- [ ] Submitting a weak password lists EXACTLY the unmet rules — no
      more, no fewer.
- [ ] `you@gmail.com` is rejected with the friendly domain message.
- [ ] Valid signup lands on "Check your inbox" showing the address and
      the 24-hour warning.
- [ ] Unverified login attempt bounces back to the verify screen.
- [ ] Resend button reports the same neutral message whether or not the
      address exists.
- [ ] The emailed link signs you in and opens onboarding.
- [ ] Clicking the SAME link again shows the friendly expired/used-link
      page with resend options (not a raw error).
- [ ] Registering an email that already has an account behaves exactly
      like a fresh signup (no "account exists" hint).

## Registration — Google

- [ ] "Continue with UMN Google" opens Google with UMN accounts surfaced.
- [ ] A umn.edu Google account lands directly in onboarding (no email
      verification step).
- [ ] A personal Gmail is REJECTED and the login page shows "Only
      @umn.edu accounts can join" — not a raw database error.

## Login & reset

- [ ] Wrong password and nonexistent email produce the IDENTICAL
      "Email or password is incorrect." message.
- [ ] Forgot-password always says "if that email has an account…" —
      same response either way.
- [ ] Reset link opens the new-password form (with live checklist);
      saving signs you in.
- [ ] Signed-in users hitting /login or /register are bounced to
      /dashboard; signed-out users hitting /dashboard are bounced to
      /login and return to their target after signing in.

## Onboarding

- [ ] Exactly 3 steps; only display name is required; optional fields
      are labeled optional and never block Next.
- [ ] Pressing Enter in a text field advances the step — it must NOT
      submit the wizard.
- [ ] Course picker searches by code and by name; skipping it is fine.
- [ ] Avatar: a 6 MB file and a .txt renamed to .png are both rejected
      with the format/size message; a real JPEG under 5 MB previews and
      saves.
- [ ] Refresh mid-wizard: no crash, no half-saved account; the wizard
      restarts cleanly.
- [ ] After Finish you land on /dashboard; revisiting /onboarding
      redirects back to /dashboard.

## Dashboard

- [ ] Empty state (fresh account): every section shows encouraging copy
      with an action, not blank space.
- [ ] With data: my groups show course code, members/capacity,
      open/closed badge, and next meetup; courses show group counts;
      explore lists most-active courses.
- [ ] Search box with ≥2 chars goes to /people?q=…
- [ ] Suggested people: only course-sharers and grad-year-sharers, max
      10, course-sharers first.

## Courses

- [ ] Catalog search matches department (CSCI), number (1301), and name
      (physics); department + college filters narrow the list.
- [ ] Empty search results offer "Add a missing course" prominently.
- [ ] Adding a duplicate course routes to the existing page with the
      "already in the catalog" note — never a raw error.
- [ ] Course page lists active groups, each with the correct join
      control; "Create a group for this course" works.

## Groups — creating & joining

- [ ] Creation form: capacity outside 2–50 and empty name give inline
      per-field errors; open/closed difference is explained.
- [ ] Invite picker only offers CURRENT classmates, caps at
      capacity − 1, and re-checks on submit.
- [ ] "My course isn't listed" path creates course + group together.
- [ ] Duplicate group name within one course → inline NAME_TAKEN error
      on the name field.
- [ ] Join button states: Join (open), Request to join (closed),
      Requested ✓ (click withdraws), Member, Manager, Full, Unavailable
      — and a member of a full group sees Member, not Full.
- [ ] U2 joining an open group lands them in it instantly; joining a
      full group is refused with the friendly full message.
- [ ] Closed group: U2's second request attempt → "already have a
      request waiting"; withdraw works.
- [ ] Invitee sees the Accept/Decline banner on the group page;
      accepting seats them even though the group is closed.

## Group page

- [ ] Non-member preview: name, course, member count, manager, mode,
      join control — and NO chat/meetups/member list.
- [ ] Chat: U1's message appears for U2 within ~2s without refresh; own
      messages right-aligned maroon; sender name+avatar on others';
      date separators correct.
- [ ] Counter turns red at 2,001 chars and Send is disabled; a 2,000-char
      message sends.
- [ ] Scroll up during incoming messages → "New messages" pill appears,
      clicking jumps to newest; at bottom it auto-scrolls.
- [ ] Meetups: creating with everything invalid shows ALL field errors
      at once; online requires link, in-person requires location.
- [ ] Times display in local time; RSVP's three states stick; attending
      count equals the people attending, always.
- [ ] Add to Google Calendar opens a prefilled event (right title, time,
      location).
- [ ] Cancel meetup (creator or manager only): reason optional, card
      struck through, members notified.
- [ ] Poll: 2–20 future slots, votes toggle live, top slot highlighted
      with Schedule button (prefilled), close poll works.
- [ ] Members panel: crown on manager; manager sees pending requests
      with Approve/Deny; Remove asks for confirmation and notifies the
      removed member; Leave explains consequences.

## Group management

- [ ] /groups/[id]/settings as NON-manager → 404 (not 403, not redirect).
- [ ] Rename re-checks uniqueness; mode switch works.
- [ ] Closed→open with 3 waiting and 2 seats: exactly the 2 OLDEST
      approved, the third cancelled + notified.
- [ ] Disband requires typing the exact group name; after: members
      notified, meetups cancelled, requests declined, group page shows
      unavailable.
- [ ] Manager leaves → longest-tenured member becomes manager (crown
      moves, notification arrives). Last member leaving disbands.

## People, filters, buddies

- [ ] Search needs 2+ chars; matches names case-insensitively; matching
      by email finds the person but their email is NEVER displayed.
- [ ] Every filter narrows server-side; combinations AND together;
      result count updates.
- [ ] Filters appear in the URL; copy the URL into a new tab → same
      filtered view; chips remove single values; Clear all resets.
- [ ] Empty result state suggests loosening filters.
- [ ] PRIVACY: U2 hides their major → filtering by that major no longer
      returns U2 at all; unhiding brings them back.
- [ ] Buddy toggle on /people flips your availability; buddies-only
      filter shows only available students; buddy request → accept →
      both notified; disconnect works.

## Profiles & privacy

- [ ] Own profile shows everything + Edit; other profiles show
      add-friend / message / block / report.
- [ ] Each privacy switch hides its field from ANOTHER account's view
      (absent, not blank) — spot-check college, graduation, current
      classes.
- [ ] Save failure (e.g. 501-char bio) keeps everything you typed in
      the form.
- [ ] Social links: 6th link refused; `notaurl` refused; links open in
      new tabs.

## Friends, DMs, blocking

- [ ] Friend request: send → recipient notified → accept → both in each
      other's lists + sender notified. Decline: silent, sender NOT
      notified.
- [ ] Duplicate pending request refused; crossing requests (A→B while
      B→A pending) just connects them.
- [ ] DMs deliver in realtime both directions; unread badge counts per
      conversation and clears on open; history survives refresh.
- [ ] U1 blocks U2 → friendship gone, buddy link gone, pending requests
      gone; U2 can't message U1 ("can't send that request"-style error),
      can't friend-request, can't see U1's profile (404), and neither
      appears in the other's search. Unblock restores visibility but
      NOT the old friendship.

## Notifications

- [ ] Bell badge increments live (have U2 trigger something while U1
      watches); dropdown lists latest; clicking navigates AND marks
      read; badge decrements.
- [ ] /notifications lists all; Mark all as read zeroes the badge.

## Reporting & moderation

- [ ] Report requires a category; description caps at 1,000; the
      false-report warning is visible; confirmation shows after submit.
- [ ] With ADMIN_EMAIL configured, the report emails the team; without
      any email config, submitting still succeeds silently.
- [ ] Setting U2's account_status to `suspended` locks them to the
      explanation screen with working sign-out, and removes them from
      U1's search/suggestions.

## The three states, everywhere

- [ ] Loading: dashboard and course pages show skeletons on slow
      connections (throttle to verify).
- [ ] Empty: every list has designed copy + an action (dashboard
      sections, catalog search, group page, people results, messages,
      notifications, friends).
- [ ] Error: kill the network mid-navigation → the error boundary offers
      Try again, and it works.

## Accessibility spot-checks

- [ ] Tab through registration, group creation, and chat: every control
      reachable, gold focus ring always visible, dialogs trap focus and
      close on Escape.
- [ ] Icon-only buttons (bell, send, close, remove) announce sensible
      labels in a screen reader.
- [ ] New chat messages are announced (aria-live) without stealing focus.
