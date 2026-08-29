# SETUP — from zero to a running app

The complete runbook: Supabase project, database, auth settings, Google
OAuth, environment variables, local dev, course imports, and deploying to
Vercel. Follow it top to bottom the first time; each section is
independently re-runnable.

---

## 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) → **New project**.
2. Pick the team, name it (e.g. `goldys-study-buddies`), choose a strong
   database password (save it — you'll need it for `db push` and the
   invariant tests), region `us-east-1` or similar.
3. When it finishes provisioning, collect three values. The **Connect**
   button at the top of the dashboard shows all of them at once, which is
   easier than hunting through settings:

   | Value | Where | Goes to |
   |---|---|---|
   | Project URL | Settings → **API** (not API Keys), or read your project ref straight out of the dashboard's address bar — the URL is always `https://<project-ref>.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
   | Publishable key (`sb_publishable_…`) | Settings → **API Keys** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | Secret key (`sb_secret_…`) | Settings → **API Keys** — reveal it | `SUPABASE_SERVICE_ROLE_KEY` (keep secret!) |

   Supabase split the old "API" settings page into **API** (URL and config)
   and **API Keys** (keys only), and replaced the `anon`/`service_role` JWTs
   with publishable/secret keys. The old JWTs still work and still sit under
   a **Legacy API Keys** tab, but they're deprecated at the end of 2026 —
   use the new ones. Both map to the same Postgres roles, so the app code is
   identical either way.

## 2. Run the migrations and seed

The schema lives in `supabase/migrations/` (ordered, idempotent) and the
starter course catalog in `supabase/seed.sql`.

**Option A — Supabase CLI (recommended). No psql needed:**

```bash
npx supabase login                 # one-time, opens the browser
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push --include-seed   # migrations in order, then seed.sql
```

(`YOUR-PROJECT-REF` is the string in your dashboard's address bar. The
CLI asks for the database password from step 1.)

`--include-seed` loads `supabase/seed.sql` through the CLI's own
connection, so **you do not need `psql` installed** — macOS doesn't ship
it. If you ever want it anyway: `brew install libpq` and add its `bin`
to your PATH.

**Option B — SQL editor (no CLI):** open the dashboard's **SQL Editor**
and run each file's contents in order: `0001` → the highest number, then
`seed.sql`. Every file is idempotent — running one twice is harmless.

> ⚠️ **Option B is for the FIRST run against an EMPTY database only.** It
> does not record anything in `supabase_migrations.schema_migrations`, so
> the CLI has no idea those files ran. After the initial setup, **never
> hand-paste a migration into a live database again** — see "Ongoing
> changes" below. Hand-pasting 0023–0031 is what stranded the migration
> history at 0022, forced a manual `migration repair` to catch it up, and
> hid a bug in 0029 that `db push` + a local `db reset` test would have
> caught before launch (fixed in 0032).

### Verify

Dashboard → **Table Editor**: you should see `universities` (1 row),
`courses` (~45 rows), `profiles` (empty), and friends. **Database →
Functions** should list `join_group`, `approve_join_request`, etc.

If you set the database up with Option B, tell the CLI those files are
already applied so future pushes don't try to re-run them:

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase migration list                 # local vs remote, side by side
npx supabase migration repair --status applied 0001 0002 …   # every file you pasted
```

### Ongoing changes (after launch)

The migration history on the live database must always match
`supabase/migrations/`. The only supported way to change the live schema:

```bash
# 1. write supabase/migrations/NNNN_name.sql on a branch, test it locally
npx supabase db reset          # replays every migration + seed on the local stack
npm test && psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql

# 2. open a PR, merge to main

# 3. immediately after the merge, from an up-to-date main:
git checkout main && git pull
npx supabase db push           # applies ONLY the new file(s), records them

# 4. confirm remote == local
npx supabase migration list    # no rows should be "local only" or "remote only"
```

Rules:

- **One change = one new migration file.** Never edit a migration that has
  already been pushed — write a new one that alters the previous state.
- **`db push` after every merge that adds a migration**, before anyone
  relies on the new schema. Vercel deploys the app on merge; the database
  does *not* update itself.
- **Never run migration SQL in the dashboard SQL Editor** against a
  database the CLI manages. If you must inspect or hot-fix by hand, write
  it up as a migration file afterward and `migration repair` the history.
- If `db push` reports drift, stop and reconcile with `migration list` +
  `migration repair` — do not force past it.

## 3. Auth settings (dashboard → Authentication)

Auth is **Google-only** (team decision, 2026-08-06) — there are no
passwords, so most auth settings stay untouched. Two things matter:

Under **Sign In / Up → Email**:

- **Enable email provider**: **OFF**. This is what makes Google the only
  door in. (The @umn.edu rule itself is enforced by the database trigger
  from migration `0001`, not by any dashboard setting.)

Under **URL Configuration**:

- **Site URL**: your production origin, **including `https://`** and with
  no trailing slash — e.g. `https://your-app.vercel.app`. Omitting the
  scheme is a silent trap: the browser resolves a scheme-less redirect
  relative to the Supabase host and you get a 404 after signing in.
- **Redirect URLs**: end every entry with `/**`, not an exact path —
  - `http://localhost:3000/**`
  - `https://YOUR-PRODUCTION-DOMAIN/**`
  - `https://your-app-*.vercel.app/**`  (preview deploys)

  **Why `/**` matters:** the app requests
  `/auth/callback?next=/dashboard`, and Supabase matches the *entire* URL
  including the query string. An exact `…/auth/callback` entry does NOT
  match, so the request silently falls back to the Site URL instead.
  Supabase treats `.` and `/` as separators: `*` matches one segment,
  `**` matches across them.

## 4. Google SSO ("Continue with UMN Google") — REQUIRED

The ONLY sign-in method — without this configured, nobody can get in.
Two halves: a Google Cloud OAuth client, pasted into Supabase.

**Google Cloud:**

1. [console.cloud.google.com](https://console.cloud.google.com) → create
   (or pick) a project → **APIs & Services → OAuth consent screen**:
   - User type **External**, app name "Goldy's Study Buddies", support
     email = a team address. Scopes: the default `email`, `profile`,
     `openid` are all we use. Publish the app (or add teammates as test
     users while it's in Testing).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - **Authorized JavaScript origins** — add both:
     - `https://YOUR-PROJECT-REF.supabase.co`  (hosted)
     - `http://localhost:54321`                (local stack)
   - **Authorized redirect URIs** — add both:
     - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     - `http://localhost:54321/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.

ONE client covers hosted and local — Google allows several redirect URIs
per client, so there's no need to manage two sets of credentials.

**Supabase:** dashboard → **Authentication → Providers →
Google** → enable, paste the Client ID + secret, save.

**For the local stack**, put the SAME credentials in `supabase/.env`
(gitignored, next to `config.toml`):

```
SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_GOOGLE_SECRET=...
```

Restart the stack (`npx supabase stop && npx supabase start`) and sign
in locally with your REAL @umn.edu Google account — personal Gmails are
rejected by the database trigger even locally. Share the client with
teammates via your team password manager, not the repo.

**How the UMN-only rule works with Google — read this once:** the app
sends Google an `hd=umn.edu` hint so university accounts surface first,
but that hint is bypassable and we never trust it. The real gate is the
database trigger from migration `0001` checking the `universities`
allow-list — a personal-Gmail signup fails there, and the app shows
"Only @umn.edu accounts can join." To support a second school someday:
`insert into universities (name, email_domain) values ('X University',
'x.edu');` — that's the entire rollout.

### Making Google's consent screen say your name, not the project ref

Out of the box Google shows *"Sign in to xluzbgksvhybziysweph.supabase.co"* —
accurate (that IS where auth happens) but it looks like a phishing page to
a student. Three ways to improve it, cheapest first:

1. **Google brand verification — free.** In the OAuth consent screen set
   **App name** ("Goldy's Study Buddies"), a logo, and a support email, then
   submit for verification. Once approved, Google shows your name and logo
   instead of the domain. Google emails you to verify ownership of the
   authorized domains; for `supabase.co` reply that it is a third-party
   service you integrate with. Review takes days to weeks, so start early.
2. **Vanity subdomain — needs a paid Supabase plan.** Turns the host into
   something readable like `goldys-study-buddies.supabase.co`. No DNS work.
3. **Custom domain — paid Supabase add-on + a domain you own.** Auth runs at
   e.g. `auth.goldysstudybuddies.com`. After enabling it, add the new
   callback URL to the Google OAuth client (keep the old one during the
   switchover).

Separately, the APP's own address (`*.vercel.app`) can be replaced for just
the cost of a domain: Vercel → Settings → Domains. That is independent of
the auth host above — changing it means updating `NEXT_PUBLIC_SITE_URL`,
the Supabase Site URL, and the redirect list.

## 5. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values from step 1 (each variable is documented inline in
`.env.example`). Email (Resend) is optional — without it the app runs
fully on in-app notifications.

## 6. Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Quality gates, same as CI would run:

```bash
npm run typecheck    # zero TypeScript errors
npm test             # unit tests (Vitest)
npm run build        # production build
```

### Optional: fully local Supabase (Docker required)

```bash
npx supabase start   # local Postgres + auth + storage + email catcher
```

**"database files are incompatible with server"** — you linked to a
hosted project whose Postgres major version differs from your existing
local volume, and the CLI now matches local to production (it records the
remote version in `supabase/.temp/postgres-version`). Throw the stale
volume away and start clean:

```bash
npx supabase stop --no-backup && npx supabase start
```

Local data is disposable — the migrations and `seed.sql` rebuild it on
the next start. Nothing in your hosted project is touched.

Point `.env.local` at the printed local URL/anon key. Signup emails are
captured at http://localhost:54324 (nothing is actually sent). The local
auth config in `supabase/config.toml` already mirrors the settings from
step 3.

### Database invariant tests

The script rolls back everything it does, so it is safe against any
database. Against the local stack, run it through the container's own
`psql` — again, nothing to install:

```bash
docker exec -i supabase_db_goldys-study-buddies \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/invariants.sql
```

If you do have `psql` on your PATH, this is equivalent:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
```

Expect a series of `PASS:` notices and a final rollback.

## 7. Bulk course import (per-term catalogs)

Export the term's courses from the registrar's Class Search into a CSV:

```csv
department_code,course_number,course_name
CSCI,1133,Introduction to Computing and Programming Concepts
MATH,1371,CSE Calculus I
```

Then, with `.env.local` populated (the script needs the service-role
key — it loads `.env.local` for you):

```bash
npm run import-courses -- fall-2026.csv
```

Existing courses are skipped; malformed rows are listed and skipped. Run
it per term (Summer 2026, Fall 2026, Spring 2027…).

## 8. Deploy to Vercel

1. Push the repo to GitHub. In [vercel.com](https://vercel.com) →
   **Add New → Project** → import the repo. Framework auto-detects Next.js.
2. **Environment variables** (Production + Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL` (the production URL), and optionally the email
   trio. Do NOT add the service-role key to Vercel — nothing deployed
   needs it.
3. Deploy. Then go back to **step 3's URL Configuration** and make sure
   the production domain and preview-domain pattern are in the redirect
   list — OAuth and email links break silently without this.
4. Branch flow: `main` → production; every PR gets a preview deploy
   automatically.

## 9. Notification emails (optional — bug report #9)

Students get an email when something important happens to them in-app
(group invite, approval, removal, disband, new/cancelled meetup, friend
or buddy request). Chat and DMs are never emailed. Each student can turn
this off under **Edit profile → "Email me about group & friend
activity"**.

Every notification in this app is created inside a Postgres function, so
the only place that sees ALL of them is the `notifications` table itself.
A Supabase **Database Webhook** on that table calls our route, which
looks up the recipient and sends through Resend.

1. **Env, on Vercel** (Production + Preview) — the email trio from §5
   (`RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`) plus a new secret:
   ```
   NOTIFICATION_WEBHOOK_SECRET=<output of: openssl rand -hex 32>
   ```
   Redeploy after adding.
2. **Supabase dashboard → Database → Webhooks → Create a new hook**:
   - Name: `notification-email`
   - Table: `notifications` · Events: **Insert** only
   - Type: HTTP Request · Method: POST
   - URL: `https://YOUR-DOMAIN/api/hooks/notification-email`
   - HTTP Headers: add `x-webhook-secret` = the exact value from step 1
   - Timeout: 5000 ms is plenty
3. Test: have a second account send you a friend request. Within a few
   seconds the email arrives; the in-app bell fires regardless.

If `RESEND_API_KEY` is unset the route still returns 200 and sends
nothing — email stays optional everywhere (spec §10). If the secret is
missing or wrong the route answers 401 and Supabase logs the failure
under the webhook's history.

## 10. Moderation basics (until admin tooling exists)

- **Review reports**: Table Editor → `reports` (admins can also query it
  through the API thanks to the `is_admin` policy).
- **Suspend/ban**: set `profiles.account_status` to `suspended` or
  `banned`. The user is locked out on their next request and vanishes
  from search/suggestions.
- **Make an admin**: set `profiles.is_admin = true` for a trusted account.
