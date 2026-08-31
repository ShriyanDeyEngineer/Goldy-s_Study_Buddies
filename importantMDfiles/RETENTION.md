# Data retention

Every kind of stored data is deleted from the database a fixed number of days
after it stops being useful. One number governs almost all of it. The course
catalog (`courses`) and the university allow-list (`universities`) are the
only things kept forever, on purpose.

Enforced by `public.purge_stale_rows()`, run nightly at 03:30 UTC by
`pg_cron`. Introduced in migration `0035_retention_grace_period.sql`.

## The grace period

```
public.retention_grace_days()             -> 365   -- the one number
public.retention_grace_days_moderation()  -> delegates to the base
```

### Changing it

Redefine the function. That's the whole change — no application deploy, no
code edit. The purge is pure SQL + cron and never reads anything from the
Next.js side, so the value lives only here (there is deliberately **no**
mirror in `lib/constants.ts`).

```sql
create or replace function public.retention_grace_days()
  returns int language sql stable
  set search_path = public, pg_temp
  as $$ select 730 $$;   -- new value
```

Run it as a tiny migration, or paste it straight into the Supabase SQL
editor. It takes effect on the next nightly run.

- **Keep the moderation record longer.** `message_originals` (uncensored
  flagged messages) and resolved `reports` follow
  `retention_grace_days_moderation()`. Redefine *only* that function to give
  them a longer evidence window; everything else stays on the base.
- **Kill switch.** `... as $$ select 100000 $$` on `retention_grace_days()`
  effectively disables all time-based deletion, no deploy.

### Before changing it — preview

```sql
select * from public.preview_stale_purge();
```

Returns, per table, how many rows the *next* purge run would delete under the
current setting. Direct matches only — cascades (RSVPs from meetups, slots
and votes from polls, every child of a disbanded group) are on top. Run this
first whenever you change the period.

## What expires, and from when

### Bucket 1 — `grace` days after it was created

| Data | Table | Clock |
|---|---|---|
| Direct messages | `direct_messages` | `created_at` |
| Group chat | `group_messages` | `created_at` |
| Shared notes & links | `group_resources` | `created_at` |
| Availability polls (+ slots, votes by cascade) | `availability_polls` | `created_at` |
| Flagged-message log | `message_originals` | `created_at`, **moderation** knob |
| Meetups (+ RSVPs by cascade) | `meetups` | `scheduled_at` — a far-future booking is never deleted before it happens |

Closing an availability poll still deletes it immediately (migration 0022);
Bucket 1 only sweeps polls nobody ever closed.

### Bucket 2 — `grace` days after it was created, even if still pending

With one grace period, "created + grace" always comes before "resolved +
grace", so a single `created_at` cutoff covers resolved *and* never-resolved
rows.

`friend_requests`, `study_buddy_requests`, `join_requests`,
`group_invitations`, `course_requests`, `notifications`.

**Exception — `reports`.** A report is deleted `grace` days after it is
marked `resolved`/`dismissed` (`reports.resolved_at`, stamped by a trigger).
An `open`/`reviewing` report is **never** auto-deleted, however old.

### Bucket 3 — `grace` days after a user's delete/disband decision

| Data | From | Notes |
|---|---|---|
| Disbanded group + all its content | `study_groups.disbanded_at` | One delete cascades chat, meetups (+RSVPs), polls (+slots+votes), resources, members, request history |
| A deleted account's `user_courses`, `friends`, `study_buddy_connections`, `blocks` | `profiles.deleted_at` | |
| A deleted account's retained email | `deleted_account_emails.deleted_at` | |
| The scrubbed profile tombstone | `profiles.deleted_at` | Only once the period is up **and** nothing else still points at it (chat, reports, meetups/polls/resources created, groups managed) |

## Account deletion

Deleting an account is **not** deferred wholesale. Two speeds:

**Immediately** (`scrub_account_core()`), because it affects other people:

- Leave every group — manager succession and last-member disband run now.
- Cancel pending requests/invitations in both directions.
- Drop the account's RSVPs, poll votes, notification inbox, and any pending
  course request.
- Scrub all profile PII to a `Deleted User` tombstone (deletion is
  irreversible — nothing will read those fields again).
- Delete the `auth.users` row, so the same Google account can immediately
  sign up again as a brand-new user with a new id.

**After the grace period** (`purge_stale_rows()`):

- `user_courses`, `friends`, `study_buddy_connections`, `blocks`,
  `deleted_account_emails`, then the tombstone row itself.

During the window the account shows as `Deleted User` everywhere (the app
already hides `account_status = 'deleted'` from search, profiles, and DMs)
and still occupies a slot in the other party's friends list.

## Never deleted

- `courses` — the catalog everyone browses.
- `universities` — the email-domain allow-list.

## Rollback

`docs/retention-rollback.sql` restores the pre-0035 purge, account-deletion,
and windows. Rows already purged are recoverable only from a database backup
/ PITR — take one before first enabling this.
