# Content Team Production Tracker

A React + TypeScript + Tailwind app backed by Supabase (Auth, Postgres, RLS) that
replaces the "Content Assistant Checklist" spreadsheet with a real internal tool.

## What's included

- Email/password auth via Supabase Auth, with role-based routing (admin vs assistant)
- `profiles`, `clients`, `production_logs` tables with indexes, triggers, and full RLS policies
- Assistant dashboard (personal totals, recent activity) and Admin dashboard (team totals + per-assistant table)
- Daily Log form (fast entry, auto day-of-week, live running total)
- History page: filter by assistant/client/date, sort, paginate, edit/delete, CSV export
- Team management (add/edit/deactivate — never hard-deletes someone with history)
- Client management (active/inactive; inactive clients drop out of the logging dropdown but stay on old records)
- Reports: production by assistant / client / content type, completed vs in-progress, production over time, CSV export
- CSV import mapped to your existing spreadsheet columns
- Toasts, confirm-before-delete dialogs, empty states, loading states, responsive layout (desktop sidebar / mobile menu)

## What you'll need to do yourself

This was built in an environment with no network access, so it's delivered as
source, not a deployed app. Getting it live takes about 15 minutes:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the schema.** Open your project → SQL Editor → New Query → paste the
   contents of `supabase/schema.sql` → Run. This creates all tables, indexes,
   triggers, and RLS policies in one go.
3. **Turn off "Confirm email"** (Authentication → Providers → Email → toggle off
   "Confirm email") so accounts created from the app's "Add Member" dialog can log
   in immediately without clicking an email link. If you'd rather keep email
   confirmation on, new members just need to confirm once before their first login.
4. **Copy your API keys.** Project Settings → API → copy the Project URL and the
   `anon public` key.
5. **Configure the app.** Copy `.env.example` to `.env` and paste those two values in.
6. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
7. **Create your first account.** Sign up (or have the app auto-create your account
   the first time you sign in via Supabase's Auth UI, or simplest: go to
   Authentication → Users → Add User in the Supabase dashboard, using your own
   email/password). **The very first user created automatically becomes admin**
   (see the `handle_new_user` trigger in the schema) — everyone after that starts
   as an assistant. Promote anyone to admin later from the Team page.
8. **Deploy.** `npm run build` produces a `dist/` folder — drag it into Netlify,
   or connect the repo to Vercel. Add the same two env vars in your host's
   dashboard.

## A note on adding team members from the app

The "Add Member" dialog in Team uses Supabase's public sign-up call, which is the
only option available without a server. It works well, but two things to know:

- It briefly logs the new account in as itself during creation, then Supabase
  switches back automatically — this is standard `supabase-js` behavior, not a bug.
- For a cleaner flow with no session juggling, the production-grade approach is a
  Supabase Edge Function that uses the **service role key** to call
  `supabase.auth.admin.createUser()` server-side. That's a ~20-line function if you
  want to add it later; the current dialog is a fully working stand-in.

## Client view-only report links

Each client (Clients page → the link icon on a row) can get a **view-only report
link** — no client login required:

- Filterable by date range, content type, and status
- Printable (`Print` opens the browser print dialog with filters hidden) and
  exportable to CSV
- Shows only that one client's data — never other clients, never internal
  notes, never which assistant did the work
- Revocable any time; generating a new link retires the old one automatically

This is implemented as a random token (`client_share_links` table) checked by
two Postgres RPCs (`get_client_report_info`, `get_client_report_logs`) rather
than RLS on the base tables, so anonymous visitors never get direct table
access — only whatever those two functions choose to return. Run
`supabase/migrations/006_client_share_links.sql` after the base schema to add
this.

## CSV import — mapping your spreadsheet

Your existing file has one tab per assistant (`Regine DG`, `Jasmin`, `Nimfa`) with
columns `Date, Day, Client Name, Videos Edited, Videos Re-edited, Carousels Edited,
Carousels Re-edited, Text Posts Prepared, Text Posts Re-edited` (each with
Count/Checked/Submitted sub-columns).

To import a tab:

1. In Google Sheets/Excel, export that one tab as CSV.
2. Add an `Assistant` column to the CSV with that person's exact full name (matching
   their `full_name` in the Team page) — the importer needs this since the original
   sheet only implied the assistant via the tab name.
3. On the **Reports** page, click **Import CSV** and select the file.

The importer matches columns by header name (`Client Name` or `Client`, `Videos
Edited`, `Videos Re-edited`, etc.), creates any client it doesn't recognize, treats
`X` as Completed and `/` as In Progress in the `*Checked` columns (defaulting to
Completed if left blank), and skips rows missing a date, client, or assistant name
— reporting how many rows it skipped so you can fix and re-import them.

## Design notes

The UI uses hand-built Tailwind components (Button, Card, Badge, Dialog, etc.)
styled in the shadcn/ui spirit rather than pulling in Radix primitives — this kept
the dependency list installable without a live network check. If you'd like the
full shadcn/ui CLI-managed components instead, run `npx shadcn@latest init` and
swap the imports in `src/components/ui/` at your own pace; the rest of the app
doesn't care which Button implementation it's using.

## Project structure

```
src/
  components/     UI primitives, dialogs, layout (sidebar, app shell), dashboard widgets
  contexts/       Auth + Toast providers
  hooks/          useProductionLogs (filtering/pagination)
  lib/            Supabase client, utils
  pages/          One file per route
  types/          Database types + shared constants (PRODUCTION_FIELDS, totalItems)
supabase/
  schema.sql      Tables, indexes, triggers, RLS — run this once in the SQL editor
```
