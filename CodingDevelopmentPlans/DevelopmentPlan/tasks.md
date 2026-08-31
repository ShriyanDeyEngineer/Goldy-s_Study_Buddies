# Implementation Plan: Study Buddies

## Overview

This plan breaks the Study Buddies platform into ordered phases, starting with infrastructure
and data models, then authentication, core features, realtime, background workers, and finally
frontend integration and end-to-end wiring. Each task references specific requirements and design
correctness properties. Tasks marked `*` are optional (tests/verification) and can be skipped for
a faster MVP.

Tech stack: **Next.js (App Router)** · **Python FastAPI** · **PostgreSQL via Supabase** ·
**Supabase Auth / Realtime / Storage** · **Redis** · **Celery** · **Resend/SendGrid** ·
**Google Calendar API**

---

## Tasks

- [ ] 1. Project scaffolding and shared infrastructure
  - [ ] 1.1 Initialize the FastAPI backend project structure
    - Create `backend/` directory with `app/`, `tests/`, `alembic/`, `workers/` sub-packages
    - Add `pyproject.toml` (or `requirements.txt`) pinning: FastAPI, SQLAlchemy (async), Alembic,
      Supabase-py, redis-py, celery[redis], httpx, pytest, hypothesis
    - Configure `app/config.py` to load environment variables (Supabase URL/key, Redis URL,
      email provider key, Google OAuth credentials)
    - Add FastAPI security middleware: CSP, X-Frame-Options, X-Content-Type-Options, HSTS
    - _Requirements: 16.1 (performance baseline), Design: Security Headers_

  - [ ] 1.2 Initialize the Next.js frontend project structure
    - Bootstrap with `create-next-app` using App Router and TypeScript
    - Pin dependencies: React Query (TanStack Query v5), Supabase-js, Tailwind CSS, React Hook Form,
      Zod, date-fns
    - Create `app/(public)/`, `app/(auth)/`, and `components/` directory trees matching the
      design's route/component structure
    - Set up Supabase Auth context provider at the root layout
    - _Requirements: 1.1–1.5, Design: Frontend Route Structure_

  - [ ] 1.3 Create Alembic migration: core database schema (part 1 — universities, users, courses)
    - Write migration for `universities`, `users`, `user_privacy_settings`, `user_social_links`,
      `courses`, `user_courses` tables with all constraints as specified in the data model
    - Add `CHECK (graduation_month BETWEEN 1 AND 12)` and all FK constraints
    - _Requirements: 2.1, 3.1, 3.3, 16.2_

  - [ ] 1.4 Create Alembic migration: core database schema (part 2 — groups, meetups, messaging)
    - Write migration for `study_groups`, `study_group_members`, `join_requests`,
      `group_invitations`, `meetups`, `meetup_attendance`, `group_messages`, `direct_messages`
    - Include `UNIQUE (course_id, name)` on `study_groups` and all indexes
      (`(group_id, created_at)` on `group_messages`, `(sender_id, recipient_id, created_at)` and
      `(recipient_id, is_read)` on `direct_messages`)
    - _Requirements: 5.4, 8.3, 12.3, Design: Data Models_

  - [ ] 1.5 Create Alembic migration: core database schema (part 3 — social, admin, email)
    - Write migration for `friends`, `friend_requests`, `blocks`, `study_buddy_requests`,
      `study_buddy_connections`, `reports`, `email_notifications`
    - Add canonical-ordering CHECK on `friends` (`user_id_a < user_id_b`) and
      `study_buddy_connections`
    - _Requirements: 11.1–11.5, 14.1–14.7, 15.2, Design: Data Models_

  - [ ] 1.6 Configure Redis connection, Celery app, and shared SQLAlchemy async session factory
    - Wire `app/db.py` (async SQLAlchemy engine + session factory)
    - Wire `app/redis_client.py` (redis-py async client)
    - Wire `workers/celery_app.py` with Redis broker and four queues: `emails`, `realtime`,
      `maintenance`, `default`
    - _Requirements: 16.1, Design: Background Job Design_


- [ ] 2. Authentication and session management (FastAPI)
  - [ ] 2.1 Implement domain validation and password policy helpers
    - Write `validate_email_domain(email, db)` — queries `universities` table for an active domain
      match; raises HTTP 400 with `DOMAIN_NOT_ALLOWED` if none found
    - Write `validate_password_policy(password)` — checks length ≥ 12, uppercase, lowercase, digit,
      special character; returns list of unmet criteria
    - _Requirements: 2.1, 2.2, 2.3, 2.4, Design: Domain Validation, Password Policy Enforcement_

  - [ ]* 2.2 Write property test for email domain validation (Property 1)
    - **Property 1: Email Domain Validation**
    - Generate arbitrary email strings; assert acceptance IFF domain is in the mocked allowlist
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.3 Write property test for password complexity validation (Property 2)
    - **Property 2: Password Complexity Validation**
    - Generate arbitrary password strings with Hypothesis; assert the validator accepts iff all five
      criteria are simultaneously satisfied; assert error list contains exactly the unmet criteria
    - **Validates: Requirements 2.3, 2.4**

  - [ ] 2.4 Implement `POST /auth/register` and `POST /auth/verify-email` endpoints
    - Call domain + password validators; create disabled Supabase Auth user; insert `users` row;
      enqueue verification email via `email_service`
    - Verification link expiry: token timestamp + 24 h; handle expired/used token with HTTP 400
    - _Requirements: 2.1–2.7_

  - [ ]* 2.5 Write property test for verification token expiry (Property 3)
    - **Property 3: Verification Token Expiry**
    - For arbitrary registration timestamps, assert token expiry equals creation time + exactly 24 h
    - **Validates: Requirements 2.5**

  - [ ] 2.6 Implement `POST /auth/login`, rate-limiting/lockout, and `POST /auth/logout`
    - On failed login: INCR `failed_attempts:{email}` (TTL 15 min); on 5th failure set
      `locked_until:{email}`; on success DEL counter
    - Return identical error message for wrong email vs wrong password (`LOGIN_FAILED`)
    - Session stored as `session:{user_id}:{jti}` in Redis (TTL 30 min, sliding)
    - Implement `GET /auth/session` and `POST /auth/resend-verification`
    - _Requirements: 2.8–2.11_

  - [ ]* 2.7 Write property test for login error indistinguishability (Property 4)
    - **Property 4: Login Error Indistinguishability**
    - For wrong-email and wrong-password scenarios, assert HTTP status and message body are identical
    - **Validates: Requirements 2.9**

  - [ ] 2.8 Implement `auth_middleware` FastAPI dependency
    - Validate Supabase JWT signature; look up `session:{user_id}:{jti}` in Redis; refresh TTL on
      each authenticated request (sliding 30-min window); raise `SESSION_EXPIRED` if key missing
    - _Requirements: 2.11, Design: Session Management_


- [ ] 3. User profiles, privacy, and avatar upload (FastAPI)
  - [ ] 3.1 Implement `GET /users/{user_id}` with privacy enforcement
    - Fetch `users` + `user_privacy_settings` row; strip hidden fields from the response dict
      before serialization
    - Apply `block_middleware` check so a blocked user cannot view the blocker's profile
    - _Requirements: 3.1, 3.3, 11.5_

  - [ ]* 3.2 Write property test for profile privacy enforcement (Property 5)
    - **Property 5: Profile Privacy Enforcement**
    - For arbitrary combinations of hidden fields, assert response contains exactly the complement
      set; blocked viewer receives 403
    - **Validates: Requirements 3.3**

  - [ ] 3.3 Implement `PUT /users/me`, `PUT /users/me/privacy`, and social links endpoints
    - Validate `display_name` length (1–50), `bio` ≤ 500 chars, social link count ≤ 5 and valid
      URLs; persist atomically; return updated profile
    - _Requirements: 3.1, 3.2, 3.6_

  - [ ] 3.4 Implement `POST /users/me/avatar` (multipart upload)
    - Validate MIME type server-side (must be `image/jpeg` or `image/png`) and size ≤ 5 MB before
      streaming to Supabase Storage; store returned CDN URL in `users.profile_picture_url`
    - _Requirements: 3.4, 3.5_

  - [ ]* 3.5 Write property test for profile picture upload validation (Property 6)
    - **Property 6: Profile Picture Upload Validation**
    - Generate arbitrary (mime_type, size_bytes) pairs; assert accept iff mime in {image/jpeg,
      image/png} AND size ≤ 5 242 880 bytes
    - **Validates: Requirements 3.4, 3.5**

- [ ] 4. Checkpoint — auth and profiles
  - Ensure all auth and profile tests pass; verify migrations apply cleanly on a fresh DB;
    ask the user if any questions arise.


- [ ] 5. Study group creation and management (FastAPI)
  - [ ] 5.1 Implement `POST /groups` (create study group)
    - Validate name (1–100 chars), capacity (2–50), mode present; check name uniqueness per course;
      verify all invitees are enrolled in the course; create group + manager membership in one
      transaction; enqueue invitation emails for each invitee
    - _Requirements: 5.1–5.6_

  - [ ] 5.2 Implement `GET /groups/{group_id}` and `PUT /groups/{group_id}`
    - Return group details, member list, upcoming meetups; manager-only edit of name and mode;
      on closed→open switch: auto-approve pending requests up to remaining capacity atomically
    - _Requirements: 7.1, 7.4, 8.1_

  - [ ]* 5.3 Write property test for study group capacity invariant (Property 7)
    - **Property 7: Study Group Capacity Invariant**
    - Simulate concurrent join/approve operations; assert `current_member_count` never exceeds
      `max_capacity` under any interleaving; rejected operations leave count unchanged
    - **Validates: Requirements 6.1, 6.5, 6.7**

  - [ ]* 5.4 Write property test for group membership after join (Property 8)
    - **Property 8: Group Membership After Join**
    - For arbitrary open groups with capacity, assert post-join member count = pre + 1 and user
      appears in member list
    - **Validates: Requirements 6.1**

  - [ ] 5.5 Implement join/leave endpoints and join request lifecycle
    - `POST /groups/{id}/join`: open groups add user immediately; closed groups create pending
      request + notify manager
    - `DELETE /groups/{id}/leave`: non-manager leave; manager leave triggers role transfer or
      disband (see 5.6)
    - `POST /groups/{id}/requests/{req_id}/approve` and `/deny`: check capacity on approval;
      enqueue result email
    - _Requirements: 6.1–6.8, 7.5–7.7_

  - [ ]* 5.6 Write property test for duplicate request idempotency (Property 9)
    - **Property 9: Duplicate Request Idempotency**
    - For join, friend, and study buddy requests, assert submitting a second identical pending
      request always returns DUPLICATE_REQUEST and count stays at 1
    - **Validates: Requirements 6.3, 10.4, 11.7**

  - [ ] 5.7 Implement manager-only actions: remove member, disband group
    - `DELETE /groups/{id}/members/{user_id}`: manager-only; decrement count; enqueue removal email
    - `DELETE /groups/{id}`: disband — delete all members, cancel future meetups, decline pending
      requests, enqueue notifications; all in one DB transaction
    - _Requirements: 7.1–7.3_

  - [ ]* 5.8 Write property test for manager-only action authorization (Property 10)
    - **Property 10: Manager-Only Action Authorization**
    - For any non-manager user, assert every manager action returns 403 and group state is unchanged
    - **Validates: Requirements 7.1**

  - [ ]* 5.9 Write property test for disband state completeness (Property 11)
    - **Property 11: Disband State Completeness**
    - After disband, assert zero members, zero pending requests, all future meetups cancelled,
      regardless of pre-disband state size
    - **Validates: Requirements 7.3, 7.7**

  - [ ]* 5.10 Write property test for closed-to-open mode switch auto-approval (Property 12)
    - **Property 12: Closed-to-Open Mode Switch Auto-Approval**
    - For P pending requests and remaining capacity C, assert exactly min(P, C) are approved and
      final count = initial + min(P, C)
    - **Validates: Requirements 7.4**

  - [ ] 5.11 Implement manager role transfer logic
    - On manager leave: query `study_group_members` ordered by `joined_at ASC`, then
      `users.created_at ASC`; assign manager role to first result; if no other members, disband
    - _Requirements: 7.6, 7.7_

  - [ ]* 5.12 Write property test for manager role transfer ordering (Property 13)
    - **Property 13: Manager Role Transfer Ordering**
    - For arbitrary member lists with various joined_at combinations (including ties), assert new
      manager is always the member with earliest joined_at (breaking ties by users.created_at)
    - **Validates: Requirements 7.6**


- [ ] 6. Group chat and message history (FastAPI)
  - [ ] 6.1 Implement `POST /groups/{id}/messages` and `GET /groups/{id}/messages`
    - Validate membership and message length ≤ 2,000 chars; persist to `group_messages`; publish
      INSERT event via Supabase Realtime SDK to channel `group-chat:{group_id}`
    - Paginated history ordered by `created_at ASC`; offline members get full history on reconnect
    - _Requirements: 8.2–8.6_

  - [ ]* 6.2 Write property test for message character limit (Property 14)
    - **Property 14: Message Character Limit**
    - For messages of length exactly 2000 and 2001, assert acceptance and rejection respectively;
      for arbitrary lengths, assert no message > 2000 is ever persisted
    - **Validates: Requirements 8.5, 12.6**

  - [ ]* 6.3 Write property test for chat history chronological order (Property 15)
    - **Property 15: Chat History Chronological Order**
    - Insert N messages with arbitrary timestamps; assert fetched list is in strictly ascending
      created_at order
    - **Validates: Requirements 8.3, 12.3**

- [ ] 7. Meetup scheduling (FastAPI)
  - [ ] 7.1 Implement `POST /groups/{id}/meetups` (create meetup)
    - Validate title (1–100 chars), scheduled_at is in the future, format present, location/link
      required per format; store in UTC; enqueue meetup notification email to all group members
    - Per-field error reporting for each missing/invalid field
    - _Requirements: 9.1, 9.2, 9.7_

  - [ ]* 7.2 Write property test for meetup validation completeness (Property 16)
    - **Property 16: Meetup Validation Completeness**
    - For arbitrary combinations of missing/invalid fields, assert a distinct per-field error is
      returned for each invalid field; no valid submission is rejected
    - **Validates: Requirements 9.1, 9.7**

  - [ ] 7.3 Implement meetup listing, attendance, and cancellation endpoints
    - `GET /groups/{id}/meetups`: return upcoming and past sections (status field drives this)
    - `PUT /groups/{id}/meetups/{mid}/attendance`: upsert `meetup_attendance`; update
      `attending_count` atomically
    - `DELETE /groups/{id}/meetups/{mid}`: manager-only cancel; enqueue cancellation emails with
      reason
    - _Requirements: 9.3–9.6_

  - [ ]* 7.4 Write property test for attendance count consistency (Property 17)
    - **Property 17: Attendance Count Consistency**
    - For arbitrary sequences of attendance status updates, assert attending_count equals exactly
      the number of members whose latest status is 'attending'
    - **Validates: Requirements 9.3**

  - [ ] 7.5 Implement Google Calendar link generation endpoint
    - `GET /groups/{id}/meetups/{mid}/calendar`: construct Google Calendar event URL with title,
      start time, location/link, and group name in the description; return URL for single-click add
    - _Requirements: 9.4_


- [ ] 8. Direct messaging (FastAPI)
  - [ ] 8.1 Implement DM send, history, and read-receipt endpoints
    - `POST /dm/{user_id}`: validate ≤ 2,000 chars; check block status (`block_middleware`); persist
      to `direct_messages`; publish to Supabase Realtime channel `dm:{sorted_pair}`
    - `GET /dm/{user_id}`: paginated history ordered by `created_at ASC` (retained ≥ 365 days)
    - `POST /dm/{user_id}/read`: SET `is_read = true` for all messages where
      `recipient_id = current_user` in this conversation
    - `GET /dm`: list conversations with unread counts (query `is_read = false` grouped by sender)
    - _Requirements: 12.1–12.6_

  - [ ]* 8.2 Write property test for unread message count accuracy (Property 22)
    - **Property 22: Unread Message Count Accuracy**
    - For arbitrary message sequences, assert unread count = count of rows where recipient=A and
      is_read=false; after read, count = 0
    - **Validates: Requirements 12.4**

- [ ] 9. Study buddy discovery (FastAPI)
  - [ ] 9.1 Implement study buddy discovery, request, and connection endpoints
    - `GET /study-buddy/discover`: filter `users` where `study_buddy_available = true`, optionally
      by course; return display_name, profile_picture_url, major, shared courses
    - `POST /study-buddy/requests/{user_id}`: create pending request; enqueue notification email;
      reject duplicates with `DUPLICATE_REQUEST`
    - `POST /study-buddy/requests/{id}/accept`: create canonical `study_buddy_connections` row
      (smaller UUID first); enqueue confirmation emails to both users
    - `POST /study-buddy/requests/{id}/decline` and `GET /study-buddy/connections`
    - _Requirements: 10.1–10.6_

  - [ ]* 9.2 Write property test for study buddy connection symmetry (Property 19)
    - **Property 19: Study Buddy Connection Symmetry**
    - After accepting a request from A→B, assert both A's and B's buddy lists contain each other
    - **Validates: Requirements 10.5, 10.6**


- [ ] 10. Friend system and block enforcement (FastAPI)
  - [ ] 10.1 Implement friend request lifecycle endpoints
    - `POST /friends/requests/{user_id}`: create pending request; enqueue email notification;
      reject duplicate with `DUPLICATE_REQUEST`
    - `POST /friends/requests/{id}/accept`: atomically insert into `friends` (canonical order) and
      delete the request row in one transaction
    - `POST /friends/requests/{id}/decline`: delete request row silently (no notification to sender)
    - `DELETE /friends/{user_id}`: delete `friends` row atomically; both users removed from each
      other's list in single operation
    - `GET /friends`: list own friends
    - _Requirements: 11.1–11.4, 11.6, 11.7_

  - [ ]* 10.2 Write property test for friend connection symmetry and atomicity (Property 20)
    - **Property 20: Friend Connection Symmetry and Atomicity**
    - After accept: A in B's list AND B in A's list (atomic). After unfriend: neither in the other's
      list. Assert no partial state is observable.
    - **Validates: Requirements 11.2, 11.4**

  - [ ] 10.3 Implement block/unblock and `block_middleware` dependency
    - `POST /friends/blocks/{user_id}`: insert into `blocks`; atomically remove any `friends` row
      and cancel any pending `friend_requests` between the pair
    - `DELETE /friends/blocks/{user_id}`: remove block row
    - `check_not_blocked` FastAPI dependency: injected on all messaging and profile endpoints
    - _Requirements: 11.5, 12.5_

  - [ ]* 10.4 Write property test for block relationship cleanup (Property 21)
    - **Property 21: Block Relationship Cleanup**
    - For arbitrary prior relationship states (friends, pending request, or none), assert all five
      post-block conditions hold simultaneously after a single block action
    - **Validates: Requirements 11.5**

- [ ] 11. Search, suggestions, and courses (FastAPI + Redis)
  - [ ] 11.1 Implement course listing with Redis cache
    - `GET /courses`: cache-aside with key `courses:{university_id}`, TTL 5 min; on miss query
      `courses` table filtered by university and `is_active = true`
    - `GET /courses/{id}/study-groups`: list active groups for a course
    - _Requirements: 4.2, 16.3_

  - [ ] 11.2 Implement user search and suggestion endpoints
    - `GET /search/users?q=`: validate q length ≥ 2 and ≤ 100; ILIKE query on `display_name` and
      `email`; return within 1 second target
    - `GET /search/suggestions`: cache-aside with key `suggestions:{user_id}`, TTL 1 min; rank
      shared-course users above same-graduation-year users; cap at 10 results
    - Invalidate `suggestions:{user_id}` when user joins a group or updates courses
    - _Requirements: 13.1–13.4, 16.3_

  - [ ]* 11.3 Write property test for search result relevance (Property 23)
    - **Property 23: Search Result Relevance**
    - For arbitrary query strings Q (len ≥ 2), assert every returned profile's name or email
      contains Q as a case-insensitive substring; no non-matching profile appears
    - **Validates: Requirements 13.1**

  - [ ]* 11.4 Write property test for suggestion ordering priority (Property 24)
    - **Property 24: Suggestion Ordering Priority**
    - For arbitrary user pools, assert shared-course users always precede same-graduation-year-only
      users; users sharing neither do not appear
    - **Validates: Requirements 13.3**


- [ ] 12. Report system and admin actions (FastAPI)
  - [ ] 12.1 Implement report submission endpoint
    - `GET /reports/reasons`: return predefined enum list
    - `POST /reports`: validate reason category selected and description ≤ 1000 chars; persist to
      `reports`; enqueue admin notification email; return confirmation and disclaimer in response
    - _Requirements: 14.1–14.4_

  - [ ] 12.2 Implement admin report queue and user sanction endpoints
    - `GET /admin/reports`: list all reports (admin-only middleware check)
    - `POST /admin/users/{id}/suspend`: validate duration 1–365 days; update `account_status`,
      set `suspension_expires_at`; delete all `session:{user_id}:*` Redis keys to terminate active
      sessions; enqueue suspension notification email; all atomically
    - `POST /admin/users/{id}/ban`: set `account_status = 'banned'`; same session termination and
      email flow
    - `POST /admin/users/{id}/unsuspend`: manually clear suspension
    - _Requirements: 14.5–14.7_

  - [ ]* 12.3 Write property test for suspension state consistency (Property 25)
    - **Property 25: Suspension State Consistency**
    - Assert suspension atomically produces all three effects: sessions invalidated, auth rejected,
      notification enqueued — no partial state valid
    - **Validates: Requirements 14.6**

- [ ] 13. Checkpoint — API layer complete
  - Ensure all FastAPI endpoint tests pass, migrations clean, Redis integration verified;
    ask the user if any questions arise.


- [ ] 14. Background workers (Celery)
  - [ ] 14.1 Implement `send_email_notification` Celery task
    - Read `email_notifications` row by `notification_id`; call Resend/SendGrid REST API; on success
      update `status = 'sent'`, `sent_at = now()`; on `EmailProviderError` with attempts < 3 update
      `status = 'retrying'`, increment `attempts`, retry with exponential backoff; after 3 failures
      set `status = 'failed'`
    - Route to `emails` queue (4 workers)
    - _Requirements: 5.6, 6.2, 6.4, 6.6, 7.2, 7.3, 9.2, 9.6, 10.3, 10.6, 11.1, 14.2, 14.6,
      14.7, 15.2_

  - [ ] 14.2 Implement `inactivity_scanner` Celery Beat task (daily at 02:00 UTC)
    - Step 1: users with `last_login_at < now - 90d` AND `inactivity_email_sent_at IS NULL` →
      enqueue re-engagement email, set `inactivity_email_sent_at = now()`
    - Step 2: groups with `last_activity_at < now - 60d` AND `status = 'active'` →
      `status = 'inactive'`, `inactive_since = now()`
    - Step 3: groups with `inactive_since < now - 30d` AND `status = 'inactive'` →
      archive: delete `study_group_members`, set `status = 'archived'`, enqueue archival emails
    - _Requirements: 15.1–15.8_

  - [ ]* 14.3 Write property test for group inactivity status transition (Property 27)
    - **Property 27: Group Inactivity Status Transition**
    - For groups with last_activity_at ≤ now−60d and status=active, assert scanner sets
      status=inactive; for inactive groups with qualifying member activity, assert status=active
    - **Validates: Requirements 15.4, 15.6**

  - [ ]* 14.4 Write property test for group archival state completeness (Property 28)
    - **Property 28: Group Archival State Completeness**
    - For groups with inactive_since ≤ now−30d, assert scanner produces: status=archived, 0 member
      rows, archival notification enqueued for each former member
    - **Validates: Requirements 15.7, 15.8**

  - [ ] 14.5 Implement `meetup_archival_worker` Celery Beat task (every 5 minutes)
    - `UPDATE meetups SET status='past' WHERE scheduled_at <= now() AND status='upcoming'`
    - _Requirements: 9.5_

  - [ ]* 14.6 Write property test for meetup UTC archival (Property 18)
    - **Property 18: Meetup UTC Archival**
    - For meetups with scheduled_at ≤ now (UTC), assert worker sets status=past; for future
      scheduled_at, assert status unchanged
    - **Validates: Requirements 9.5**

  - [ ] 14.7 Implement `suspension_expiry_worker` Celery Beat task (every 15 minutes)
    - `UPDATE users SET account_status='active', suspension_expires_at=NULL WHERE
      account_status='suspended' AND suspension_expires_at <= now()`
    - Re-enable Supabase Auth for affected users
    - _Requirements: 14.8_

  - [ ]* 14.8 Write property test for suspension auto-expiry (Property 26)
    - **Property 26: Suspension Auto-Expiry**
    - For users with suspension_expires_at ≤ now, assert worker sets account_status=active and
      suspension_expires_at=null; users with future expiry remain suspended
    - **Validates: Requirements 14.8**


- [ ] 15. Realtime frontend hooks and Supabase channel subscriptions (Next.js)
  - [ ] 15.1 Implement `useGroupChat` hook
    - Subscribe to `group-chat:{groupId}` Supabase Realtime channel on mount; on INSERT event
      append message to React Query cache; unsubscribe on unmount
    - On page load fetch full history from `GET /groups/{id}/messages` (offline message recovery)
    - _Requirements: 8.2, 8.6, Design: Realtime and Chat Architecture_

  - [ ] 15.2 Implement `useDirectMessages` hook
    - Subscribe to `dm:{sortedPair}` channel; update React Query DM cache on message INSERT;
      call `POST /dm/{user_id}/read` when conversation is opened to clear unread count
    - _Requirements: 12.1–12.4_

  - [ ] 15.3 Implement presence and notifications channel subscriptions
    - Subscribe to `presence:{groupId}` channel on group page; subscribe to
      `notifications:{user_id}` channel at auth layout level to push friend request and join
      request events into React Query cache; update `UnreadBadge` count
    - _Requirements: 8.1, 12.4, Design: Channel Types_

- [ ] 16. Frontend: public pages and authentication UI (Next.js)
  - [ ] 16.1 Build public marketing pages
    - Implement `app/(public)/page.tsx` (Home), `about/page.tsx`, `why/page.tsx`,
      `testimonials/page.tsx` as Server Components
    - Implement `PublicNav` with Sign In / Sign Up buttons linking to `/login` and `/register`
    - _Requirements: 1.1–1.5_

  - [ ] 16.2 Build `LoginForm` and `RegisterForm` client components
    - `RegisterForm`: React Hook Form + Zod; inline `PasswordStrengthMeter` showing per-criterion
      real-time feedback; calls `POST /api/v1/auth/register`
    - `LoginForm`: displays lockout countdown on `ACCOUNT_LOCKED` error; generic error message for
      failed credentials
    - `app/(auth)/layout.tsx`: checks Supabase Auth session; redirects unauthenticated users to
      `/login`
    - _Requirements: 2.1–2.10_


- [ ] 17. Frontend: dashboard, profile, and search UI (Next.js)
  - [ ] 17.1 Build Dashboard page and core discovery components
    - `app/(auth)/dashboard/page.tsx`: Server Component fetching courses and user groups; compose
      `CourseGroupList`, `UserSearchBar`, `UserSuggestions`, enrolled group cards
    - `UserSearchBar`: debounced input (min 2 chars, max 100); calls `GET /search/users?q=`;
      renders results inline
    - `UserSuggestions`: displays up to 10 suggestions from `GET /search/suggestions`; clicking
      navigates to profile page
    - `EmptyState` component for zero-courses and zero-groups states
    - _Requirements: 4.1–4.5, 13.1–13.4_

  - [ ] 17.2 Build profile view and edit UI
    - `app/(auth)/profile/[userId]/page.tsx`: renders `ProfileFull` — only shows fields returned
      by API (privacy already enforced server-side); shows Friend count
    - `app/(auth)/profile/edit/page.tsx`: renders `ProfileEditForm` with per-field privacy toggles;
      preserves unsaved input on server error (Req. 3.6)
    - `AvatarUpload`: client-side MIME and size validation before calling `POST /users/me/avatar`
    - _Requirements: 3.1–3.6_

- [ ] 18. Frontend: study group pages and group management UI (Next.js)
  - [ ] 18.1 Build group creation and group listing UI
    - `app/(auth)/groups/new/page.tsx`: renders `CreateGroupForm`; per-field validation with React
      Hook Form + Zod matching backend rules; invitee picker filtered to course enrollees
    - `CourseGroupList`: renders `GroupCard` list with `JoinRequestButton` showing
      Join / Request / Requested / Member state
    - _Requirements: 5.1–5.6, 6.1–6.8_

  - [ ] 18.2 Build group detail page (chat + meetups + members)
    - `app/(auth)/groups/[groupId]/page.tsx`: composes `ChatPanel` (using `useGroupChat`),
      `MeetupList`, `MemberList`; shows attendance counts
    - `ChatPanel` / `MessageInput`: 2000-char counter; blocks send above limit
    - `MeetupList`: renders upcoming and past sections; `AttendanceSelector` with optimistic update
    - `AddToCalendarButton`: calls calendar endpoint and opens URL in new tab
    - _Requirements: 8.1–8.6, 9.3–9.6_

  - [ ] 18.3 Build group settings page (manager only)
    - `app/(auth)/groups/[groupId]/settings/page.tsx`: renders `GroupSettings` — edit name/mode,
      member list with remove buttons, disband button with `ConfirmDialog`
    - `CreateMeetupForm`: date/time picker in user's local timezone; per-field error display
    - _Requirements: 7.1–7.7, 9.1, 9.2, 9.7_

- [ ] 19. Frontend: messaging, study buddy, and friends UI (Next.js)
  - [ ] 19.1 Build DM conversation UI
    - `app/(auth)/messages/page.tsx`: list conversations with `UnreadBadge` counts
    - `app/(auth)/messages/[userId]/page.tsx`: renders `DMConversation` using `useDirectMessages`;
      auto-marks read on open; 2000-char limit enforced in `MessageInput`
    - _Requirements: 12.1–12.6_

  - [ ] 19.2 Build study buddy discovery UI
    - `app/(auth)/study-buddy/page.tsx`: renders `StudyBuddyList` with course/subject filter;
      send request button with pending state indicator
    - _Requirements: 10.1–10.6_

  - [ ] 19.3 Build friends and blocks UI
    - `app/(auth)/friends/page.tsx`: renders `FriendList`, `FriendRequestList`,
      `BlockedUserList`; accept/decline inline; block/unblock actions
    - `ReportModal`: accessible from any user profile; predefined categories dropdown; 1000-char
      description; disclaimer text; confirmation on submit
    - _Requirements: 11.1–11.7, 14.1–14.4_


- [ ] 20. Frontend: admin UI (Next.js)
  - [ ] 20.1 Build admin report queue and user management pages
    - `app/(auth)/admin/reports/page.tsx`: table of open reports with reporter/reported identities,
      category, description, timestamp; actions: suspend (with duration 1–365 days) or ban
    - `app/(auth)/admin/users/[userId]/page.tsx`: view user status; suspend/ban/unsuspend actions
    - Admin route guard: check user role in `auth` layout; redirect non-admins to dashboard
    - _Requirements: 14.5–14.7_

- [ ] 21. Checkpoint — frontend complete
  - Ensure all frontend components render correctly, Realtime subscriptions connect, and form
    validations match backend rules; ask the user if any questions arise.

- [ ] 22. Integration wiring and end-to-end data flow
  - [ ] 22.1 Wire Next.js API route proxies to FastAPI
    - Create `app/api/[...path]/route.ts` proxy handler that forwards authenticated requests
      (with JWT from Supabase Auth session cookie) to FastAPI at `FASTAPI_URL`
    - Ensure CORS is configured on FastAPI to accept requests from the Next.js origin only
    - _Requirements: 16.1, Design: API Design_

  - [ ] 22.2 Wire `email_service` module and validate full email delivery flow end-to-end
    - Implement `email_service.enqueue(recipient, notification_type, payload)`:
      inserts `email_notifications` row then calls `send_email_notification.apply_async()`
    - Smoke-test: register a test user, verify the verification email notification is queued and
      Celery picks it up
    - _Requirements: 5.6, 6.2, 6.4, 6.6, 15.2_

  - [ ]* 22.3 Write integration tests for the full auth registration + email verification flow
    - Test: register → notification enqueued → verification link → account activated → redirect to
      dashboard; assert each step
    - _Requirements: 2.1–2.7_

  - [ ] 22.4 Configure Celery Beat schedule entries and verify periodic task execution
    - Add beat schedule in `workers/celery_app.py`: `inactivity_scanner` daily 02:00 UTC,
      `meetup_archival` every 5 min, `suspension_expiry` every 15 min
    - Write a smoke test that mocks the DB and asserts each periodic task runs without error
    - _Requirements: 9.5, 14.8, 15.1–15.8_

  - [ ] 22.5 Configure Supabase RLS policies for Realtime channels
    - Add RLS policies ensuring users can only subscribe to `group-chat:{id}` channels for groups
      they are members of, `dm:*` channels that include their own user_id, and their own
      `notifications:{user_id}` channel
    - _Requirements: 8.2, 12.1, Design: Row-Level Security_

- [ ] 23. Final checkpoint — all systems integrated
  - Run the full test suite (unit, property, integration); verify all 16 requirements have at least
    one covering test; ask the user if any questions arise before closing out.


---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they cover property-based
  and integration testing but not core functionality.
- Every property test task references an explicit Property number and the requirements it validates.
- All 16 requirements are covered: Req 1 → Task 16.1; Req 2 → Tasks 2.1–2.8; Req 3 → Tasks 3.1–3.5;
  Req 4 → Task 17.1; Req 5 → Task 5.1; Req 6 → Task 5.5; Req 7 → Tasks 5.2, 5.7, 5.11;
  Req 8 → Tasks 6.1, 18.2; Req 9 → Tasks 7.1–7.5, 18.2–18.3; Req 10 → Task 9.1;
  Req 11 → Tasks 10.1–10.3; Req 12 → Task 8.1; Req 13 → Tasks 11.1–11.2;
  Req 14 → Tasks 12.1–12.2; Req 15 → Tasks 14.2–14.4; Req 16 → Tasks 1.1, 11.1–11.2.
- All 28 correctness properties are covered by property test sub-tasks (2.2, 2.3, 2.5, 2.7, 3.2,
  3.5, 5.3, 5.4, 5.6, 5.8, 5.9, 5.10, 5.12, 6.2, 6.3, 7.2, 7.4, 9.2, 10.2, 10.4, 11.3, 11.4,
  12.3, 14.3, 14.4, 14.6, 14.8, 8.2).
- Checkpoints at tasks 4, 13, 21, and 23 provide incremental validation gates.


## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"],
      "notes": "Independent project scaffolding — backend and frontend can be initialized in parallel"
    },
    {
      "id": 1,
      "tasks": ["1.3", "1.4", "1.5", "1.6"],
      "notes": "All DB migrations and infra wiring depend only on the project structure from wave 0"
    },
    {
      "id": 2,
      "tasks": ["2.1"],
      "notes": "Domain + password helpers require DB models (migrations done in wave 1)"
    },
    {
      "id": 3,
      "tasks": ["2.2", "2.3", "2.4"],
      "notes": "Auth register/verify endpoints and property tests for validators (wave 2 helpers ready)"
    },
    {
      "id": 4,
      "tasks": ["2.5", "2.6"],
      "notes": "Token expiry property test requires register endpoint; login requires register flow"
    },
    {
      "id": 5,
      "tasks": ["2.7", "2.8"],
      "notes": "Login indistinguishability test and auth middleware require login endpoint from wave 4"
    },
    {
      "id": 6,
      "tasks": ["3.1", "3.3", "3.4"],
      "notes": "Profile endpoints require auth middleware (wave 5); all independent of each other"
    },
    {
      "id": 7,
      "tasks": ["3.2", "3.5", "5.1", "16.1"],
      "notes": "Profile property tests (require endpoints wave 6); group creation (requires auth+profile); public pages (only needs frontend scaffold)"
    },
    {
      "id": 8,
      "tasks": ["5.2", "5.5", "5.7", "5.11", "16.2"],
      "notes": "Group read/edit/join/leave/disband/transfer (require create from wave 7); auth forms (require scaffold)"
    },
    {
      "id": 9,
      "tasks": ["5.3", "5.4", "5.6", "5.8", "5.9", "5.10", "5.12", "6.1", "7.1"],
      "notes": "All group property tests (require group endpoints waves 7–8); chat and meetup create endpoints"
    },
    {
      "id": 10,
      "tasks": ["6.2", "6.3", "7.2", "7.3", "7.4", "8.1", "9.1"],
      "notes": "Message/meetup/DM property tests and DM endpoint require chat/meetup/study-buddy endpoints from wave 9"
    },
    {
      "id": 11,
      "tasks": ["7.5", "9.2", "10.1", "11.1", "11.2"],
      "notes": "Google Calendar endpoint, buddy connection symmetry test, friend lifecycle, course listing — all require wave 10 foundations"
    },
    {
      "id": 12,
      "tasks": ["8.2", "10.2", "10.3", "11.3", "11.4"],
      "notes": "Unread count test (requires DM from wave 10); block middleware (requires friend endpoints); friend symmetry test; search endpoints"
    },
    {
      "id": 13,
      "tasks": ["10.4", "12.1", "12.2", "14.1"],
      "notes": "Block cleanup test (requires block middleware wave 12); report endpoints; email Celery task"
    },
    {
      "id": 14,
      "tasks": ["12.3", "14.2", "14.5", "14.7"],
      "notes": "Suspension consistency test; inactivity scanner, meetup archival, suspension expiry workers (all require email task from wave 13)"
    },
    {
      "id": 15,
      "tasks": ["14.3", "14.4", "14.6", "14.8", "15.1", "15.2", "15.3"],
      "notes": "Worker property tests (require workers wave 14); Realtime hooks (require chat/DM endpoints)"
    },
    {
      "id": 16,
      "tasks": ["17.1", "17.2", "18.1"],
      "notes": "Dashboard/profile/group-creation frontend (requires API + Realtime hooks from waves 6–15)"
    },
    {
      "id": 17,
      "tasks": ["18.2", "18.3", "19.1", "19.2", "19.3"],
      "notes": "Group detail, settings, DM, study buddy, friends UI (requires group/DM/buddy/friend API)"
    },
    {
      "id": 18,
      "tasks": ["20.1"],
      "notes": "Admin UI requires report and sanction API (wave 13–14)"
    },
    {
      "id": 19,
      "tasks": ["22.1", "22.4", "22.5"],
      "notes": "Integration wiring: Next.js proxy, Celery Beat schedule, RLS policies — require all API and worker tasks complete"
    },
    {
      "id": 20,
      "tasks": ["22.2", "22.3"],
      "notes": "Email service wiring and auth integration test require proxy + email worker wired (wave 19)"
    }
  ]
}
```
