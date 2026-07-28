// ============================================================================
// app.js — router + views for the Eternity Vault web app.
// Hash-routed SPA, no framework. Refined reverent design; bold centered nav.
// ============================================================================
import { supabase } from './supabase.js';
import * as api from './api.js';

// ---- Small helpers ---------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nav = (hash) => { location.hash = hash; };
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MILESTONE_ICON = { marriage: '💍', graduation: '🎓', 'first-child': '👶', loss: '🕊️', 'first-home': '🏡', 'new-job': '💼', 'big-move': '📦', retirement: '🌅' };
const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
const FAVORITE_COLORS = ['#1B4B8F', '#FFC93C', '#2E9E5B', '#C21F45', '#6B3F7A', '#E39A28', '#3AB0C4', '#9A4A24', '#707A2E', '#8C4560', '#42506B', '#1A2233'];
const MILESTONE_OPTS = [['', '— none —'], ['marriage', '💍 Marriage'], ['graduation', '🎓 Graduation'], ['first-child', '👶 First child'], ['loss', '🕊️ Lost a loved one'], ['first-home', '🏡 First home'], ['new-job', '💼 New job'], ['big-move', '📦 Big move'], ['retirement', '🌅 Retirement']];

const state = { user: null, blocked: new Set() };
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
const fullDate = (m) => (m.month && m.day ? `${MONTHS[m.month]} ${m.day}, ${m.year}` : m.month ? `${MONTHS[m.month]} ${m.year}` : `${m.year}`);
const placeLabel = (m) => {
  if (m.placeCity && m.placeCountry === 'United States' && m.placeRegion) return `${m.placeCity}, ${m.placeRegion}`;
  if (m.placeCity && m.placeCountry) return `${m.placeCity}, ${m.placeCountry}`;
  return m.location || '';
};
const setLoading = () => { root().innerHTML = '<div class="spinner"></div>'; };
const avatarImg = (u, cls = '') => (u.avatarUri ? `<img class="${cls}" src="${esc(u.avatarUri)}" alt="">` : `<span class="${cls}">${esc(initials(u.name))}</span>`);

// ---- Top navigation (bold, centered) --------------------------------------
function renderTopbar(active, unread = 0) {
  const bar = el('topbar');
  if (!state.user) { bar.innerHTML = ''; return; }
  const tab = (hash, ic, label, key) =>
    `<a class="nav-tab ${active === key ? 'active' : ''}" href="${hash}"><span class="ic">${ic}</span>${label}</a>`;
  const meAvatar = state.user.avatarUri
    ? `<img class="avatar-mini" src="${esc(state.user.avatarUri)}" alt="Me">`
    : '👤';
  bar.innerHTML = `
    <div class="nav-inner">
      <a class="nav-brand" href="#/journey"><img src="../brand/eternity-vault-mark.svg" alt=""><span>Eternity Vault</span></a>
      <nav class="nav-primary">
        ${tab('#/journey', '📖', 'Journey', 'journey')}
        ${tab('#/world', '🌍', 'World', 'world')}
        ${tab('#/circle', '🤝', 'Circle', 'circle')}
      </nav>
      <div class="nav-actions">
        <a class="nav-icon ${active === 'notifications' ? 'active' : ''}" href="#/notifications" title="Notifications">🔔${unread ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}</a>
        <a class="nav-icon ${active === 'profile' || active === 'settings' ? 'active' : ''}" href="#/profile" title="Me">${meAvatar}</a>
      </div>
    </div>`;
}

const appFooter = () => `
  <div class="app-footer">
    Eternity Vault — proof you were here.<br>
    <a href="../privacy.html" target="_blank">Privacy</a> ·
    <a href="../terms.html" target="_blank">Terms</a> ·
    <a href="../support.html" target="_blank">Support</a> ·
    <a href="#/settings">Settings</a>
  </div>`;

// ---- Auth ------------------------------------------------------------------
function viewAuth() {
  renderTopbar(null);
  let mode = 'login';
  const render = () => {
    root().innerHTML = `
      <div class="panel center-card">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="../brand/eternity-vault-mark.svg" width="56" height="56" alt="">
          <h1 style="color:var(--blue);margin:12px 0 2px;font-size:1.7rem;">Eternity Vault</h1>
          <div class="eyebrow">proof you were here</div>
        </div>
        <div id="auth-err"></div>
        <form id="auth-form">
          ${mode === 'signup' ? `
            <div class="field"><label>Your name</label><input name="name" autocomplete="name" required></div>
            <div class="field"><label>Handle</label><input name="handle" placeholder="yourname" autocomplete="username" required>
              <div class="hint">3–15 characters: lowercase letters, numbers, underscores.</div></div>` : ''}
          <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label>Password</label>
            <div class="pw-wrap">
              <input name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required>
              <button type="button" class="pw-toggle" data-for="password">Show</button>
            </div>
            ${mode === 'login' ? `<div class="hint"><a href="#/forgot">Forgot your password?</a></div>` : ''}
          </div>
          ${mode === 'signup' ? `
            <div class="field"><label>This journey is…</label>
              <select name="accountType"><option value="personal">A life</option><option value="business">A business</option></select></div>
            <label class="checkbox-row"><input type="checkbox" name="terms" required>
              <span>I agree to the <a href="../terms.html" target="_blank">Terms</a> and <a href="../privacy.html" target="_blank">Privacy Policy</a>.</span></label>` : ''}
          <button class="btn block" type="submit">${mode === 'signup' ? 'Create my journey' : 'Sign in'}</button>
        </form>
        <div style="text-align:center;margin-top:18px;color:var(--muted);font-size:0.92rem;">
          ${mode === 'signup' ? `Already have an account? <a href="#" id="toggle-mode">Sign in</a>` : `New here? <a href="#" id="toggle-mode">Create a journey</a>`}
        </div>
      </div>`;
    wirePasswordToggles();
    $('#toggle-mode').onclick = (e) => { e.preventDefault(); mode = mode === 'login' ? 'signup' : 'login'; render(); };
    $('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = $('#auth-form button[type=submit]');
      btn.disabled = true; btn.textContent = 'One moment…';
      $('#auth-err').innerHTML = '';
      try {
        if (mode === 'signup') {
          const res = await api.signUp({ name: f.get('name'), email: f.get('email'), handle: f.get('handle'), password: f.get('password'), accountType: f.get('accountType') });
          if (res?.needsConfirmation) {
            root().innerHTML = `<div class="panel center-card"><h2 style="color:var(--blue)">Check your email</h2>
              <p>We sent a confirmation link to <strong>${esc(res.email)}</strong>. Tap it, then come back and sign in.</p>
              <button class="btn ghost block" id="back-login">Back to sign in</button></div>`;
            $('#back-login').onclick = () => { mode = 'login'; render(); };
            return;
          }
          state.user = res; nav('#/profile'); route();
        } else {
          state.user = await api.logIn({ email: f.get('email'), password: f.get('password') });
          await loadBlocked(); nav('#/journey'); route();
        }
      } catch (err) {
        $('#auth-err').innerHTML = `<div class="error">${esc(err.message)}</div>`;
        btn.disabled = false; btn.textContent = mode === 'signup' ? 'Create my journey' : 'Sign in';
      }
    };
  };
  render();
}

function wirePasswordToggles() {
  root().querySelectorAll('.pw-toggle').forEach((b) => {
    b.onclick = () => {
      const input = b.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Hide' : 'Show';
    };
  });
}

function viewForgot() {
  renderTopbar(null);
  root().innerHTML = `
    <div class="panel center-card">
      <a class="back" href="#/login">← Back to sign in</a>
      <h2 style="color:var(--blue);margin-top:0;">Reset your password</h2>
      <p class="muted">Enter your email and we'll send a link to set a new password.</p>
      <div id="fp-msg"></div>
      <form id="fp-form">
        <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
        <button class="btn block" type="submit">Send reset link</button>
      </form>
    </div>`;
  $('#fp-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get('email');
    const btn = $('#fp-form button');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await api.sendPasswordReset(email, `${location.origin}${location.pathname}`);
      $('#fp-msg').innerHTML = `<div class="success">If an account exists for ${esc(email)}, a reset link is on its way. Check your inbox.</div>`;
    } catch (err) {
      $('#fp-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
    btn.disabled = false; btn.textContent = 'Send reset link';
  };
}

function viewReset() {
  renderTopbar(null);
  root().innerHTML = `
    <div class="panel center-card">
      <h2 style="color:var(--blue);margin-top:0;">Set a new password</h2>
      <div id="rp-msg"></div>
      <form id="rp-form">
        <div class="field"><label>New password</label>
          <div class="pw-wrap"><input name="password" type="password" minlength="6" autocomplete="new-password" required>
            <button type="button" class="pw-toggle">Show</button></div></div>
        <button class="btn block" type="submit">Save new password</button>
      </form>
    </div>`;
  wirePasswordToggles();
  $('#rp-form').onsubmit = async (e) => {
    e.preventDefault();
    const pw = new FormData(e.target).get('password');
    const btn = $('#rp-form button');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.updatePassword(pw);
      state.user = await api.getSessionUser();
      $('#rp-msg').innerHTML = `<div class="success">Password updated. Taking you in…</div>`;
      setTimeout(() => { nav('#/journey'); route(); }, 900);
    } catch (err) {
      $('#rp-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Save new password';
    }
  };
}

// ---- Monument header -------------------------------------------------------
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
  const avatar = u.avatarUri ? `<img src="${esc(u.avatarUri)}" alt="">` : `<div class="ph">${esc(initials(u.name))}</div>`;
  return `
    <div class="monument">
      <div class="avatar-ring" ${ring}>${avatar}</div>
      <h1>${esc(u.name || 'Unnamed')}</h1>
      <div class="handle">@${esc(u.handle || '')}</div>
      <div>${business ? '<span class="chip">Business</span>' : ''}${sealed ? '<span class="chip sealed">✦ Kept as they left it</span>' : ''}</div>
      ${u.epitaph ? `<div class="epitaph">“${esc(u.epitaph)}”</div>` : isSelf ? `<div class="epitaph muted"><a href="#/profile/edit">+ add an epitaph</a></div>` : ''}
      ${birthBits.length ? `<div class="birthline">${bornWord} ${esc(birthBits.join(' · '))}</div>` : ''}
      ${u.bio ? `<p style="max-width:480px;margin:14px auto 0;">${esc(u.bio)}</p>` : isSelf ? `<p class="muted" style="margin-top:10px;"><a href="#/profile/edit">+ add a short bio</a></p>` : ''}
      <div class="stats">
        <div class="stat"><div class="n">${moments.length}</div><div class="l">Moments</div></div>
        <div class="stat"><div class="n">${years}</div><div class="l">Years</div></div>
        <div class="stat"><div class="n">${circleCount}</div><div class="l">Circle</div></div>
      </div>
    </div>`;
}

// ---- Timeline --------------------------------------------------------------
function momentCardHTML(m) {
  const sealedFuture = m.sealedUntil && new Date(m.sealedUntil) > new Date();
  if (sealedFuture) {
    return `<div class="moment-row"><div class="datetab">${esc(dateTabLabel(m))}</div>
      <div class="sealed-card"><div class="lock">🔒</div><div style="font-weight:600;margin-top:6px;">A sealed time capsule</div>
      <div class="muted" style="margin-top:4px;">Opens ${esc(new Date(m.sealedUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}</div></div></div>`;
  }
  const photos = (m.photos || []).slice(0, 6);
  const photosHTML = photos.length ? `<div class="photos">${photos.map((p) => `<img src="${esc(p)}" loading="lazy" alt="">`).join('')}</div>` : '';
  const tagsHTML = (m.tags || []).length ? `<div class="tags">${m.tags.map((t) => `<span class="tag ${t.confirmed ? 'witnessed' : ''}">${t.confirmed ? '✓ ' : ''}${esc(t.label)}</span>`).join('')}</div>` : '';
  const loc = placeLabel(m);
  const milestone = m.milestone && MILESTONE_ICON[m.milestone] ? `<span class="milestone" title="${esc(m.milestone)}">${MILESTONE_ICON[m.milestone]}</span>` : '';
  return `<div class="moment-row"><div class="datetab">${esc(dateTabLabel(m))}</div>
    <div class="card ${m.adopted ? 'adopted' : ''}" data-moment="${esc(m.id)}">
      ${milestone || m.adopted ? `<div class="m-meta">${milestone}${m.adopted ? '<span class="tag" style="background:rgba(27,75,143,0.12);color:var(--blue-deep)">Added from a friend</span>' : ''}</div>` : ''}
      ${m.title ? `<h3 class="m-title">${esc(m.title)}</h3>` : ''}
      ${m.caption ? `<div class="m-caption">${esc(m.caption)}</div>` : ''}
      ${m.story ? `<div class="m-story">${esc(m.story.length > 280 ? m.story.slice(0, 280) + '…' : m.story)}</div>` : ''}
      ${photosHTML}${loc ? `<div class="m-loc">📍 ${esc(loc)}</div>` : ''}${tagsHTML}
    </div></div>`;
}

function timelineHTML(moments, owner) {
  if (!moments.length) return '';
  const sorted = [...moments].sort(api.byChrono);
  const byYear = new Map();
  for (const m of sorted) { if (!byYear.has(m.year)) byYear.set(m.year, []); byYear.get(m.year).push(m); }
  const business = owner?.accountType === 'business';
  let lastDecade = null;
  let html = '<div class="timeline">';
  for (const [year, list] of byYear) {
    const decade = Math.floor(year / 10) * 10;
    const isDecade = decade !== lastDecade;
    lastDecade = decade;
    let label = String(year);
    if (owner?.birthYear) {
      const n = year - owner.birthYear;
      label = business ? `Year ${n + 1} · ${year}` : n >= 0 ? `Age ${n} · ${year}` : String(year);
    }
    html += `<div class="era ${isDecade ? 'decade' : ''}">${isDecade ? `<div class="ghost">${decade}s</div>` : ''}<span class="plate">${esc(label)}</span></div>`;
    for (const m of list) html += momentCardHTML(m);
  }
  return html + '</div>';
}

function attachMomentClicks() {
  root().querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
}

// ---- My Journey ------------------------------------------------------------
async function viewJourney() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('journey', unread);
  setLoading();
  const [moments, circleCount] = await Promise.all([api.getMomentsOf(state.user.id), api.fetchCircleCountOf(state.user.id)]);
  const sealed = state.user.memorialState === 'sealed';
  root().innerHTML = `
    <div class="wrap">
      ${monumentHTML(state.user, moments, circleCount, true)}
      ${!sealed ? `<div class="btn-row"><a class="btn" href="#/add">+ Add a moment</a><a class="btn ghost" href="#/profile/edit">Edit profile</a></div>` : ''}
      <div class="section-title">Your Journey</div>
      ${moments.length ? timelineHTML(moments, state.user)
        : `<div class="empty"><div class="big">🌱</div>Your journey is empty.<br>Add the first moment of your life's record.
           <div style="margin-top:18px;"><a class="btn" href="#/add">+ Add a moment</a></div></div>`}
      ${appFooter()}
    </div>
    ${!sealed ? '<button class="fab" onclick="location.hash=\'#/add\'" title="Add a moment">+</button>' : ''}`;
  attachMomentClicks();
}

// ---- Person (someone else's journey) ---------------------------------------
async function viewPerson(handle) {
  renderTopbar('world');
  setLoading();
  const u = await api.fetchUserByHandle(handle);
  if (!u) { root().innerHTML = `<div class="wrap"><a class="back" href="#/world">← World</a><div class="empty">No one here by @${esc(handle)}.</div></div>`; return; }
  if (u.id === state.user.id) { nav('#/journey'); return; }
  if (state.blocked.has(u.id)) {
    root().innerHTML = `<div class="wrap"><a class="back" href="#/world">← World</a>
      <div class="empty"><div class="big">🚫</div>You've blocked this person.<br>
      <button class="btn ghost sm" id="unblock" style="margin-top:14px;">Unblock</button></div></div>`;
    $('#unblock').onclick = async () => { await api.unblockUser(state.user.id, u.id); await loadBlocked(); viewPerson(handle); };
    return;
  }
  api.recordProfileView(state.user.id, u.id);
  const [moments, circleCount, circlePairs] = await Promise.all([api.getMomentsOf(u.id), api.fetchCircleCountOf(u.id), api.fetchCircleOf(state.user.id)]);
  const inCircle = circlePairs.some((p) => (p.a === state.user.id && p.b === u.id) || (p.b === state.user.id && p.a === u.id));
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/world">← World</a>
      ${monumentHTML(u, moments, circleCount, false)}
      <div class="btn-row">
        <button class="btn ${inCircle ? 'ghost' : ''}" id="circle-btn">${inCircle ? 'In your Circle ✓' : '+ Add to Circle'}</button>
        <button class="btn ghost sm" id="report-btn">⚑ Report</button>
        <button class="btn danger sm" id="block-btn">Block</button>
      </div>
      <div class="section-title">${esc(u.name?.split(' ')[0] || 'Their')}'s Journey</div>
      ${moments.length ? timelineHTML(moments, u) : '<div class="empty">No moments yet.</div>'}
      ${appFooter()}
    </div>`;
  attachMomentClicks();
  $('#circle-btn').onclick = async () => {
    const btn = $('#circle-btn'); btn.disabled = true;
    try { inCircle ? await api.removeFromCircle(state.user.id, u.id) : await api.addToCircle(state.user, u.id); viewPerson(handle); }
    catch (e) { btn.disabled = false; alert(e.message); }
  };
  $('#report-btn').onclick = () => openReport({ reportedUserId: u.id, label: `@${u.handle}` });
  $('#block-btn').onclick = async () => {
    if (!confirm(`Block @${u.handle}? You won't see each other, and they can't contact you.`)) return;
    try { await api.blockUser(state.user, u.id); await loadBlocked(); nav('#/world'); } catch (e) { alert(e.message); }
  };
}

// ---- World -----------------------------------------------------------------
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
      ${appFooter()}
    </div>`;
  const trending = (await api.getTrendingProfiles().catch(() => [])).filter((t) => !state.blocked.has(t.id));
  if (trending.length) {
    $('#trending-wrap').innerHTML = `<div class="eyebrow" style="font-size:1.3rem;">🔥 Trending now</div>
      <div class="trending">${trending.map((t) => `<div class="t-card" data-handle="${esc(t.handle)}">
        <div class="pfp">${t.avatarUri ? `<img src="${esc(t.avatarUri)}" alt="">` : esc(initials(t.name))}</div>
        <div class="nm">${esc(t.name?.split(' ')[0] || t.handle)}</div><div class="vc">${t.viewCount} views</div></div>`).join('')}</div>`;
    $('#trending-wrap').querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  }
  const doSearch = async (q) => {
    $('#results').innerHTML = '<div class="spinner"></div>';
    const people = (await api.searchOthers(state.user.id, q)).filter((u) => !state.blocked.has(u.id));
    $('#results').innerHTML = people.length
      ? `<div class="section-title">${q ? 'Results' : 'Recently joined'}</div>` + people.map(personRowHTML).join('')
      : '<div class="empty">No one found. Try another name.</div>';
    $('#results').querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  };
  let t;
  $('#search').oninput = (e) => { clearTimeout(t); t = setTimeout(() => doSearch(e.target.value), 260); };
  doSearch('');
}

function personRowHTML(u) {
  return `<div class="person" data-handle="${esc(u.handle)}">
    <div class="pfp">${u.avatarUri ? `<img src="${esc(u.avatarUri)}" alt="">` : esc(initials(u.name))}</div>
    <div class="who"><div class="nm">${esc(u.name)}${u.accountType === 'business' ? ' <span class="chip" style="margin:0">Business</span>' : ''}</div>
      <div class="hd">@${esc(u.handle)}${u.hometown ? ' · ' + esc(u.hometown) : ''}</div></div>
    <div style="color:var(--blue);font-size:1.4rem;">›</div></div>`;
}

// ---- Circle ----------------------------------------------------------------
async function viewCircle() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('circle', unread);
  setLoading();
  const pairs = await api.fetchCircleOf(state.user.id);
  const ids = [...new Set(pairs.map((p) => (p.a === state.user.id ? p.b : p.a)))].filter((id) => !state.blocked.has(id));
  const people = [];
  for (const id of ids) { const u = await api.fetchUserById(id); if (u) people.push(u); }
  root().innerHTML = `
    <div class="wrap">
      <div class="section-title">Your Circle</div>
      <p class="muted">The people whose lives are woven with yours.</p>
      ${people.length ? people.map(personRowHTML).join('')
        : `<div class="empty"><div class="big">🤝</div>Your Circle is empty.<br>Find people in the <a href="#/world">World</a>.</div>`}
      ${appFooter()}
    </div>`;
  root().querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
}

// ---- Notifications ---------------------------------------------------------
async function viewNotifications() {
  renderTopbar('notifications');
  setLoading();
  const notes = await api.fetchNotificationsOf(state.user.id);
  const line = (n) => {
    const who = n.fromName ? esc(n.fromName) : 'Someone';
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
      ${notes.length ? notes.map((n) => `<div class="notif ${n.read ? '' : 'unread'}" ${n.memoryId ? `data-moment="${esc(n.memoryId)}"` : n.fromHandle ? `data-handle="${esc(n.fromHandle)}"` : ''} style="cursor:${n.memoryId || n.fromHandle ? 'pointer' : 'default'}">
          <div>${line(n)}</div><div class="muted" style="font-size:0.8rem;margin-top:3px;">${timeAgo(n.createdAt)}</div></div>`).join('')
        : '<div class="empty"><div class="big">🔔</div>No notifications yet.</div>'}
      ${appFooter()}
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
  const frozen = owner?.memorialState === 'sealed';
  renderTopbar(isOwner ? 'journey' : 'world');
  const [comments, contributions] = await Promise.all([api.getComments(id), api.getContributions(id)]);
  const loc = placeLabel(m);
  const photosHTML = (m.photos || []).length ? `<div class="gallery-full">${m.photos.map((p) => `<img src="${esc(p)}" loading="lazy" alt="">`).join('')}</div>` : '';
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="${isOwner ? '#/journey' : `#/u/${esc(owner?.handle || '')}`}">← Back</a>
      <div class="datetab" style="font-size:1.4rem">${esc(fullDate(m))}</div>
      <div class="panel" style="border-top-left-radius:0;">
        ${owner ? `<div class="muted" style="margin-bottom:8px;">A moment from <a href="#/u/${esc(owner.handle)}">${esc(owner.name)}</a>${m.milestone && MILESTONE_ICON[m.milestone] ? ' · ' + MILESTONE_ICON[m.milestone] : ''}</div>` : ''}
        ${m.title ? `<h1 style="color:var(--blue);margin:0 0 6px;">${esc(m.title)}</h1>` : ''}
        ${m.caption ? `<div style="font-size:1.12rem;color:var(--muted);">${esc(m.caption)}</div>` : ''}
        ${photosHTML}
        ${m.story ? `<p style="white-space:pre-wrap;margin-top:14px;font-size:1.08rem;">${esc(m.story)}</p>` : ''}
        ${m.audioUrl ? `<audio controls src="${esc(m.audioUrl)}" style="width:100%;margin-top:12px;"></audio>` : ''}
        ${loc ? `<div class="m-loc" style="color:var(--muted);margin-top:12px;">📍 ${m.placeLat ? `<a href="https://maps.google.com/?q=${m.placeLat},${m.placeLng}" target="_blank" rel="noopener">${esc(loc)}</a>` : esc(loc)}</div>` : ''}
        ${(m.tags || []).length ? `<div class="tags" style="margin-top:14px;">${m.tags.map((t) => `<span class="tag witnessed" style="background:${t.confirmed ? 'var(--gold)' : 'rgba(27,75,143,0.1)'};color:var(--blue-deep)">${t.confirmed ? '✓ ' : ''}${esc(t.label)}</span>`).join('')}</div>` : ''}
        <div class="btn-row" style="justify-content:flex-start;margin-top:18px;">
          ${isOwner && !frozen ? `<a class="btn ghost sm" href="#/edit/${esc(m.id)}">Edit</a><button class="btn danger sm" id="del-moment">Delete</button>` : ''}
          ${!isOwner ? `<button class="btn ghost sm" id="report-moment">⚑ Report</button>` : ''}
        </div>
      </div>
      ${contributions.length ? `<div class="section-title">Their side of the story</div>
        ${contributions.map((c) => `<div class="contribution">
          <div class="who" style="font-weight:600;color:var(--blue)">${esc(c.name)} <span class="muted" style="font-weight:400">@${esc(c.handle)}</span></div>
          ${c.note ? `<p style="margin:6px 0;white-space:pre-wrap;">${esc(c.note)}</p>` : ''}
          ${c.photos?.length ? `<div class="photos">${c.photos.map((p) => `<img src="${esc(p)}" loading="lazy" alt="">`).join('')}</div>` : ''}
          ${c.audioUrl ? `<audio controls src="${esc(c.audioUrl)}" style="width:100%;margin-top:8px;"></audio>` : ''}</div>`).join('')}` : ''}
      <div class="section-title">Comments</div>
      ${frozen ? '<div class="notice">This journey is sealed and kept as they left it. It can be read, but not added to.</div>' : `
        <form id="comment-form" style="display:flex;gap:8px;margin-bottom:16px;"><input name="text" placeholder="Leave a comment…" style="flex:1" required><button class="btn" type="submit">Post</button></form>`}
      <div id="comments">${comments.length ? comments.map((c) => `<div class="comment"><span class="who">${esc(c.name)}</span>${c.pinned ? ' 📌' : ''}<span class="when">${timeAgo(c.createdAt)}</span><div>${esc(c.text)}</div></div>`).join('') : '<div class="muted">No comments yet.</div>'}</div>
      ${appFooter()}
    </div>`;
  if (isOwner && !frozen) {
    const del = $('#del-moment');
    if (del) del.onclick = async () => { if (!confirm('Delete this moment? This cannot be undone.')) return; await api.deleteMemory(m.id); nav('#/journey'); };
  }
  const rep = $('#report-moment');
  if (rep) rep.onclick = () => openReport({ momentId: m.id, label: `“${m.title || 'this moment'}”` });
  const cf = $('#comment-form');
  if (cf) cf.onsubmit = async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('text');
    e.target.querySelector('button').disabled = true;
    try { await api.addComment(state.user, id, text); viewMoment(id); } catch (err) { alert(err.message); e.target.querySelector('button').disabled = false; }
  };
}

// ---- Add / edit a moment ---------------------------------------------------
async function viewMomentForm(existingId) {
  renderTopbar('journey');
  setLoading();
  let m = null;
  if (existingId) {
    m = await api.getMomentById(existingId);
    if (!m || m.ownerId !== state.user.id) { root().innerHTML = '<div class="wrap"><div class="empty">You can only edit your own moments.</div></div>'; return; }
  }
  const pendingFiles = [];
  let keptPhotos = m ? [...(m.photos || [])] : [];
  const thisYear = new Date().getFullYear();
  const curState = m?.placeRegion || '';
  const curCity = m?.placeCity || '';
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="${existingId ? `#/moment/${existingId}` : '#/journey'}">← Cancel</a>
      <div class="section-title">${existingId ? 'Edit moment' : 'Add a moment'}</div>
      <div id="form-err"></div>
      <form id="m-form" class="panel">
        <div class="row">
          <div class="field"><label>Year *</label><input name="year" type="number" min="1900" max="${thisYear}" value="${m ? m.year : thisYear}" required></div>
          <div class="field"><label>Month</label><select name="month">${['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => `<option value="${v}" ${m && String(m.month || '') === String(v) ? 'selected' : ''}>${v ? MONTHS[v] : '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Day</label><input name="day" type="number" min="1" max="31" value="${m && m.day ? m.day : ''}"></div>
        </div>
        <div class="field"><label>Title</label><input name="title" value="${m ? esc(m.title) : ''}" placeholder="e.g. Summer at the lake house"></div>
        <div class="field"><label>Caption</label><input name="caption" value="${m ? esc(m.caption) : ''}" placeholder="A short line"></div>
        <div class="field"><label>Story</label><textarea name="story" placeholder="Tell it the way you'd tell it…">${m ? esc(m.story) : ''}</textarea></div>
        <div class="field"><label>Where did it happen?</label>
          <div class="row">
            <input name="city" value="${esc(curCity)}" placeholder="City">
            <select name="stateSel">
              <option value="">State…</option>
              ${US_STATES.map((s) => `<option value="${esc(s)}" ${curState === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="hint">United States for now — we'll add more countries soon.</div>
        </div>
        <div class="field"><label>Milestone</label><select name="milestone">${MILESTONE_OPTS.map(([v, l]) => `<option value="${v}" ${m && (m.milestone || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>People who were there</label><input name="tags" value="${m ? esc((m.tags || []).map((t) => (t.handle ? '@' + t.handle : t.label)).join(', ')) : ''}" placeholder="Mom, @davidk, the whole crew">
          <div class="hint">Separate with commas. Use @handle to link a real member.</div></div>
        <div class="field"><label>Photos</label><input type="file" id="photo-input" accept="image/*,video/*" multiple><div class="photo-preview" id="preview"></div></div>
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
    const btn = $('#m-form button[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…';
    $('#form-err').innerHTML = '';
    try {
      const tags = (f.get('tags') || '').split(',').map((s) => s.trim()).filter(Boolean).map((label) => ({ label }));
      const city = (f.get('city') || '').trim();
      const st = f.get('stateSel') || '';
      const place = city || st ? { city: city || null, region: st || null, country: city || st ? 'United States' : null, lat: null, lng: null } : null;
      const locationText = [city, st].filter(Boolean).join(', ');
      const payload = {
        year: +f.get('year'), month: f.get('month') ? +f.get('month') : null, day: f.get('day') ? +f.get('day') : null,
        title: f.get('title'), caption: f.get('caption'), story: f.get('story'),
        location: locationText, place, milestone: f.get('milestone') || null,
        photos: [...keptPhotos, ...pendingFiles], tags,
      };
      if (existingId) { await api.updateMemory(state.user, existingId, payload, m.tags); nav(`#/moment/${existingId}`); }
      else { const row = await api.addMemory(state.user, payload); nav(`#/moment/${row.id}`); }
    } catch (err) {
      $('#form-err').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = existingId ? 'Save changes' : 'Add to my Journey';
    }
  };
}

// ---- Edit profile ----------------------------------------------------------
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
            ${u.avatarUri ? `<img src="${esc(u.avatarUri)}" alt="">` : `<div class="ph">${esc(initials(u.name))}</div>`}</div>
          <label class="btn ghost sm" style="cursor:pointer">Change photo<input type="file" id="av-input" accept="image/*" hidden></label>
        </div>
        <div class="field"><label>Name</label><input name="name" value="${esc(u.name || '')}"></div>
        <div class="field"><label>Epitaph <span class="muted">— a line that captures a life</span></label><input name="epitaph" value="${esc(u.epitaph || '')}" placeholder="She never met a stranger."></div>
        <div class="field"><label>Bio</label><textarea name="bio" placeholder="A few words about you.">${esc(u.bio || '')}</textarea></div>
        <div class="row">
          <div class="field"><label>Birth year</label><input name="birthYear" type="number" min="1900" max="${new Date().getFullYear()}" value="${u.birthYear || ''}"></div>
          <div class="field"><label>Month</label><select name="birthMonth">${['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => `<option value="${v}" ${String(u.birthMonth || '') === String(v) ? 'selected' : ''}>${v ? MONTHS[v] : '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Day</label><input name="birthDay" type="number" min="1" max="31" value="${u.birthDay || ''}"></div>
        </div>
        <div class="field"><label>Hometown</label><input name="hometown" value="${esc(u.hometown || '')}" placeholder="Where you're from"></div>
        <div class="field"><label>Favorite color</label><div style="display:flex;gap:8px;flex-wrap:wrap;" id="colors">
          ${FAVORITE_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="width:36px;height:36px;border-radius:50%;border:${favColor === c ? '3px solid var(--ink)' : '2px solid var(--line)'};background:${c}"></button>`).join('')}</div></div>
        <button class="btn block" type="submit">Save profile</button>
      </form>
    </div>`;
  $('#av-input').onchange = (e) => { avatarFile = e.target.files[0]; if (avatarFile) $('#av-ring').innerHTML = `<img src="${URL.createObjectURL(avatarFile)}" alt="">`; };
  $('#colors').querySelectorAll('.swatch').forEach((b) => (b.onclick = () => {
    favColor = b.getAttribute('data-color');
    $('#colors').querySelectorAll('.swatch').forEach((x) => (x.style.border = '2px solid var(--line)'));
    b.style.border = '3px solid var(--ink)'; $('#av-ring').style.background = favColor;
  }));
  $('#pf-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('#pf-form button'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const patch = {
        name: f.get('name'), epitaph: f.get('epitaph'), bio: f.get('bio'),
        birthYear: f.get('birthYear') ? +f.get('birthYear') : null,
        birthMonth: f.get('birthMonth') ? +f.get('birthMonth') : null,
        birthDay: f.get('birthDay') ? +f.get('birthDay') : null,
        hometown: f.get('hometown'), favoriteColor: favColor,
      };
      if (avatarFile) patch.avatarFile = avatarFile;
      const applied = await api.updateProfile(u.id, patch);
      Object.assign(state.user, patch); if (applied.avatarUri) state.user.avatarUri = applied.avatarUri;
      nav('#/profile');
    } catch (err) { $('#pf-err').innerHTML = `<div class="error">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = 'Save profile'; }
  };
}

// ---- My profile ------------------------------------------------------------
async function viewMyProfile() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('profile', unread);
  setLoading();
  const [moments, circleCount] = await Promise.all([api.getMomentsOf(state.user.id), api.fetchCircleCountOf(state.user.id)]);
  root().innerHTML = `
    <div class="wrap">
      ${monumentHTML(state.user, moments, circleCount, true)}
      <div class="btn-row">
        <a class="btn" href="#/journey">View my Journey</a>
        <a class="btn ghost" href="#/profile/edit">Edit profile</a>
        <a class="btn ghost" href="#/settings">Settings</a>
      </div>
      ${appFooter()}
    </div>`;
}

// ---- Settings --------------------------------------------------------------
async function viewSettings() {
  renderTopbar('settings');
  const u = state.user;
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Settings</div>
      <div id="set-msg"></div>

      <div class="section-title" style="font-size:1.15rem;">Privacy</div>
      <div class="panel">
        <div class="field"><label>Who can tag you in moments?</label>
          <select id="tagperm">
            <option value="anyone" ${u.tagPermission === 'anyone' ? 'selected' : ''}>Anyone</option>
            <option value="circle" ${u.tagPermission === 'circle' ? 'selected' : ''}>Only my Circle</option>
            <option value="nobody" ${u.tagPermission === 'nobody' ? 'selected' : ''}>No one</option>
          </select></div>
      </div>

      <div class="section-title" style="font-size:1.15rem;">Your Vault</div>
      <div class="panel">
        <p class="muted" style="margin-top:0;">Your life is yours. Download a complete copy any time — no hostage-taking.</p>
        <div class="btn-row" style="justify-content:flex-start;">
          <button class="btn ghost sm" id="dl-html">Download as a readable page</button>
          <button class="btn ghost sm" id="dl-json">Download as a data file</button>
        </div>
      </div>

      <div class="section-title" style="font-size:1.15rem;">Password</div>
      <form class="panel" id="pw-form">
        <div class="field"><label>New password</label>
          <div class="pw-wrap"><input name="password" type="password" minlength="6" autocomplete="new-password" required>
            <button type="button" class="pw-toggle">Show</button></div></div>
        <button class="btn sm" type="submit">Update password</button>
      </form>

      <div class="section-title" style="font-size:1.15rem;">Account</div>
      <div class="settings-list">
        <div class="settings-row"><div class="lbl"><div class="t">Signed in as</div><div class="d">${esc(u.email || u.handle)}</div></div></div>
        <div class="settings-row"><div class="lbl"><div class="t">Log out</div><div class="d">Sign out on this device</div></div><button class="btn ghost sm" id="logout">Log out</button></div>
        <div class="settings-row"><div class="lbl"><div class="t" style="color:var(--danger)">Delete account</div><div class="d">Permanently erase your account and everything in it. Cannot be undone.</div></div><button class="btn danger sm" id="del-account">Delete</button></div>
      </div>

      <div class="app-footer"><a href="../privacy.html" target="_blank">Privacy</a> · <a href="../terms.html" target="_blank">Terms</a> · <a href="../support.html" target="_blank">Support</a></div>
    </div>`;
  wirePasswordToggles();
  $('#tagperm').onchange = async (e) => {
    try { await api.updateProfile(u.id, { tagPermission: e.target.value }); state.user.tagPermission = e.target.value; $('#set-msg').innerHTML = '<div class="success">Privacy updated.</div>'; }
    catch (err) { $('#set-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; }
  };
  $('#dl-html').onclick = () => downloadJourney('html');
  $('#dl-json').onclick = () => downloadJourney('json');
  $('#pw-form').onsubmit = async (e) => {
    e.preventDefault();
    const pw = new FormData(e.target).get('password');
    const btn = $('#pw-form button'); btn.disabled = true; btn.textContent = 'Updating…';
    try { await api.updatePassword(pw); $('#set-msg').innerHTML = '<div class="success">Password updated.</div>'; e.target.reset(); }
    catch (err) { $('#set-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; }
    btn.disabled = false; btn.textContent = 'Update password';
  };
  $('#logout').onclick = async () => { await api.logOut(); state.user = null; state.blocked = new Set(); nav('#/login'); route(); };
  $('#del-account').onclick = async () => {
    if (!confirm('Permanently delete your account and everything in it? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? There is no way to recover your journey after this.')) return;
    try { await api.deleteAccount(); state.user = null; nav('#/login'); route(); } catch (err) { $('#set-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; }
  };
}

// ---- Journey export --------------------------------------------------------
function downloadBlob(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadJourney(format) {
  const u = state.user;
  const moments = (await api.getMomentsOf(u.id)).sort(api.byChrono);
  if (format === 'json') {
    const data = { format: 'eternity-vault-archive-v1', exported_at: new Date().toISOString(), profile: u, moments };
    downloadBlob(`${u.handle || 'journey'}-eternity-vault.json`, 'application/json', JSON.stringify(data, null, 2));
    return;
  }
  const byYear = new Map();
  for (const m of moments) { if (!byYear.has(m.year)) byYear.set(m.year, []); byYear.get(m.year).push(m); }
  let body = '';
  for (const [year, list] of byYear) {
    const age = u.birthYear ? ` <span style="color:#6b6656">(age ${year - u.birthYear})</span>` : '';
    body += `<h2 style="color:#1B4B8F;border-bottom:2px solid #FFC93C;padding-bottom:4px;">${year}${age}</h2>`;
    for (const m of list) {
      const loc = placeLabel(m);
      body += `<div style="margin:0 0 22px;padding:14px 16px;border:1px solid #eadfbf;border-radius:10px;">
        <div style="font-family:Caveat,cursive;color:#1B4B8F;font-size:20px;">${esc(fullDate(m))}</div>
        ${m.title ? `<h3 style="margin:4px 0;color:#21201c;">${esc(m.title)}</h3>` : ''}
        ${m.caption ? `<div style="color:#555;">${esc(m.caption)}</div>` : ''}
        ${m.story ? `<p style="white-space:pre-wrap;">${esc(m.story)}</p>` : ''}
        ${loc ? `<div style="color:#6b6656;font-size:14px;">📍 ${esc(loc)}</div>` : ''}
        ${(m.tags || []).length ? `<div style="color:#6b6656;font-size:14px;">With: ${m.tags.map((t) => esc(t.label)).join(', ')}</div>` : ''}
        ${(m.photos || []).map((p) => `<img src="${esc(p)}" style="max-width:100%;border-radius:8px;margin-top:8px;">`).join('')}
      </div>`;
    }
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(u.name)} — Eternity Vault</title>
    <link href="https://fonts.googleapis.com/css2?family=Lora&family=Caveat&display=swap" rel="stylesheet">
    <style>body{font-family:Lora,Georgia,serif;max-width:720px;margin:0 auto;padding:40px 20px;color:#21201c;background:#FDF8EA;}h1{color:#1B4B8F;}</style></head>
    <body><h1>${esc(u.name)}</h1><div style="color:#6b6656;">@${esc(u.handle)}${u.epitaph ? ` — <em>“${esc(u.epitaph)}”</em>` : ''}</div>
    ${u.birthYear ? `<div style="color:#6b6656;">${u.accountType === 'business' ? 'Founded' : 'Born'} ${u.birthYear}${u.hometown ? ' · ' + esc(u.hometown) : ''}</div>` : ''}
    <p style="color:#6b6656;font-size:13px;">Exported from Eternity Vault on ${new Date().toLocaleDateString()}. Photos are linked and need a connection to load.</p>
    <hr style="border:none;border-top:1px solid #eadfbf;margin:20px 0;">${body}</body></html>`;
  downloadBlob(`${u.handle || 'journey'}-eternity-vault.html`, 'text/html', html);
}

// ---- Report modal ----------------------------------------------------------
function openReport({ reportedUserId = null, momentId = null, commentId = null, label = 'this' }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <h2>Report ${esc(label)}</h2>
      <div id="rep-msg"></div>
      <form id="rep-form">
        <div class="field"><label>Reason</label>
          <select name="reason" required>
            <option value="">Choose a reason…</option>
            <option>Harassment or bullying</option>
            <option>Hate or violence</option>
            <option>Sexual or inappropriate content</option>
            <option>Spam or scam</option>
            <option>Impersonation</option>
            <option>Other</option>
          </select></div>
        <div class="field"><label>Details (optional)</label><textarea name="details" placeholder="Anything that helps us understand."></textarea></div>
        <div class="btn-row" style="justify-content:flex-end;">
          <button type="button" class="btn ghost sm" id="rep-cancel">Cancel</button>
          <button type="submit" class="btn sm">Send report</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.onclick = (e) => { if (e.target === back) close(); };
  $('#rep-cancel', back).onclick = close;
  $('#rep-form', back).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('#rep-form button[type=submit]', back); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await api.reportContent(state.user, { reportedUserId, momentId, commentId, reason: f.get('reason'), details: f.get('details') });
      $('#rep-msg', back).innerHTML = '<div class="success">Thank you — our team will review this.</div>';
      setTimeout(close, 1400);
    } catch (err) { $('#rep-msg', back).innerHTML = `<div class="error">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = 'Send report'; }
  };
}

// ---- Router ----------------------------------------------------------------
async function route() {
  const hash = location.hash || '#/journey';
  const parts = hash.replace(/^#\//, '').split('/');
  const head = parts[0] || 'journey';
  const publicRoutes = ['login', 'forgot', 'reset'];

  if (!state.user) {
    if (head === 'forgot') { viewForgot(); return; }
    if (head === 'reset') { viewReset(); return; }
    viewAuth();
    return;
  }
  try {
    switch (head) {
      case 'login': nav('#/journey'); break;
      case 'forgot': case 'reset': nav('#/journey'); break;
      case 'journey': await viewJourney(); break;
      case 'world': await viewWorld(); break;
      case 'circle': await viewCircle(); break;
      case 'notifications': await viewNotifications(); break;
      case 'settings': await viewSettings(); break;
      case 'add': await viewMomentForm(null); break;
      case 'edit': await viewMomentForm(parts[1]); break;
      case 'moment': await viewMoment(parts[1]); break;
      case 'u': await viewPerson(parts[1]); break;
      case 'profile': parts[1] === 'edit' ? await viewProfileEdit() : await viewMyProfile(); break;
      default: await viewJourney();
    }
  } catch (err) {
    console.error(err);
    root().innerHTML = `<div class="wrap"><div class="error">Something went wrong loading this page.</div><button class="btn ghost" onclick="location.reload()">Reload</button></div>`;
  }
  window.scrollTo(0, 0);
}

async function loadBlocked() {
  if (!state.user) return;
  try { state.blocked = await api.fetchBlockedIds(state.user.id); } catch { state.blocked = new Set(); }
}

// ---- Boot ------------------------------------------------------------------
async function boot() {
  setLoading();
  let recovery = false;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { recovery = true; nav('#/reset'); route(); }
    if (event === 'SIGNED_OUT' && state.user) { state.user = null; state.blocked = new Set(); route(); }
  });
  try {
    let u = await api.getSessionUser();
    if (!u) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) u = await api.ensureProfileRow();
    }
    state.user = u;
    if (u) await loadBlocked();
  } catch (e) { console.warn('Boot failed', e); }
  window.addEventListener('hashchange', route);
  if (!recovery) route();
}

boot();
