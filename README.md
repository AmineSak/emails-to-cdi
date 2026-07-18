# Candidatures spontanées · CDI

Personal web app for sending personalized spontaneous job applications (candidatures spontanées, CDI) to leads imported from CSV. Drafts are generated in French by Gemini from your resume + preferences, sent through your own Gmail account with rate limiting, and tracked in a dashboard.

Single-user tool — Google OAuth is only used to authorize Gmail access for your own account.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS + shadcn/ui · PostgreSQL via Prisma (Neon/Supabase) · Gmail API · Gemini API · papaparse · pdf-parse · Vercel

## Setup

1. **Install & database**

   ```bash
   npm install
   cp .env.example .env   # then fill in the values
   npx prisma migrate deploy   # or `npx prisma migrate dev` in development
   ```

   `DATABASE_URL` — a Postgres connection string (Neon or Supabase work well).

2. **Google OAuth (Gmail)**

   In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Enable the **Gmail API**.
   - Create an **OAuth client ID** of type *Web application*.
   - Add the redirect URI: `http://localhost:3000/api/auth/google/callback` (and your production URL equivalent).
   - Configure the OAuth consent screen; add your own Google account as a test user (Testing mode is fine for a personal tool).
   - Put client ID/secret/redirect into `.env`.

   Scopes used: `gmail.send` (sending) and `gmail.readonly` (reply sync). The refresh token is stored AES-256-GCM-encrypted using `APP_SECRET`.

3. **Gemini**

   Create a key at [Google AI Studio](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`. Model is configurable in Settings (default `gemini-2.5-flash`).

4. **Run**

   ```bash
   npm run dev
   ```

   Then: **Resume & Preferences** → upload resume · **Import CSV** → bring in leads · select leads → **Generate drafts** → review → **Send**.

## How sending works

- Nothing is ever sent without an editable `EmailDraft` you can review first.
- "Send" queues jobs in Postgres, spaced by the configured delay (default 45 s + jitter) with a **server-side** daily cap (default 50).
- The queue drains while any app tab is open (in-app poller, every 20s) and via Vercel Cron as a fallback for when no tab is open (`vercel.json`; set `CRON_SECRET` to protect the endpoint). Vercel's **Hobby** plan only allows daily cron schedules, so it's set to run once a day (08:00 UTC) — on a **Pro** plan you can tighten `vercel.json`'s schedule (e.g. `*/5 * * * *`) for near-real-time draining even with no tab open.
- Your uploaded resume PDF is attached to every send.
- "Sync replies" checks the Gmail threads of sent emails; replies flip the lead to `REPLIED` (bounces to `BOUNCED`). Every status can also be set manually.

## Deploying to Vercel

1. Push the repo and import it in Vercel.
2. Set all env vars from `.env.example` (use the production redirect URI for `GOOGLE_REDIRECT_URI`).
3. `npx prisma migrate deploy` runs against the production DB (add it as a build step or run once locally pointing at the prod `DATABASE_URL`).
4. **Important:** the app has no login of its own. Enable [Vercel Deployment Protection](https://vercel.com/docs/security/deployment-protection) (password/SSO) so the deployment isn't publicly reachable.

## Privacy

The app only uses lead data you explicitly import from CSV — no scraping or enrichment. Keep GDPR in mind: delete leads (and their drafts, via cascade) when no longer needed.
