# MAINTENANCE — keeping Study Buddies alive on a few hours a month

Written for the team that actually runs this: a handful of UMN students who
have their own coursework. The goal is a site that stays up, stays safe, and
stays current **without** anyone babysitting it. Everything here is designed
around three ideas:

1. **The system tells you when something is wrong.** You do not watch dashboards.
2. **Work is time-boxed and scheduled** — ~20 min/week, ~2 hr/month, ~half a
   day per semester, and nothing urgent hides outside those windows except
   safety and outages.
3. **Any two people on the team can do any task.** No step lives in one
   person's head or one person's laptop.

If the team ever can't sustain even the minimum, there is a shutdown plan
(§10). An unmoderated student social site left running unattended is worse
than one that closed on purpose.

---

## 1. Roles

| Role | Who | Does |
|---|---|---|
| **Lead / owner** | Shriyan | Holds the root accounts, makes the call on Sev-1 incidents, grants and revokes access, owns this plan. |
| **Backup owner** | one other maintainer | Full access to everything the Lead has. Exists so the bus factor is never 1. Named in the team chat topic. |
| **Maintainers** | 2–4 students | Merge rights on `main`, Supabase + Vercel access. Review each other's PRs, run releases. |
| **Caretaker of the month** | rotates | Front line. Runs the weekly checklist, works the moderation queue, triages alerts. Hands off on the 1st. Not always the Lead. |

The Caretaker rotation is the whole trick to not burning out. One person is
"it" for a month; everyone else can fully ignore operations unless paged.
Post the current Caretaker in the team chat channel topic.

During **finals and semester breaks**, the Caretaker covers **moderation and
Sev-1 only**. Everything else pauses until classes resume — that is expected,
not a failure.

---

## 2. Access & secrets — the bus-factor fix

**One shared team password manager** (1Password and Bitwarden both have free
plans for small/OSS teams) holds every credential:

- Supabase account (the project owner login)
- Vercel account
- Google Cloud Console (the OAuth client)
- Domain registrar
- Resend (if email is enabled)
- GitHub organization owner
- The team's shared inbox (`team@…` — see §0 checklist, it's still a placeholder)

Rules, no exceptions:

- **Production secrets never live in a personal note, a DM, a screenshot, or a
  `.env` file passed over chat.** Password manager or nowhere.
- `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_…` key) lives **only** in the
  password manager and in the local `.env.local` of whoever runs the course
  importer. It is never added to Vercel and never imported into app code.
- Every maintainer has their **own** login to GitHub / Supabase / Vercel where
  the platform supports team members; the shared password-manager entries are
  for the platforms that only have one account.
- **Access review every semester** (§4). **Offboarding checklist** whenever
  someone leaves (§9).

---

## 3. Phase 0 — set this up once before the plan can run

The project currently has **no monitoring, no CI, and no automated dependency
updates**. Until these exist, "the system tells you when something is wrong"
isn't true. This is a one-time backlog, roughly a day of work, split up:

- [ ] **CI** — add `.github/workflows/ci.yml` running `npm run typecheck`,
      `npm test`, and `npm run build` on every PR and every push to `main`.
      (The README already claims CI runs these; it doesn't yet.)
- [ ] **Branch protection** on `main` — require CI green + 1 review.
- [ ] **Uptime monitor** — UptimeRobot or Better Stack (free tier). `GET /`
      every 5 min; alert to the team chat **and** the Caretaker's phone.
- [ ] **Error tracking** — Sentry (free tier). Add the Next.js SDK; alert on
      any new issue and on error-rate spikes. This is how you learn about
      bugs that users don't report.
- [ ] **Vercel notifications** → team chat: deployment failed, deployment
      promoted to production.
- [ ] **Supabase alerts** — turn on the project-pause warning email and the
      weekly usage email; make sure they go to the shared inbox, not one
      student.
- [ ] **Dependabot** — add `.github/dependabot.yml` (npm ecosystem, weekly).
      Enable Dependabot **security alerts** under the repo's
      Settings → Code security.
- [ ] **Pin Node** — add `.nvmrc` and an `"engines"` field to `package.json`;
      set the same major version in Vercel's project settings and in CI.
- [ ] **`LICENSE`** — pick one, or add an explicit "all rights reserved,
      not for reuse" note. There is currently nothing.
- [ ] **Real contact address** — replace the placeholder
      `team@goldysstudybuddies.example` in
      `components/marketing/site-footer.tsx` with the shared inbox.
- [ ] **Backups** — confirm Supabase's automated daily backups are on for the
      plan you're on; enable Point-in-Time Recovery if the budget allows.
      **Take one manual backup before the retention purge (`0035`) first runs
      in production** — purged rows are only recoverable from a backup.
- [ ] **Legacy API keys** — the project may still use the legacy
      `anon`/`service_role` JWTs. Supabase deprecates them **end of 2026**.
      Migrate to publishable/secret keys (`.env`, Vercel, `SETUP.md`) well
      before then.
- [ ] **Google OAuth brand verification** — submit the consent screen for
      verification so students stop seeing a raw `*.supabase.co` domain that
      looks like phishing (`SETUP.md` §4).
- [ ] **`CONTRIBUTING.md`** — branch naming, the PR rule, and the
      **`supabase db push` after merge** step (§5), so a new contributor
      can't miss it.
- [ ] **`docs/INCIDENTS.md`** — the break-glass steps from §7, written out
      concretely with the actual project names and URLs filled in.

---

## 4. The recurring cadence

### Continuous — automated, no human

- CI runs on every PR and merge.
- Uptime + Sentry alerts fire to chat and phone.
- `pg_cron` runs `purge_stale_rows()` nightly at 03:30 UTC (retention —
  see [RETENTION.md](RETENTION.md)). You only *confirm* it monthly.

### Weekly — the Caretaker, 15–30 min

- [ ] **Moderation queue.** `/admin` → reports. Action every `open` one.
      Target: acknowledged within 48 h. (Policy: §6.)
- [ ] **Flagged messages.** `/admin/messages` — skim for anything the
      auto-filter caught that signals a user who needs a warning or a ban
      (not just a stray swear).
- [ ] **Course requests.** `/admin/requests` — approve or decline what's
      pending.
- [ ] **Sentry.** Triage new issues. Real bug → file a GitHub issue with the
      stack trace. Noise → mute it.
- [ ] **Uptime.** Any incident this week? A blip that self-resolved still
      deserves a 2-minute look at the Vercel + Supabase logs for that window.
- [ ] **Deploy log.** Glance at what merged and deployed. Anything surprising?

If a week is genuinely impossible (midterms), the minimum is: **moderation
queue + Sentry**. Say so in chat so someone can cover.

### Monthly — Caretaker + one maintainer, 1.5–2 hr

- [ ] **Dependency PRs.** Merge Dependabot patch/minor updates once CI is
      green — batch them, one merge, then smoke-test production. Hold major
      version bumps for semester work (§below).
- [ ] **Quality gates on `main`.** Pull latest, run
      `npm run typecheck && npm test && npm run build` locally. All green.
- [ ] **Supabase usage.** Database size, monthly active users, storage,
      egress — against your plan's limits. Write the numbers somewhere so you
      can see the trend. Free tier pauses a project after ~1 week of
      inactivity and has hard ceilings; know how close you are.
- [ ] **Vercel usage.** Bandwidth, function invocations, build minutes vs.
      the plan limit.
- [ ] **Retention purge.** Run `select * from public.preview_stale_purge();`
      in the SQL editor. Small numbers = the nightly job is working. A large
      backlog = the cron job stopped; investigate.
- [ ] **Backup check.** Confirm a recent automated backup exists. **Once a
      quarter**, actually restore it into a scratch Supabase project and run
      `supabase/tests/invariants.sql` against it — an untested backup is a
      hope, not a backup.
- [ ] **Metrics glance.** Signups, active groups, messages this month. Is it
      alive? Growing? Dead? This informs whether the effort is worth it.
- [ ] **Rotate the Caretaker.** Update the chat topic. Outgoing Caretaker
      spends 5 minutes handing off anything in flight.

### Per semester — whole team, ~half a day, during the break

Do this in **August** (before Fall), **January** (before Spring), and a
lighter pass in **May** (before Summer).

- [ ] **Course catalog import** for the new term. Export the registrar's
      Class Search to CSV, then `npm run import-courses -- <term>.csv`
      (`SETUP.md` §7). Re-running is safe — existing courses are skipped.
- [ ] **Access review.** List everyone with GitHub merge rights / Supabase /
      Vercel / Google Cloud / password-manager access. Remove anyone who has
      graduated, gone inactive, or left the team. Confirm the Backup owner is
      still active and reachable.
- [ ] **Full QA pass.** Run [QA.md](../importantMDfiles/QA.md) end to end
      against a Vercel **preview** deploy with fresh `you+1@umn.edu`-style
      test accounts. Split the checklist — ~5 sections per person.
- [ ] **Major dependency upgrades.** Next.js, React, `@supabase/*`, Tailwind,
      Zod — one PR each, deliberately, with the relevant QA.md sections
      re-run. Never batch major bumps.
- [ ] **Migration drift check.** `npx supabase migration list` — every
      migration shows applied both local and remote, nothing "local only" or
      "remote only". Then run the invariant script against production (it
      rolls itself back):
      `psql "<prod connection string>" -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql`
- [ ] **Rotate `NOTIFICATION_WEBHOOK_SECRET`** (if email is on): new value in
      Vercel and in the Supabase webhook header, redeploy, send a test
      notification.
- [ ] **Backlog review.** Triage GitHub issues. Pick the **one or two**
      things the team will actually build this semester. Say no to the rest.
- [ ] **Docs truth pass.** Fix anything in this file, `SETUP.md`, `QA.md`,
      `RETENTION.md`, `GLOSSARY.md` that drifted from reality.

---

## 5. Change & release process

Small team, so the process is light — but the database step is not optional.

1. **Branch** from `main`: `feat/…`, `fix/…`, `chore/…`.
2. **Open a PR.** CI must be green. **One other maintainer reviews** — even a
   two-minute read. Solo-merging is allowed only for a Sev-1 hotfix, and you
   post in chat that you did it.
3. **Check the preview deploy.** Vercel builds every PR. Click through the
   change and run the QA.md sections it touches.
4. **If the PR adds a file under `supabase/migrations/`** — merging does
   **not** apply it. Vercel deploys the app; the database does not update
   itself. Right after merge, from an up-to-date `main`:
   ```bash
   git checkout main && git pull
   npx supabase db push            # applies only the new migration(s)
   npx supabase migration list     # confirm remote == local, no drift
   ```
   Then smoke-test the feature **on production**. One named person owns this
   per release. **Never leave the production app deployed against a database
   that's missing its migration.**
5. **Post in chat:** what shipped, and anything to watch for the next day.

**Never:**

- edit a migration that has already been pushed (write a new one that alters
  the state),
- hand-paste migration SQL into the Supabase SQL Editor on a CLI-managed
  database,
- force past a drift warning — stop and reconcile with `migration list` +
  `migration repair`.

---

## 6. Moderation policy — the one thing that can't wait

This is a social platform for students. Reports get a **human** on a clock:

- **Acknowledge within 48 hours. Resolve within 1 week.**
- During finals / breaks, moderation is the *one* operational task that still
  runs. If the Caretaker is heads-down, the Lead or Backup owner covers the
  queue — and only the queue.

**Escalation ladder:** DM warning → `profiles.account_status = 'suspended'` →
`profiles.account_status = 'banned'`. (Suspended and banned are the same
lockout in code today; the difference is intent and the message.)

**Every action gets logged** in a shared moderation log doc: who acted, when,
which user, what they did, why. This protects the team if a decision is
challenged.

**Immediate-action categories** — act first (ban + preserve the
`message_originals` row and the report as evidence), ask questions after:

- Credible threats of violence or self-harm
- Child-safety issues (see the child-safety clause in the Terms of Service)
- Illegal content
- Doxxing / sharing another student's private information

For those, the Lead also notifies UMN and/or authorities as the Terms
describe. **Keep the reporter's identity private** from the reported user.

---

## 7. Incident response

### Severity

| Level | Looks like | Response |
|---|---|---|
| **Sev-1** | Site down · auth broken · data leak · active abuse or a safety threat | Now (best effort — you're volunteers). Notify the whole team. |
| **Sev-2** | A feature broken · email not sending · noticeably degraded | Within a few days. |
| **Sev-3** | Cosmetic · minor edge case | Normal backlog. |

### Break-glass moves for Sev-1

- **Bad deploy / site broken** → Vercel → Deployments → the last good one →
  **Promote to Production**. Instant rollback, no code change, no rebuild.
- **Bad migration** → apply its rollback SQL. Write a rollback for every risky
  migration; `docs/retention-rollback.sql` is the model. Full PITR restore is
  the last resort and the Lead runs it.
- **Supabase project paused** (free-tier inactivity) → un-pause from the
  dashboard. If it keeps happening, that's the signal to move to a paid plan.
- **Leaked or compromised key** → rotate it in Supabase → update Vercel and
  the password manager → redeploy. Rotate the webhook secret too. Assume
  anything that touched a public repo or a chat log is burned.
- **Abuse in progress** → suspend/ban the accounts first, investigate after.
- **Need the site read-only *right now*** → pause the Supabase project, or
  disable writes at the RLS layer. Write the exact clicks in
  `docs/INCIDENTS.md` so you're not figuring it out under pressure.

### After any Sev-1

A short, blameless write-up in `docs/INCIDENTS.md` or a GitHub issue: what
happened, how it was fixed, what change prevents a repeat. Ten minutes,
not a report.

---

## 8. Dependency & security upkeep

- **Dependabot security alerts** → the Caretaker triages within a week. A
  critical advisory on a package we ship is **at least** Sev-2.
- **Monthly:** merge patch/minor bumps behind green CI.
- **Per semester:** major upgrades, one at a time, with QA.
- **Watch especially:** `next` (frequent security releases), `@supabase/*`,
  `zod`, `sharp`.
- `SUPABASE_SERVICE_ROLE_KEY` stays out of Vercel and out of client code —
  forever. It bypasses row-level security.
- **RLS is the security boundary.** Any new table needs its RLS policies in
  the same migration **and** a covering assertion in
  `supabase/tests/invariants.sql`. Don't merge a table without both.
- **Annually:** skim every RLS policy and every `SECURITY DEFINER` function
  for anything more permissive than it needs to be.

---

## 9. Knowledge continuity

Students graduate. Plan for it.

- **The manual is:** this file + [SETUP.md](../importantMDfiles/SETUP.md) +
  [QA.md](../importantMDfiles/QA.md) + everything in `docs/`. Keep it true —
  update the docs **in the same PR** as the change they describe.
- **Onboarding a maintainer:** add them to the accounts (§2) → they run the
  app locally start to finish from `SETUP.md` → they do one release with a
  buddy watching → they shadow one full Caretaker month.
- **Offboarding anyone:** remove from GitHub org, Supabase, Vercel, Google
  Cloud, and the password manager → rotate any shared secret they personally
  held → reassign any doc/area they owned. Use a checklist so nothing is
  missed.
- **Bus-factor rule:** if exactly one person knows how to do something, that's
  a bug. Write it down or pair on it *this* semester.
- Keep a one-page **"who owns what"** list (auth, database, frontend,
  moderation, infra/billing) in the team chat or a pinned doc.

---

## 10. If the team runs out of time

Better to wind down on purpose than to rot.

**Minimum viable maintenance** — roughly **1 hour a month**:

- Work the moderation queue.
- Apply security patches (Dependabot criticals).
- Keep the lights on: pay the domain, un-pause Supabase, don't let billing
  lapse.

If even that isn't sustainable:

1. Post an in-app notice with a shutdown date (give it a few weeks).
2. Freeze new signups (disable the Google provider, or an allow-list flag).
3. Offer users a way to export or delete their data before the date.
4. On the date: take the site down, export a final database backup, keep it
   somewhere safe, then delete the Supabase and Vercel projects so nothing
   runs unattended.

Do **not** leave a student social platform online with nobody reading reports.

---

## Quick reference — time budget

| Cadence | Who | Time | Core tasks |
|---|---|---|---|
| Continuous | automated | 0 | CI, uptime, error alerts, nightly purge |
| Weekly | Caretaker | 15–30 min | Moderation queue, Sentry triage, uptime check |
| Monthly | Caretaker + 1 | 1.5–2 hr | Dep updates, usage vs. limits, backup check, metrics, rotate Caretaker |
| Per semester | whole team | ~half day | Course import, access review, full QA, major upgrades, drift check |
| Incident | on-call / Lead | varies | Rollback, rotate keys, ban abusers, write-up |

**During finals & breaks:** moderation + Sev-1 only. Everything else waits.
