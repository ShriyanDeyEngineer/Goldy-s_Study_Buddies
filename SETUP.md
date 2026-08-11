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

Auth is **Google-only** (team decision, 2026-08-06) — there are no
passwords, so most auth settings stay untouched. Two things matter:

Under **Sign In / Up → Email**:

- **Enable email provider**: **OFF**. This is what makes Google the only
  door in. (The @umn.edu rule itself is enforced by the database trigger
  from migration `0001`, not by any dashboard setting.)

Under **URL Configuration**:

- **Site URL**: your production URL (locally, `http://localhost:3000`).
- **Redirect URLs**: add BOTH
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
  - plus each Vercel preview pattern you use, e.g.
    `https://*-your-team.vercel.app/auth/callback`.

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

## 9. Moderation basics (until admin tooling exists)

- **Review reports**: Table Editor → `reports` (admins can also query it
  through the API thanks to the `is_admin` policy).
- **Suspend/ban**: set `profiles.account_status` to `suspended` or
  `banned`. The user is locked out on their next request and vanishes
  from search/suggestions.
- **Make an admin**: set `profiles.is_admin = true` for a trusted account.
