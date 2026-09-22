/* ============ SPE OOU — admin.js ============ */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (r.status === 401) { showLogin(); throw new Error('Session expired — please log in again'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function apiForm(url, formData, method = 'POST') {
  const r = await fetch(url, { method, body: formData });
  if (r.status === 401) { showLogin(); throw new Error('Session expired — please log in again'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Upload failed');
  return data;
}
function toast(msg, isErr = false) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', isErr); t.classList.remove('hidden');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 3000);
}
const confirmDo = msg => window.confirm(msg);

/* ---------- Auth / shell ---------- */
async function boot() {
  try {
    const { user } = await api('/api/auth/me');
    $('#adminName').textContent = user.name + ' • ' + user.email;
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    showView('dashboard');
  } catch (e) { showLogin(); }
}
function showLogin() {
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn'), err = $('#loginErr');
  btn.disabled = true; btn.textContent = 'Logging in…'; err.classList.add('hidden');
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#loginEmail').value.trim(), password: $('#loginPass').value })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Login failed');
    $('#loginPass').value = '';
    toast('Welcome back! ⚡');
    boot();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
  finally { btn.disabled = false; btn.textContent = '🔐 Log in'; }
});
$('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  showLogin(); toast('Logged out');
});
$('#sideOpen').addEventListener('click', () => $('#sidebar').classList.add('open'));
$('#sideClose').addEventListener('click', () => $('#sidebar').classList.remove('open'));

/* ---------- Router ---------- */
const TITLES = { dashboard: 'Dashboard', about: 'About SPE OOU', history: 'Chapter History', executives: 'Current Executives', leaders: 'Past Leaders', events: 'Events', media: 'Media Library', achievements: 'Achievements', documents: 'Document Library', settings: 'Website Settings', account: 'My Account' };
$$('#sideNav button').forEach(b => b.addEventListener('click', () => {
  $$('#sideNav button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#sidebar').classList.remove('open');
  showView(b.dataset.view);
}));
function showView(v) {
  $('#viewTitle').textContent = TITLES[v] || v;
  $$('#sideNav button').forEach(x => x.classList.toggle('active', x.dataset.view === v));
  ({ dashboard: vDashboard, about: vAbout, history: vHistory, executives: vExecs, leaders: vLeaders, events: vEvents, media: vMedia, achievements: vAchievements, documents: vDocs, settings: vSettings, account: vAccount })[v]();
  window.scrollTo(0, 0);
}

/* ---------- Modal + form builder ---------- */
function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Schema field: {k, label, t:'text|textarea|date|time|number|select|check|image|url', opts?, kind?, full?, ph?}
function fieldHtml(f, val) {
  const v = val ?? '';
  if (f.t === 'textarea') return `<div class="frow full"><label>${f.label}</label><textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea></div>`;
  if (f.t === 'select') return `<div class="frow"><label>${f.label}</label><select name="${f.k}">${f.opts.map(o => `<option value="${esc(o[0])}" ${String(v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
  if (f.t === 'check') return `<div class="frow"><label>${f.label}</label><div class="checkrow"><input type="checkbox" name="${f.k}" value="1" ${v ? 'checked' : ''}> <span>Yes</span></div></div>`;
  if (f.t === 'image') return `<div class="frow full"><label>${f.label}</label>
    <input type="file" accept="image/*" data-img="${f.k}" data-kind="${f.kind || 'misc'}">
    <input type="hidden" name="${f.k}" value="${esc(v)}">
    <div data-prev="${f.k}">${v ? `<img class="img-preview" src="${esc(v)}">` : ''}</div>
    <small style="color:var(--muted)">JPG/PNG/WebP • optimized automatically</small></div>`;
  return `<div class="frow ${f.full ? 'full' : ''}"><label>${f.label}</label><input type="${f.t || 'text'}" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"></div>`;
}
function bindImageUploads(root) {
  root.querySelectorAll('input[type=file][data-img]').forEach(inp => {
    inp.addEventListener('change', async () => {
      if (!inp.files.length) return;
      const key = inp.dataset.img, kind = inp.dataset.kind;
      const hidden = root.querySelector(`input[type=hidden][name="${key}"]`);
      const prev = root.querySelector(`[data-prev="${key}"]`);
      prev.innerHTML = '<small>Uploading…</small>';
      try {
        const fd = new FormData(); fd.append('file', inp.files[0]); fd.append('kind', kind);
        const d = await apiForm('/api/admin/upload/image', fd);
        hidden.value = d.url;
        prev.innerHTML = `<img class="img-preview" src="${esc(d.url)}">`;
        toast('Image uploaded ✓');
      } catch (e) { prev.innerHTML = ''; toast(e.message, true); }
    });
  });
}
function readForm(root, schema) {
  const out = {};
  for (const f of schema) {
    const el = root.querySelector(`[name="${f.k}"]`);
    if (!el) continue;
    if (f.t === 'check') out[f.k] = el.checked ? 1 : 0;
    else out[f.k] = el.value.trim();
  }
  return out;
}

/* ---------- Generic resource manager ---------- */
async function resourceManager({ base, table, title, singular, schema, columns, searchKeys = [], extraActions = null, onData = null }) {
  const body = $('#viewBody');
  body.innerHTML = `<div class="toolbar"><input type="search" id="resSearch" placeholder="🔍 Search…"><button class="abtn primary" id="resAdd">+ Add ${esc(singular)}</button></div><div class="rows" id="resRows"><p>Loading…</p></div>`;
  let items = [];
  async function load() {
    items = await api('/api/admin/' + base);
    if (onData) onData(items);
    paint('');
  }
  function paint(q) {
    const rows = items.filter(it => !q || searchKeys.some(k => String(it[k] || '').toLowerCase().includes(q)));
    $('#resRows').innerHTML = rows.length ? rows.map(it => `
      <div class="row-card">
        ${columns.thumb && it[columns.thumb] ? `<img class="row-thumb" src="${esc(it[columns.thumb])}" loading="lazy">` : ''}
        <div class="row-main"><b>${esc(it[columns.title])} ${it.published === 0 ? '<span class="badge red">Hidden</span>' : ''} ${columns.badge ? esc(columns.badge(it)) : ''}</b>
        <small>${esc(columns.sub ? columns.sub(it) : '')}</small></div>
        <div class="row-actions">
          <button class="icon-btn" data-act="up" data-id="${it.id}" title="Move up">↑</button>
          <button class="icon-btn" data-act="down" data-id="${it.id}" title="Move down">↓</button>
          <button class="icon-btn ${it.published ? 'on' : 'off'}" data-act="pub" data-id="${it.id}" title="Publish/unpublish">${it.published ? '👁️' : '🚫'}</button>
          ${extraActions ? extraActions(it) : ''}
          <button class="icon-btn" data-act="edit" data-id="${it.id}">✏️ Edit</button>
          <button class="icon-btn" data-act="del" data-id="${it.id}">🗑️</button>
        </div>
      </div>`).join('') : '<div class="panel">No entries yet.</div>';
    bindRows(rows);
  }
  function bindRows(rows) {
    $$('#resRows [data-act]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id, act = b.dataset.act;
      const it = items.find(x => x.id == id);
      try {
        if (act === 'edit') openForm(it);
        else if (act === 'del') {
          if (!confirmDo(`Delete "${it[columns.title]}"? This cannot be undone.`)) return;
          await api(`/api/admin/${base}/${id}`, { method: 'DELETE' });
          toast('Deleted'); load();
        }
        else if (act === 'pub') {
          await api(`/api/admin/${base}/${id}`, { method: 'PUT', body: JSON.stringify({ published: it.published ? 0 : 1 }) });
          load();
        }
        else if (act === 'up' || act === 'down') {
          const idx = items.findIndex(x => x.id == id);
          const j = act === 'up' ? idx - 1 : idx + 1;
          if (j < 0 || j >= items.length) return;
          [items[idx], items[j]] = [items[j], items[idx]];
          await api('/api/admin/reorder/' + table, { method: 'PUT', body: JSON.stringify({ ids: items.map(x => x.id) }) });
          paint(($('#resSearch').value || '').toLowerCase());
        }
        else if (act === 'graduate') graduateExec(it);
      } catch (e) { toast(e.message, true); }
    }));
  }
  function openForm(it) {
    const isNew = !it;
    openModal((isNew ? 'Add ' : 'Edit ') + singular, `
      <form id="resForm"><div class="form-grid">${schema.map(f => fieldHtml(f, it ? it[f.k] : (f.def ?? ''))).join('')}</div>
      <div class="form-actions"><button type="button" class="abtn ghost" onclick="document.getElementById('modalClose').click()">Cancel</button>
      <button class="abtn primary" type="submit">${isNew ? 'Create' : 'Save changes'}</button></div></form>`);
    const form = $('#resForm');
    bindImageUploads(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const payload = readForm(form, schema);
        if (isNew) await api('/api/admin/' + base, { method: 'POST', body: JSON.stringify(payload) });
        else await api(`/api/admin/${base}/${it.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        closeModal(); toast(isNew ? 'Created ✓' : 'Saved ✓'); load();
      } catch (ex) { toast(ex.message, true); }
    });
  }
  $('#resAdd').addEventListener('click', () => openForm(null));
  $('#resSearch').addEventListener('input', e => paint(e.target.value.toLowerCase()));
  await load();
}

async function graduateExec(ex) {
  openModal('Move to Past Leaders', `
    <form id="gradForm"><p style="margin-bottom:14px">Move <b>${esc(ex.name)}</b> (${esc(ex.position)}) from Current Executives to Past Leaders?</p>
    <div class="form-grid">
      <div class="frow"><label>Tenure (e.g. 2026/2027)</label><input name="tenure" placeholder="2026/2027"></div>
      <div class="frow full"><label>Major contribution / achievement</label><textarea name="contribution"></textarea></div>
    </div>
    <div class="form-actions"><button type="button" class="abtn ghost" onclick="document.getElementById('modalClose').click()">Cancel</button>
    <button class="abtn primary" type="submit">Move to Past Leaders →</button></div></form>`);
  $('#gradForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/api/admin/executives/${ex.id}/graduate`, { method: 'POST', body: JSON.stringify({ tenure: fd.get('tenure'), contribution: fd.get('contribution') }) });
      closeModal(); toast('Moved to Past Leaders ✓'); showView('executives');
    } catch (ex2) { toast(ex2.message, true); }
  });
}

/* ---------- Views ---------- */
async function vDashboard() {
  const body = $('#viewBody');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const [s, a] = await Promise.all([api('/api/admin/stats'), api('/api/admin/analytics')]);
    const cards = [
      ['📅', s.events, 'Total Events'], ['📷', s.photos, 'Total Photos'], ['🎬', s.videos, 'Total Videos'],
      ['👔', s.executives, 'Current Executives'], ['🏛️', s.leaders, 'Past Leaders'], ['📄', s.documents, 'Documents'],
      ['🕰️', s.timeline, 'History Entries'], ['🏆', s.achievements, 'Achievements'],
      ['👁️', s.visits, 'Website Visits'], ['📈', s.visitsToday, 'Visits Today'],
    ];
    const days = [...a].reverse().slice(-21);
    const max = Math.max(1, ...days.map(d => d.count));
    body.innerHTML = `
      <div class="stat-cards">${cards.map(c => `<div class="stat-card"><div class="n">${c[1]}</div><div class="l">${c[0]} ${c[2]}</div></div>`).join('')}</div>
      <div class="panel"><h3>📈 Visits — last ${days.length} days</h3>
        ${days.length ? `<div class="bars">${days.map(d => `<div style="height:${Math.max(4, (d.count / max) * 100)}%" data-tip="${d.day}: ${d.count}"></div>`).join('')}</div>` : '<p>No visit data yet.</p>'}
      </div>
      <div class="panel"><h3>⚡ Quick actions</h3><div class="quick-grid">
        <button onclick="go('events')">+ New event</button>
        <button onclick="go('media')">⬆ Upload photos/videos</button>
        <button onclick="go('executives')">👔 Update executives</button>
        <button onclick="go('documents')">📄 Add document</button>
        <button onclick="go('settings')">⚙️ Edit website texts</button>
        <button onclick="go('history')">🕰️ Add history entry</button>
      </div></div>
      <div class="panel"><h3>💾 Backup</h3><p style="color:var(--muted);font-size:.88rem;margin-bottom:12px">Download a copy of the website database. Uploaded photos/videos live in the <b>uploads/</b> folder — back that up too.</p>
      <a class="abtn dark" href="/api/admin/backup">⬇ Download database backup</a></div>`;
  } catch (e) { body.innerHTML = `<div class="panel">Failed to load dashboard: ${esc(e.message)}</div>`; }
}
window.go = v => showView(v);

async function vAbout() {
  const body = $('#viewBody');
  const a = await api('/api/about');
  const schema = [
    { k: 'what', label: 'What SPE OOU is', t: 'textarea' },
    { k: 'history', label: 'Chapter history', t: 'textarea' },
    { k: 'founding_year', label: 'Founding year', ph: '2015' },
    { k: 'mission', label: 'Mission', t: 'textarea' },
    { k: 'vision', label: 'Vision', t: 'textarea' },
    { k: 'objectives', label: 'Objectives (one per line)', t: 'textarea' },
    { k: 'achievements', label: 'Major achievements (one per line)', t: 'textarea' },
    { k: 'activities', label: 'Activities (one per line)', t: 'textarea' },
    { k: 'industry_connections', label: 'Industry connections', t: 'textarea' },
    { k: 'image', label: 'About image', t: 'image', kind: 'timeline' },
  ];
  body.innerHTML = `<div class="panel"><h3>Edit About content (shows on public site immediately)</h3>
    <form id="aboutForm"><div class="form-grid">${schema.map(f => fieldHtml(f, a[f.k])).join('')}</div>
    <div class="form-actions"><button class="abtn primary" type="submit">💾 Save changes</button></div></form></div>`;
  bindImageUploads(body);
  $('#aboutForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/api/admin/about', { method: 'PUT', body: JSON.stringify(readForm(e.target, schema)) });
      toast('About saved ✓');
    } catch (ex) { toast(ex.message, true); }
  });
}

function vHistory() {
  return resourceManager({
    base: 'timeline', table: 'timeline', title: 'History', singular: 'timeline entry',
    searchKeys: ['title', 'year', 'description'],
    columns: { title: 'title', thumb: 'image', sub: it => `${it.date_label || it.year} • ${it.description || ''}` },
    schema: [
      { k: 'year', label: 'Year', ph: '2015' },
      { k: 'date_label', label: 'Date label', ph: '2015 — The Beginning' },
      { k: 'title', label: 'Title *', ph: 'Founded' },
      { k: 'description', label: 'Description', t: 'textarea' },
      { k: 'image', label: 'Image', t: 'image', kind: 'timeline' },
      { k: 'video', label: 'Video URL (optional)', ph: 'https://youtube.com/…' },
      { k: 'published', label: 'Published', t: 'check', def: 1 },
    ]
  });
}
function vExecs() {
  return resourceManager({
    base: 'executives', table: 'executives', title: 'Executives', singular: 'executive',
    searchKeys: ['name', 'position'],
    columns: { title: 'name', thumb: 'photo', sub: it => it.position },
    extraActions: it => `<button class="icon-btn" data-act="graduate" data-id="${it.id}" title="Move to Past Leaders">🎓→🏛️</button>`,
    schema: [
      { k: 'name', label: 'Full name *' }, { k: 'position', label: 'Position *' },
      { k: 'bio', label: 'Short biography', t: 'textarea' },
      { k: 'photo', label: 'Photograph', t: 'image', kind: 'profiles' },
      { k: 'linkedin', label: 'LinkedIn URL' }, { k: 'twitter', label: 'X / Twitter URL' },
      { k: 'email', label: 'Email' }, { k: 'published', label: 'Published', t: 'check', def: 1 },
    ]
  });
}
function vLeaders() {
  return resourceManager({
    base: 'leaders', table: 'leaders', title: 'Past Leaders', singular: 'past leader',
    searchKeys: ['name', 'position', 'tenure'],
    columns: { title: 'name', thumb: 'photo', sub: it => `${it.position} • ${it.tenure || ''}` },
    schema: [
      { k: 'name', label: 'Full name *' }, { k: 'position', label: 'Position *' },
      { k: 'tenure', label: 'Tenure', ph: '2024/2025' },
      { k: 'bio', label: 'Short biography', t: 'textarea' },
      { k: 'contribution', label: 'Major contribution / achievement', t: 'textarea' },
      { k: 'photo', label: 'Photograph', t: 'image', kind: 'profiles' },
      { k: 'linkedin', label: 'LinkedIn URL' }, { k: 'published', label: 'Published', t: 'check', def: 1 },
    ]
  });
}

async function vEvents() {
  let cats = [];
  try { cats = await api('/api/admin/categories'); } catch (e) { /* ignore */ }
  const body = $('#viewBody');
  body.innerHTML = `<div class="toolbar"><input type="search" id="evSearch" placeholder="🔍 Search events…">
    <select id="evStatus"><option value="">All</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select>
    <button class="abtn ghost" id="catBtn">🏷️ Categories</button>
    <button class="abtn primary" id="evAdd">+ Add event</button></div>
    <div class="rows" id="evRows"><p>Loading…</p></div>`;
  let items = [];
  async function load() {
    [items, cats] = await Promise.all([api('/api/admin/events'), api('/api/admin/categories')]);
    paint();
  }
  function paint() {
    const q = ($('#evSearch').value || '').toLowerCase();
    const st = $('#evStatus').value;
    const rows = items.filter(it => (!q || (it.title + it.location + it.description).toLowerCase().includes(q)) && (!st || it.computed_status === st));
    $('#evRows').innerHTML = rows.length ? rows.map(ev => `
      <div class="row-card">
        ${ev.poster ? `<img class="row-thumb" src="${esc(ev.poster)}" loading="lazy">` : ''}
        <div class="row-main"><b>${esc(ev.title)} ${ev.published ? '' : '<span class="badge red">Hidden</span>'}
          <span class="badge ${ev.computed_status === 'upcoming' ? 'green' : ''}">${ev.computed_status}</span>
          ${ev.category_name ? `<span class="badge">${esc(ev.category_name)}</span>` : ''}${ev.featured ? ' ⭐' : ''}</b>
        <small>📅 ${esc(ev.date || 'TBA')} ${esc(ev.time || '')} • 📍 ${esc(ev.location || '')}</small></div>
        <div class="row-actions">
          <button class="icon-btn ${ev.published ? 'on' : 'off'}" data-act="pub" data-id="${ev.id}">${ev.published ? '👁️' : '🚫'}</button>
          <button class="icon-btn" data-act="edit" data-id="${ev.id}">✏️ Edit</button>
          <button class="icon-btn" data-act="del" data-id="${ev.id}">🗑️</button>
        </div>
      </div>`).join('') : '<div class="panel">No events found.</div>';
    $$('#evRows [data-act]').forEach(b => b.addEventListener('click', () => rowAction(b.dataset.act, b.dataset.id)));
  }
  async function rowAction(act, id) {
    const ev = items.find(x => x.id == id);
    try {
      if (act === 'edit') openForm(ev);
      else if (act === 'del') {
        if (!confirmDo(`Delete event "${ev.title}"? Its media will be kept but unlinked.`)) return;
        await api('/api/admin/events/' + id, { method: 'DELETE' });
        toast('Event deleted'); load();
      } else if (act === 'pub') {
        await api('/api/admin/events/' + id, { method: 'PUT', body: JSON.stringify({ published: ev.published ? 0 : 1 }) });
        load();
      }
    } catch (e) { toast(e.message, true); }
  }
  function openForm(ev) {
    const schema = [
      { k: 'title', label: 'Event title *', full: 1 }, { k: 'date', label: 'Date', t: 'date' }, { k: 'time', label: 'Time', t: 'time' },
      { k: 'location', label: 'Location' },
      { k: 'category_id', label: 'Category', t: 'select', opts: [['', '— None —'], ...cats.map(c => [c.id, c.name])] },
      { k: 'status', label: 'Status', t: 'select', opts: [['auto', 'Auto (by date)'], ['upcoming', 'Upcoming'], ['past', 'Past']] },
      { k: 'speakers', label: 'Speakers', full: 1 }, { k: 'registration_link', label: 'Registration link (URL)', full: 1 },
      { k: 'description', label: 'Description', t: 'textarea' },
      { k: 'poster', label: 'Event poster', t: 'image', kind: 'events' },
      { k: 'featured', label: 'Featured', t: 'check' }, { k: 'published', label: 'Published', t: 'check', def: 1 },
    ];
    const isNew = !ev;
    openModal((isNew ? 'Add event' : 'Edit event'), `
      <form id="evForm"><div class="form-grid">${schema.map(f => fieldHtml(f, ev ? ev[f.k] : (f.def ?? ''))).join('')}</div>
      <div class="form-actions"><button type="button" class="abtn ghost" onclick="document.getElementById('modalClose').click()">Cancel</button>
      <button class="abtn primary" type="submit">${isNew ? 'Create event' : 'Save changes'}</button></div></form>`);
    const form = $('#evForm');
    bindImageUploads(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = readForm(form, schema);
      payload.category_id = payload.category_id ? Number(payload.category_id) : null;
      try {
        if (isNew) await api('/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
        else await api('/api/admin/events/' + ev.id, { method: 'PUT', body: JSON.stringify(payload) });
        closeModal(); toast(isNew ? 'Event created ✓' : 'Event saved ✓'); load();
      } catch (ex) { toast(ex.message, true); }
    });
  }
  $('#evAdd').addEventListener('click', () => openForm(null));
  $('#evSearch').addEventListener('input', paint);
  $('#evStatus').addEventListener('change', paint);
  $('#catBtn').addEventListener('click', manageCats);
  async function manageCats() {
    openModal('Event categories', `<div id="catList"></div>
      <form id="catForm" style="display:flex;gap:8px;margin-top:14px"><input name="name" placeholder="New category name" required style="flex:1;border:1px solid var(--line);border-radius:10px;padding:10px 13px">
      <input type="color" name="color" value="#e63946" style="width:52px"><button class="abtn primary">Add</button></form>`);
    async function paintCats() {
      cats = await api('/api/admin/categories');
      $('#catList').innerHTML = cats.map(c => `<div class="row-card" style="margin-bottom:8px"><span style="width:16px;height:16px;border-radius:50%;background:${esc(c.color)}"></span>
        <div class="row-main"><b>${esc(c.name)}</b></div>
        <div class="row-actions"><button class="icon-btn" data-del="${c.id}">🗑️</button></div></div>`).join('') || '<p>No categories.</p>';
      $$('#catList [data-del]').forEach(b => b.addEventListener('click', async () => {
        if (!confirmDo('Delete this category? Events using it will become uncategorized.')) return;
        try { await api('/api/admin/categories/' + b.dataset.del, { method: 'DELETE' }); paintCats(); } catch (e) { toast(e.message, true); }
      }));
    }
    $('#catForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try { await api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), color: fd.get('color') }) }); e.target.reset(); paintCats(); }
      catch (ex) { toast(ex.message, true); }
    });
    paintCats();
  }
  await load();
}

/* ---------- Media library ---------- */
let mediaState = { type: '', event: '', search: '', page: 1, pages: 1, published: '' };
async function vMedia() {
  const body = $('#viewBody');
  let events = [];
  try { events = await api('/api/admin/events'); } catch (e) { /* ignore */ }
  body.innerHTML = `
    <div class="dropzone" id="dz">
      <div style="font-size:2rem">☁️⬆️</div>
      <h3>Upload photos & videos</h3>
      <p>Drag & drop files here, or click to browse. Up to 20 files at once.<br>Photos: JPG/PNG/WebP (max 15MB) • Videos: MP4/WebM/MOV (max 250MB)</p>
      <input type="file" id="mediaFiles" multiple accept="image/*,video/*" class="hidden">
      <button class="abtn primary" id="browseBtn">📁 Browse files</button>
      <div class="upload-row">
        <select id="upType"><option value="photo">📷 Photo</option><option value="video">🎬 Video</option><option value="poster">🖼️ Poster</option><option value="flyer">📣 Flyer</option></select>
        <select id="upEvent"><option value="">— No event —</option>${events.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('')}</select>
        <input id="upCat" placeholder="Category (optional)">
      </div>
      <div class="progress" id="upProg"><i></i></div>
      <p id="upStatus"></p>
    </div>
    <div class="toolbar">
      <select id="fType"><option value="">All types</option><option value="photo">Photos</option><option value="video">Videos</option><option value="poster">Posters</option><option value="flyer">Flyers</option></select>
      <select id="fEvent"><option value="">All events</option>${events.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('')}</select>
      <select id="fPub"><option value="">Published + hidden</option><option value="1">Published</option><option value="0">Hidden</option></select>
      <input type="search" id="fSearch" placeholder="🔍 Search media…">
    </div>
    <p id="mediaMeta" style="color:var(--muted);font-size:.85rem;margin-bottom:12px"></p>
    <div class="media-grid" id="mediaGrid"></div>
    <div class="center" style="text-align:center;margin-top:16px"><button class="abtn ghost" id="mediaMore">Load more</button></div>`;

  const dz = $('#dz'), fi = $('#mediaFiles');
  $('#browseBtn').addEventListener('click', () => fi.click());
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });
  fi.addEventListener('change', () => { if (fi.files.length) uploadFiles(fi.files); fi.value = ''; });

  async function uploadFiles(files) {
    const prog = $('#upProg'), bar = prog.querySelector('i'), st = $('#upStatus');
    prog.classList.add('show'); bar.style.width = '5%';
    st.textContent = `Uploading ${files.length} file(s)…`;
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    fd.append('filetype', $('#upType').value);
    fd.append('event_id', $('#upEvent').value);
    fd.append('category', $('#upCat').value.trim());
    try {
      const d = await apiForm('/api/admin/media/upload', fd);
      const ok = d.results.filter(r => r.ok).length, fail = d.results.filter(r => !r.ok);
      bar.style.width = '100%';
      st.textContent = `Done: ${ok} uploaded${fail.length ? `, ${fail.length} failed (${fail.map(f => f.file + ': ' + f.error).join('; ')})` : ''}`;
      toast(`Uploaded ${ok} file(s) ✓`);
      mediaState.page = 1; loadMedia(false);
    } catch (e) { st.textContent = ''; toast(e.message, true); }
    setTimeout(() => { prog.classList.remove('show'); bar.style.width = '0'; }, 2500);
  }

  $('#fType').addEventListener('change', e => { mediaState.type = e.target.value; mediaState.page = 1; loadMedia(false); });
  $('#fEvent').addEventListener('change', e => { mediaState.event = e.target.value; mediaState.page = 1; loadMedia(false); });
  $('#fPub').addEventListener('change', e => { mediaState.published = e.target.value; mediaState.page = 1; loadMedia(false); });
  let deb;
  $('#fSearch').addEventListener('input', e => { clearTimeout(deb); deb = setTimeout(() => { mediaState.search = e.target.value.trim(); mediaState.page = 1; loadMedia(false); }, 350); });
  $('#mediaMore').addEventListener('click', () => { mediaState.page++; loadMedia(true); });

  async function loadMedia(append) {
    const p = new URLSearchParams({ page: mediaState.page, per_page: 30 });
    if (mediaState.type) p.set('type', mediaState.type);
    if (mediaState.event) p.set('event_id', mediaState.event);
    if (mediaState.published !== '') p.set('published', mediaState.published);
    if (mediaState.search) p.set('search', mediaState.search);
    const grid = $('#mediaGrid');
    if (!append) grid.innerHTML = '<p>Loading…</p>';
    try {
      const d = await api('/api/admin/media?' + p.toString());
      mediaState.pages = d.pages;
      if (!append) grid.innerHTML = '';
      if (!d.items.length && !append) grid.innerHTML = '<div class="panel">No media found. Upload something! 📸</div>';
      d.items.forEach(m => {
        const isV = m.filetype === 'video';
        const el = document.createElement('div');
        el.className = 'media-card';
        el.innerHTML = `<div class="thumb">${isV ? `<video src="${esc(m.filepath)}" preload="metadata" muted playsinline></video>` : `<img src="${esc(m.thumb || m.filepath)}" loading="lazy">`}<span class="ptag">${esc(m.filetype)}${m.published ? '' : ' • hidden'}</span></div>
          <div class="mbody"><b title="${esc(m.original_name || '')}">${esc(m.title || m.original_name)}</b>
          <small>${esc(m.event_title || 'No event')} • ${new Date(m.upload_date + 'Z').toLocaleDateString()}</small></div>
          <div class="macts">
            <button class="icon-btn" data-a="view">👁️</button>
            <button class="icon-btn" data-a="edit">✏️</button>
            <button class="icon-btn" data-a="replace" title="Replace file">🔄</button>
            <button class="icon-btn" data-a="pub" title="Publish/unpublish">${m.published ? '🚫' : '✅'}</button>
            <button class="icon-btn" data-a="del">🗑️</button>
          </div>`;
        el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => mediaAction(b.dataset.a, m, el)));
        grid.appendChild(el);
      });
      $('#mediaMeta').textContent = `Showing ${grid.children.length} of ${d.total} item(s)`;
      $('#mediaMore').style.display = mediaState.page >= d.pages ? 'none' : '';
    } catch (e) { grid.innerHTML = `<div class="panel">Failed: ${esc(e.message)}</div>`; }
  }
  async function mediaAction(a, m, el) {
    try {
      if (a === 'view') {
        const isV = m.filetype === 'video';
        openModal(m.title || 'Preview', isV
          ? `<video src="${esc(m.filepath)}" controls style="width:100%;border-radius:12px" playsinline></video>`
          : `<img src="${esc(m.filepath)}" style="width:100%;border-radius:12px">`);
      } else if (a === 'edit') {
        const schema = [
          { k: 'title', label: 'Title (rename)', full: 1 },
          { k: 'description', label: 'Description', t: 'textarea' },
          { k: 'filetype', label: 'Type', t: 'select', opts: [['photo', 'Photo'], ['video', 'Video'], ['poster', 'Poster'], ['flyer', 'Flyer']] },
          { k: 'category', label: 'Category' },
          { k: 'event_id', label: 'Associated event', t: 'select', opts: [['', '— None —'], ...events.map(e => [e.id, e.title])] },
          { k: 'published', label: 'Published', t: 'check' },
        ];
        openModal('Edit media', `<form id="mForm"><div class="form-grid">${schema.map(f => fieldHtml(f, m[f.k])).join('')}</div>
          <div class="form-actions"><button type="button" class="abtn ghost" onclick="document.getElementById('modalClose').click()">Cancel</button>
          <button class="abtn primary" type="submit">Save</button></div></form>`);
        $('#mForm').addEventListener('submit', async e => {
          e.preventDefault();
          const payload = readForm(e.target, schema);
          payload.event_id = payload.event_id ? Number(payload.event_id) : null;
          await api('/api/admin/media/' + m.id, { method: 'PUT', body: JSON.stringify(payload) });
          closeModal(); toast('Saved ✓'); mediaState.page = 1; loadMedia(false);
        });
      } else if (a === 'replace') {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*,video/*';
        inp.onchange = async () => {
          if (!inp.files.length) return;
          const fd = new FormData(); fd.append('file', inp.files[0]);
          await apiForm(`/api/admin/media/${m.id}/replace`, fd);
          toast('File replaced ✓'); mediaState.page = 1; loadMedia(false);
        };
        inp.click();
      } else if (a === 'pub') {
        await api('/api/admin/media/' + m.id, { method: 'PUT', body: JSON.stringify({ published: m.published ? 0 : 1 }) });
        mediaState.page = 1; loadMedia(false);
      } else if (a === 'del') {
        if (!confirmDo(`Permanently delete "${m.title || m.original_name}"? The file will be removed from storage.`)) return;
        await api('/api/admin/media/' + m.id, { method: 'DELETE' });
        el.remove(); toast('Deleted');
      }
    } catch (e) { toast(e.message, true); }
  }
  await loadMedia(false);
}

function vAchievements() {
  return resourceManager({
    base: 'achievements', table: 'achievements', title: 'Achievements', singular: 'achievement',
    searchKeys: ['label', 'description'],
    columns: { title: 'label', sub: it => it.kind === 'stat' ? `STAT: ${it.value}${it.suffix} — ${it.description || ''}` : `${it.year || ''} — ${it.description || ''}` },
    schema: [
      { k: 'kind', label: 'Type', t: 'select', opts: [['stat', '📊 Animated statistic'], ['item', '🏆 Achievement story']] },
      { k: 'label', label: 'Label / title *' },
      { k: 'value', label: 'Number (for stats)', ph: '270' },
      { k: 'suffix', label: 'Suffix', ph: '+' },
      { k: 'description', label: 'Description', t: 'textarea' },
      { k: 'icon', label: 'Icon (emoji)', ph: '🏆' },
      { k: 'year', label: 'Year (for stories)' },
      { k: 'published', label: 'Published', t: 'check', def: 1 },
    ]
  });
}

async function vDocs() {
  const body = $('#viewBody');
  body.innerHTML = `
    <div class="panel"><h3>⬆ Upload document</h3>
      <form id="docForm"><div class="form-grid">
        <div class="frow"><label>File * (PDF/DOC/PPT/XLS/TXT/ZIP, max 30MB)</label><input type="file" name="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.jpg,.png,.webp"></div>
        <div class="frow"><label>Title *</label><input name="title" required placeholder="e.g. SPE OOU Constitution"></div>
        <div class="frow"><label>Category</label><input name="category" placeholder="Constitution / Report / Minutes…" value="General"></div>
        <div class="frow"><label>Published</label><div class="checkrow"><input type="checkbox" name="published" value="1" checked> <span>Visible to visitors</span></div></div>
        <div class="frow full"><label>Description</label><textarea name="description"></textarea></div>
      </div><div class="form-actions"><button class="abtn primary" type="submit">Upload document</button></div></form>
    </div>
    <div class="toolbar"><input type="search" id="docSearch" placeholder="🔍 Search documents…"></div>
    <div class="rows" id="docRows"></div>`;
  let items = [];
  async function load() {
    items = await api('/api/admin/documents');
    paint('');
  }
  function paint(q) {
    const rows = items.filter(d => !q || (d.title + d.description + d.category).toLowerCase().includes(q));
    $('#docRows').innerHTML = rows.length ? rows.map(d => `
      <div class="doc-row-admin"><div class="doc-ic">📄</div>
        <div class="row-main"><b>${esc(d.title)} ${d.published ? '' : '<span class="badge red">Hidden</span>'} <span class="badge">${esc(d.category)}</span></b>
        <small>${esc(d.filename || '')} • ${(Number(d.size) / 1024).toFixed(1)} KB • ${esc(d.upload_date || '')}</small></div>
        <div class="row-actions">
          <a class="icon-btn" href="${esc(d.filepath)}" target="_blank" rel="noopener" style="text-decoration:none">⬇️</a>
          <button class="icon-btn ${d.published ? 'on' : 'off'}" data-a="pub" data-id="${d.id}">${d.published ? '👁️' : '🚫'}</button>
          <button class="icon-btn" data-a="edit" data-id="${d.id}">✏️</button>
          <button class="icon-btn" data-a="del" data-id="${d.id}">🗑️</button>
        </div></div>`).join('') : '<div class="panel">No documents yet.</div>';
    $$('#docRows [data-a]').forEach(b => b.addEventListener('click', () => docAction(b.dataset.a, b.dataset.id)));
  }
  async function docAction(a, id) {
    const d = items.find(x => x.id == id);
    try {
      if (a === 'pub') { await api('/api/admin/documents/' + id, { method: 'PUT', body: JSON.stringify({ published: d.published ? 0 : 1 }) }); load(); }
      else if (a === 'del') {
        if (!confirmDo(`Delete document "${d.title}"? The file will be removed from storage.`)) return;
        await api('/api/admin/documents/' + id, { method: 'DELETE' }); toast('Deleted'); load();
      } else if (a === 'edit') {
        openModal('Edit document', `<form id="dForm"><div class="form-grid">
          <div class="frow full"><label>Title</label><input name="title" value="${esc(d.title)}"></div>
          <div class="frow"><label>Category</label><input name="category" value="${esc(d.category)}"></div>
          <div class="frow"><label>Published</label><div class="checkrow"><input type="checkbox" name="published" value="1" ${d.published ? 'checked' : ''}> <span>Visible to visitors</span></div></div>
          <div class="frow full"><label>Description</label><textarea name="description">${esc(d.description)}</textarea></div></div>
          <div class="form-actions"><button type="button" class="abtn ghost" onclick="document.getElementById('modalClose').click()">Cancel</button>
          <button class="abtn primary" type="submit">Save</button></div></form>`);
        $('#dForm').addEventListener('submit', async e => {
          e.preventDefault();
          const fd = new FormData(e.target);
          await api('/api/admin/documents/' + id, { method: 'PUT', body: JSON.stringify({ title: fd.get('title'), category: fd.get('category'), description: fd.get('description'), published: fd.get('published') ? 1 : 0 }) });
          closeModal(); toast('Saved ✓'); load();
        });
      }
    } catch (e) { toast(e.message, true); }
  }
  $('#docForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.set('published', e.target.published.checked ? '1' : '0');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      await apiForm('/api/admin/documents/upload', fd);
      e.target.reset(); toast('Document uploaded ✓'); load();
    } catch (ex) { toast(ex.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Upload document'; }
  });
  $('#docSearch').addEventListener('input', e => paint(e.target.value.toLowerCase()));
  await load();
}

async function vSettings() {
  const body = $('#viewBody');
  const [s, c] = await Promise.all([api('/api/settings'), api('/api/contact')]);
  const fields = [
    ['site_title', 'Website title (browser tab)'], ['hero_eyebrow', 'Hero eyebrow'],
    ['hero_title', 'Hero title'], ['hero_playful', 'Hero playful line'], ['hero_sub', 'Hero subtitle'],
    ['exec_session', 'Current executive session (e.g. 2026/2027)'], ['exec_title', 'Executives section title'],
    ['leaders_title', 'Past leaders section title'], ['gallery_title', 'Gallery section title'],
    ['community_title', 'Community section title'], ['community_text', 'Community text (long)'],
    ['announcement', 'Announcement banner text (leave empty to hide)'],
  ];
  body.innerHTML = `
    <div class="panel"><h3>✏️ Website texts</h3><form id="setForm"><div class="form-grid">
      ${fields.map(([k, l]) => `<div class="frow ${['hero_title', 'community_text', 'announcement'].includes(k) ? 'full' : ''}"><label>${l}</label>
        ${['hero_title', 'community_text', 'announcement'].includes(k) ? `<textarea name="${k}">${esc(s[k] || '')}</textarea>` : `<input name="${k}" value="${esc(s[k] || '')}">`}</div>`).join('')}
      <div class="frow"><label>Show announcement banner</label><div class="checkrow"><input type="checkbox" name="announcement_on" value="1" ${s.announcement_on === '1' ? 'checked' : ''}> <span>Yes</span></div></div>
      </div><div class="form-actions"><button class="abtn primary" type="submit">💾 Save texts</button></div></form></div>
    <div class="panel"><h3>📇 Contact info & social links</h3><form id="conForm"><div class="form-grid">
      ${[['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['instagram', 'Instagram URL'], ['linkedin', 'LinkedIn URL'], ['facebook', 'Facebook URL'], ['twitter', 'X / Twitter URL'], ['youtube', 'YouTube URL'], ['whatsapp', 'WhatsApp URL']].map(([k, l]) => `<div class="frow ${k === 'address' ? 'full' : ''}"><label>${l}</label><input name="${k}" value="${esc(c[k] || '')}"></div>`).join('')}
      </div><div class="form-actions"><button class="abtn primary" type="submit">💾 Save contact info</button></div></form></div>`;
  $('#setForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target), out = {};
    fields.forEach(([k]) => out[k] = fd.get(k) || '');
    out.announcement_on = e.target.announcement_on.checked ? '1' : '0';
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(out) }); toast('Settings saved ✓'); }
    catch (ex) { toast(ex.message, true); }
  });
  $('#conForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target), out = {};
    ['email', 'phone', 'address', 'instagram', 'linkedin', 'facebook', 'twitter', 'youtube', 'whatsapp'].forEach(k => out[k] = fd.get(k) || '');
    try { await api('/api/admin/contact', { method: 'PUT', body: JSON.stringify(out) }); toast('Contact info saved ✓'); }
    catch (ex) { toast(ex.message, true); }
  });
}

async function vAccount() {
  const body = $('#viewBody');
  const { user } = await api('/api/auth/me');
  body.innerHTML = `<div class="panel" style="max-width:560px"><h3>👤 My account</h3>
    <form id="accForm"><div class="form-grid">
      <div class="frow"><label>Display name</label><input name="name" value="${esc(user.name)}"></div>
      <div class="frow"><label>Email</label><input name="email" type="email" value="${esc(user.email)}"></div>
      <div class="frow full"><label>Current password (required to change password)</label><input name="currentPassword" type="password" autocomplete="current-password"></div>
      <div class="frow full"><label>New password (min 8 chars, leave empty to keep)</label><input name="newPassword" type="password" autocomplete="new-password"></div>
    </div><div class="form-actions"><button class="abtn primary" type="submit">💾 Save account</button></div></form></div>`;
  $('#accForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/auth/account', { method: 'PUT', body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') || undefined }) });
      toast('Account updated ✓'); boot();
    } catch (ex) { toast(ex.message, true); }
  });
}

document.addEventListener('DOMContentLoaded', boot);
