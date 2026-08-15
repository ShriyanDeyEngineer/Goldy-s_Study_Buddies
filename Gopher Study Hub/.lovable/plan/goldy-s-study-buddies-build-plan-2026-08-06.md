# Goldy's Study Buddies — build plan

A UMN-only study-group platform: verified @umn.edu accounts, course catalog, open/closed study groups, realtime group chat, meetups with RSVPs and availability polls, plus profiles, friends, DMs, and moderation.

## Stack note (important)

This project runs on **TanStack Start** (React 19 + Vite) with **Lovable Cloud** (Postgres, Auth, Realtime, Storage). Next.js/Vercel aren't available here, so the spec is ported one-to-one:

- Server Actions → **server functions** (`createServerFn`) with Zod validation
- RSC reads → **route loaders + TanStack Query** using the user's session
- Everything else in the spec is honored as written: Tailwind v4 CSS-first tokens, hand-rolled shadcn-style components on Radix, lucide-react, date-fns, sonner, Vitest, Postgres SECURITY DEFINER functions for all invariants.

Email confirmation stays **on**, so each test account needs a real inbox click.

## Design system

Maroon `#7A0019` / maroon-dark `#5B0013` / gold `#FFCC33` / gold-light `#FFDE7A` / cream `#FFFAF0` background / white cards / ink `#1A1A1A` / ink-muted `#6B6B6B` / line `#EDE6DC`, plus success/warning/danger. DM Serif Display headings, Inter body at 16px, radius 0.75rem, gold focus rings, never gold-on-cream. Original gopher-silhouette SVG only — no UMN marks — and a footer disclaimer: "Not officially affiliated with the University of Minnesota."

Every list and panel ships loading skeleton, encouraging empty state, and error+retry. Mobile-first, verified at 375/768/1024/1440, WCAG 2.1 AA.

## Phase 1 — core (this build)

1. **Design system + public site.** Tokens, fonts, Button/Input/Card/Dialog/Tabs/Badge/Avatar/Skeleton primitives, shared header and footer. Routes: `/`, `/about`, `/why`, `/testimonials`, plus `robots.txt` and `sitemap.xml` (auth routes disallowed).
2. **Database.** All ~22 tables with RLS from §5, seeded with University of Minnesota + ~40 real UMN courses (PHYS 1301W, CHEM 1061/1062, CSCI 1133/1913/2011, MATH 1271–2263, BIOL 1009, STAT 3021, ECON 1101/1102, PSY 1001, WRIT 1301, …). Client insert/update/delete revoked on group-state tables; a trigger on the auth users table checks the email domain against the `universities` allow-list so a second school is one row, not a code change.
3. **Postgres state machine functions** (SECURITY DEFINER, `SELECT … FOR UPDATE` on the group row first, then request rows): join/request/withdraw, approve/deny, remove member, leave with deterministic succession, mode switch approving exactly `min(pending, remaining)`, disband in one transaction, block-completeness, profile-privacy view. Each raises codes like `GROUP_FULL`, `NAME_TAKEN`, `NOT_MANAGER`, `DUPLICATE_REQUEST`, mapped to friendly copy — no raw DB errors ever surface.
4. **Auth.** Register/login/reset with the 12-char + upper/lower/digit/special policy, live green checklist, errors listing exactly the unmet rules, identical generic messages for login failure and forgot-password. Verification screens for expired/used links with resend. Google SSO behind an env flag, default off.
5. **Onboarding wizard.** Three refresh-safe steps (display name 1–50, major, graduation month/year, courses, optional bio and avatar); Enter advances instead of submitting; app gated until a display name exists.
6. **Dashboard.** My groups, your courses, explore courses, user search (2–100 chars), suggested people ranked shared-course-first then shared-grad-year, never neither.
7. **Courses and groups.** Searchable catalog with group counts, add-a-missing-course routing duplicates to the existing row, course detail with join controls, group creation (name unique per course, capacity 2–50 default 8, open/closed, invite picker limited to enrolled classmates and capacity−1, re-validated server-side).
8. **Group page.** Non-member preview vs member view. Realtime chat (1–2,000 chars, live counter, date separators, own messages right-aligned maroon, "New messages ↓" pill, dedupe by id, one instance reflowed with CSS). Meetups with future-dated UTC storage, conditional link/location validation reporting all bad fields at once, three-state RSVP with derived counts, Google Calendar template link, cancel with reason. Members panel with crown, pending approvals, remove, leave.
9. **Manager settings page** returning 404 to non-managers: rename, mode switch, typed-name disband.
10. **Notifications**: bell badge, dropdown, full page, mark-all-read, all 15 types wired for the phase-1 events.

## Phase 2 (after you've seen phase 1 working)

Availability polls, profiles with per-field server-side privacy stripping and 5 MB JPEG/PNG server-side MIME validation, friends, direct messages, study-buddy mode and discovery, reporting and account status/suspension, admin flag, full Vitest suite (boundaries at 2000/2001 chars, capacity 1/2/50/51, grad-year edges), the SQL invariant script, and SETUP.md / QA.md / README.

## Pitfalls explicitly guarded

Button defaults to `type="button"`; Enter intercepted in the wizard; no interactive elements nested in buttons; session-without-profile renders a "sign out and start over" screen instead of looping; route params UUID-validated before use in filters; realtime sender lookups cached in a ref; attendance counts derived, never stored; datetime-local converted to a UTC instant in the browser; every DB error code mapped to friendly copy.

## Verification

Typecheck, production build, and a clicked-through primary flow — register, verify, onboard, create a group, join as a second user, chat, schedule a meetup — with no console errors before I call phase 1 done.
