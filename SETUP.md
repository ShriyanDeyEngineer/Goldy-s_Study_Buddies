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
3. When it finishes provisioning, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## 2. Run the migrations and seed

The schema lives in `supabase/migrations/` (ordered, idempotent) and the
starter course catalog in `supabase/seed.sql`.

**Option A — Supabase CLI (recommended):**

```bash
npx supabase login                 # one-time, opens the browser
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push               # applies every migration in order
psql "$DATABASE_URL" -f supabase/seed.sql   # or paste seed.sql into the SQL editor
```

(`YOUR-PROJECT-REF` is the random string in your project URL. The CLI
asks for the database password from step 1.)

**Option B — SQL editor (no CLI):** open the dashboard's **SQL Editor**
and run each file's contents in order: `0001` → `0010`, then `seed.sql`.
Every file is idempotent — running one twice is harmless.

### Verify

Dashboard → **Table Editor**: you should see `universities` (1 row),
`courses` (~45 rows), `profiles` (empty), and friends. **Database →
Functions** should list `join_group`, `approve_join_request`, etc.

## 3. Auth settings (dashboard → Authentication)

These must match the app's own validation — the spec's rules live in both
layers on purpose.

Under **Sign In / Up → Email**:

- **Enable email provider**: on.
- **Confirm email**: **ON** (required — accounts must verify before use).
- **Secure email change**: on.

Under **Rate Limits / Sessions** (defaults are fine), and under
**Passwords**:

- **Minimum password length**: `12`.
- **Password requirements**: *lowercase, uppercase, digits, symbols*.

Under **URL Configuration**:

- **Site URL**: your production URL (locally, `http://localhost:3000`).
- **Redirect URLs**: add BOTH
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
  - plus each Vercel preview pattern you use, e.g.
    `https://*-your-team.vercel.app/auth/callback`.

Under **Emails → Templates** (optional but recommended): the defaults
work with our `/auth/callback` route as-is. **Link expiry**: set *Email
OTP expiry* to `86400` seconds (24 hours) — the spec's link lifetime.

## 4. Google SSO ("Continue with UMN Google") — REQUIRED

The app's second sign-in method. Two halves: a Google Cloud OAuth client,
pasted into Supabase.

**Google Cloud:**

1. [console.cloud.google.com](https://console.cloud.google.com) → create
   (or pick) a project → **APIs & Services → OAuth consent screen**:
   - User type **External**, app name "Goldy's Study Buddies", support
     email = a team address. Scopes: the default `email`, `profile`,
     `openid` are all we use. Publish the app (or add teammates as test
     users while it's in Testing).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - **Authorized JavaScript origins**: `https://YOUR-PROJECT-REF.supabase.co`
   - **Authorized redirect URIs**:
     `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.

**Supabase:** dashboard → **Authentication → Providers →
Google** → enable, paste the Client ID + secret, save.

**How the UMN-only rule works with Google — read this once:** the app
sends Google an `hd=umn.edu` hint so university accounts surface first,
but that hint is bypassable and we never trust it. The real gate is the
database trigger from migration `0001` checking the `universities`
allow-list — a personal-Gmail signup fails there, and the app shows
"Only @umn.edu accounts can join." To support a second school someday:
`insert into universities (name, email_domain) values ('X University',
'x.edu');` — that's the entire rollout.

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

Point `.env.local` at the printed local URL/anon key. Signup emails are
captured at http://localhost:54324 (nothing is actually sent). The local
auth config in `supabase/config.toml` already mirrors the settings from
step 3.

### Database invariant tests

With a database available (local stack or hosted — the script rolls back
everything it does):

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

Then, with `.env.local` populated (the script needs the service-role key):

```bash
npx dotenv -e .env.local -- npm run import-courses -- fall-2026.csv
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

## 9. Moderation basics (until admin tooling exists)

- **Review reports**: Table Editor → `reports` (admins can also query it
  through the API thanks to the `is_admin` policy).
- **Suspend/ban**: set `profiles.account_status` to `suspended` or
  `banned`. The user is locked out on their next request and vanishes
  from search/suggestions.
- **Make an admin**: set `profiles.is_admin = true` for a trusted account.
