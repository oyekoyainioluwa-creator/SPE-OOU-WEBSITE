# SPE OOU Website — Official Digital Hub 🛢️

Official website for the **Society of Petroleum Engineers, Olabisi Onabanjo University Student Chapter (SPE OOU)**.

A complete, full-stack system — not a static mockup:

- 🌍 **Public website** — no login required (history, executives, past leaders, events, photo/video archive, achievements, documents, contact)
- 🔐 **Admin login + dashboard** (`/admin`) — edit every piece of content, no code changes needed
- 🗄️ **Persistent database** — SQLite (`data/spe.db`), auto-created & seeded on first run
- ☁️ **Persistent media storage** — uploaded photos/videos/documents stored on disk (`uploads/`), auto-optimized with thumbnails
- ⚡ **Animations** — particles, seismic waves, counters, reveal effects; fully responsive & mobile-first

## Quick start

Requires **Node.js 18+** (Node 22 recommended — the database uses the built-in `node:sqlite` module, no native build tools needed).

```bash
npm install
cp .env.example .env   # optional but recommended
npm start
```

- Public site: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin

### First login

Set the initial admin account in `.env` **before first run**:

```env
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=ChooseAStrongPassword123!
JWT_SECRET=some-long-random-secret
```

If not set, the app creates a default admin on first run:

- Email: `admin@speoou.org`
- Password: `Admin123!`

⚠️ **Change the password immediately** after first login (Dashboard → My Account).

## How it works

| Area | Details |
|---|---|
| Backend | Express + `node:sqlite` (file `data/spe.db`), JWT sessions in httpOnly cookies (2h inactivity timeout), bcrypt password hashing, rate-limited login |
| Media | `uploads/` folders; images auto-converted to WebP + thumbnails via `sharp`, lazy-loaded in the gallery with pagination |
| Content | About, timeline, executives, past leaders, events, categories, media, achievements, documents, settings, contact — all in the DB, all editable from `/admin` |
| Future sessions | "🎓→🏛️" button moves a current executive to Past Leaders; update the session title in Website Settings and add the new team |

### Backups

- Dashboard → **Download database backup** exports `data/spe.db`.
- Back up the `uploads/` folder to preserve photos/videos/documents.

### Deploying on Render (recommended)

The repo includes a `render.yaml` Blueprint for one-click deploy:

1. Push this code to GitHub (merge the working branch into `main`).
2. Go to **render.com** → **New +** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and asks you to fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD` (it auto-generates `JWT_SECRET`).
4. Click **Deploy**. You get a public URL like `https://spe-oou-website.onrender.com`.

The Blueprint provisions a **persistent disk** at `/var/spe-data` holding both the database (`DATA_DIR`) and uploads (`UPLOAD_DIR`), so content survives redeploys. Note: Render disks require a paid instance type (Starter ≈ $6/mo + ~$0.25/GB/mo). On the free plan (no disk), the site works but uploaded content resets on every restart — not recommended for production.

Works on other Node hosts too (Railway, VPS…) — just make sure `data/` and `uploads/` (or your `DATA_DIR`/`UPLOAD_DIR`) live on persistent storage, and set `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` as environment variables.

## Project structure

```
server.js            # API + auth + uploads + static hosting
data/spe.db          # SQLite database (auto-created)
uploads/             # persistent media storage
public/
  index.html         # public website
  admin.html         # admin login + dashboard
  css/ js/ img/      # styles, scripts, seed images
```

Built with ❤️ for SPE OOU — *"This is SPE OOU — a chapter with history, people, energy and a future."*
