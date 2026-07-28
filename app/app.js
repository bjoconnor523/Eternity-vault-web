// ============================================================================
// app.js — router + views for the Eternity Vault web app.
// A tiny hash-routed SPA. No framework, no build step: just modules + the DOM.
// ============================================================================
import { supabase } from './supabase.js';
import * as api from './api.js';

// ---- Small helpers ---------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nav = (hash) => { location.hash = hash; };
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MILESTONE_ICON = {
  marriage: '💍', graduation: '🎓', 'first-child': '👶', loss: '🕊️',
  'first-home': '🏡', 'new-job': '💼', 'big-move': '📦', retirement: '🌅',
};

const state = { user: null };

const el = (id) => document.getElementById(id);
const root = () => el('app-root');

const initials = (name) => (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const timeAgo = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

const dateTabLabel = (m) => (m.month ? `${MONTHS[m.month]} ${m.year}` : `${m.year}`);
const fullDate = (m) => {
  if (m.month && m.day) return `${MONTHS[m.month]} ${m.day}, ${m.year}`;
  if (m.month) return `${MONTHS[m.month]} ${m.year}`;
  return `${m.year}`;
};
const placeLabel = (m) => {
  if (m.placeCity && m.placeCountry === 'United States' && m.placeRegion) return `${m.placeCity}, ${m.placeRegion}`;
  if (m.placeCity && m.placeCountry) return `${m.placeCity}, ${m.placeCountry}`;
  return m.location || '';
};

// ---- Loading / chrome ------------------------------------------------------
function setLoading() {
  root().innerHTML = '<div class="spinner"></div>';
}

function renderTopbar(active, unread = 0) {
  const bar = el('topbar');
  if (!state.user) { bar.innerHTML = ''; return; }
  const link = (hash, label, key, badge = 0) =>
    `<a class="navlink ${active === key ? 'active' : ''}" href="${hash}">${label}${
      badge ? `<span class="badge">${badge > 9 ? '9+' : badge}</span>` : ''
    }</a>`;
  bar.innerHTML = `
    <a class="brand" href="#/journey"><img src="../brand/eternity-vault-mark.svg" alt=""><span>Eternity Vault</span></a>
    <div class="spacer"></div>
    ${link('#/journey', 'Journey', 'journey')}
    ${link('#/world', 'World', 'world')}
    ${link('#/circle', 'Circle', 'circle')}
    ${link('#/notifications', '🔔', 'notifications', unread)}
    ${link('#/profile', 'Me', 'profile')}
  `;
}

// ---- Auth view -------------------------------------------------------------
function viewAuth() {
  renderTopbar(null);
  let mode = 'login';
  const render = () => {
    root().innerHTML = `
      <div class="panel center-card">
        <div style="text-align:center;margin-bottom:18px;">
          <img src="../brand/eternity-vault-mark.svg" width="52" height="52" alt="">
          <h1 style="color:var(--blue);margin:10px 0 2px;font-size:1.6rem;">Eternity Vault</h1>
          <div class="eyebrow">proof you were here</div>
        </div>
        <div id="auth-err"></div>
        <form id="auth-form">
          ${mode === 'signup' ? `
            <div class="field"><label>Your name</label><input name="name" autocomplete="name" required></div>
            <div class="field"><label>Handle</label><input name="handle" placeholder="yourname" autocomplete="username" required>
              <div class="hint">3–15 characters: lowercase letters, numbers, underscores.</div></div>
          ` : ''}
          <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label>Password</label><input name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required></div>
          ${mode === 'signup' ? `
            <div class="field"><label>This journey is…</label>
              <select name="accountType"><option value="personal">A life</option><option value="business">A business</option></select>
            </div>` : ''}
          <button class="btn block" type="submit">${mode === 'signup' ? 'Create my journey' : 'Sign in'}</button>
        </form>
        <div style="text-align:center;margin-top:16px;color:var(--muted);font-size:0.92rem;">
          ${mode === 'signup'
            ? `Already have an account? <a href="#" id="toggle-mode">Sign in</a>`
            : `New here? <a href="#" id="toggle-mode">Create a journey</a>`}
        </div>
      </div>`;
    $('#toggle-mode').onclick = (e) => { e.preventDefault(); mode = mode === 'login' ? 'signup' : 'login'; render(); };
    $('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = $('#auth-form button');
      btn.disabled = true;
      btn.textContent = 'One moment…';
      $('#auth-err').innerHTML = '';
      try {
        if (mode === 'signup') {
          const res = await api.signUp({
            name: f.get('name'), email: f.get('email'), handle: f.get('handle'),
            password: f.get('password'), accountType: f.get('accountType'),
          });
          if (res?.needsConfirmation) {
            root().innerHTML = `<div class="panel center-card"><h2 style="color:var(--blue)">Check your email</h2>
              <p>We sent a confirmation link to <strong>${esc(res.email)}</strong>. Tap it, then come back and sign in.</p>
              <button class="btn ghost block" id="back-login">Back to sign in</button></div>`;
            $('#back-login').onclick = () => { mode = 'login'; render(); };
            return;
          }
          state.user = res;
          nav('#/profile');
        } else {
          state.user = await api.logIn({ email: f.get('email'), password: f.get('password') });
          nav('#/journey');
        }
        route();
      } catch (err) {
        $('#auth-err').innerHTML = `<div class="error">${esc(err.message)}</div>`;
        btn.disabled = false;
        btn.textContent = mode === 'signup' ? 'Create my journey' : 'Sign in';
      }
    };
  };
  render();
}

// ---- Monument header (shared by my profile + person page) ------------------
function monumentHTML(u, moments, circleCount, isSelf) {
  const business = u.accountType === 'business';
  const sealed = u.memorialState === 'sealed';
  const years = moments.length ? new Set(moments.map((m) => m.year)).size : 0;
  const bornWord = business ? 'Founded' : 'Born';
  const birthBits = [];
  if (u.birthMonth && u.birthDay && u.birthYear) birthBits.push(`${MONTHS[u.birthMonth]} ${u.birthDay}, ${u.birthYear}`);
  else if (u.birthYear) birthBits.push(String(u.birthYear));
  if (u.hometown) birthBits.push(u.hometown);
  const ring = u.favoriteColor ? `style="background:${esc(u.favoriteColor)}"` : '';
  const avatar = u.avatarUri
    ? `<img src="${esc(u.avatarUri)}" alt="">`
    : `<div class="ph">${esc(initials(u.name))}</div>`;
  return `
    <div class="monument">
      <div class="avatar-ring" ${ring}>${avatar}</div>
      <h1>${esc(u.name || 'Unnamed')}</h1>
      <div class="handle">@${esc(u.handle || '')}</div>
      ${business ? '<div class="chip">Business</div>' : ''}
      ${sealed ? '<div class="chip sealed">✦ Kept as they left it</div>' : ''}
      ${u.epitaph ? `<div class="epitaph">“${esc(u.epitaph)}”</div>`
        : isSelf ? `<div class="epitaph muted"><a href="#/profile/edit">+ add an epitaph</a></div>` : ''}
      ${birthBits.length ? `<div class="birthline">${bornWord} ${esc(birthBits.join(' · '))}</div>` : ''}
      ${u.bio ? `<p style="max-width:480px;margin:12px auto 0;">${esc(u.bio)}</p>`
        : isSelf ? `<p class="muted" style="margin-top:10px;"><a href="#/profile/edit">+ add a short bio</a></p>` : ''}
      <div class="stats">
        <div class="stat"><div class="n">${moments.length}</div><div class="l">Moments</div></div>
        <div class="stat"><div class="n">${years}</div><div class="l">Years</div></div>
        <div class="stat"><div class="n">${circleCount}</div><div class="l">Circle</div></div>
      </div>
    </div>`;
}

// ---- Timeline rendering ----------------------------------------------------
function momentCardHTML(m, opts = {}) {
  const now = new Date();
  const sealedFuture = m.sealedUntil && new Date(m.sealedUntil) > now;
  if (sealedFuture) {
    return `
      <div class="moment-row">
        <div class="datetab">${esc(dateTabLabel(m))}</div>
        <div class="sealed-card">
          <div class="lock">🔒</div>
          <div style="font-weight:600;margin-top:6px;">A sealed time capsule</div>
          <div class="muted" style="margin-top:4px;">Opens ${esc(new Date(m.sealedUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}</div>
        </div>
      </div>`;
  }
  const photos = (m.photos || []).slice(0, 6);
  const photosHTML = photos.length
    ? `<div class="photos">${photos.map((p) => `<img src="${esc(p)}" loading="lazy" alt="">`).join('')}</div>`
    : '';
  const tagsHTML = (m.tags || []).length
    ? `<div class="tags">${m.tags
        .map((t) => `<span class="tag ${t.confirmed ? 'witnessed' : ''}">${t.confirmed ? '✓ ' : ''}${esc(t.label)}</span>`)
        .join('')}</div>`
    : '';
  const loc = placeLabel(m);
  const milestone = m.milestone && MILESTONE_ICON[m.milestone] ? `<span class="milestone" title="${esc(m.milestone)}">${MILESTONE_ICON[m.milestone]}</span>` : '';
  return `
    <div class="moment-row">
      <div class="datetab">${esc(dateTabLabel(m))}</div>
      <div class="card ${m.adopted ? 'adopted' : ''}" data-moment="${esc(m.id)}">
        <div class="m-meta">${milestone}${m.adopted ? '<span class="tag" style="background:rgba(27,75,143,0.12);color:var(--blue-deep)">Added from a friend</span>' : ''}</div>
        ${m.title ? `<h3 class="m-title">${esc(m.title)}</h3>` : ''}
        ${m.caption ? `<div class="m-caption">${esc(m.caption)}</div>` : ''}
        ${m.story ? `<div class="m-story">${esc(m.story.length > 280 ? m.story.slice(0, 280) + '…' : m.story)}</div>` : ''}
        ${photosHTML}
        ${loc ? `<div class="m-loc">📍 ${esc(loc)}</div>` : ''}
        ${tagsHTML}
      </div>
    </div>`;
}

function timelineHTML(moments, owner) {
  if (!moments.length) return '';
  // Ascending by year (a life read from the start).
  const sorted = [...moments].sort(api.byChrono);
  const byYear = new Map();
  for (const m of sorted) {
    if (!byYear.has(m.year)) byYear.set(m.year, []);
    byYear.get(m.year).push(m);
  }
  const business = owner?.accountType === 'business';
  let lastDecade = null;
  let html = '<div class="timeline">';
  for (const [year, list] of byYear) {
    const decade = Math.floor(year / 10) * 10;
    const isDecade = decade !== lastDecade;
    lastDecade = decade;
    let ageLabel = String(year);
    if (owner?.birthYear) {
      const n = year - owner.birthYear;
      ageLabel = business ? `Year ${n + 1} · ${year}` : n >= 0 ? `Age ${n} · ${year}` : String(year);
    }
    html += `
      <div class="era ${isDecade ? 'decade' : ''}">
        ${isDecade ? `<div class="ghost">${decade}s</div>` : ''}
        <span class="plate">${esc(ageLabel)}</span>
      </div>`;
    for (const m of list) html += momentCardHTML(m);
  }
  html += '</div>';
  return html;
}

// ---- My Journey ------------------------------------------------------------
async function viewJourney() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('journey', unread);
  setLoading();
  const [moments, circleCount] = await Promise.all([
    api.getMomentsOf(state.user.id),
    api.fetchCircleCountOf(state.user.id),
  ]);
  const sealed = state.user.memorialState === 'sealed';
  root().innerHTML = `
    <div class="wrap">
      ${monumentHTML(state.user, moments, circleCount, true)}
      ${!sealed ? `<div class="header-actions"><a class="btn" href="#/add">+ Add a moment</a>
        <a class="btn ghost" href="#/profile/edit">Edit profile</a></div>` : ''}
      <div class="section-title">Your Journey</div>
      ${moments.length
        ? timelineHTML(moments, state.user)
        : `<div class="empty"><div class="big">🌱</div>Your journey is empty.<br>Add the first moment of your life's record.
           <div style="margin-top:16px;"><a class="btn" href="#/add">+ Add a moment</a></div></div>`}
    </div>
    ${!sealed ? '<button class="fab" onclick="location.hash=\'#/add\'" title="Add a moment">+</button>' : ''}`;
  attachMomentClicks();
}

function attachMomentClicks() {
  root().querySelectorAll('[data-moment]').forEach((c) => {
    c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`);
  });
}

// ---- Person (someone else's journey) ---------------------------------------
async function viewPerson(handle) {
  renderTopbar(null);
  setLoading();
  const u = await api.fetchUserByHandle(handle);
  if (!u) {
    root().innerHTML = `<div class="wrap"><a class="back" href="#/world">← World</a><div class="empty">No one here by @${esc(handle)}.</div></div>`;
    renderTopbar('world');
    return;
  }
  if (u.id === state.user.id) { nav('#/journey'); return; }
  api.recordProfileView(state.user.id, u.id);
  renderTopbar('world');
  const [moments, circleCount, circlePairs] = await Promise.all([
    api.getMomentsOf(u.id),
    api.fetchCircleCountOf(u.id),
    api.fetchCircleOf(state.user.id),
  ]);
  const inCircle = circlePairs.some((p) => (p.a === state.user.id && p.b === u.id) || (p.b === state.user.id && p.a === u.id));
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/world">← World</a>
      ${monumentHTML(u, moments, circleCount, false)}
      <div class="header-actions">
        <button class="btn ${inCircle ? 'ghost' : ''}" id="circle-btn">${inCircle ? 'In your Circle ✓' : '+ Add to Circle'}</button>
      </div>
      <div class="section-title">${esc(u.name?.split(' ')[0] || 'Their')}'s Journey</div>
      ${moments.length ? timelineHTML(moments, u) : '<div class="empty">No moments yet.</div>'}
    </div>`;
  attachMomentClicks();
  $('#circle-btn').onclick = async () => {
    const btn = $('#circle-btn');
    btn.disabled = true;
    try {
      if (inCircle) await api.removeFromCircle(state.user.id, u.id);
      else await api.addToCircle(state.user, u.id);
      viewPerson(handle);
    } catch (e) { btn.disabled = false; alert(e.message); }
  };
}

// ---- World (search + trending) --------------------------------------------
async function viewWorld() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('world', unread);
  root().innerHTML = `
    <div class="wrap">
      <div class="eyebrow">Eternity Vault</div>
      <div class="section-title" style="margin-top:2px;">World</div>
      <div class="field"><input id="search" placeholder="Search people and businesses by name or @handle"></div>
      <div id="trending-wrap"></div>
      <div id="results"></div>
    </div>`;
  const trending = await api.getTrendingProfiles().catch(() => []);
  if (trending.length) {
    $('#trending-wrap').innerHTML = `
      <div class="eyebrow" style="font-size:1.2rem;">🔥 Trending now</div>
      <div class="trending">${trending
        .map((t) => `<div class="t-card" data-handle="${esc(t.handle)}">
          <div class="pfp">${t.avatarUri ? `<img src="${esc(t.avatarUri)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc(initials(t.name))}</div>
          <div class="nm">${esc(t.name?.split(' ')[0] || t.handle)}</div>
          <div class="vc">${t.viewCount} views</div>
        </div>`).join('')}</div>`;
    $('#trending-wrap').querySelectorAll('[data-handle]').forEach((c) => {
      c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`);
    });
  }
  const doSearch = async (q) => {
    $('#results').innerHTML = '<div class="spinner"></div>';
    const people = await api.searchOthers(state.user.id, q);
    $('#results').innerHTML = people.length
      ? `<div class="section-title">${q ? 'Results' : 'Recently joined'}</div>` + people.map(personRowHTML).join('')
      : '<div class="empty">No one found. Try another name.</div>';
    $('#results').querySelectorAll('[data-handle]').forEach((c) => {
      c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`);
    });
  };
  let t;
  $('#search').oninput = (e) => { clearTimeout(t); t = setTimeout(() => doSearch(e.target.value), 260); };
  doSearch('');
}

function personRowHTML(u) {
  return `<div class="person" data-handle="${esc(u.handle)}">
    <div class="pfp">${u.avatarUri ? `<img src="${esc(u.avatarUri)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc(initials(u.name))}</div>
    <div class="who"><div class="nm">${esc(u.name)}${u.accountType === 'business' ? ' <span class="chip" style="margin:0">Business</span>' : ''}</div>
      <div class="hd">@${esc(u.handle)}${u.hometown ? ' · ' + esc(u.hometown) : ''}</div></div>
    <div style="color:var(--blue)">›</div>
  </div>`;
}

// ---- Circle ----------------------------------------------------------------
async function viewCircle() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('circle', unread);
  setLoading();
  const pairs = await api.fetchCircleOf(state.user.id);
  const ids = [...new Set(pairs.map((p) => (p.a === state.user.id ? p.b : p.a)))];
  const people = [];
  for (const id of ids) {
    const u = await api.fetchUserById(id);
    if (u) people.push(u);
  }
  root().innerHTML = `
    <div class="wrap">
      <div class="section-title">Your Circle</div>
      <p class="muted">The people whose lives are woven with yours.</p>
      ${people.length
        ? people.map(personRowHTML).join('')
        : `<div class="empty"><div class="big">🤝</div>Your Circle is empty.<br>Find people in the <a href="#/world">World</a>.</div>`}
    </div>`;
  root().querySelectorAll('[data-handle]').forEach((c) => {
    c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`);
  });
}

// ---- Notifications ---------------------------------------------------------
async function viewNotifications() {
  renderTopbar('notifications');
  setLoading();
  const notes = await api.fetchNotificationsOf(state.user.id);
  const line = (n) => {
    const who = n.fromName ? `${esc(n.fromName)}` : 'Someone';
    if (n.type === 'tag') return `${who} tagged you in “${esc(n.memoryTitle || 'a moment')}” (${n.year})`;
    if (n.type === 'confirm') return `${who} confirmed “${esc(n.memoryTitle || 'a moment')}” — now witnessed`;
    if (n.type === 'comment') return `${who} commented on “${esc(n.memoryTitle || 'a moment')}”${n.body ? `: “${esc(n.body)}”` : ''}`;
    if (n.type === 'contribution') return `${who} added their side to “${esc(n.memoryTitle || 'a moment')}”`;
    if (n.type === 'circle') return `${who} added you to their Circle`;
    if (n.type === 'memorial') return `${esc(n.body || 'A memorial notice')}`;
    return `${who} sent you a notification`;
  };
  root().innerHTML = `
    <div class="wrap">
      <div class="section-title">Notifications</div>
      ${notes.length
        ? notes.map((n) => `<div class="notif ${n.read ? '' : 'unread'}" ${n.memoryId ? `data-moment="${esc(n.memoryId)}"` : n.fromHandle ? `data-handle="${esc(n.fromHandle)}"` : ''} style="cursor:${n.memoryId || n.fromHandle ? 'pointer' : 'default'}">
            <div>${line(n)}</div>
            <div class="muted" style="font-size:0.8rem;margin-top:3px;">${timeAgo(n.createdAt)}</div>
          </div>`).join('')
        : '<div class="empty"><div class="big">🔔</div>No notifications yet.</div>'}
    </div>`;
  root().querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
  root().querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  api.markNotificationsRead(state.user.id).catch(() => {});
}

// ---- Moment detail ---------------------------------------------------------
async function viewMoment(id) {
  renderTopbar(null);
  setLoading();
  const m = await api.getMomentById(id);
  if (!m) { root().innerHTML = `<div class="wrap"><div class="empty">This moment isn't available.</div></div>`; return; }
  const owner = await api.fetchUserById(m.ownerId);
  const isOwner = m.ownerId === state.user.id;
  const sealedOwnerFrozen = owner?.memorialState === 'sealed';
  renderTopbar(isOwner ? 'journey' : 'world');
  const [comments, contributions] = await Promise.all([api.getComments(id), api.getContributions(id)]);
  const loc = placeLabel(m);
  const photosHTML = (m.photos || []).length
    ? `<div class="gallery-full">${m.photos.map((p) => `<img src="${esc(p)}" loading="lazy" alt="">`).join('')}</div>`
    : '';
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="${isOwner ? '#/journey' : `#/u/${esc(owner?.handle || '')}`}">← Back</a>
      <div class="datetab" style="font-size:1.3rem">${esc(fullDate(m))}</div>
      <div class="panel" style="border-top-left-radius:0;">
        ${owner ? `<div class="muted" style="margin-bottom:8px;">A moment from <a href="#/u/${esc(owner.handle)}">${esc(owner.name)}</a>${m.milestone && MILESTONE_ICON[m.milestone] ? ' · ' + MILESTONE_ICON[m.milestone] : ''}</div>` : ''}
        ${m.title ? `<h1 style="color:var(--blue);margin:0 0 6px;">${esc(m.title)}</h1>` : ''}
        ${m.caption ? `<div style="font-size:1.1rem;color:var(--muted);">${esc(m.caption)}</div>` : ''}
        ${photosHTML}
        ${m.story ? `<p style="white-space:pre-wrap;margin-top:14px;font-size:1.08rem;">${esc(m.story)}</p>` : ''}
        ${m.audioUrl ? `<audio controls src="${esc(m.audioUrl)}" style="width:100%;margin-top:12px;"></audio>` : ''}
        ${loc ? `<div class="m-loc" style="color:var(--muted);margin-top:12px;">📍 ${
          m.placeLat ? `<a href="https://maps.google.com/?q=${m.placeLat},${m.placeLng}" target="_blank" rel="noopener">${esc(loc)}</a>` : esc(loc)
        }</div>` : ''}
        ${(m.tags || []).length ? `<div class="tags" style="margin-top:14px;">${m.tags.map((t) => `<span class="tag witnessed" style="background:${t.confirmed ? 'var(--gold)' : 'rgba(27,75,143,0.1)'};color:var(--blue-deep)">${t.confirmed ? '✓ ' : ''}${esc(t.label)}</span>`).join('')}</div>` : ''}
        ${isOwner && !sealedOwnerFrozen ? `<div class="header-actions" style="justify-content:flex-start;margin-top:18px;">
          <a class="btn ghost sm" href="#/edit/${esc(m.id)}">Edit</a>
          <button class="btn danger sm" id="del-moment">Delete</button>
        </div>` : ''}
      </div>

      ${contributions.length ? `<div class="section-title">Their side of the story</div>
        ${contributions.map((c) => `<div class="contribution">
          <div class="who" style="font-weight:600;color:var(--blue)">${esc(c.name)} <span class="muted" style="font-weight:400">@${esc(c.handle)}</span></div>
          ${c.note ? `<p style="margin:6px 0;white-space:pre-wrap;">${esc(c.note)}</p>` : ''}
          ${c.photos?.length ? `<div class="photos">${c.photos.map((p) => `<img src="${esc(p)}" loading="lazy" alt="">`).join('')}</div>` : ''}
          ${c.audioUrl ? `<audio controls src="${esc(c.audioUrl)}" style="width:100%;margin-top:8px;"></audio>` : ''}
        </div>`).join('')}` : ''}

      <div class="section-title">Comments</div>
      ${sealedOwnerFrozen ? '<div class="notice">This journey is sealed and kept as they left it. It can be read, but not added to.</div>' : `
        <form id="comment-form" style="display:flex;gap:8px;margin-bottom:16px;">
          <input name="text" placeholder="Leave a comment…" style="flex:1" required>
          <button class="btn" type="submit">Post</button>
        </form>`}
      <div id="comments">${
        comments.length
          ? comments.map((c) => `<div class="comment"><span class="who">${esc(c.name)}</span>${c.pinned ? ' 📌' : ''}<span class="when">${timeAgo(c.createdAt)}</span>
              <div>${esc(c.text)}</div></div>`).join('')
          : '<div class="muted">No comments yet.</div>'
      }</div>
    </div>`;
  if (isOwner && !sealedOwnerFrozen) {
    const del = $('#del-moment');
    if (del) del.onclick = async () => {
      if (!confirm('Delete this moment? This cannot be undone.')) return;
      await api.deleteMemory(m.id);
      nav('#/journey');
    };
  }
  const cf = $('#comment-form');
  if (cf) cf.onsubmit = async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('text');
    e.target.querySelector('button').disabled = true;
    try { await api.addComment(state.user, id, text); viewMoment(id); }
    catch (err) { alert(err.message); e.target.querySelector('button').disabled = false; }
  };
}

// ---- Add / edit a moment ---------------------------------------------------
const MILESTONE_OPTS = [
  ['', '— none —'], ['marriage', '💍 Marriage'], ['graduation', '🎓 Graduation'], ['first-child', '👶 First child'],
  ['loss', '🕊️ Lost a loved one'], ['first-home', '🏡 First home'], ['new-job', '💼 New job'],
  ['big-move', '📦 Big move'], ['retirement', '🌅 Retirement'],
];

async function viewMomentForm(existingId) {
  renderTopbar('journey');
  setLoading();
  let m = null;
  if (existingId) {
    m = await api.getMomentById(existingId);
    if (!m || m.ownerId !== state.user.id) { root().innerHTML = '<div class="wrap"><div class="empty">You can only edit your own moments.</div></div>'; return; }
  }
  const pendingFiles = []; // File objects newly picked
  let keptPhotos = m ? [...(m.photos || [])] : []; // existing URLs to keep
  const thisYear = new Date().getFullYear();
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="${existingId ? `#/moment/${existingId}` : '#/journey'}">← Cancel</a>
      <div class="section-title">${existingId ? 'Edit moment' : 'Add a moment'}</div>
      <div id="form-err"></div>
      <form id="m-form" class="panel">
        <div class="row">
          <div class="field"><label>Year *</label><input name="year" type="number" min="1900" max="${thisYear}" value="${m ? m.year : thisYear}" required></div>
          <div class="field"><label>Month</label><select name="month">${['','1','2','3','4','5','6','7','8','9','10','11','12'].map((v) => `<option value="${v}" ${m && String(m.month || '') === v ? 'selected' : ''}>${v ? MONTHS[+v] : '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Day</label><input name="day" type="number" min="1" max="31" value="${m && m.day ? m.day : ''}"></div>
        </div>
        <div class="field"><label>Title</label><input name="title" value="${m ? esc(m.title) : ''}" placeholder="e.g. Summer at the lake house"></div>
        <div class="field"><label>Caption</label><input name="caption" value="${m ? esc(m.caption) : ''}" placeholder="A short line"></div>
        <div class="field"><label>Story</label><textarea name="story" placeholder="Tell it the way you'd tell it…">${m ? esc(m.story) : ''}</textarea></div>
        <div class="field"><label>Location</label><input name="location" value="${m ? esc(m.location) : ''}" placeholder="City, or wherever it happened"></div>
        <div class="field"><label>Milestone</label><select name="milestone">${MILESTONE_OPTS.map(([v, l]) => `<option value="${v}" ${m && (m.milestone || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>People who were there</label><input name="tags" value="${m ? esc((m.tags || []).map((t) => t.handle ? '@' + t.handle : t.label).join(', ')) : ''}" placeholder="Mom, @davidk, the whole crew">
          <div class="hint">Separate with commas. Use @handle to link a real member.</div></div>
        <div class="field"><label>Photos</label>
          <input type="file" id="photo-input" accept="image/*,video/*" multiple>
          <div class="photo-preview" id="preview"></div>
        </div>
        <button class="btn block" type="submit">${existingId ? 'Save changes' : 'Add to my Journey'}</button>
      </form>
    </div>`;

  const renderPreview = () => {
    const wrap = $('#preview');
    wrap.innerHTML =
      keptPhotos.map((url, i) => `<div class="pp"><img src="${esc(url)}" alt=""><button type="button" class="rm" data-kept="${i}">×</button></div>`).join('') +
      pendingFiles.map((f, i) => `<div class="pp"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="rm" data-new="${i}">×</button></div>`).join('');
    wrap.querySelectorAll('[data-kept]').forEach((b) => (b.onclick = () => { keptPhotos.splice(+b.getAttribute('data-kept'), 1); renderPreview(); }));
    wrap.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => { pendingFiles.splice(+b.getAttribute('data-new'), 1); renderPreview(); }));
  };
  $('#photo-input').onchange = (e) => { for (const f of e.target.files) pendingFiles.push(f); renderPreview(); };
  renderPreview();

  $('#m-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('#m-form button');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    $('#form-err').innerHTML = '';
    try {
      const tags = (f.get('tags') || '').split(',').map((s) => s.trim()).filter(Boolean).map((label) => ({ label }));
      const photos = [...keptPhotos, ...pendingFiles]; // urls pass through, files upload
      const payload = {
        year: +f.get('year'),
        month: f.get('month') ? +f.get('month') : null,
        day: f.get('day') ? +f.get('day') : null,
        title: f.get('title'),
        caption: f.get('caption'),
        story: f.get('story'),
        location: f.get('location'),
        milestone: f.get('milestone') || null,
        photos,
        tags,
      };
      if (existingId) {
        await api.updateMemory(state.user, existingId, payload, m.tags);
        nav(`#/moment/${existingId}`);
      } else {
        const row = await api.addMemory(state.user, payload);
        nav(`#/moment/${row.id}`);
      }
    } catch (err) {
      $('#form-err').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      btn.disabled = false;
      btn.textContent = existingId ? 'Save changes' : 'Add to my Journey';
    }
  };
}

// ---- Edit profile ----------------------------------------------------------
const FAVORITE_COLORS = ['#1B4B8F', '#FFC93C', '#2E9E5B', '#C21F45', '#6B3F7A', '#E39A28', '#3AB0C4', '#9A4A24', '#707A2E', '#8C4560', '#42506B', '#1A2233'];

async function viewProfileEdit() {
  renderTopbar('profile');
  const u = state.user;
  let avatarFile = null;
  let favColor = u.favoriteColor || '';
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Edit your profile</div>
      <div id="pf-err"></div>
      <form id="pf-form" class="panel">
        <div style="text-align:center;margin-bottom:16px;">
          <div class="avatar-ring" id="av-ring" style="${favColor ? `background:${favColor}` : ''}">
            ${u.avatarUri ? `<img src="${esc(u.avatarUri)}" id="av-img" alt="">` : `<div class="ph" id="av-img">${esc(initials(u.name))}</div>`}
          </div>
          <label class="btn ghost sm" style="cursor:pointer">Change photo
            <input type="file" id="av-input" accept="image/*" hidden></label>
        </div>
        <div class="field"><label>Name</label><input name="name" value="${esc(u.name || '')}"></div>
        <div class="field"><label>Epitaph <span class="muted">— a line that captures a life</span></label><input name="epitaph" value="${esc(u.epitaph || '')}" placeholder="She never met a stranger."></div>
        <div class="field"><label>Bio</label><textarea name="bio" placeholder="A few words about you.">${esc(u.bio || '')}</textarea></div>
        <div class="row">
          <div class="field"><label>Birth year</label><input name="birthYear" type="number" min="1900" max="${new Date().getFullYear()}" value="${u.birthYear || ''}"></div>
          <div class="field"><label>Month</label><select name="birthMonth">${['','1','2','3','4','5','6','7','8','9','10','11','12'].map((v) => `<option value="${v}" ${String(u.birthMonth || '') === v ? 'selected' : ''}>${v ? MONTHS[+v] : '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Day</label><input name="birthDay" type="number" min="1" max="31" value="${u.birthDay || ''}"></div>
        </div>
        <div class="field"><label>Hometown</label><input name="hometown" value="${esc(u.hometown || '')}" placeholder="Where you're from"></div>
        <div class="field"><label>Favorite color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;" id="colors">
            ${FAVORITE_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="width:34px;height:34px;border-radius:50%;border:${favColor === c ? '3px solid var(--ink)' : '2px solid var(--line)'};background:${c}"></button>`).join('')}
          </div>
        </div>
        <button class="btn block" type="submit">Save profile</button>
      </form>
    </div>`;
  $('#av-input').onchange = (e) => {
    avatarFile = e.target.files[0];
    if (avatarFile) $('#av-ring').innerHTML = `<img src="${URL.createObjectURL(avatarFile)}" alt="">`;
  };
  $('#colors').querySelectorAll('.swatch').forEach((b) => {
    b.onclick = () => {
      favColor = b.getAttribute('data-color');
      $('#colors').querySelectorAll('.swatch').forEach((x) => (x.style.border = '2px solid var(--line)'));
      b.style.border = '3px solid var(--ink)';
      $('#av-ring').style.background = favColor;
    };
  });
  $('#pf-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('#pf-form button');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const patch = {
        name: f.get('name'),
        epitaph: f.get('epitaph'),
        bio: f.get('bio'),
        birthYear: f.get('birthYear') ? +f.get('birthYear') : null,
        birthMonth: f.get('birthMonth') ? +f.get('birthMonth') : null,
        birthDay: f.get('birthDay') ? +f.get('birthDay') : null,
        hometown: f.get('hometown'),
        favoriteColor: favColor,
      };
      if (avatarFile) patch.avatarFile = avatarFile;
      const applied = await api.updateProfile(u.id, patch);
      Object.assign(state.user, patch, applied);
      nav('#/profile');
    } catch (err) {
      $('#pf-err').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Save profile';
    }
  };
}

// ---- My profile (= my journey view, but reachable via Me) ------------------
async function viewMyProfile() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('profile', unread);
  setLoading();
  const [moments, circleCount] = await Promise.all([api.getMomentsOf(state.user.id), api.fetchCircleCountOf(state.user.id)]);
  root().innerHTML = `
    <div class="wrap">
      ${monumentHTML(state.user, moments, circleCount, true)}
      <div class="header-actions">
        <a class="btn" href="#/journey">View my Journey</a>
        <a class="btn ghost" href="#/profile/edit">Edit profile</a>
      </div>
      <div class="panel" style="margin-top:24px;">
        <div style="font-weight:600;color:var(--blue);margin-bottom:6px;">Account</div>
        <div class="muted" style="font-size:0.92rem;">Signed in as ${esc(state.user.email || state.user.handle)}</div>
        <div style="margin-top:14px;"><button class="btn ghost sm" id="logout">Log out</button></div>
      </div>
      <p class="muted" style="text-align:center;margin-top:30px;font-size:0.85rem;">
        Eternity Vault — proof you were here.<br>The same journey, on your phone and here.
      </p>
    </div>`;
  $('#logout').onclick = async () => {
    await api.logOut();
    state.user = null;
    nav('#/login');
    route();
  };
}

// ---- Router ----------------------------------------------------------------
async function route() {
  const hash = location.hash || '#/journey';
  const parts = hash.replace(/^#\//, '').split('/');
  const head = parts[0] || 'journey';

  if (!state.user) {
    if (head !== 'login') { viewAuth(); return; }
    viewAuth();
    return;
  }
  try {
    switch (head) {
      case 'login': nav('#/journey'); break;
      case 'journey': await viewJourney(); break;
      case 'world': await viewWorld(); break;
      case 'circle': await viewCircle(); break;
      case 'notifications': await viewNotifications(); break;
      case 'add': await viewMomentForm(null); break;
      case 'edit': await viewMomentForm(parts[1]); break;
      case 'moment': await viewMoment(parts[1]); break;
      case 'u': await viewPerson(parts[1]); break;
      case 'profile': parts[1] === 'edit' ? await viewProfileEdit() : await viewMyProfile(); break;
      default: await viewJourney();
    }
  } catch (err) {
    console.error(err);
    root().innerHTML = `<div class="wrap"><div class="error">Something went wrong loading this page.</div>
      <button class="btn ghost" onclick="location.reload()">Reload</button></div>`;
  }
  window.scrollTo(0, 0);
}

// ---- Boot ------------------------------------------------------------------
async function boot() {
  setLoading();
  try {
    let u = await api.getSessionUser();
    if (!u) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) u = await api.ensureProfileRow();
    }
    state.user = u;
  } catch (e) {
    console.warn('Boot failed', e);
  }
  // React to sign-out from other tabs.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && state.user) { state.user = null; route(); }
  });
  window.addEventListener('hashchange', route);
  route();
}

boot();
