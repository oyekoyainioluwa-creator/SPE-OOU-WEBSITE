/*
 * SPE OOU — Official Website & Digital Hub
 * Society of Petroleum Engineers, Olabisi Onabanjo University Student Chapter
 *
 * Full-stack server: REST API + SQLite database + media storage + auth + static site.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { DatabaseSync } = require('node:sqlite');

// Optional image optimizer (graceful fallback if unavailable)
let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('[warn] sharp not available — images will be stored without optimization.'); }

/* ----------------------------- Config ----------------------------- */
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'spe-oou-dev-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('[warn] JWT_SECRET not set — using dev secret. Set JWT_SECRET in production.');
const SESSION_HOURS = 2; // inactivity timeout
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SUBDIRS = ['photos', 'videos', 'posters', 'profiles', 'timeline', 'events', 'docs', 'misc', 'thumbs'];

for (const d of [DATA_DIR, UPLOAD_DIR, PUBLIC_DIR]) fs.mkdirSync(d, { recursive: true });
for (const d of SUBDIRS) fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true });

/* ----------------------------- Database ----------------------------- */
const db = new DatabaseSync(path.join(DATA_DIR, 'spe.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Administrator',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS about (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  what TEXT DEFAULT '', history TEXT DEFAULT '', founding_year TEXT DEFAULT '',
  mission TEXT DEFAULT '', vision TEXT DEFAULT '', objectives TEXT DEFAULT '',
  achievements TEXT DEFAULT '', activities TEXT DEFAULT '', industry_connections TEXT DEFAULT '',
  image TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contact (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT DEFAULT '', phone TEXT DEFAULT '', address TEXT DEFAULT '',
  instagram TEXT DEFAULT '', linkedin TEXT DEFAULT '', facebook TEXT DEFAULT '',
  twitter TEXT DEFAULT '', youtube TEXT DEFAULT '', whatsapp TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL DEFAULT '', date_label TEXT DEFAULT '',
  title TEXT NOT NULL, description TEXT DEFAULT '',
  image TEXT DEFAULT '', video TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS executives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, position TEXT NOT NULL, bio TEXT DEFAULT '',
  photo TEXT DEFAULT '', linkedin TEXT DEFAULT '', twitter TEXT DEFAULT '', email TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS leaders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, position TEXT NOT NULL, tenure TEXT DEFAULT '',
  bio TEXT DEFAULT '', contribution TEXT DEFAULT '',
  photo TEXT DEFAULT '', linkedin TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL, color TEXT DEFAULT '#e63946'
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, date TEXT NOT NULL DEFAULT '', time TEXT DEFAULT '',
  location TEXT DEFAULT '', description TEXT DEFAULT '', poster TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  registration_link TEXT DEFAULT '', speakers TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'auto',
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT '', description TEXT DEFAULT '',
  original_name TEXT DEFAULT '', filepath TEXT NOT NULL,
  thumb TEXT DEFAULT '', filetype TEXT NOT NULL DEFAULT 'photo',
  mime TEXT DEFAULT '', size INTEGER NOT NULL DEFAULT 0,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  category TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
  upload_date TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'stat',
  label TEXT NOT NULL, value TEXT DEFAULT '', suffix TEXT DEFAULT '',
  description TEXT DEFAULT '', icon TEXT DEFAULT '', year TEXT DEFAULT '', image TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, description TEXT DEFAULT '', category TEXT DEFAULT 'General',
  filepath TEXT NOT NULL, filename TEXT DEFAULT '', size INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
  upload_date TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS visits (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
`);

const get = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

/* ----------------------------- Seed data ----------------------------- */
function seed() {
  // Admin user (configurable via env; only created when no admin exists)
  const userCount = get('SELECT COUNT(*) c FROM users').c;
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@speoou.org';
    const name = process.env.ADMIN_NAME || 'SPE OOU Admin';
    const pass = process.env.ADMIN_PASSWORD || 'Admin123!';
    run('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      email, name, bcrypt.hashSync(pass, 12));
    console.log(`[seed] admin account created: ${email}` + (process.env.ADMIN_PASSWORD ? '' : '  (default password — CHANGE IT after first login!)'));
  }

  const defaults = {
    site_title: 'SPE OOU — Society of Petroleum Engineers, Olabisi Onabanjo University',
    hero_eyebrow: 'SOCIETY OF PETROLEUM ENGINEERS • OLABISI ONABANJO UNIVERSITY',
    hero_title: 'WELCOME, DEAR SPE OOU MEMBER 👋',
    hero_playful: 'Where energy meets ideas, opportunities meet people, and somehow… meetings still happen.',
    hero_sub: "Explore our chapter, meet our people, relive our events, and discover what's next.",
    exec_session: '2026/2027',
    exec_title: 'MEET THE 2026/2027 EXECUTIVES',
    leaders_title: 'THE PEOPLE WHO BUILT THE CHAPTER',
    gallery_title: 'SPE OOU MOMENTS',
    community_title: 'MORE THAN A CHAPTER. A COMMUNITY.',
    community_text: 'SPE OOU is a family of future energy leaders — learning, volunteering, leading and growing together. Whether you are passionate about geoscience, engineering, leadership or community, there is a place for you here.',
    announcement: '',
    announcement_on: '0',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!get('SELECT key FROM settings WHERE key = ?', k)) run('INSERT INTO settings (key, value) VALUES (?, ?)', k, v);
  }

  if (!get('SELECT id FROM about WHERE id = 1')) {
    run(`INSERT INTO about (id, what, history, founding_year, mission, vision, objectives, achievements, activities, industry_connections) VALUES
      (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'The Society of Petroleum Engineers (SPE) Olabisi Onabanjo University Student Chapter — SPE OOU — is a vibrant community of students passionate about petroleum engineering, geoscience, and the future of energy. As part of the global SPE network, we connect classroom learning with real industry exposure through technical sessions, workshops, field trips, competitions and conferences.',
      'SPE OOU was founded by a small group of visionary students who believed OOU deserved a place on the global energy map. From humble first meetings to hosting major technical events, the chapter has grown into one of the most active student communities on campus — producing leaders, innovators and industry-ready graduates year after year.',
      '2015',
      'To empower students with the technical knowledge, professional skills and industry connections needed to thrive in the global energy industry.',
      'To be the leading SPE student chapter in Nigeria — a hub of excellence, innovation and leadership in energy education.',
      '• Promote technical and professional development among members\n• Bridge the gap between classroom theory and industry practice\n• Provide exposure through field trips, conferences and competitions\n• Build leadership, teamwork and communication skills\n• Foster mentorship between students, alumni and industry professionals',
      '• Consistent growth in membership year after year\n• Successful hosting of technical sessions, workshops and symposia\n• Active participation in NAICE and other SPE Nigeria events\n• Strong alumni network across the energy industry',
      '• Weekly/biweekly technical sessions\n• Workshops and software training\n• Excursions and field trips to industry facilities\n• Quiz and debate competitions\n• Community outreach and energy enlightenment programs\n• Annual dinner, awards and social events',
      'Through SPE International and SPE Nigeria, our members connect with professionals across IOCs, indigenous operators, service companies and academia — opening doors to internships, mentorship and careers.');
  }

  if (!get('SELECT id FROM contact WHERE id = 1')) {
    run(`INSERT INTO contact (id, email, phone, address, instagram, linkedin, facebook, twitter, youtube, whatsapp) VALUES
      (1, 'spe.oou@gmail.com', '+234 800 000 0000', 'Olabisi Onabanjo University, Ago-Iwoye, Ogun State, Nigeria',
       'https://instagram.com/', 'https://linkedin.com/', 'https://facebook.com/', 'https://x.com/', 'https://youtube.com/', '')`);
  }

  if (get('SELECT COUNT(*) c FROM categories').c === 0) {
    const cats = [['Technical Session', '#2563eb'], ['Conference', '#7c3aed'], ['Workshop', '#0891b2'],
      ['Field Trip', '#16a34a'], ['Competition', '#ea580c'], ['Social Event', '#db2777'],
      ['Career Development', '#ca8a04'], ['Executive Activity', '#64748b'], ['Other', '#e63946']];
    for (const [n, c] of cats) run('INSERT INTO categories (name, color) VALUES (?, ?)', n, c);
  }

  if (get('SELECT COUNT(*) c FROM timeline').c === 0) {
    const rows = [
      ['2015', '2015 — The Beginning', 'Founded', 'A small group of passionate students establishes the SPE OOU Student Chapter, planting the seed of an energy community at Olabisi Onabanjo University.', '', '', 1],
      ['2017', '2017 — Early Years', 'Growth & Structure', 'The chapter holds its first executive elections, launches regular technical sessions, and grows its membership across geoscience and engineering departments.', '', '', 2],
      ['2020', '2020 — Major Milestones', 'Recognition', 'SPE OOU gains recognition for outstanding student activities, participates in national SPE events, and expands its industry visit program.', '', '', 3],
      ['2023', '2023 — Expansion', 'New Heights', 'Record membership growth, landmark workshops and competitions, and a stronger alumni and industry network supporting the chapter.', '', '', 4],
      ['2026', '2026 — Present Day', 'The Energy Continues', 'Today SPE OOU stands as a thriving hub of learning, leadership and community — and this digital archive preserves its story for generations to come.', '', '', 5],
    ];
    for (const [y, dl, t, d, img, vid, o] of rows)
      run('INSERT INTO timeline (year, date_label, title, description, image, video, sort_order) VALUES (?,?,?,?,?,?,?)', y, dl, t, d, img, vid, o);
  }

  if (get('SELECT COUNT(*) c FROM executives').c === 0) {
    const execs = [
      ['Chapter President', 'To Be Announced', 'Elected leader of the chapter — sets the vision, represents SPE OOU, and drives the executive agenda for the session.'],
      ['Vice President', 'To Be Announced', 'Supports the president, coordinates programs, and steps in to lead whenever duty calls.'],
      ['General Secretary', 'To Be Announced', 'Keeps the chapter organized — records, correspondence, and the institutional memory of the administration.'],
      ['Technical Director', 'To Be Announced', 'Leads technical sessions, workshops and academic programs that sharpen members’ industry readiness.'],
      ['Financial Secretary', 'To Be Announced', 'Manages chapter finances with transparency — dues, budgets, sponsorships and event funding.'],
      ['Public Relations Officer', 'To Be Announced', 'The voice and face of the chapter — publicity, media, and engagement within and beyond campus.'],
    ];
    let i = 1;
    for (const [pos, name, bio] of execs)
      run('INSERT INTO executives (position, name, bio, sort_order) VALUES (?,?,?,?)', pos, name, bio, i++);
  }

  if (get('SELECT COUNT(*) c FROM leaders').c === 0) {
    const rows = [
      ['Founding President', 'Founding Team', '2015/2016', 'The pioneering leaders who founded SPE OOU and laid the foundation of the chapter.', 'Established the chapter and held its first programs.'],
      ['Chapter President', 'Past Administration', '2024/2025', 'Leaders who steered the chapter through a remarkable session of growth and impact.', 'Expanded membership and hosted landmark events.'],
    ];
    let i = 1;
    for (const [pos, name, ten, bio, contrib] of rows)
      run('INSERT INTO leaders (position, name, tenure, bio, contribution, sort_order) VALUES (?,?,?,?,?,?)', pos, name, ten, bio, contrib, i++);
  }

  if (get('SELECT COUNT(*) c FROM achievements').c === 0) {
    const stats = [
      ['Members', '270', '+', 'Growing community of passionate students', '👥', 1],
      ['Events Hosted', '50', '+', 'Technical sessions, workshops, trips & more', '🎯', 2],
      ['Technical Sessions', '20', '+', 'Deep dives into energy & geoscience', '⚙️', 3],
      ['Years of Excellence', '10', '+', 'A decade of impact and counting', '🏆', 4],
    ];
    for (const [l, v, s, d, icon, o] of stats)
      run(`INSERT INTO achievements (kind, label, value, suffix, description, icon, sort_order) VALUES ('stat',?,?,?,?,?,?)`, l, v, s, d, icon, o);
    run(`INSERT INTO achievements (kind, label, description, year, icon, sort_order) VALUES
      ('item', 'Active participation in NAICE & SPE Nigeria events', 'Our members consistently represent OOU at national SPE conferences and competitions.', '2025', '🌍', 5)`);
  }

  if (get('SELECT COUNT(*) c FROM events').c === 0) {
    const conf = get("SELECT id FROM categories WHERE name='Conference'")?.id || null;
    const tech = get("SELECT id FROM categories WHERE name='Technical Session'")?.id || null;
    const ws = get("SELECT id FROM categories WHERE name='Workshop'")?.id || null;
    run(`INSERT INTO events (title, date, time, location, description, category_id, speakers, status, featured, sort_order) VALUES
      ('NAICE 2026 — Chapter Delegation', '2026-08-04', '09:00', 'Lagos, Nigeria', 'SPE OOU joins energy professionals and students from across Nigeria at the Nigeria Annual International Conference and Exhibition. Delegates attend technical sessions, exhibitions and networking events.', ?, 'SPE Nigeria Council', 'upcoming', 1, 1)`, conf);
    run(`INSERT INTO events (title, date, time, location, description, category_id, speakers, status, featured, sort_order) VALUES
      ('Campus to Career 2026', '2026-05-15', '10:00', 'OOU Main Campus', 'A career development event connecting students with industry professionals and alumni — CV clinics, mock interviews and career talks.', ?, 'Industry Professionals & Alumni', 'upcoming', 1, 2)`, tech);
    run(`INSERT INTO events (title, date, time, location, description, category_id, speakers, status, featured, sort_order) VALUES
      ('Petroleum Software Bootcamp', '2026-03-20', '09:00', 'ICT Centre, OOU', 'Hands-on workshop introducing members to industry-standard petroleum software tools.', ?, 'Technical Team', 'past', 0, 3)`, ws);
  }

  // Sample gallery media (replaceable/deletable from admin dashboard)
  if (get('SELECT COUNT(*) c FROM media').c === 0) {
    const samples = [
      ['seed-conference.jpg', 'Chapter Delegates at National Conference', 'Conference', 'SPE OOU members representing the chapter at a national energy conference.'],
      ['seed-fieldtrip.jpg', 'Field Trip to Energy Facility', 'Field Trip', 'Hands-on learning during an excursion to an industry facility.'],
      ['seed-workshop.jpg', 'Technical Workshop Session', 'Workshop', 'Members building practical skills in a hands-on technical workshop.'],
      ['seed-team.jpg', 'The SPE OOU Family', 'Community', 'Team spirit — the people behind the chapter.'],
      ['seed-stage.jpg', 'Annual Symposium Stage', 'Conference', 'A landmark symposium hosted by the chapter.'],
      ['seed-poster.jpg', 'Sample Event Poster', 'Publicity', 'Example of a chapter event poster. Upload real posters from the Media Library.'],
    ];
    let i = 1;
    for (const [f, title, cat, desc] of samples) {
      if (!fs.existsSync(path.join(PUBLIC_DIR, 'img', f))) continue;
      run(`INSERT INTO media (title, description, original_name, filepath, thumb, filetype, event_id, category, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?)`, title, desc, f, '/img/' + f, '/img/' + f,
        f.includes('poster') ? 'poster' : 'photo', null, cat, i++);
    }
  }
  const ab = get('SELECT image FROM about WHERE id = 1');
  if (ab && !ab.image && fs.existsSync(path.join(PUBLIC_DIR, 'img', 'about-rig.jpg'))) {
    run("UPDATE about SET image = '/img/about-rig.jpg' WHERE id = 1");
  }
  if (fs.existsSync(path.join(PUBLIC_DIR, 'img', 'seed-poster.jpg'))) {
    run("UPDATE events SET poster = '/img/seed-poster.jpg' WHERE title LIKE 'Campus to Career%' AND (poster IS NULL OR poster = '')");
  }
  const tlImgs = [['Founded', 'seed-team.jpg'], ['Growth & Structure', 'seed-workshop.jpg'], ['Recognition', 'seed-conference.jpg'], ['New Heights', 'seed-stage.jpg'], ['The Energy Continues', 'seed-fieldtrip.jpg']];
  for (const [t, f] of tlImgs) {
    if (fs.existsSync(path.join(PUBLIC_DIR, 'img', f)))
      run('UPDATE timeline SET image = ? WHERE title = ? AND (image IS NULL OR image = ?)', '/img/' + f, t, '');
  }
}
seed();

/* ----------------------------- App setup ----------------------------- */
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: SESSION_HOURS * 3600 * 1000, secure: process.env.COOKIE_SECURE === 'true' };
function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
}
function requireAuth(req, res, next) {
  const token = req.cookies?.spe_token || (req.headers.authorization || '').replace(/^Bearer /i, '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    // Sliding session: refresh cookie on activity (inactivity timeout)
    res.cookie('spe_token', signToken({ id: payload.uid, email: payload.email }), COOKIE_OPTS);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const trackLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

/* ----------------------------- Uploads ----------------------------- */
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.mkv', '.avi'];
const DOC_EXT = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv', '.zip'];
const MAX_IMAGE = 15 * 1024 * 1024, MAX_VIDEO = 250 * 1024 * 1024, MAX_DOC = 30 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kind = (req.body.kind || req.query.kind || 'misc').toLowerCase();
    const dir = SUBDIRS.includes(kind) ? kind : 'misc';
    cb(null, path.join(UPLOAD_DIR, dir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  }
});
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const kind = (req.body.kind || req.query.kind || 'misc').toLowerCase();
  const okImage = IMAGE_EXT.includes(ext);
  const okVideo = VIDEO_EXT.includes(ext);
  const okDoc = DOC_EXT.includes(ext);
  let ok = false;
  if (['photos', 'posters', 'profiles', 'timeline', 'events'].includes(kind)) ok = okImage;
  else if (kind === 'videos') ok = okVideo || okImage;
  else if (kind === 'docs') ok = okDoc || okImage;
  else ok = okImage || okVideo || okDoc;
  if (!ok) return cb(new Error('File type not allowed: ' + ext));
  cb(null, true);
}
const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_VIDEO, files: 20 } });

function publicUrl(kind, filename) { return `/uploads/${kind}/${filename}`; }
function localFromUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return null;
  const p = path.normalize(path.join(ROOT, url));
  return p.startsWith(UPLOAD_DIR) ? p : null;
}
function safeUnlink(url) {
  const p = localFromUrl(url);
  if (p && fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (e) { /* ignore */ } }
}

async function optimizeImage(absPath, kind, filename) {
  // Creates optimized web image + thumbnail; returns {url, thumb}
  if (!sharp) return { url: publicUrl(kind, filename), thumb: '' };
  try {
    const base = filename.replace(path.extname(filename), '');
    const webName = base + '.webp';
    const thumbName = 'thumb-' + base + '.webp';
    const webPath = path.join(UPLOAD_DIR, kind, webName);
    const thumbPath = path.join(UPLOAD_DIR, 'thumbs', thumbName);
    await sharp(absPath).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(webPath);
    await sharp(absPath).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toFile(thumbPath);
    if (webPath !== absPath && fs.existsSync(absPath)) fs.unlinkSync(absPath);
    return { url: publicUrl(kind, webName), thumb: publicUrl('thumbs', thumbName) };
  } catch (e) {
    console.warn('[warn] image optimization failed:', e.message);
    return { url: publicUrl(kind, filename), thumb: '' };
  }
}

/* ----------------------------- Auth routes ----------------------------- */
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = get('SELECT * FROM users WHERE email = ?', String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.cookie('spe_token', signToken(user), COOKIE_OPTS);
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
});
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('spe_token', { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = get('SELECT id, email, name, created_at FROM users WHERE id = ?', req.user.uid);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ user });
});
app.put('/api/auth/account', requireAuth, (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const user = get('SELECT * FROM users WHERE id = ?', req.user.uid);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(String(currentPassword), user.password_hash))
      return res.status(400).json({ error: 'Current password is incorrect' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(String(newPassword), 12), user.id);
  }
  if (name) run('UPDATE users SET name = ? WHERE id = ?', String(name).slice(0, 100), user.id);
  if (email && email !== user.email) {
    if (get('SELECT id FROM users WHERE email = ?', String(email).toLowerCase().trim()))
      return res.status(400).json({ error: 'Email already in use' });
    run('UPDATE users SET email = ? WHERE id = ?', String(email).toLowerCase().trim().slice(0, 160), user.id);
  }
  res.json({ ok: true });
});

/* ----------------------------- Public content routes ----------------------------- */
app.get('/api/settings', (req, res) => {
  const rows = all('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});
app.get('/api/about', (req, res) => res.json(get('SELECT * FROM about WHERE id = 1')));
app.get('/api/contact', (req, res) => res.json(get('SELECT * FROM contact WHERE id = 1')));
app.get('/api/timeline', (req, res) => res.json(all('SELECT * FROM timeline WHERE published = 1 ORDER BY sort_order, id')));
app.get('/api/executives', (req, res) => res.json(all('SELECT * FROM executives WHERE published = 1 ORDER BY sort_order, id')));
app.get('/api/leaders', (req, res) => res.json(all('SELECT * FROM leaders WHERE published = 1 ORDER BY sort_order, id')));
app.get('/api/categories', (req, res) => res.json(all('SELECT * FROM categories ORDER BY name')));
app.get('/api/achievements', (req, res) => res.json(all('SELECT * FROM achievements WHERE published = 1 ORDER BY sort_order, id')));
app.get('/api/documents', (req, res) => res.json(all('SELECT * FROM documents WHERE published = 1 ORDER BY sort_order, id')));

function eventStatus(ev) {
  if (ev.status && ev.status !== 'auto') return ev.status;
  const today = new Date().toISOString().slice(0, 10);
  return (ev.date || '') < today ? 'past' : 'upcoming';
}
app.get('/api/events', (req, res) => {
  const q = String(req.query.filter || 'all'); // all | upcoming | past
  let rows = all(`SELECT e.*, c.name AS category_name, c.color AS category_color
    FROM events e LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.published = 1 ORDER BY e.date DESC, e.sort_order`);
  rows = rows.map(r => ({ ...r, computed_status: eventStatus(r) }));
  if (q === 'upcoming') rows = rows.filter(r => r.computed_status === 'upcoming').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (q === 'past') rows = rows.filter(r => r.computed_status === 'past');
  res.json(rows);
});
app.get('/api/events/:id', (req, res) => {
  const ev = get(`SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e
    LEFT JOIN categories c ON c.id = e.category_id WHERE e.id = ?`, req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  ev.computed_status = eventStatus(ev);
  ev.media = all('SELECT * FROM media WHERE event_id = ? AND published = 1 ORDER BY upload_date DESC LIMIT 200', ev.id);
  res.json(ev);
});

app.get('/api/media', (req, res) => {
  const { type = '', event_id = '', category = '', search = '', page = '1', per_page = '24' } = req.query;
  const where = ['published = 1'];
  const params = [];
  if (type) { where.push('filetype = ?'); params.push(String(type)); }
  else if (req.query.group === 'photos') where.push("filetype IN ('photo','poster','flyer')");
  else if (req.query.group === 'videos') where.push("filetype = 'video'");
  if (event_id) { where.push('event_id = ?'); params.push(Number(event_id)); }
  if (category) { where.push('category = ?'); params.push(String(category)); }
  if (search) { where.push('(title LIKE ? OR description LIKE ? OR original_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const perPage = Math.min(60, Math.max(1, Number(per_page) || 24));
  const pg = Math.max(1, Number(page) || 1);
  const total = get(`SELECT COUNT(*) c FROM media WHERE ${where.join(' AND ')}`, ...params).c;
  const items = all(`SELECT m.*, e.title AS event_title FROM media m LEFT JOIN events e ON e.id = m.event_id
    WHERE ${where.join(' AND ').replace(/published = 1/, 'm.published = 1')}
    ORDER BY m.upload_date DESC, m.id DESC LIMIT ? OFFSET ?`, ...params, perPage, (pg - 1) * perPage);
  res.json({ items, total, page: pg, per_page: perPage, pages: Math.ceil(total / perPage) });
});
app.get('/api/media-categories', (req, res) => {
  res.json(all("SELECT DISTINCT category FROM media WHERE published = 1 AND category <> '' ORDER BY category"));
});

// Visit tracking (counts once per visitor per day via cookie)
app.post('/api/track', trackLimiter, (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  if (req.cookies?.spe_seen === day) return res.json({ ok: true, counted: false });
  const row = get('SELECT count FROM visits WHERE day = ?', day);
  if (row) run('UPDATE visits SET count = count + 1 WHERE day = ?', day);
  else run('INSERT INTO visits (day, count) VALUES (?, 1)', day);
  res.cookie('spe_seen', day, { maxAge: 24 * 3600 * 1000, sameSite: 'lax' });
  res.json({ ok: true, counted: true });
});

/* ----------------------------- Admin: generic helpers ----------------------------- */
function reorder(table, ids) {
  const stmt = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  ids.forEach((id, i) => stmt.run(i + 1, Number(id)));
}
const TABLE_WHITELIST = ['timeline', 'executives', 'leaders', 'events', 'media', 'achievements', 'documents'];
app.put('/api/admin/reorder/:table', requireAuth, (req, res) => {
  const t = req.params.table;
  if (!TABLE_WHITELIST.includes(t)) return res.status(400).json({ error: 'Invalid table' });
  const ids = req.body?.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  reorder(t, ids);
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const c = (t, extra = '') => get(`SELECT COUNT(*) c FROM ${t} ${extra}`).c;
  const totalVisits = get('SELECT COALESCE(SUM(count),0) s FROM visits').s;
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    events: c('events'), photos: c('media', `WHERE filetype IN ('photo','poster','flyer')`),
    videos: c('media', `WHERE filetype = 'video'`), executives: c('executives'),
    leaders: c('leaders'), documents: c('documents'), timeline: c('timeline'),
    achievements: c('achievements'), visits: totalVisits,
    visitsToday: get('SELECT count FROM visits WHERE day = ?', today)?.count || 0,
  });
});
app.get('/api/admin/analytics', requireAuth, (req, res) => {
  res.json(all('SELECT * FROM visits ORDER BY day DESC LIMIT 60'));
});
// Database backup download (admin only)
app.get('/api/admin/backup', requireAuth, (req, res) => {
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch (e) { /* ignore */ }
  res.download(path.join(DATA_DIR, 'spe.db'), `spe-oou-backup-${new Date().toISOString().slice(0, 10)}.db`);
});

/* ---- Admin: settings / about / contact ---- */
app.put('/api/admin/settings', requireAuth, (req, res) => {
  const body = req.body || {};
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(body)) {
    if (/^[a-z0-9_]{1,60}$/i.test(k)) stmt.run(k, String(v ?? '').slice(0, 5000));
  }
  res.json({ ok: true });
});
app.put('/api/admin/about', requireAuth, (req, res) => {
  const b = req.body || {};
  const cols = ['what', 'history', 'founding_year', 'mission', 'vision', 'objectives', 'achievements', 'activities', 'industry_connections', 'image'];
  const sets = cols.filter(c => c in b).map(c => `${c} = ?`).join(', ');
  if (sets) run(`UPDATE about SET ${sets} WHERE id = 1`, ...cols.filter(c => c in b).map(c => String(b[c] ?? '')));
  res.json({ ok: true });
});
app.put('/api/admin/contact', requireAuth, (req, res) => {
  const b = req.body || {};
  const cols = ['email', 'phone', 'address', 'instagram', 'linkedin', 'facebook', 'twitter', 'youtube', 'whatsapp'];
  const sets = cols.filter(c => c in b).map(c => `${c} = ?`).join(', ');
  if (sets) run(`UPDATE contact SET ${sets} WHERE id = 1`, ...cols.filter(c => c in b).map(c => String(b[c] ?? '').slice(0, 500)));
  res.json({ ok: true });
});

/* ---- Admin: generic CRUD factory ---- */
function crud(base, table, fields, opts = {}) {
  app.get(`/api/admin/${base}`, requireAuth, (req, res) => {
    // media/documents get special list handling below; this covers the rest
    if (base === 'media') {
      const { type = '', event_id = '', search = '', page = '1', per_page = '30', published = '' } = req.query;
      const where = ['1=1']; const params = [];
      if (type) { where.push('m.filetype = ?'); params.push(String(type)); }
      if (event_id) { where.push('m.event_id = ?'); params.push(Number(event_id)); }
      if (published !== '') { where.push('m.published = ?'); params.push(Number(published)); }
      if (search) { where.push('(m.title LIKE ? OR m.description LIKE ? OR m.original_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
      const perPage = Math.min(100, Math.max(1, Number(per_page) || 30));
      const pg = Math.max(1, Number(page) || 1);
      const total = get(`SELECT COUNT(*) c FROM media m WHERE ${where.join(' AND ')}`, ...params).c;
      const items = all(`SELECT m.*, e.title AS event_title FROM media m LEFT JOIN events e ON e.id = m.event_id
        WHERE ${where.join(' AND ')} ORDER BY m.upload_date DESC, m.id DESC LIMIT ? OFFSET ?`, ...params, perPage, (pg - 1) * perPage);
      return res.json({ items, total, page: pg, per_page: perPage, pages: Math.ceil(total / perPage) });
    }
    let rows;
    if (table === 'events') rows = all(`SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e LEFT JOIN categories c ON c.id = e.category_id ORDER BY e.date DESC, e.sort_order`);
    else if (table === 'categories') rows = all('SELECT * FROM categories ORDER BY name');
    else if (table === 'documents') rows = all('SELECT * FROM documents ORDER BY upload_date DESC, id DESC');
    else rows = all(`SELECT * FROM ${table} ORDER BY sort_order, id`);
    if (table === 'events') rows = rows.map(r => ({ ...r, computed_status: eventStatus(r) }));
    res.json(rows);
  });

  app.post(`/api/admin/${base}`, requireAuth, (req, res) => {
    const b = req.body || {};
    const cols = fields.filter(f => f in b);
    if (opts.required) for (const r of opts.required) if (!b[r]) return res.status(400).json({ error: `${r} is required` });
    const maxOrder = get(`SELECT COALESCE(MAX(sort_order),0) m FROM ${table}`).m;
    const colSql = [...cols, 'sort_order'].join(', ');
    const vals = [...cols.map(c => b[c]), maxOrder + 1];
    const r = run(`INSERT INTO ${table} (${colSql}) VALUES (${vals.map(() => '?').join(',')})`, ...vals);
    res.json({ ok: true, id: Number(r.lastInsertRowid) });
  });

  app.put(`/api/admin/${base}/:id`, requireAuth, (req, res) => {
    const b = req.body || {};
    const cols = fields.filter(f => f in b);
    if (!cols.length) return res.json({ ok: true });
    run(`UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map(c => b[c]), req.params.id);
    res.json({ ok: true });
  });

  if (!opts.customDelete) app.delete(`/api/admin/${base}/:id`, requireAuth, (req, res) => {
    const row = get(`SELECT * FROM ${table} WHERE id = ?`, req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (opts.onDelete) opts.onDelete(row);
    run(`DELETE FROM ${table} WHERE id = ?`, req.params.id);
    res.json({ ok: true });
  });
}

crud('timeline', 'timeline', ['year', 'date_label', 'title', 'description', 'image', 'video', 'published'], {
  required: ['title'],
  onDelete: r => { safeUnlink(r.image); safeUnlink(r.video); }
});
crud('executives', 'executives', ['name', 'position', 'bio', 'photo', 'linkedin', 'twitter', 'email', 'published'], {
  required: ['name', 'position'],
  onDelete: r => safeUnlink(r.photo)
});
crud('leaders', 'leaders', ['name', 'position', 'tenure', 'bio', 'contribution', 'photo', 'linkedin', 'published'], {
  required: ['name', 'position'],
  onDelete: r => safeUnlink(r.photo)
});
crud('categories', 'categories', ['name', 'color'], { required: ['name'] });
crud('events', 'events', ['title', 'date', 'time', 'location', 'description', 'poster', 'category_id', 'registration_link', 'speakers', 'status', 'featured', 'published'], {
  required: ['title'],
  onDelete: r => { safeUnlink(r.poster); run('UPDATE media SET event_id = NULL WHERE event_id = ?', r.id); }
});
crud('media', 'media', ['title', 'description', 'filetype', 'category', 'event_id', 'published', 'sort_order'], { customDelete: true });
crud('achievements', 'achievements', ['kind', 'label', 'value', 'suffix', 'description', 'icon', 'year', 'image', 'published'], { required: ['label'] });
crud('documents', 'documents', ['title', 'description', 'category', 'published'], {
  onDelete: r => safeUnlink(r.filepath)
});

// Graduate an executive → past leader (future administrations workflow)
app.post('/api/admin/executives/:id/graduate', requireAuth, (req, res) => {
  const ex = get('SELECT * FROM executives WHERE id = ?', req.params.id);
  if (!ex) return res.status(404).json({ error: 'Executive not found' });
  const { tenure = '', contribution = '' } = req.body || {};
  const maxOrder = get('SELECT COALESCE(MAX(sort_order),0) m FROM leaders').m;
  const r = run('INSERT INTO leaders (name, position, tenure, bio, contribution, photo, linkedin, sort_order) VALUES (?,?,?,?,?,?,?,?)',
    ex.name, ex.position, tenure, ex.bio, contribution, ex.photo, ex.linkedin, maxOrder + 1);
  run('DELETE FROM executives WHERE id = ?', ex.id);
  res.json({ ok: true, leader_id: Number(r.lastInsertRowid) });
});

/* ---- Admin: uploads ---- */
function checkSize(file, kind) {
  const ext = path.extname(file.originalname).toLowerCase();
  const limit = VIDEO_EXT.includes(ext) ? MAX_VIDEO : (DOC_EXT.includes(ext) && kind === 'docs' ? MAX_DOC : MAX_IMAGE);
  if (file.size > limit) { fs.unlinkSync(file.path); return `File too large (max ${Math.round(limit / 1024 / 1024)}MB)`; }
  return null;
}

// Single/batch image upload → returns optimized URLs (for exec photos, posters, timeline images…)
app.post('/api/admin/upload/image', requireAuth, (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const kind = SUBDIRS.includes((req.body.kind || '').toLowerCase()) ? req.body.kind.toLowerCase() : 'misc';
    const sizeErr = checkSize(req.file, kind);
    if (sizeErr) return res.status(400).json({ error: sizeErr });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Only image files allowed here' }); }
    const out = await optimizeImage(req.file.path, kind, req.file.filename);
    res.json({ ok: true, ...out });
  });
});

// Gallery media upload (multiple files) → creates media rows
app.post('/api/admin/media/upload', requireAuth, (req, res) => {
  upload.array('files', 20)(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
    const { filetype = 'photo', event_id = null, category = '', title = '' } = req.body || {};
    const results = [];
    for (const f of req.files) {
      const ext = path.extname(f.originalname).toLowerCase();
      const isVideo = VIDEO_EXT.includes(ext);
      const kind = isVideo ? 'videos' : (filetype === 'poster' ? 'posters' : 'photos');
      // move file to correct subdir if multer guessed differently
      const destPath = path.join(UPLOAD_DIR, kind, f.filename);
      if (f.path !== destPath) { try { fs.renameSync(f.path, destPath); } catch (e) { /* keep */ } }
      const finalPath = fs.existsSync(destPath) ? destPath : f.path;
      const finalKind = fs.existsSync(destPath) ? kind : path.basename(path.dirname(f.path));
      const sizeErr = checkSize({ ...f, path: finalPath }, finalKind);
      if (sizeErr) { results.push({ file: f.originalname, error: sizeErr }); continue; }
      let url = publicUrl(finalKind, f.filename), thumb = '';
      if (!isVideo) {
        const o = await optimizeImage(finalPath, finalKind, f.filename);
        url = o.url; thumb = o.thumb;
      }
      const maxOrder = get('SELECT COALESCE(MAX(sort_order),0) m FROM media').m;
      const r = run(`INSERT INTO media (title, original_name, filepath, thumb, filetype, mime, size, event_id, category, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?)`, title || f.originalname.replace(/\.[^.]+$/, ''), f.originalname, url, thumb,
        isVideo ? 'video' : (['poster', 'flyer'].includes(filetype) ? filetype : 'photo'),
        f.mimetype, f.size, event_id ? Number(event_id) : null, String(category || '').slice(0, 80), maxOrder + 1);
      results.push({ file: f.originalname, ok: true, id: Number(r.lastInsertRowid), url, thumb });
    }
    res.json({ ok: true, results });
  });
});

// Replace an existing media file (keeps the row/metadata)
app.post('/api/admin/media/:id/replace', requireAuth, (req, res) => {
  const row = get('SELECT * FROM media WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Media not found' });
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = VIDEO_EXT.includes(ext);
    const kind = isVideo ? 'videos' : (row.filetype === 'poster' ? 'posters' : 'photos');
    const destPath = path.join(UPLOAD_DIR, kind, req.file.filename);
    if (req.file.path !== destPath) { try { fs.renameSync(req.file.path, destPath); } catch (e) { /* keep */ } }
    const finalPath = fs.existsSync(destPath) ? destPath : req.file.path;
    const finalKind = fs.existsSync(destPath) ? kind : path.basename(path.dirname(req.file.path));
    let url = publicUrl(finalKind, req.file.filename), thumb = '';
    if (!isVideo) { const o = await optimizeImage(finalPath, finalKind, req.file.filename); url = o.url; thumb = o.thumb; }
    safeUnlink(row.filepath); if (row.thumb) safeUnlink(row.thumb);
    run('UPDATE media SET filepath = ?, thumb = ?, original_name = ?, mime = ?, size = ?, filetype = ? WHERE id = ?',
      url, thumb, req.file.originalname, req.file.mimetype, req.file.size, isVideo ? 'video' : row.filetype === 'video' ? 'photo' : row.filetype, row.id);
    res.json({ ok: true, url, thumb });
  });
});
app.delete('/api/admin/media/:id/file-only', requireAuth, (req, res) => res.status(400).json({ error: 'Use DELETE /api/admin/media/:id' }));

// Delete media row + files (override generic delete to clean files)
app.delete('/api/admin/media/:id', requireAuth, (req, res) => {
  const row = get('SELECT * FROM media WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  safeUnlink(row.filepath); if (row.thumb) safeUnlink(row.thumb);
  run('DELETE FROM media WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// Document upload
app.post('/api/admin/documents/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!(DOC_EXT.includes(ext) || IMAGE_EXT.includes(ext))) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'File type not allowed' }); }
    if (req.file.size > MAX_DOC) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'File too large (max 30MB)' }); }
    const destPath = path.join(UPLOAD_DIR, 'docs', req.file.filename);
    if (req.file.path !== destPath) { try { fs.renameSync(req.file.path, destPath); } catch (e) { /* keep */ } }
    const url = publicUrl('docs', req.file.filename);
    const { title = '', description = '', category = 'General', published = 1 } = req.body || {};
    const maxOrder = get('SELECT COALESCE(MAX(sort_order),0) m FROM documents').m;
    const r = run('INSERT INTO documents (title, description, category, filepath, filename, size, published, sort_order) VALUES (?,?,?,?,?,?,?,?)',
      title || req.file.originalname, String(description || ''), String(category || 'General').slice(0, 80),
      url, req.file.originalname, req.file.size, Number(published) ? 1 : 0, maxOrder + 1);
    res.json({ ok: true, id: Number(r.lastInsertRowid), url });
  });
});

/* ----------------------------- Static site ----------------------------- */
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: false }));
app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔥 SPE OOU website running at http://localhost:${PORT}`);
  console.log(`   Admin dashboard: http://localhost:${PORT}/admin\n`);
});
