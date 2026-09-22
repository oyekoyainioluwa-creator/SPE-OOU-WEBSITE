/* ============ SPE OOU — public app.js ============ */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function api(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Request failed: ' + url);
  return r.json();
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2800);
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function fmtDate(d) {
  if (!d) return 'Date TBA';
  const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''));
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtSize(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function bullets(text) {
  const lines = String(text || '').split('\n').map(l => l.replace(/^[•\-\*\d\.\)\s]+/, '').trim()).filter(Boolean);
  if (!lines.length) return '<p class="empty">—</p>';
  return '<ul>' + lines.map(l => `<li>${esc(l)}</li>`).join('') + '</ul>';
}

/* ---------- Loader ---------- */
window.addEventListener('load', () => setTimeout(() => $('#loader').classList.add('done'), 350));
setTimeout(() => $('#loader').classList.add('done'), 3500); // safety

/* ---------- Nav ---------- */
const hamburger = $('#hamburger'), navlinks = $('#navlinks');
hamburger.addEventListener('click', () => {
  const open = navlinks.classList.toggle('open');
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open);
});
$$('[data-scroll]').forEach(a => a.addEventListener('click', () => {
  navlinks.classList.remove('open'); hamburger.classList.remove('open');
}));
const spySections = ['home', 'about', 'history', 'executives', 'events', 'gallery', 'achievements', 'documents', 'contact'];
window.addEventListener('scroll', () => {
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  $('#scrollProgress').style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
  let cur = 'home';
  for (const id of spySections) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top < innerHeight * 0.4) cur = id;
  }
  $$('#navlinks a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
}, { passive: true });

/* ---------- Reveal on scroll ---------- */
const revealObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
}), { threshold: 0.12 });
function watchReveals(root = document) {
  root.querySelectorAll('.reveal:not(.in)').forEach(el => revealObs.observe(el));
}

/* ---------- Hero particles ---------- */
(function particles() {
  const cv = $('#particles'); if (!cv || reducedMotion) return;
  const ctx = cv.getContext('2d');
  let W, H, pts = [];
  const COLORS = ['230,57,70', '244,167,44', '34,211,238', '255,255,255'];
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(130, Math.floor(W * H / 14000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2.2 + 0.6, vy: -(Math.random() * 0.5 + 0.12),
      vx: (Math.random() - 0.5) * 0.25, a: Math.random() * 0.5 + 0.15,
      c: COLORS[Math.floor(Math.random() * COLORS.length)], tw: Math.random() * Math.PI * 2
    }));
  }
  resize(); addEventListener('resize', resize);
  let visible = true;
  new IntersectionObserver(e => visible = e[0].isIntersecting).observe(cv);
  (function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.y += p.vy; p.x += p.vx; p.tw += 0.03;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = `rgba(${p.c},${alpha})`; ctx.fill();
    }
    // rising energy streaks
    ctx.strokeStyle = 'rgba(230,57,70,.07)'; ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i += 9) {
      const p = pts[i];
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 60); ctx.stroke();
    }
  })();
})();

/* ---------- Seismic waves ---------- */
(function seismic() {
  const paths = [$('#seismicPath'), ...$$('.seismic-path-alt')].filter(Boolean);
  if (!paths.length) return;
  if (reducedMotion) { paths.forEach(p => p.setAttribute('d', 'M0,60 L1200,60')); return; }
  let t = 0, visible = true;
  const hero = $('.hero');
  if (hero) new IntersectionObserver(e => visible = e[0].isIntersecting).observe(hero);
  function wave(phase, amp1, amp2) {
    let d = 'M0,60 ';
    for (let x = 0; x <= 1200; x += 12) {
      const y = 60
        + Math.sin(x * 0.02 + phase) * amp1
        + Math.sin(x * 0.055 - phase * 1.7) * amp2
        + Math.sin(x * 0.008 + phase * 0.5) * 10;
      d += `L${x},${y.toFixed(1)} `;
    }
    return d;
  }
  (function tick() {
    requestAnimationFrame(tick);
    if (!visible && document.hidden) return;
    t += 0.03;
    paths[0].setAttribute('d', wave(t, 16, 7));
    for (let i = 1; i < paths.length; i++) paths[i].setAttribute('d', wave(-t * 0.8 + i, 12, 5));
  })();
})();

/* ---------- Community network canvas ---------- */
(function network() {
  const cv = $('#netCanvas'); if (!cv || reducedMotion) return;
  const ctx = cv.getContext('2d');
  let W, H, nodes = [];
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.floor(W * H / 22000));
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: Math.random() * 2 + 1
    }));
  }
  resize(); addEventListener('resize', resize);
  let visible = false;
  new IntersectionObserver(e => visible = e[0].isIntersecting).observe(cv);
  (function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    ctx.clearRect(0, 0, W, H);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d = Math.hypot(dx, dy);
      if (d < 150) {
        ctx.strokeStyle = `rgba(230,57,70,${(1 - d / 150) * 0.35})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(244,167,44,.8)';
    for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill(); }
  })();
})();

/* ---------- About tabs ---------- */
$$('.tab-btn').forEach(b => b.addEventListener('click', () => {
  $$('.tab-btn').forEach(x => x.classList.remove('active'));
  $$('.tab-panel').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  document.getElementById('tab-' + b.dataset.tab).classList.add('active');
}));

/* ---------- Load + render all content ---------- */
let EVENTS = [];
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // staggered hero entrance
  $$('.hero .reveal').forEach((el, i) => el.style.setProperty('--d', (0.15 + i * 0.14) + 's'));
  watchReveals();
  try {
    const [settings, about, timeline, execs, leaders, achievements, docs, contact] = await Promise.all([
      api('/api/settings'), api('/api/about'), api('/api/timeline'), api('/api/executives'),
      api('/api/leaders'), api('/api/achievements'), api('/api/documents'), api('/api/contact')
    ]);
    renderSettings(settings);
    renderAbout(about);
    renderTimeline(timeline);
    renderExecs(execs);
    renderLeaders(leaders);
    renderAchievements(achievements);
    renderDocs(docs);
    renderContact(contact);
  } catch (e) { console.error(e); toast('Could not load some content — please refresh'); }
  try {
    const [upcoming, past, cats] = await Promise.all([
      api('/api/events?filter=upcoming'), api('/api/events?filter=past'), api('/api/media-categories')
    ]);
    EVENTS = [...upcoming, ...past];
    renderEvents(upcoming, past);
    buildGalleryFilters(cats);
  } catch (e) { console.error(e); }
  initGallery();
  fetch('/api/track', { method: 'POST' }).catch(() => {});
  $('#year').textContent = new Date().getFullYear();
  watchReveals();
}

function renderSettings(s) {
  document.title = s.site_title || document.title;
  if (s.hero_eyebrow) $('#heroEyebrow').textContent = s.hero_eyebrow;
  if (s.hero_title) $('#heroTitle').textContent = s.hero_title;
  if (s.hero_playful) $('#heroPlayful').textContent = s.hero_playful;
  if (s.hero_sub) $('#heroSub').textContent = s.hero_sub;
  if (s.exec_title) $('#execTitle').textContent = s.exec_title;
  if (s.leaders_title) $('#leadersTitle').textContent = s.leaders_title;
  if (s.gallery_title) $('#galleryTitle').textContent = s.gallery_title;
  if (s.community_title) $('#communityTitle').textContent = s.community_title;
  if (s.community_text) $('#communityText').textContent = s.community_text;
  if (s.announcement_on === '1' && s.announcement) {
    const a = $('#announce'); a.textContent = s.announcement; a.classList.remove('hidden');
  }
  $('#heroChips').innerHTML = ['⚡ Energy', '🛢️ Petroleum & Geoscience', '🎓 ' + esc(s.exec_session || '2026/2027') + ' Session', '🤝 Community']
    .map(c => `<span>${c}</span>`).join('');
}

function renderAbout(a) {
  if (!a) return;
  $('#aboutWhat').textContent = a.what || '';
  $('#aboutMission').textContent = a.mission || '';
  $('#aboutVision').textContent = a.vision || '';
  $('#aboutYear').textContent = a.founding_year || '—';
  $('#aboutHistoryShort').textContent = (a.history || '').slice(0, 160) + ((a.history || '').length > 160 ? '…' : '');
  $('#tab-objectives').innerHTML = bullets(a.objectives);
  $('#tab-activities').innerHTML = bullets(a.activities);
  $('#tab-industry').innerHTML = `<p>${esc(a.industry_connections || '')}</p>`;
  if (a.image) $('#aboutMedia').innerHTML = `<img src="${esc(a.image)}" alt="About SPE OOU" loading="lazy">`;
}

function renderTimeline(rows) {
  const box = $('#timeline');
  if (!rows.length) { box.innerHTML = '<p class="empty">History entries will appear here soon.</p>'; return; }
  box.innerHTML = rows.map(r => `
    <div class="tl-item reveal">
      <span class="tl-dot"></span>
      <div class="tl-card">
        <span class="tl-year">${esc(r.date_label || r.year || '')}</span>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.description)}</p>
        ${r.image ? `<img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy">` : ''}
        ${r.video ? `<a class="tl-video" href="${esc(r.video)}" target="_blank" rel="noopener">▶ Watch video</a>` : ''}
      </div>
    </div>`).join('');
}

function personCard(p, isLeader) {
  const photo = p.photo
    ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;avatar-fallback&quot;>${initials(p.name)}</div>'">`
    : `<div class="avatar-fallback">${initials(p.name)}</div>`;
  const links = [
    p.linkedin ? `<a href="${esc(p.linkedin)}" target="_blank" rel="noopener" title="LinkedIn">in</a>` : '',
    p.twitter ? `<a href="${esc(p.twitter)}" target="_blank" rel="noopener" title="X / Twitter">𝕏</a>` : '',
    p.email ? `<a href="mailto:${esc(p.email)}" title="Email">✉️</a>` : ''
  ].join('');
  return `<div class="person reveal">
    <div class="photo">${photo}<span class="pos-chip">${esc(p.position)}</span></div>
    <div class="body">
      <h3>${esc(p.name)}</h3>
      ${isLeader && p.tenure ? `<div class="tenure">${esc(p.tenure)}</div>` : ''}
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
      ${isLeader && p.contribution ? `<div class="contrib">🏅 ${esc(p.contribution)}</div>` : ''}
      ${links ? `<div class="links">${links}</div>` : ''}
    </div>
  </div>`;
}
function renderExecs(rows) {
  $('#execGrid').innerHTML = rows.length ? rows.map(p => personCard(p, false)).join('')
    : '<p class="empty">Executive profiles will appear here soon.</p>';
}
function renderLeaders(rows) {
  $('#leadersGrid').innerHTML = rows.length ? rows.map(p => personCard(p, true)).join('')
    : '<p class="empty">Past leader profiles will appear here soon.</p>';
}

/* ----- Events ----- */
let curEventFilter = 'upcoming', EV_UP = [], EV_PAST = [];
function renderEvents(upcoming, past) {
  EV_UP = upcoming; EV_PAST = past;
  $('#upCount').textContent = upcoming.length;
  $('#pastCount').textContent = past.length;
  paintEvents();
}
function paintEvents() {
  const rows = curEventFilter === 'upcoming' ? EV_UP : EV_PAST;
  const box = $('#eventsGrid');
  if (!rows.length) {
    box.innerHTML = `<p class="empty">${curEventFilter === 'upcoming' ? 'No upcoming events yet — check back soon, something exciting is brewing. ⚡' : 'No past events archived yet.'}</p>`;
    return;
  }
  box.innerHTML = rows.map(ev => {
    const d = ev.date ? new Date(ev.date + 'T12:00:00') : null;
    return `<article class="event-card reveal in">
      <div class="event-poster">
        ${ev.poster ? `<img src="${esc(ev.poster)}" alt="${esc(ev.title)}" loading="lazy">` : `<span class="no-poster">🛢️</span>`}
        ${ev.category_name ? `<span class="event-cat" style="background:${esc(ev.category_color || '#e63946')}">${esc(ev.category_name)}</span>` : ''}
        ${d && !isNaN(d) ? `<div class="event-date"><b>${d.getDate()}</b><small>${d.toLocaleString('en', { month: 'short' })} '${String(d.getFullYear()).slice(2)}</small></div>` : ''}
      </div>
      <div class="event-body">
        <h3>${esc(ev.title)}</h3>
        <div class="event-meta">
          <span>📅 ${fmtDate(ev.date)}${ev.time ? ' • ⏰ ' + esc(ev.time) : ''}</span>
          ${ev.location ? `<span>📍 ${esc(ev.location)}</span>` : ''}
          ${ev.speakers ? `<span>🎤 ${esc(ev.speakers)}</span>` : ''}
        </div>
        <p class="event-desc">${esc(ev.description || '')}</p>
        <div class="event-actions">
          <button class="btn btn-outline btn-sm" onclick="openEvent(${ev.id})">View details</button>
          ${ev.registration_link && ev.computed_status === 'upcoming' ? `<a class="btn btn-primary btn-sm" href="${esc(ev.registration_link)}" target="_blank" rel="noopener">Register →</a>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}
$$('.event-tab').forEach(b => b.addEventListener('click', () => {
  $$('.event-tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); curEventFilter = b.dataset.filter; paintEvents();
}));

window.openEvent = async function (id) {
  try {
    const ev = await api('/api/events/' + id);
    $('#evBody').innerHTML = `
      ${ev.poster ? `<img class="ev-poster" src="${esc(ev.poster)}" alt="${esc(ev.title)}">` : ''}
      <div class="ev-body">
        ${ev.category_name ? `<span class="event-cat" style="position:static;background:${esc(ev.category_color || '#e63946')}">${esc(ev.category_name)}</span>` : ''}
        <h2 style="margin-top:10px">${esc(ev.title)}</h2>
        <div class="ev-meta">
          <span>📅 ${fmtDate(ev.date)}</span>${ev.time ? `<span>⏰ ${esc(ev.time)}</span>` : ''}
          ${ev.location ? `<span>📍 ${esc(ev.location)}</span>` : ''}${ev.speakers ? `<span>🎤 ${esc(ev.speakers)}</span>` : ''}
        </div>
        <p class="ev-desc">${esc(ev.description || 'Details coming soon.')}</p>
        ${ev.registration_link && ev.computed_status === 'upcoming' ? `<div style="margin-top:18px"><a class="btn btn-primary" href="${esc(ev.registration_link)}" target="_blank" rel="noopener">Register for this event →</a></div>` : ''}
        ${ev.media && ev.media.length ? `<h3 style="font-family:var(--font-d);margin:24px 0 4px">📸 Event moments (${ev.media.length})</h3>
          <div class="ev-media">${ev.media.slice(0, 12).map((m, i) => m.filetype === 'video'
            ? `<video src="${esc(m.filepath)}" preload="metadata" data-evm="${i}"></video>`
            : `<img src="${esc(m.thumb || m.filepath)}" alt="${esc(m.title)}" loading="lazy" data-evm="${i}">`).join('')}</div>` : ''}
      </div>`;
    $$('#evBody [data-evm]').forEach(el => el.addEventListener('click', () => {
      const m = ev.media[Number(el.dataset.evm)];
      openLightbox([{ src: m.filepath, type: m.filetype === 'video' ? 'video' : 'photo', cap: m.title }], 0);
    }));
    $('#eventModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } catch (e) { toast('Could not load event details'); }
};
$('#evClose').addEventListener('click', closeEvent);
$('#eventModal').addEventListener('click', e => { if (e.target.id === 'eventModal') closeEvent(); });
function closeEvent() { $('#eventModal').classList.add('hidden'); document.body.style.overflow = ''; }

/* ----- Achievements ----- */
function renderAchievements(rows) {
  const stats = rows.filter(r => r.kind === 'stat');
  const items = rows.filter(r => r.kind !== 'stat');
  $('#statsGrid').innerHTML = stats.map(s => `
    <div class="stat reveal"><div class="num"><span class="counter" data-target="${esc(s.value)}">0</span><small>${esc(s.suffix || '')}</small></div>
    <div class="lbl">${esc(s.icon || '')} ${esc(s.label)}</div><div class="desc">${esc(s.description || '')}</div></div>`).join('');
  $('#achGrid').innerHTML = items.length ? items.map(a => `
    <div class="ach-card reveal"><div class="ach-icon">${esc(a.icon || '🏆')}</div>
      <h3>${esc(a.label)}</h3><p>${esc(a.description || '')}</p>
      ${a.year ? `<span class="ach-year">${esc(a.year)}</span>` : ''}</div>`).join('')
    : '<p class="empty">More achievements will be showcased here soon.</p>';
  initCounters();
  // community pillars (static highlights)
  const pillars = [
    ['🤝', 'Membership', 'Join a family of driven students and grow your network.'],
    ['🙌', 'Volunteering', 'Serve, organize and make real impact on campus and beyond.'],
    ['⚙️', 'Technical Growth', 'Sessions, workshops and software training that build skills.'],
    ['🌐', 'Networking', 'Meet professionals, alumni and peers across the energy industry.'],
    ['🧭', 'Mentorship', 'Learn from those ahead and guide those coming behind.'],
    ['🏛️', 'Conferences', 'Represent OOU at NAICE, SPE events and competitions.'],
    ['🏭', 'Industry Exposure', 'Field trips and excursions to real energy facilities.'],
    ['👑', 'Leadership', 'Take up roles that shape you into a future energy leader.'],
  ];
  $('#pillars').innerHTML = pillars.map(p => `<div class="pillar reveal"><div class="ic">${p[0]}</div><h3>${p[1]}</h3><p>${p[2]}</p></div>`).join('');
}

function initCounters() {
  const obs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    obs.unobserve(e.target);
    const el = e.target, raw = el.dataset.target;
    const target = parseFloat(String(raw).replace(/[^\d.]/g, '')) || 0;
    if (reducedMotion || !target) { el.textContent = raw; return; }
    const dur = 1600, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * ease).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: 0.5 });
  $$('.counter').forEach(el => obs.observe(el));
}

/* ----- Documents ----- */
let DOCS = [], docCat = '';
function renderDocs(docs) {
  DOCS = docs;
  const cats = ['All', ...new Set(docs.map(d => d.category || 'General'))];
  $('#docFilter').innerHTML = cats.map(c => `<button class="doc-chip ${c === 'All' ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $$('.doc-chip').forEach(b => b.addEventListener('click', () => {
    $$('.doc-chip').forEach(x => x.classList.remove('active')); b.classList.add('active');
    docCat = b.dataset.cat === 'All' ? '' : b.dataset.cat; paintDocs();
  }));
  paintDocs();
}
function paintDocs() {
  const rows = DOCS.filter(d => !docCat || (d.category || 'General') === docCat);
  $('#docList').innerHTML = rows.length ? rows.map(d => `
    <div class="doc-row reveal in">
      <div class="doc-ic">📄</div>
      <div><h3>${esc(d.title)}</h3><p>${esc(d.description || '')}</p>
      <span class="doc-badge">${esc(d.category || 'General')}</span> <span class="doc-badge">${fmtSize(d.size)}</span></div>
      <a class="btn btn-outline btn-sm" href="${esc(d.filepath)}" download="${esc(d.filename || d.title)}" target="_blank" rel="noopener">⬇ View</a>
    </div>`).join('')
    : '<p class="empty">No documents published yet.</p>';
}

/* ----- Contact / socials ----- */
function socialBtn(href, icon, label) {
  if (!href) return '';
  return `<a href="${esc(href)}" target="_blank" rel="noopener" title="${label}">${icon}</a>`;
}
function renderContact(c) {
  if (!c) return;
  $('#contactCards').innerHTML = `
    <div class="contact-card"><div class="ic">✉️</div><div><small>Email</small><b><a href="mailto:${esc(c.email)}">${esc(c.email || '—')}</a></b></div></div>
    <div class="contact-card"><div class="ic">📞</div><div><small>Phone</small><b><a href="tel:${esc((c.phone || '').replace(/\s/g, ''))}">${esc(c.phone || '—')}</a></b></div></div>
    <div class="contact-card"><div class="ic">📍</div><div><small>Address</small><b>${esc(c.address || '—')}</b></div></div>`;
  const socials = socialBtn(c.instagram, '📸', 'Instagram') + socialBtn(c.linkedin, 'in', 'LinkedIn')
    + socialBtn(c.facebook, 'f', 'Facebook') + socialBtn(c.twitter, '𝕏', 'X / Twitter')
    + socialBtn(c.youtube, '▶️', 'YouTube') + socialBtn(c.whatsapp, '💬', 'WhatsApp');
  $('#socials').innerHTML = socials || '<p style="color:#8b9bb5">Social links coming soon.</p>';
  $('#socialsFooter').innerHTML = socials;
  $('#contactAddr').textContent = c.address || '';
  $('#footerContact').textContent = `${c.email || ''}\n${c.phone || ''}`;
}

/* ---------- Gallery ---------- */
const gal = { group: 'all', event: '', category: '', search: '', page: 1, pages: 1, items: [] };
function buildGalleryFilters(cats) {
  $('#galEvent').innerHTML = '<option value="">All events</option>' + EVENTS.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
  const list = Array.isArray(cats) ? cats.map(c => c.category || c).filter(Boolean) : [];
  if (list.length) $('#galCategory').innerHTML = '<option value="">All categories</option>' + list.map(c => `<option>${esc(c)}</option>`).join('');
}
function initGallery() {
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
    $$('.seg-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
    gal.group = b.dataset.group; reloadGallery();
  }));
  $('#galEvent').addEventListener('change', e => { gal.event = e.target.value; reloadGallery(); });
  $('#galCategory').addEventListener('change', e => { gal.category = e.target.value; reloadGallery(); });
  let deb;
  $('#galSearch').addEventListener('input', e => { clearTimeout(deb); deb = setTimeout(() => { gal.search = e.target.value.trim(); reloadGallery(); }, 350); });
  $('#loadMore').addEventListener('click', () => { gal.page++; loadGallery(true); });
  reloadGallery();
}
function reloadGallery() { gal.page = 1; gal.items = []; $('#masonry').innerHTML = ''; loadGallery(false); }
async function loadGallery(append) {
  const params = new URLSearchParams({ page: gal.page, per_page: 24 });
  if (gal.group !== 'all') params.set('group', gal.group);
  if (gal.event) params.set('event_id', gal.event);
  if (gal.category) params.set('category', gal.category);
  if (gal.search) params.set('search', gal.search);
  $('#galleryMeta').textContent = 'Loading moments…';
  try {
    const data = await api('/api/media?' + params.toString());
    gal.pages = data.pages;
    const box = $('#masonry');
    if (!append && !data.items.length) {
      box.innerHTML = '<p class="empty" style="column-span:all">No moments found. Moments uploaded from the admin dashboard will appear here. 📸</p>';
    }
    data.items.forEach(m => {
      const idx = gal.items.length; gal.items.push(m);
      const isVideo = m.filetype === 'video';
      const label = m.filetype === 'poster' ? '🖼️ Poster' : m.filetype === 'flyer' ? '📣 Flyer' : isVideo ? '🎬 Video' : '📷 Photo';
      const el = document.createElement('div');
      el.className = 'm-item';
      el.innerHTML = isVideo
        ? `<video src="${esc(m.filepath)}" preload="metadata" playsinline muted></video><span class="play">▶</span>`
        : `<img src="${esc(m.thumb || m.filepath)}" alt="${esc(m.title || 'SPE OOU moment')}" loading="lazy">`;
      el.innerHTML += `<span class="type-tag">${label}</span>
        <div class="ov"><b>${esc(m.title || 'Untitled')}</b><small>${esc(m.event_title || '')}</small></div>`;
      el.addEventListener('click', () => openLightbox(gal.items.map(x => ({
        src: x.filepath, type: x.filetype === 'video' ? 'video' : 'photo',
        cap: (x.title || 'Untitled') + (x.event_title ? ' • ' + x.event_title : '')
      })), idx));
      box.appendChild(el);
    });
    const shown = box.querySelectorAll('.m-item').length;
    $('#galleryMeta').textContent = data.total ? `Showing ${shown} of ${data.total} moment${data.total === 1 ? '' : 's'}` : '';
    $('#loadMore').classList.toggle('hidden', gal.page >= gal.pages);
  } catch (e) { $('#galleryMeta').textContent = 'Could not load gallery.'; }
}

/* ---------- Lightbox ---------- */
let lbItems = [], lbIdx = 0;
window.openLightbox = function (items, idx) {
  lbItems = items; lbIdx = idx || 0;
  $('#lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  paintLb();
};
function paintLb() {
  const it = lbItems[lbIdx]; if (!it) return;
  $('#lbStage').innerHTML = it.type === 'video'
    ? `<video src="${esc(it.src)}" controls autoplay playsinline style="max-height:74vh"></video>`
    : `<img src="${esc(it.src)}" alt="">`;
  $('#lbCap').textContent = (it.cap || '') + `  (${lbIdx + 1}/${lbItems.length})`;
}
function lbNav(d) { lbIdx = (lbIdx + d + lbItems.length) % lbItems.length; paintLb(); }
$('#lbPrev').addEventListener('click', e => { e.stopPropagation(); lbNav(-1); });
$('#lbNext').addEventListener('click', e => { e.stopPropagation(); lbNav(1); });
$('#lbClose').addEventListener('click', closeLb);
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLb(); });
$('#lbFull').addEventListener('click', () => {
  const el = document.getElementById('lightbox');
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen();
});
function closeLb() {
  $('#lbStage').innerHTML = ''; // stop video
  $('#lightbox').classList.add('hidden'); document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (!$('#lightbox').classList.contains('hidden')) {
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') lbNav(-1);
    if (e.key === 'ArrowRight') lbNav(1);
  }
  if (e.key === 'Escape' && !$('#eventModal').classList.contains('hidden')) closeEvent();
});
