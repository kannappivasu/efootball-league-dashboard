# eFootball League Dashboard

A web app to track a private friends **eFootball** round-robin league. Every player plays every other player **twice** (one home leg, one away leg). Standings are auto-calculated and update **live** for anyone with the public link. Only authorized admins can add/edit results.

> Stack: **Next.js 15 (App Router) · React 19 · Tailwind CSS · Prisma + SQLite · iron-session · live polling**

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # then edit SESSION_SECRET to a long random string
npm run db:push               # create SQLite database + tables
npm run db:seed               # create default admin + 6 sample players + full fixtures
npm run dev                   # http://localhost:3000
```

Open the dashboard at http://localhost:3000 (public, read-only) and the admin at http://localhost:3000/admin/login.

Default admin (from `.env`):

```
ADMIN_EMAIL=admin@league.local
ADMIN_PASSWORD=admin123
```

Change the password by editing `.env` and re-running `npm run db:seed` (the seed *upserts* the admin, updating the password hash).

The seed is safe to run again: it fills in missing players/fixtures without deleting existing scores.

### Quality checks

```bash
npm run check   # ESLint + TypeScript + unit tests
npm run build   # production build
```

---

## How to add an admin

There is **no public sign-up**. Admins are added manually with a tiny script:

```bash
npx tsx scripts/add-admin.ts admin@league.local "supersecretpassword"
# add a role (default is "admin"; super-admins use "super")
npx tsx scripts/add-admin.ts friend2@league.local "theirpassword" super
```

The script creates (or updates) a row in the `Admin` table with a bcrypt password hash. Share the credentials out-of-band with the trusted friend.

To remove an admin, edit the DB directly (e.g. `npx prisma studio`) and delete the `Admin` row.

---

## How to share the public link

The public dashboard at `/` is **read-only and requires no login**. Anyone with the URL can see live standings & fixtures — it refreshes automatically every ~8 seconds.

Just share your deployed URL:

```
https://your-league.vercel.app/
```

Do **not** share `/admin` links with non-admins — that route redirects to the login page, but there's no reason to send it around.

---

## Admin workflow

1. Sign in at `/admin/login`.
2. **Players tab**: add/edit/remove players. Adding a player auto-generates two fixtures (home & away legs) against every existing player.
3. **Fixtures & Scores tab**: search/filter, click **Edit**, enter non-negative integer scores, **Save**. The match is marked completed and standings recalculate immediately. **Reset** clears a score back to scheduled.
4. **Audit Log tab**: see who changed what and when (last 100 entries).

All writes go through server-side API routes that verify the admin session — the client is never trusted.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add environment variables (Project → Settings → Environment Variables):
   - `SESSION_SECRET` — a long random string (≥ 32 chars). Generate one with `openssl rand -hex 32`.
   - `ADMIN_EMAIL` — default super-admin email (used only by the seed).
   - `ADMIN_PASSWORD` — default super-admin password (used only by the seed).
   - `DATABASE_URL` — **optional**. By default the app uses a local SQLite file (`file:./data/league.sqlite`), which works for quick demos but is **ephemeral on Vercel** (reset on every deploy). For a persistent league use a real database:
     - Easiest free option: create a PostgreSQL DB on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and set `DATABASE_URL` to the connection string, then change the provider in `prisma/schema.prisma` from `sqlite` to `postgresql`, run `npm run db:push` once locally (or via `vercel env pull` + a build script), and Vercel will use it.
4. After the first deploy, run the seed once so the DB has an admin and fixtures:
   ```bash
   vercel env pull .env.local
   npm run db:push
   npm run db:seed
   ```
   …or use `npx prisma studio` against your remote DB to add the admin/fixtures manually.

> SQLite note: Vercel's serverless functions have an ephemeral filesystem. The bundled `data/league.sqlite` resets on each cold start, so use Postgres for any league you care about. The app will still *run* on SQLite on Vercel for testing/throwaway demos.

---

## Project structure

```
prisma/schema.prisma           Player, Match (unique home+away pairing), Admin, AuditLog
scripts/seed.ts                Seeds default admin + 6 players + full double round-robin
scripts/add-admin.ts           Add/update an admin manually
src/lib/prisma.ts              Prisma client singleton
src/lib/session.ts             iron-session + requireAdmin() guard
src/lib/standings.ts           Pure standings computation (MP/W/D/L/GF/GA/GD/Pts + form)
src/lib/fixtures.ts            Double round-robin fixture generator (idempotent on add)
src/lib/avatar.ts              Initials crest SVG fallback
src/lib/validation.ts          Shared player/avatar input validation
src/app/page.tsx               Public dashboard (server entry)
src/components/Dashboard.tsx   Live-polling standings + fixtures (client)
src/app/admin/login/page.tsx   Admin login
src/app/admin/page.tsx         Server-side auth gate
src/components/AdminPanel.tsx   Players, scores, audit tabs
src/app/api/*                  data, auth, session, players, matches, audit routes
tests/*                        Standings, fixture generation, and validation tests
```

---

## Standings rules

| Column | Meaning |
|---|---|
| MP | Matches Played |
| W / D / L | Wins / Draws / Losses |
| GF / GA | Goals For / Goals Against |
| GD | Goal Difference (GF − GA) |
| Pts | Win = 3, Draw = 1, Loss = 0 |

Sort order: **Pts → GD → GF → name (alphabetical)**. Top 4 rows are highlighted (the configured cutoff).

---

## Behavior notes

- **Live updates**: dashboard polls `/api/data` every 8s; rows that changed since the last poll flash green briefly. No manual reload needed.
- **No duplicate fixtures**: the `Match` table has a unique constraint on `(homePlayerId, awayPlayerId)`, so each home/away pairing exists exactly once and can only be edited, not duplicated.
- **Score validation**: server rejects non-integer or negative scores.
- **Adding a player** auto-creates home+away legs against every existing player; **deleting a player** cascades to delete all their matches.
- **Audit log**: every player/match/auth change is recorded with actor, action, detail, and timestamp.
- **Safe reseeding**: `npm run db:seed` never wipes completed results; it only adds missing fixtures.
- **Production session safety**: the app refuses to start authenticated routes in production without a strong `SESSION_SECRET`.
- **Large leagues**: public fixtures are collapsed by default and admin match editing is paginated.
