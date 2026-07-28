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

// Journey views — same definition as the app (components/journey.js) so "solo"
// never drifts. Solo = your own, nobody else involved (no tags, not adopted).
const JOURNEY_VIEWS = [{ key: 'all', label: 'All Moments' }, { key: 'solo', label: 'Solo Moments' }, { key: 'companions', label: 'With Companions' }];
const filterByView = (list, view) =>
  view === 'solo' ? list.filter((m) => !m.adopted && !m.tags?.length)
    : view === 'companions' ? list.filter((m) => m.adopted || m.tags?.length)
    : list;

// Journey background themes (flat colors ported from the app's journeyTheme.js;
// the app's generative patterns are a later addition on web).
const BG_THEMES = [
  { key: 'default', label: 'Default', color: '#F7F9FC' }, { key: 'dawn', label: 'Dawn', color: '#FFF3D6' },
  { key: 'night', label: 'Night Sky', color: '#141B30' }, { key: 'linen', label: 'Linen', color: '#FBF6EC' },
  { key: 'hills', label: 'Hills', color: '#EAF1FB' }, { key: 'tide', label: 'Tide', color: '#E7F1F6' },
  { key: 'sprig', label: 'Sprig', color: '#EFF3E9' }, { key: 'sunset', label: 'Sunset', color: '#FFD9A0' },
  { key: 'meadow', label: 'Meadow', color: '#E4F2DC' }, { key: 'ocean', label: 'Ocean', color: '#0E3B57' },
  { key: 'confetti', label: 'Confetti', color: '#FDFBF4' }, { key: 'citrus', label: 'Citrus', color: '#FFE9B8' },
  { key: 'aurora', label: 'Aurora', color: '#101B33' }, { key: 'terracotta', label: 'Terracotta', color: '#F3D9C3' },
  { key: 'wildflowers', label: 'Wildflowers', color: '#F9F5EA' }, { key: 'arcs', label: 'Sun Arcs', color: '#FDF8EF' },
  { key: 'fireflies', label: 'Fireflies', color: '#14251E' },
];
const bgColor = (key) => (BG_THEMES.find((b) => b.key === key) || BG_THEMES[0]).color;
const PHOTO_SHAPES = [{ key: 'rounded', label: 'Rounded', r: '9px' }, { key: 'square', label: 'Square', r: '2px' }, { key: 'circle', label: 'Circle', r: '50%' }];

// Merch catalog — mirrors the app's lib/merch.js. Prices in one place.
const PRODUCTS = [
  { key: 'book', emoji: '📖', name: 'Journey Book', tagline: 'Your whole timeline as a hardcover keepsake.', detail: 'Every year, photo, and story printed and bound — one moment per page.', priceLabel: '$2.49 / page', pricing: { type: 'perPage', perPage: 2.49 }, scopes: ['all', 'decade', 'custom'] },
  { key: 'shirt', emoji: '👕', name: 'Moment Shirt', tagline: 'Wear a favorite moment.', detail: 'A soft tee featuring one moment from your Journey — front or back.', priceLabel: '$29.99', pricing: { type: 'flat', flat: 29.99 }, scopes: ['custom'], momentTiers: [1], placement: true },
  { key: 'blanket', emoji: '🧣', name: 'Memory Blanket', tagline: 'A woven blanket of your memories.', detail: 'A cozy throw — one giant moment, a 4-moment grid, or a 12-moment collage.', priceLabel: '$99.99', pricing: { type: 'flat', flat: 99.99 }, scopes: ['custom'], momentTiers: [1, 4, 12] },
  { key: 'framed', emoji: '🖼️', name: 'Framed Long Photo', tagline: 'A panoramic of your journey, framed.', detail: 'A wide, framed print — up to 6 moments laid end to end.', priceLabel: '$99', pricing: { type: 'flat', flat: 99 }, scopes: ['custom'], maxMoments: 6 },
];
const getProduct = (k) => PRODUCTS.find((p) => p.key === k);
const priceFor = (product, momentCount) => (!product ? 0 : product.pricing.type === 'perPage' ? Math.round(momentCount * product.pricing.perPage * 100) / 100 : product.pricing.flat);
const money = (n) => `$${n.toFixed(2)}`;

// ---- Astro (zodiac + birthstone), avatar rotation, and the profile wheel ---
const ZODIAC = [
  { name: 'Capricorn', glyph: '♑', month: 12, startDay: 22 }, { name: 'Aquarius', glyph: '♒', month: 1, startDay: 20 },
  { name: 'Pisces', glyph: '♓', month: 2, startDay: 19 }, { name: 'Aries', glyph: '♈', month: 3, startDay: 21 },
  { name: 'Taurus', glyph: '♉', month: 4, startDay: 20 }, { name: 'Gemini', glyph: '♊', month: 5, startDay: 21 },
  { name: 'Cancer', glyph: '♋', month: 6, startDay: 21 }, { name: 'Leo', glyph: '♌', month: 7, startDay: 23 },
  { name: 'Virgo', glyph: '♍', month: 8, startDay: 23 }, { name: 'Libra', glyph: '♎', month: 9, startDay: 23 },
  { name: 'Scorpio', glyph: '♏', month: 10, startDay: 23 }, { name: 'Sagittarius', glyph: '♐', month: 11, startDay: 22 },
];
function zodiacSign(month, day) {
  if (!month || !day) return null;
  for (let i = 0; i < ZODIAC.length; i++) {
    const cur = ZODIAC[i], next = ZODIAC[(i + 1) % ZODIAC.length];
    if (month === cur.month && day >= cur.startDay) return { name: cur.name, glyph: cur.glyph };
    if (month === next.month && day < next.startDay) return { name: cur.name, glyph: cur.glyph };
  }
  return null;
}
const BIRTHSTONES = {
  1: { name: 'Garnet', color: '#7B1E3B' }, 2: { name: 'Amethyst', color: '#8A5CC4' }, 3: { name: 'Aquamarine', color: '#7FD4D1' },
  4: { name: 'Diamond', color: '#B9C6D0' }, 5: { name: 'Emerald', color: '#2E9E5B' }, 6: { name: 'Pearl', color: '#D9CBB0' },
  7: { name: 'Ruby', color: '#C21F45' }, 8: { name: 'Peridot', color: '#9BC24A' }, 9: { name: 'Sapphire', color: '#22448C' },
  10: { name: 'Opal', color: '#B39BD8' }, 11: { name: 'Topaz', color: '#E39A28' }, 12: { name: 'Turquoise', color: '#3AB0C4' },
};
const birthstone = (month) => BIRTHSTONES[month] || null;

const ROTATE_OPTIONS = [{ key: 'minute', label: 'Every minute', seconds: 60 }, { key: 'hour', label: 'Every hour', seconds: 3600 }, { key: 'day', label: 'Every day', seconds: 86400 }];
const secondsFor = (key) => (ROTATE_OPTIONS.find((o) => o.key === key)?.seconds ?? 86400);
// Which of the (up to 5) profile photos to show right now — derived from the
// wall clock, so it rotates on the user's chosen timer. Ported from the app.
function activeAvatarUri(u) {
  const photos = (u?.avatarPhotos || []).filter(Boolean);
  if (!photos.length) return u?.avatarUri || null;
  if (photos.length === 1) return photos[0];
  return photos[Math.floor(Date.now() / 1000 / secondsFor(u?.avatarRotate)) % photos.length];
}

const hexBright = (hex) => {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return 200;
  return 0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16);
};
const textOn = (hex) => (hexBright(hex) > 145 ? '#21201c' : '#FDF8EA');

// The 4-quarter profile wheel: Sign · Birthstone · Favorite number · Favorite
// color. Top/right/bottom are user-colourable; the left quarter IS the person's
// favorite color. Personal accounts only (businesses have no zodiac).
function wheelSvg(u) {
  if (u.accountType === 'business') return '';
  const sign = zodiacSign(u.birthMonth, u.birthDay);
  const stone = birthstone(u.birthMonth);
  const wc = u.wheelColors || {};
  const cx = 150, cy = 150, R = 146, rl = 0.56 * R;
  const rad = (d) => (d * Math.PI) / 180;
  const pt = (a) => [cx + R * Math.cos(rad(a)), cy + R * Math.sin(rad(a))];
  const wedge = (a1, a2) => { const [x1, y1] = pt(a1), [x2, y2] = pt(a2); return `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`; };
  const numVal = u.favoriteNumber == null || u.favoriteNumber === '' ? '—' : String(u.favoriteNumber);
  const secs = [
    { path: wedge(225, 315), tx: cx, ty: cy - rl, fill: wc.sign || '#4E6E9E', head: 'Sign', val: sign ? `${sign.glyph} ${sign.name}` : '—' },
    { path: wedge(315, 405), tx: cx + rl, ty: cy, fill: wc.stone || (stone ? stone.color : '#8A8FA6'), head: 'Birthstone', val: stone ? stone.name : '—' },
    { path: wedge(45, 135), tx: cx, ty: cy + rl, fill: wc.number || '#D8B15E', head: 'Favorite number', val: numVal },
    { path: wedge(135, 225), tx: cx - rl, ty: cy, fill: u.favoriteColor || '#B9B2A0', head: '', val: 'Favorite color' },
  ];
  const slices = secs.map((s) => {
    const tc = textOn(s.fill);
    return `<path d="${s.path}" fill="${esc(s.fill)}" stroke="#FDF8EA" stroke-width="2.5"/>
      <text x="${s.tx}" y="${s.ty}" text-anchor="middle" fill="${tc}" font-family="Georgia, serif">
        ${s.head ? `<tspan x="${s.tx}" dy="-7" font-size="11" letter-spacing="1.2" opacity="0.9">${esc(s.head.toUpperCase())}</tspan>` : ''}
        <tspan x="${s.tx}" dy="${s.head ? '19' : '0'}" font-size="18" font-weight="700">${esc(s.val)}</tspan>
      </text>`;
  }).join('');
  return `<svg viewBox="0 0 300 300" class="wheel" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Profile wheel">
    ${slices}
    <circle cx="${cx}" cy="${cy}" r="30" fill="#FDF8EA" stroke="#1B4B8F" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#FFC93C" stroke-width="1.2"/>
  </svg>`;
}

const state = { user: null, blocked: new Set(), spotTimer: null, avatarTimer: null };

// Rotate the monument photo among the person's (up to 5) photos on their timer.
function startAvatarRotation(u) {
  clearInterval(state.avatarTimer);
  if (!(u?.avatarPhotos && u.avatarPhotos.length > 1)) return;
  state.avatarTimer = setInterval(() => {
    const img = document.querySelector('.monument-photo .mp-img');
    if (!img) { clearInterval(state.avatarTimer); return; }
    const next = activeAvatarUri(u);
    if (next && img.getAttribute('src') !== next) img.setAttribute('src', next);
  }, 12000);
}
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

// Refined inline line-icons (no emoji) — one visual language across the app.
const ICONS = {
  journey: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5V5.5Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5V5.5Z"/>',
  world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 2.4 14.7 0 17M12 3.5c-2.4 2.3-2.4 14.7 0 17"/>',
  circle: '<circle cx="8.5" cy="8" r="3"/><path d="M3.5 18.5a5 5 0 0 1 10 0"/><path d="M15.5 6.2a3 3 0 0 1 0 5.6"/><path d="M16.8 13.6a5 5 0 0 1 3 4.9"/>',
  bell: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.5 1.8 5.5 1.8 5.5H4.7s1.8-1 1.8-5.5Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (name, size = 20) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---- Top navigation (bold, centered) --------------------------------------
function renderTopbar(active, unread = 0) {
  const bar = el('topbar');
  if (!state.user) { bar.innerHTML = ''; return; }
  const tab = (hash, ic, label, key) =>
    `<a class="nav-tab ${active === key ? 'active' : ''}" href="${hash}"><span class="ic">${icon(ic)}</span>${label}</a>`;
  const meAvatar = state.user.avatarUri
    ? `<img class="avatar-mini" src="${esc(state.user.avatarUri)}" alt="Me">`
    : icon('user', 22);
  bar.innerHTML = `
    <div class="nav-inner">
      <a class="nav-brand" href="#/journey"><img src="../brand/eternity-vault-mark.svg" alt=""><span>Eternity Vault</span></a>
      <nav class="nav-primary">
        ${tab('#/journey', 'journey', 'Journey', 'journey')}
        ${tab('#/world', 'world', 'World', 'world')}
        ${tab('#/circle', 'circle', 'Circle', 'circle')}
      </nav>
      <div class="nav-actions">
        <a class="nav-icon ${active === 'notifications' ? 'active' : ''}" href="#/notifications" title="Notifications">${icon('bell', 22)}${unread ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}</a>
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
  const photo = activeAvatarUri(u);
  const photoInner = photo ? `<img class="mp-img" src="${esc(photo)}" alt="">` : `<div class="mp-ph">${esc(initials(u.name))}</div>`;
  const wheel = wheelSvg(u);
  return `
    <div class="monument">
      <div class="monument-photo">${photoInner}</div>
      <h1>${esc(u.name || 'Unnamed')}</h1>
      <div class="handle">@${esc(u.handle || '')}</div>
      <div>${business ? '<span class="chip">Business</span>' : ''}${sealed ? '<span class="chip sealed">✦ Kept as they left it</span>' : ''}</div>
      ${u.epitaph ? `<div class="epitaph">“${esc(u.epitaph)}”</div>` : isSelf ? `<div class="epitaph muted"><a href="#/profile/edit">+ add an epitaph</a></div>` : ''}
      ${birthBits.length ? `<div class="birthline">${bornWord} ${esc(birthBits.join(' · '))}</div>` : ''}
      ${u.bio ? `<p style="max-width:480px;margin:14px auto 0;">${esc(u.bio)}</p>` : isSelf ? `<p class="muted" style="margin-top:10px;"><a href="#/profile/edit">+ add a short bio</a></p>` : ''}
      ${u.links && u.links.length ? `<div class="prof-links">${u.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="prof-link">${esc(l.label || l.url)}</a>`).join('')}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="n">${moments.length}</div><div class="l">Moments</div></div>
        <div class="stat"><div class="n">${years}</div><div class="l">Years</div></div>
        <div class="stat"><div class="n">${circleCount}</div><div class="l">Circle</div></div>
      </div>
      ${wheel ? `<div class="wheel-wrap">${wheel}${isSelf ? '<div style="text-align:center;margin-top:8px;"><a href="#/profile/edit" style="font-size:0.85rem;color:var(--muted);">Customize your wheel &amp; photos →</a></div>' : ''}</div>` : ''}
    </div>`;
}

// ---- Timeline --------------------------------------------------------------
const isVideoUrl = (u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || '');
const mediaTag = (url) => (isVideoUrl(url) ? `<video src="${esc(url)}" controls preload="metadata"></video>` : `<img src="${esc(url)}" loading="lazy" alt="">`);

// The iconic central thread: a white ribbon "spine" with blue dots coiling
// around it like a helix — a snake around a sword. One SVG pattern period tiles
// seamlessly down the whole journey, any length. Ported from the app's
// HelixStitch (components/journey.js): near side of each wrap is bigger + bolder,
// far side smaller + fainter, so it reads as wrapping AROUND the thread.
const HELIX_PERIOD = 40, HELIX_DOTS = 8, HELIX_INNER = 11;
function helixSvg() {
  const dots = Array.from({ length: HELIX_DOTS }, (_, i) => {
    const t = (i / HELIX_DOTS) * Math.PI * 2;
    const along = ((i + 0.5) / HELIX_DOTS) * HELIX_PERIOD;
    const across = HELIX_INNER / 2 + Math.sin(t) * (HELIX_INNER / 2 - 1.2);
    const depth = (Math.cos(t) + 1) / 2; // 1 = front of the coil, 0 = behind
    return `<circle cx="${(across + 1.5).toFixed(2)}" cy="${along.toFixed(2)}" r="${(0.9 + depth * 0.9).toFixed(2)}" fill="#1B4B8F" opacity="${(0.28 + depth * 0.55).toFixed(2)}"/>`;
  }).join('');
  return `<svg width="14" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="hx" patternUnits="userSpaceOnUse" width="14" height="${HELIX_PERIOD}">${dots}</pattern></defs>
    <rect x="1.5" width="11" height="100%" rx="3" fill="#FFFDF8" stroke="#E9DFC4" stroke-width="1"/>
    <rect width="14" height="100%" fill="url(#hx)"/></svg>`;
}

// One moment, rendered like a page in a printed memoir. Adaptive: photo moments
// lead with 1–2 big natural-aspect images; text-only moments emphasize the
// words (bigger type, drop-cap). Colour signals solo (soft blue) vs companion
// (soft amber). A moment may be just a title + a voice note — that's fine.
function momentCardHTML(m) {
  const companion = m.adopted || (m.tags && m.tags.length);
  const cls = companion ? 'companion' : 'solo';
  const sealedFuture = m.sealedUntil && new Date(m.sealedUntil) > new Date();
  if (sealedFuture) {
    return `<article class="jmoment ${cls}" data-moment="${esc(m.id)}"><div class="jdate">${esc(dateTabLabel(m))}</div>
      <div class="jsealed"><div class="lock">🔒</div><div class="st">A sealed time capsule</div>
      <div class="muted" style="margin-top:4px;">Opens ${esc(new Date(m.sealedUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}</div></div></article>`;
  }
  const photos = m.photos || [];
  const textOnly = photos.length === 0;
  let media = '';
  if (photos.length === 1) media = `<figure class="jhero">${mediaTag(photos[0])}${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  else if (photos.length === 2) media = `<div class="jhero two"><div class="mat">${mediaTag(photos[0])}</div><div class="mat">${mediaTag(photos[1])}</div></div>`;
  else if (photos.length >= 3) media = `<figure class="jhero">${mediaTag(photos[0])}</figure><div class="jmore">${photos.slice(1, 7).map((p) => `<div class="mat">${mediaTag(p)}</div>`).join('')}</div>`;
  const showCaption = m.caption && photos.length !== 1;
  const story = m.story ? (m.story.length > 460 ? m.story.slice(0, 460).trim() + '…' : m.story) : '';
  const loc = placeLabel(m);
  const milestone = m.milestone && MILESTONE_ICON[m.milestone] ? `<div class="jmilestone">${MILESTONE_ICON[m.milestone]}</div>` : '';
  const tags = m.tags || [];
  const witnessed = tags.some((t) => t.confirmed);
  const companionsHTML = tags.length
    ? `<div class="jcompanions"><span class="lbl">${witnessed ? 'Witnessed by' : 'With'}</span>${tags.map((t) => `<span class="jcomp ${t.confirmed ? 'witnessed' : ''}">${t.confirmed ? '✦ ' : ''}${esc(t.label)}</span>`).join('')}</div>`
    : (m.adopted ? `<div class="jcompanions"><span class="lbl">A shared moment</span></div>` : '');
  return `<article class="jmoment ${cls} ${textOnly ? 'text-only' : ''}" data-moment="${esc(m.id)}">
    ${milestone}
    <div class="jdate">${esc(dateTabLabel(m))}</div>
    ${m.title ? `<h3 class="jtitle">${esc(m.title)}</h3>` : ''}
    ${showCaption ? `<div class="jcaption">${esc(m.caption)}</div>` : ''}
    ${media}
    ${story ? `<p class="jstory ${textOnly ? 'drop' : ''}">${esc(story)}</p>` : ''}
    ${m.audioUrl ? `<div class="jvoice"><audio src="${esc(m.audioUrl)}" controls preload="none"></audio></div>` : ''}
    ${loc ? `<div class="jmeta">📍 ${esc(loc)}</div>` : ''}
    ${companionsHTML}
  </article>`;
}

function timelineHTML(moments, owner) {
  if (!moments.length) return '';
  const sorted = [...moments].sort(api.byChrono);
  const byYear = new Map();
  for (const m of sorted) { if (!byYear.has(m.year)) byYear.set(m.year, []); byYear.get(m.year).push(m); }
  const business = owner?.accountType === 'business';
  let lastDecade = null;
  // The central thread + a mark capping the top, so the journey begins IN the logo.
  let html = '<div class="journey"><div class="spine">' + helixSvg() + '</div>' +
    '<div class="cap"><img src="../brand/eternity-vault-mark.svg" alt=""></div>';
  for (const [year, list] of byYear) {
    const decade = Math.floor(year / 10) * 10;
    const isDecade = decade !== lastDecade;
    lastDecade = decade;
    let age = '';
    if (owner?.birthYear) { const n = year - owner.birthYear; age = business ? `Year ${n + 1}` : n >= 0 ? `Age ${n}` : ''; }
    html += `<div class="jchapter ${isDecade ? 'decade' : ''}" id="yr-${year}" ${isDecade ? `data-decade="${decade}s"` : ''}><div class="yr">${year}</div>${age ? `<span class="age">${esc(age)}</span>` : ''}</div>`;
    for (const m of list) html += momentCardHTML(m);
  }
  return html + '<div class="cap"><img src="../brand/eternity-vault-mark.svg" alt=""></div></div>';
}

function attachMomentClicks() {
  root().querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
}

const viewChipsHTML = (id) =>
  `<div class="viewrow" id="${id}">${JOURNEY_VIEWS.map((v) => `<button class="viewchip ${v.key === 'all' ? 'active' : ''}" data-view="${v.key}">${v.label}</button>`).join('')}</div>`;

// Mount a timeline that re-renders when the All / Solo / With-Companions filter
// changes. Photo shape follows the journey owner's chosen shape.
function mountFilteredTimeline(hostId, chipsId, moments, owner) {
  let view = 'all';
  const shape = (PHOTO_SHAPES.find((s) => s.key === owner?.journeyPhotoShape) || PHOTO_SHAPES[0]).r;
  const render = () => {
    const filtered = filterByView(moments, view);
    const host = el(hostId);
    host.style.setProperty('--photo-radius', shape);
    host.innerHTML = filtered.length ? timelineHTML(filtered, owner)
      : `<div class="empty">${view === 'solo' ? 'No solo moments yet — nothing without a companion tagged.' : view === 'companions' ? 'No moments with companions yet — nothing here has a tag.' : 'No moments yet.'}</div>`;
    attachMomentClicks();
    document.querySelectorAll(`#${chipsId} .viewchip`).forEach((c) => c.classList.toggle('active', c.dataset.view === view));
  };
  document.querySelectorAll(`#${chipsId} .viewchip`).forEach((c) => (c.onclick = () => { view = c.dataset.view; render(); }));
  render();
}

// A summary band across the top of a journey: totals + the places and people.
function journeySummary(moments) {
  const places = [...new Set(moments.map(placeLabel).filter(Boolean))];
  const compMap = new Map();
  for (const m of moments) for (const t of m.tags || []) { const k = t.userId || 'lbl:' + t.label; if (!compMap.has(k)) compMap.set(k, t.label); }
  const companions = [...compMap.values()];
  return `<div class="jsummary">
    <div class="jsum-nums">
      <div class="jn"><span class="v">${moments.length}</span><span class="l">Moments</span></div>
      <div class="jn"><span class="v">${places.length}</span><span class="l">Places</span></div>
      <div class="jn"><span class="v">${companions.length}</span><span class="l">Companions</span></div>
    </div>
    ${places.length ? `<div class="jsum-chips"><span class="cap">Places</span>${places.slice(0, 30).map((p) => `<span class="jchip">📍 ${esc(p)}</span>`).join('')}</div>` : ''}
    ${companions.length ? `<div class="jsum-chips"><span class="cap">Companions</span>${companions.slice(0, 30).map((c) => `<span class="jchip">${esc(c)}</span>`).join('')}</div>` : ''}
  </div>`;
}

// A horizontal timeline scrubber: one bar per year from birth → now, height by
// how many moments happened that year. Click a year to jump to it.
function timelineMapHTML(moments, owner) {
  const years = moments.map((m) => m.year);
  if (!years.length) return '';
  const minY = Math.min(owner?.birthYear || Math.min(...years), ...years);
  const maxY = Math.max(new Date().getFullYear(), ...years);
  const counts = {};
  for (const m of moments) counts[m.year] = (counts[m.year] || 0) + 1;
  const milestoneYears = new Set(moments.filter((m) => m.milestone).map((m) => m.year));
  const maxC = Math.max(...Object.values(counts));
  let bars = '';
  for (let y = minY; y <= maxY; y++) {
    const c = counts[y] || 0;
    const h = c ? Math.round(22 + (c / maxC) * 78) : 6;
    const mile = milestoneYears.has(y);
    bars += `<div class="tmap-bar ${c ? 'has' : ''} ${mile ? 'mile' : ''}" data-year="${y}" title="${y}: ${c} moment${c === 1 ? '' : 's'}${mile ? ' · major moment' : ''}" style="height:${h}%">${mile ? '<i class="mdot"></i>' : ''}</div>`;
  }
  return `<div class="tmap">
    <div class="tmap-head"><span>${owner?.birthYear ? 'Born ' + minY : minY}</span><span class="tmap-total">${moments.length} moments · ${maxY - minY} years</span><span>${maxY}</span></div>
    <div class="tmap-track">${bars}</div>
  </div>`;
}

// A slim decade jump-rail fixed to the right edge (only when 2+ decades).
function decadeRailHTML(moments) {
  const decades = [...new Set(moments.map((m) => Math.floor(m.year / 10) * 10))].sort((a, b) => a - b);
  if (decades.length < 2) return '';
  return `<div class="decade-rail">${decades.map((d) => `<button class="drail" data-decade="${d}">'${String(d).slice(2)}s</button>`).join('')}</div>`;
}

// Wire the map + rail so clicking a year/decade smooth-scrolls to that chapter.
function wireJumpNav(moments) {
  const scrollToYear = (y) => { const el = document.getElementById(`yr-${y}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  root().querySelectorAll('.tmap-bar.has').forEach((b) => (b.onclick = () => scrollToYear(b.getAttribute('data-year'))));
  root().querySelectorAll('.drail').forEach((b) => (b.onclick = () => {
    const d = +b.getAttribute('data-decade');
    const y = moments.map((m) => m.year).filter((yr) => Math.floor(yr / 10) * 10 === d).sort((a, b) => a - b)[0];
    if (y) scrollToYear(y);
  }));
}

// ---- My Journey ------------------------------------------------------------
async function viewJourney() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('journey', unread);
  setLoading();
  const [moments, circleCount] = await Promise.all([api.getMomentsOf(state.user.id), api.fetchCircleCountOf(state.user.id)]);
  const sealed = state.user.memorialState === 'sealed';
  root().innerHTML = `
    <div class="wrap journeywide">
      ${monumentHTML(state.user, moments, circleCount, true)}
      ${moments.length ? journeySummary(moments) : ''}
      ${moments.length ? timelineMapHTML(moments, state.user) : ''}
      ${!sealed ? `<div class="btn-row"><a class="btn" href="#/add">+ Add a moment</a><a class="btn ghost" href="#/profile/edit">Edit profile</a><a class="btn ghost" href="#/profile/customize">Customize</a></div>` : ''}
      <div class="section-title" style="text-align:center;">Your Journey</div>
      ${moments.length ? `${viewChipsHTML('jv-chips')}${decadeRailHTML(moments)}<div id="jv-host"></div>`
        : `<div class="empty"><div class="big">🌱</div>Your journey is empty.<br>Add the first moment of your life's record.
           <div style="margin-top:18px;"><a class="btn" href="#/add">+ Add a moment</a></div></div>`}
      ${appFooter()}
    </div>
    ${!sealed ? '<button class="fab" onclick="location.hash=\'#/add\'" title="Add a moment">+</button>' : ''}`;
  if (moments.length) { mountFilteredTimeline('jv-host', 'jv-chips', moments, state.user); wireJumpNav(moments); }
  startAvatarRotation(state.user);
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
    <div class="wrap journeywide">
      <a class="back" href="#/world">← World</a>
      ${monumentHTML(u, moments, circleCount, false)}
      ${moments.length ? journeySummary(moments) : ''}
      ${moments.length ? timelineMapHTML(moments, u) : ''}
      <div class="btn-row">
        <button class="btn ${inCircle ? 'ghost' : ''}" id="circle-btn">${inCircle ? 'In your Circle ✓' : '+ Add to Circle'}</button>
        <button class="btn ghost sm" id="share-btn">📷 Send / Request</button>
        <button class="btn ghost sm" id="report-btn">⚑ Report</button>
        <button class="btn danger sm" id="block-btn">Block</button>
      </div>
      <div class="section-title" style="text-align:center;">${esc(u.name?.split(' ')[0] || 'Their')}'s Journey</div>
      ${moments.length ? `${viewChipsHTML('pv-chips')}${decadeRailHTML(moments)}<div id="pv-host"></div>` : '<div class="empty">No moments yet.</div>'}
      ${appFooter()}
    </div>`;
  if (moments.length) { mountFilteredTimeline('pv-host', 'pv-chips', moments, u); wireJumpNav(moments); }
  startAvatarRotation(u);
  $('#circle-btn').onclick = async () => {
    const btn = $('#circle-btn'); btn.disabled = true;
    try { inCircle ? await api.removeFromCircle(state.user.id, u.id) : await api.addToCircle(state.user, u.id); viewPerson(handle); }
    catch (e) { btn.disabled = false; alert(e.message); }
  };
  $('#share-btn').onclick = () => openShareModal(u, 'send');
  $('#report-btn').onclick = () => openReport({ reportedUserId: u.id, label: `@${u.handle}` });
  $('#block-btn').onclick = async () => {
    if (!confirm(`Block @${u.handle}? You won't see each other, and they can't contact you.`)) return;
    try { await api.blockUser(state.user, u.id); await loadBlocked(); nav('#/world'); } catch (e) { alert(e.message); }
  };
}

// A rotating spotlight on one member's journey (World page).
function renderSpotlight(s) {
  const w = $('#spotlight-wrap');
  if (!w) return;
  if (!s) { w.innerHTML = ''; return; }
  w.innerHTML = `<div class="spotlight" data-handle="${esc(s.handle)}">
    <div class="spot-label">✦ Spotlight</div>
    <div class="spot-body">
      <div class="spot-pfp">${s.avatarUri ? `<img src="${esc(s.avatarUri)}" alt="">` : esc(initials(s.name))}</div>
      <div class="spot-info">
        <div class="spot-name">${esc(s.name)}</div>
        <div class="spot-handle">@${esc(s.handle)}</div>
        <div class="spot-sub">A life worth a look — a new one every little while.</div>
      </div>
      ${s.photoUrl ? `<div class="spot-photo"><img src="${esc(s.photoUrl)}" alt=""></div>` : ''}
    </div></div>`;
  w.querySelector('.spotlight').onclick = () => nav(`#/u/${s.handle}`);
}

// ---- World -----------------------------------------------------------------
async function viewWorld() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('world', unread);
  root().innerHTML = `
    <div class="wrap">
      <div class="eyebrow">Eternity Vault</div>
      <div class="section-title" style="margin-top:2px;">World</div>
      <div id="spotlight-wrap"></div>
      <div class="field"><input id="search" placeholder="Search people and businesses by name or @handle"></div>
      <div class="viewrow" id="world-filter" style="max-width:420px;">
        <button class="viewchip active" data-wf="all">All</button>
        <button class="viewchip" data-wf="personal">People</button>
        <button class="viewchip" data-wf="business">Businesses</button>
      </div>
      <div id="trending-wrap"></div>
      <div id="results"></div>
      ${appFooter()}
    </div>`;
  renderSpotlight(await api.getJourneySpotlight(state.blocked).catch(() => null));
  clearInterval(state.spotTimer);
  state.spotTimer = setInterval(async () => {
    if (!location.hash.startsWith('#/world')) { clearInterval(state.spotTimer); return; }
    renderSpotlight(await api.getJourneySpotlight(state.blocked).catch(() => null));
  }, 10 * 60 * 1000);
  const trending = (await api.getTrendingProfiles().catch(() => [])).filter((t) => !state.blocked.has(t.id));
  if (trending.length) {
    $('#trending-wrap').innerHTML = `<div class="eyebrow" style="font-size:1.3rem;">🔥 Trending now</div>
      <div class="trending">${trending.map((t) => `<div class="t-card" data-handle="${esc(t.handle)}">
        <div class="pfp">${t.avatarUri ? `<img src="${esc(t.avatarUri)}" alt="">` : esc(initials(t.name))}</div>
        <div class="nm">${esc(t.name?.split(' ')[0] || t.handle)}</div><div class="vc">${t.viewCount} views</div></div>`).join('')}</div>`;
    $('#trending-wrap').querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  }
  let worldFilter = 'all';
  let lastQuery = '';
  const doSearch = async (q) => {
    lastQuery = q;
    $('#results').innerHTML = '<div class="spinner"></div>';
    let people = (await api.searchOthers(state.user.id, q)).filter((u) => !state.blocked.has(u.id));
    if (worldFilter !== 'all') people = people.filter((u) => (u.accountType || 'personal') === worldFilter);
    $('#results').innerHTML = people.length
      ? `<div class="section-title">${q ? 'Results' : 'Recently joined'}</div>` + people.map(personRowHTML).join('')
      : '<div class="empty">No one found. Try another name.</div>';
    $('#results').querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  };
  root().querySelectorAll('#world-filter .viewchip').forEach((c) => (c.onclick = () => {
    worldFilter = c.getAttribute('data-wf');
    root().querySelectorAll('#world-filter .viewchip').forEach((x) => x.classList.toggle('active', x === c));
    doSearch(lastQuery);
  }));
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
  const nameMap = new Map(people.map((p) => [p.id, p]));
  const feed = ids.length ? await api.getRecentMomentsOf(ids) : [];
  const feedItem = (m) => {
    const owner = nameMap.get(m.ownerId);
    const thumb = m.photos && m.photos[0];
    return `<div class="feed-item" data-moment="${esc(m.id)}">
      <div class="feed-pfp">${owner?.avatarUri ? `<img src="${esc(owner.avatarUri)}" alt="">` : esc(initials(owner?.name || '?'))}</div>
      <div class="feed-body">
        <div class="feed-who"><strong>${esc(owner?.name || 'Someone')}</strong> added <strong>${esc(m.title || 'a moment')}</strong> <span class="muted">· ${esc(fullDate(m))}</span></div>
        ${m.caption ? `<div class="muted" style="font-size:0.92rem;">${esc(m.caption)}</div>` : ''}
      </div>
      ${thumb ? `<div class="feed-thumb"><img src="${esc(thumb)}" loading="lazy" alt=""></div>` : ''}
    </div>`;
  };
  root().innerHTML = `
    <div class="wrap">
      <div class="section-title">Your Circle</div>
      ${feed.length ? `<div class="eyebrow" style="font-size:1.3rem;">Latest from your Circle</div>
        <div class="feed">${feed.map(feedItem).join('')}</div>` : ''}
      <div class="section-title" style="font-size:1.3rem;">Members</div>
      <p class="muted" style="margin-top:0;">The people whose lives are woven with yours.</p>
      ${people.length ? people.map(personRowHTML).join('')
        : `<div class="empty"><div class="big">✦</div>Your Circle is empty.<br>Find people in the <a href="#/world">World</a>.</div>`}
      ${appFooter()}
    </div>`;
  root().querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  root().querySelectorAll('.feed-item').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
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
  const myTag = (m.tags || []).find((t) => t.userId === state.user.id);
  const canConfirm = !!myTag && !myTag.confirmed && !isOwner && !frozen;
  const adoptedCopyId = !isOwner ? await api.getAdoptedCopyId(state.user.id, id).catch(() => null) : null;
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
          ${canConfirm ? `<button class="btn gold sm" id="confirm-tag">✓ I was there</button>` : ''}
          ${!isOwner && !adoptedCopyId ? `<button class="btn ghost sm" id="adopt">+ Add to my Journey</button>` : ''}
          ${!isOwner && adoptedCopyId ? `<a class="btn ghost sm" href="#/moment/${esc(adoptedCopyId)}">In your Journey ✓</a>` : ''}
          ${!isOwner && myTag && !frozen ? `<button class="btn ghost sm" id="add-side">+ Add your side</button>` : ''}
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
      <div id="comments">${comments.length ? comments.map((c) => `<div class="comment"><span class="who">${esc(c.name)}</span>${c.pinned ? ' 📌' : ''}<span class="when">${timeAgo(c.createdAt)}</span><div>${esc(c.text)}</div>${(isOwner || c.userId === state.user.id) ? `<div class="comment-tools">${isOwner ? `<button class="linkbtn" data-pin="${esc(c.id)}" data-pinned="${c.pinned ? 1 : 0}">${c.pinned ? 'Unpin' : 'Pin'}</button>` : ''}<button class="linkbtn" data-delc="${esc(c.id)}">Delete</button></div>` : ''}</div>`).join('') : '<div class="muted">No comments yet.</div>'}</div>
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
  const cb = $('#confirm-tag');
  if (cb) cb.onclick = async () => { cb.disabled = true; try { await api.confirmTag(state.user, id, m.ownerId); viewMoment(id); } catch (e) { alert(e.message); cb.disabled = false; } };
  const ab = $('#adopt');
  if (ab) ab.onclick = async () => { ab.disabled = true; ab.textContent = 'Adding…'; try { await api.adoptMoment(state.user, id); viewMoment(id); } catch (e) { alert(e.message); ab.disabled = false; ab.textContent = '+ Add to my Journey'; } };
  const as = $('#add-side');
  if (as) as.onclick = () => openContribution(id);
  root().querySelectorAll('[data-pin]').forEach((b) => (b.onclick = async () => { await api.togglePinComment(b.getAttribute('data-pin'), b.getAttribute('data-pinned') !== '1'); viewMoment(id); }));
  root().querySelectorAll('[data-delc]').forEach((b) => (b.onclick = async () => { if (!confirm('Delete this comment?')) return; await api.deleteComment(b.getAttribute('data-delc')); viewMoment(id); }));
}

// A witnessed companion adds their own side (note + photos) to a moment.
function openContribution(momentId) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  const files = [];
  const draw = () => {
    back.innerHTML = `<div class="modal">
      <h2>Add your side of the story</h2>
      <div id="ct-msg"></div>
      <form id="ct-form">
        <div class="field"><label>Your telling</label><textarea name="note" placeholder="What do you remember from that day?"></textarea></div>
        <div class="field"><label>Your photos (optional)</label><input type="file" id="ct-files" accept="image/*,video/*" multiple>
          <div class="photo-preview" id="ct-prev">${files.map((f, i) => `<div class="pp"><img src="${URL.createObjectURL(f)}"><button type="button" class="rm" data-i="${i}">×</button></div>`).join('')}</div></div>
        <div class="btn-row" style="justify-content:flex-end;"><button type="button" class="btn ghost sm" id="ct-cancel">Cancel</button><button type="submit" class="btn sm">Add</button></div>
      </form></div>`;
    $('#ct-cancel', back).onclick = () => back.remove();
    $('#ct-files', back).onchange = (e) => { for (const f of e.target.files) files.push(f); draw(); };
    back.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { files.splice(+b.getAttribute('data-i'), 1); draw(); }));
    $('#ct-form', back).onsubmit = async (e) => {
      e.preventDefault();
      const note = new FormData(e.target).get('note');
      const btn = $('#ct-form button[type=submit]', back); btn.disabled = true; btn.textContent = 'Saving…';
      try { await api.addOrUpdateContribution(state.user, momentId, { photos: files, note }); back.remove(); viewMoment(momentId); }
      catch (err) { $('#ct-msg', back).innerHTML = `<div class="error">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = 'Add'; }
    };
  };
  back.onclick = (e) => { if (e.target === back) back.remove(); };
  document.body.appendChild(back);
  draw();
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
  const usedStagedIds = new Set();
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
        <div class="field"><label>Seal as a time capsule <span class="muted">— optional; stays hidden until this date</span></label><input name="sealedUntil" type="date" value="${m && m.sealedUntil ? esc(m.sealedUntil) : ''}"></div>
        <div class="field"><label>People who were there</label><input name="tags" value="${m ? esc((m.tags || []).map((t) => (t.handle ? '@' + t.handle : t.label)).join(', ')) : ''}" placeholder="Mom, @davidk, the whole crew">
          <div class="hint">Separate with commas. Use @handle to link a real member.</div></div>
        <div class="field"><label>Photos</label><input type="file" id="photo-input" accept="image/*,video/*" multiple><div class="photo-preview" id="preview"></div></div>
        <div class="field"><label>Or pull from your shelf</label><div id="shelf-strip" class="shelf-strip"><span class="muted" style="font-size:0.9rem;">Loading…</span></div>
          <div class="hint"><a href="#/import">Manage your import shelf →</a></div></div>
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
  // Load the import shelf so photos can be pulled straight in.
  (async () => {
    const shelf = await loadStaged();
    const strip = $('#shelf-strip');
    if (!strip) return;
    if (!shelf.length) { strip.innerHTML = '<span class="muted" style="font-size:0.9rem;">Nothing on your shelf. <a href="#/import">Upload photos →</a></span>'; return; }
    strip.innerHTML = shelf.map((s) => `<div class="st" data-id="${esc(s.id)}" data-url="${esc(s.url)}"><img src="${esc(s.url)}" alt=""></div>`).join('');
    strip.querySelectorAll('.st').forEach((elm) => (elm.onclick = () => {
      const id = elm.getAttribute('data-id');
      if (usedStagedIds.has(id)) return;
      usedStagedIds.add(id);
      keptPhotos.push(elm.getAttribute('data-url'));
      elm.classList.add('used');
      renderPreview();
    }));
  })();
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
        sealedUntil: f.get('sealedUntil') || null,
        photos: [...keptPhotos, ...pendingFiles], tags,
      };
      if (existingId) {
        await api.updateMemory(state.user, existingId, payload, m.tags);
        if (usedStagedIds.size) await api.consumePendingImports([...usedStagedIds]);
        nav(`#/moment/${existingId}`);
      } else {
        const row = await api.addMemory(state.user, payload);
        if (usedStagedIds.size) await api.consumePendingImports([...usedStagedIds]);
        nav(`#/moment/${row.id}`);
      }
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
  let photos = [...(u.avatarPhotos || [])].filter(Boolean); // existing URLs to keep
  const newFiles = []; // freshly picked File objects
  let favColor = u.favoriteColor || '';
  const business = u.accountType === 'business';
  const stoneDefault = (birthstone(u.birthMonth)?.color) || '#8A8FA6';
  const wc = u.wheelColors || {};
  const total = () => photos.length + newFiles.length;
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Edit your profile</div>
      <div id="pf-err"></div>
      <form id="pf-form" class="panel">
        <div class="field"><label>Profile photos <span class="muted">— up to 5, they rotate on a timer</span></label>
          <div class="photo-preview" id="av-previews"></div>
          <label class="btn ghost sm" style="cursor:pointer;margin-top:8px;">+ Add photo<input type="file" id="av-input" accept="image/*" multiple hidden></label>
        </div>
        <div class="field" id="rotate-field" style="display:${total() > 1 ? 'block' : 'none'}"><label>Rotate photos</label>
          <select id="rotate">${ROTATE_OPTIONS.map((o) => `<option value="${o.key}" ${((u.avatarRotate || 'day') === o.key) ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
        <div class="field"><label>Name</label><input name="name" value="${esc(u.name || '')}"></div>
        <div class="field"><label>Epitaph <span class="muted">— a line that captures a life</span></label><input name="epitaph" value="${esc(u.epitaph || '')}" placeholder="She never met a stranger."></div>
        <div class="field"><label>Bio</label><textarea name="bio" placeholder="A few words about you.">${esc(u.bio || '')}</textarea></div>
        <div class="row">
          <div class="field"><label>Birth year</label><input name="birthYear" type="number" min="1900" max="${new Date().getFullYear()}" value="${u.birthYear || ''}"></div>
          <div class="field"><label>Month</label><select name="birthMonth">${['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => `<option value="${v}" ${String(u.birthMonth || '') === String(v) ? 'selected' : ''}>${v ? MONTHS[v] : '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Day</label><input name="birthDay" type="number" min="1" max="31" value="${u.birthDay || ''}"></div>
        </div>
        <div class="field"><label>Hometown</label><input name="hometown" value="${esc(u.hometown || '')}" placeholder="Where you're from"></div>
        <div class="row">
          <div class="field"><label>Favorite number</label><input name="favoriteNumber" type="number" value="${u.favoriteNumber ?? ''}" placeholder="e.g. 7"></div>
          <div class="field"><label>Favorite color</label><div style="display:flex;gap:8px;flex-wrap:wrap;" id="colors">
            ${FAVORITE_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="width:34px;height:34px;border-radius:50%;border:${favColor === c ? '3px solid var(--ink)' : '2px solid var(--line)'};background:${c}"></button>`).join('')}</div></div>
        </div>
        ${business ? '' : `<div class="field"><label>Your wheel colors <span class="muted">— the Sign, Stone &amp; Number sections</span></label>
          <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;">
            <div style="text-align:center;"><input type="color" id="wc-sign" value="${esc(wc.sign || '#4E6E9E')}" style="width:52px;height:40px;padding:2px;"><div class="muted" style="font-size:0.78rem;">Sign</div></div>
            <div style="text-align:center;"><input type="color" id="wc-stone" value="${esc(wc.stone || stoneDefault)}" style="width:52px;height:40px;padding:2px;"><div class="muted" style="font-size:0.78rem;">Stone</div></div>
            <div style="text-align:center;"><input type="color" id="wc-number" value="${esc(wc.number || '#D8B15E')}" style="width:52px;height:40px;padding:2px;"><div class="muted" style="font-size:0.78rem;">Number</div></div>
          </div>
          <div class="hint">The Favorite-color section always uses your favorite color above.</div></div>`}
        <div class="field"><label>Links <span class="muted">— up to 5</span></label>
          <div id="links-wrap"></div>
          <button type="button" class="btn ghost sm" id="add-link">+ Add link</button></div>
        <button class="btn block" type="submit">Save profile</button>
      </form>
    </div>`;
  let links = [...(u.links || [])].map((l) => ({ label: l.label || '', url: l.url || '' }));
  const renderLinks = () => {
    const w = $('#links-wrap');
    w.innerHTML = links.map((l, i) => `<div class="row" style="margin-bottom:6px;">
      <input placeholder="Label" value="${esc(l.label)}" data-li="${i}" data-k="label">
      <input placeholder="https://…" value="${esc(l.url)}" data-li="${i}" data-k="url">
      <button type="button" class="btn ghost sm" data-rml="${i}" style="flex:0 0 auto;">×</button></div>`).join('');
    w.querySelectorAll('input').forEach((inp) => (inp.oninput = () => { links[+inp.getAttribute('data-li')][inp.getAttribute('data-k')] = inp.value; }));
    w.querySelectorAll('[data-rml]').forEach((b) => (b.onclick = () => { links.splice(+b.getAttribute('data-rml'), 1); renderLinks(); }));
    $('#add-link').style.display = links.length >= 5 ? 'none' : '';
  };
  renderLinks();
  $('#add-link').onclick = () => { if (links.length < 5) { links.push({ label: '', url: '' }); renderLinks(); } };
  const renderPreviews = () => {
    const wrap = $('#av-previews');
    wrap.innerHTML =
      photos.map((url, i) => `<div class="pp"><img src="${esc(url)}" alt=""><button type="button" class="rm" data-kept="${i}">×</button></div>`).join('') +
      newFiles.map((f, i) => `<div class="pp"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="rm" data-new="${i}">×</button></div>`).join('');
    wrap.querySelectorAll('[data-kept]').forEach((b) => (b.onclick = () => { photos.splice(+b.getAttribute('data-kept'), 1); renderPreviews(); }));
    wrap.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => { newFiles.splice(+b.getAttribute('data-new'), 1); renderPreviews(); }));
    const rf = $('#rotate-field'); if (rf) rf.style.display = total() > 1 ? 'block' : 'none';
  };
  renderPreviews();
  $('#av-input').onchange = (e) => { for (const f of e.target.files) { if (total() < 5) newFiles.push(f); } e.target.value = ''; renderPreviews(); };
  $('#colors').querySelectorAll('.swatch').forEach((b) => (b.onclick = () => {
    favColor = b.getAttribute('data-color');
    $('#colors').querySelectorAll('.swatch').forEach((x) => (x.style.border = '2px solid var(--line)'));
    b.style.border = '3px solid var(--ink)';
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
        hometown: f.get('hometown'),
        favoriteColor: favColor,
        favoriteNumber: f.get('favoriteNumber') === '' ? null : +f.get('favoriteNumber'),
        avatarPhotos: [...photos, ...newFiles],
        avatarRotate: ($('#rotate') && $('#rotate').value) || 'day',
        links: links.filter((l) => (l.url || '').trim()).map((l) => ({ label: (l.label || '').trim(), url: l.url.trim() })).slice(0, 5),
      };
      if (!business) patch.wheelColors = { sign: $('#wc-sign').value, stone: $('#wc-stone').value, number: $('#wc-number').value };
      const applied = await api.updateProfile(u.id, patch);
      Object.assign(state.user, patch);
      if (applied.avatarPhotos) { state.user.avatarPhotos = applied.avatarPhotos; state.user.avatarUri = applied.avatarUri; }
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
  const u = state.user;
  const photoCount = moments.filter((m) => m.photos?.length).length;
  const years = moments.map((m) => m.year);
  const span = years.length ? `${Math.min(...years)} – ${Math.max(...years)}` : '—';
  const menuRow = (href, ic, label) => `<a class="menu-row" href="${href}"><span class="mic">${ic}</span><span class="ml">${label}</span><span class="chev">›</span></a>`;
  root().innerHTML = `
    <div class="wrap">
      ${monumentHTML(u, moments, circleCount, true)}
      <div class="stats-card">
        <div class="row3">
          <div class="st"><div class="n">${moments.length}</div><div class="l">Moments</div></div>
          <div class="st"><div class="n">${photoCount}</div><div class="l">Photos</div></div>
          <div class="st"><div class="n">${circleCount}</div><div class="l">Circle</div></div>
        </div>
        <div class="span"><span class="l">Journey spans</span><span class="v">${span}</span></div>
      </div>
      <div class="menu-card">
        ${menuRow('#/journey', '📖', 'View my Journey')}
        ${menuRow('#/import', '📥', 'Import Photos')}
        ${menuRow('#/profile/edit', '✎', 'Edit Profile')}
        ${menuRow('#/profile/qr', '▦', 'My QR Code')}
        ${menuRow('#/profile/customize', '🎨', 'Customize Journey')}
        ${menuRow('#/shared', '📬', 'Shared With Me')}
        ${menuRow('#/merch', '🛍️', 'Order Memories')}
        ${menuRow('#/orders', '📦', 'My Orders')}
        ${menuRow('#/settings', '⚙️', 'Account & Settings')}
      </div>
      ${u.isModerator ? '<p class="muted" style="text-align:center;margin-top:18px;font-size:0.88rem;">Moderation tools are coming to the web soon.</p>' : ''}
      ${appFooter()}
    </div>`;
  startAvatarRotation(state.user);
}

// ---- My QR Code ------------------------------------------------------------
async function viewQR() {
  renderTopbar('profile');
  const u = state.user;
  const url = `${location.origin}/app/#/u/${u.handle}`;
  root().innerHTML = `
    <div class="wrap narrow">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">My QR Code</div>
      <p class="muted">Point a phone camera at this to open your journey.</p>
      <div class="panel qr-box">
        <canvas id="qr" width="240" height="240"></canvas>
        <div class="qr-url">${esc(url)}</div>
        <div class="btn-row"><button class="btn ghost sm" id="copy">Copy link</button></div>
      </div>
    </div>`;
  $('#copy').onclick = () => { try { navigator.clipboard.writeText(url); $('#copy').textContent = 'Copied!'; } catch {} };
  try {
    const QR = await import('https://esm.sh/qrcode@1.5.4');
    await (QR.toCanvas || QR.default.toCanvas)($('#qr'), url, { width: 240, margin: 1, color: { dark: '#1B4B8F', light: '#ffffff' } });
  } catch {
    $('#qr').outerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}" alt="QR code">`;
  }
}

// ---- Customize Journey -----------------------------------------------------
async function viewCustomize() {
  renderTopbar('profile');
  const u = state.user;
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Customize Journey</div>
      <div id="cust-msg"></div>
      <div class="section-title" style="font-size:1.15rem;">Background</div>
      <div class="theme-grid" id="bg-grid">${BG_THEMES.map((b) => `<div class="theme-sw ${u.journeyBg === b.key ? 'sel' : ''}" data-bg="${b.key}"><div class="dot" style="background:${b.color}"></div><div class="tn">${b.label}</div></div>`).join('')}</div>
      <div class="section-title" style="font-size:1.15rem;">Photo shape</div>
      <div class="theme-grid" id="shape-grid">${PHOTO_SHAPES.map((s) => `<div class="theme-sw ${u.journeyPhotoShape === s.key ? 'sel' : ''}" data-shape="${s.key}"><div class="dot" style="background:var(--blue);border-radius:${s.r}"></div><div class="tn">${s.label}</div></div>`).join('')}</div>
      <p class="muted" style="margin-top:18px;font-size:0.88rem;">More journey styling (fonts, patterned backdrops) is coming to the web soon.</p>
    </div>`;
  const wire = (gridId, attr, field) =>
    root().querySelectorAll(`#${gridId} .theme-sw`).forEach((sw) => (sw.onclick = async () => {
      const val = sw.getAttribute(attr);
      root().querySelectorAll(`#${gridId} .theme-sw`).forEach((x) => x.classList.remove('sel'));
      sw.classList.add('sel');
      try { await api.updateProfile(u.id, { [field]: val }); state.user[field] = val; $('#cust-msg').innerHTML = '<div class="success">Saved.</div>'; }
      catch (err) { $('#cust-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; }
    }));
  wire('bg-grid', 'data-bg', 'journeyBg');
  wire('shape-grid', 'data-shape', 'journeyPhotoShape');
}

// ---- Settings --------------------------------------------------------------
async function viewSettings() {
  renderTopbar('settings');
  setLoading();
  const u = state.user;
  // Circle members for the Keeper picker.
  const pairs = await api.fetchCircleOf(u.id);
  const ids = [...new Set(pairs.map((p) => (p.a === u.id ? p.b : p.a)))];
  const members = [];
  for (const id of ids) { const m = await api.fetchUserById(id); if (m) members.push(m); }
  const section = (t) => `<div class="section-title" style="font-size:1.15rem;">${t}</div>`;
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Account &amp; Settings</div>
      <div id="set-msg"></div>

      ${section('Email address')}
      <form class="panel" id="email-form">
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(u.email || '')}" autocomplete="email"></div>
        <button class="btn ghost sm" type="submit">Update email</button>
        <div class="hint">You'll get a confirmation link at the new address.</div>
      </form>

      ${section('Password')}
      <form class="panel" id="pw-form">
        <div class="field"><label>New password</label><div class="pw-wrap"><input name="pw" type="password" minlength="6" autocomplete="new-password"><button type="button" class="pw-toggle">Show</button></div></div>
        <div class="field"><label>Confirm new password</label><div class="pw-wrap"><input name="pw2" type="password" minlength="6" autocomplete="new-password"><button type="button" class="pw-toggle">Show</button></div></div>
        <button class="btn sm" type="submit">Update password</button>
      </form>

      ${section('Shipping details')}
      <form class="panel" id="ship-form">
        <p class="muted" style="margin-top:0;">Where we'll send your printed books, prints, and merch.</p>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(u.phone || '')}" placeholder="(555) 123-4567"></div>
        <div class="field"><label>Street address</label><input name="addressLine1" value="${esc(u.addressLine1 || '')}" placeholder="123 Main St"></div>
        <div class="row">
          <div class="field"><label>City</label><input name="city" value="${esc(u.city || '')}"></div>
          <div class="field"><label>State</label><select name="state"><option value="">—</option>${US_STATES.map((s) => `<option ${u.state === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>ZIP</label><input name="zipCode" value="${esc(u.zipCode || '')}" maxlength="10"></div>
        </div>
        <button class="btn ghost sm" type="submit">Save shipping details</button>
      </form>

      ${section('Privacy')}
      <div class="panel"><label style="font-weight:700;color:var(--blue-deep);display:block;margin-bottom:10px;">Who can tag you in a memory?</label>
        <div id="tagopts">
          ${[['anyone', 'Anyone', 'Any signed-in member can tag you.'], ['circle', 'My Circle', 'Only people in your Circle can tag you.'], ['nobody', 'Nobody', 'No one can tag you in a memory.']]
            .map(([v, l, h]) => `<div class="opt ${((u.tagPermission || 'anyone') === v) ? 'sel' : ''}" data-perm="${v}"><div class="radio"></div><div><div class="ol">${l}</div><div class="oh">${h}</div></div></div>`).join('')}
        </div>
      </div>

      ${section('Your Vault')}
      <div class="panel"><p class="muted" style="margin-top:0;">Take a copy of everything, anytime — a readable document plus a data file. It's yours; we never hold it hostage.</p>
        <div class="btn-row" style="justify-content:flex-start;"><button class="btn ghost sm" id="dl-html">Download as a page</button><button class="btn ghost sm" id="dl-json">Download as a data file</button></div>
      </div>

      ${section('Legacy — your Keeper')}
      <div class="panel"><p class="muted" style="margin-top:0;">Name the one person you trust to tell us when you're gone. They can never edit or add to your Vault — only close it, and share it. Choose from your Circle.</p>
        <div class="field"><select id="keeper">
          <option value="">No Keeper chosen</option>
          ${members.map((m) => `<option value="${m.id}" ${u.keeperId === m.id ? 'selected' : ''}>${esc(m.name)} (@${esc(m.handle)})</option>`).join('')}
        </select></div>
        ${members.length === 0 ? '<div class="hint">Add people to your Circle first, then you can name one as your Keeper.</div>' : ''}
      </div>

      ${section('Legal')}
      <div class="settings-list">
        <a class="settings-row" href="../terms.html" target="_blank"><div class="lbl"><div class="t">Terms of Service</div></div><span class="chev">›</span></a>
        <a class="settings-row" href="../privacy.html" target="_blank"><div class="lbl"><div class="t">Privacy Policy</div></div><span class="chev">›</span></a>
        <a class="settings-row" href="../support.html" target="_blank"><div class="lbl"><div class="t">Support</div></div><span class="chev">›</span></a>
      </div>

      <div class="section-title" style="font-size:1.15rem;color:var(--danger)">Danger zone</div>
      <div class="settings-list">
        <div class="settings-row"><div class="lbl"><div class="t">Log out</div><div class="d">${esc(u.email || u.handle)}</div></div><button class="btn ghost sm" id="logout">Log out</button></div>
        <div class="settings-row"><div class="lbl"><div class="t" style="color:var(--danger)">Delete account</div><div class="d">Permanently erase everything. Cannot be undone.</div></div><button class="btn danger sm" id="del-account">Delete</button></div>
      </div>

      <div style="text-align:center;color:var(--muted);margin-top:26px;">
        <img src="../brand/eternity-vault-mark.svg" width="30" height="30" alt=""><div style="font-weight:600;margin-top:4px;">Eternity Vault</div><div style="font-size:0.82rem;">Web · Version 1.0</div>
      </div>
    </div>`;
  wirePasswordToggles();
  const msg = (html) => { $('#set-msg').innerHTML = html; window.scrollTo(0, 0); };
  $('#email-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await api.changeEmail(new FormData(e.target).get('email')); msg('<div class="success">Email change started — check your new inbox for a confirmation link.</div>'); }
    catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
  };
  $('#pw-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get('pw').length < 6) return msg('<div class="error">Password must be at least 6 characters.</div>');
    if (f.get('pw') !== f.get('pw2')) return msg('<div class="error">Passwords do not match.</div>');
    try { await api.updatePassword(f.get('pw')); e.target.reset(); msg('<div class="success">Password updated.</div>'); }
    catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
  };
  $('#ship-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const patch = { phone: f.get('phone'), addressLine1: f.get('addressLine1'), city: f.get('city'), state: f.get('state'), zipCode: f.get('zipCode') };
    try { await api.updateProfile(u.id, patch); Object.assign(state.user, patch); msg('<div class="success">Shipping details saved.</div>'); }
    catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
  };
  root().querySelectorAll('#tagopts .opt').forEach((o) => (o.onclick = async () => {
    const v = o.getAttribute('data-perm');
    root().querySelectorAll('#tagopts .opt').forEach((x) => x.classList.remove('sel'));
    o.classList.add('sel');
    try { await api.updateProfile(u.id, { tagPermission: v }); state.user.tagPermission = v; } catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
  }));
  $('#dl-html').onclick = () => downloadJourney('html');
  $('#dl-json').onclick = () => downloadJourney('json');
  $('#keeper').onchange = async (e) => {
    const v = e.target.value || null;
    try { await api.updateProfile(u.id, { keeperId: v }); state.user.keeperId = v; msg('<div class="success">Keeper updated.</div>'); }
    catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
  };
  $('#logout').onclick = async () => { await api.logOut(); state.user = null; state.blocked = new Set(); nav('#/login'); route(); };
  $('#del-account').onclick = async () => {
    if (!confirm('Permanently delete your account and everything in it? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? There is no way to recover your journey after this.')) return;
    try { await api.deleteAccount(); state.user = null; nav('#/login'); route(); } catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
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

// ---- Photo import shelf ----------------------------------------------------
async function readPhotoDate(file) {
  try {
    const mod = await import('https://esm.sh/exifr@7.1.3');
    const exifr = mod.default || mod;
    const m = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null);
    const d = m?.DateTimeOriginal || m?.CreateDate;
    if (d) return +new Date(d);
  } catch {}
  return file.lastModified || Date.now();
}

async function loadStaged() {
  try { return await api.getPendingImports(state.user.id); } catch { return []; }
}

async function viewImport() {
  renderTopbar('profile');
  setLoading();
  let staged = await loadStaged();
  const selected = new Set();

  const doUpload = async (files) => {
    if (!files.length) return;
    $('#imp-progress').innerHTML = `<div class="progress"><div class="bar" style="width:0%"></div></div><div class="muted" id="pct">Reading photo dates…</div>`;
    const withDates = [];
    for (const file of files) withDates.push({ file, takenAt: await readPhotoDate(file) });
    const res = await api.addPendingImports(state.user.id, withDates, (done, total) => {
      const bar = $('#imp-progress .bar'); if (bar) bar.style.width = Math.round((done / total) * 100) + '%';
      const pct = $('#pct'); if (pct) pct.textContent = `Uploading ${done}/${total}…`;
    });
    staged = await loadStaged();
    render();
    $('#imp-msg').innerHTML = res.failed.length
      ? `<div class="error">${res.saved} added, ${res.failed.length} couldn't upload.</div>`
      : `<div class="success">${res.saved} photo${res.saved === 1 ? '' : 's'} added to your shelf.</div>`;
  };

  const buildMoment = async () => {
    const items = staged.filter((s) => selected.has(s.id));
    if (!items.length) return;
    const first = items.find((s) => s.takenAt);
    const d = first ? new Date(first.takenAt) : new Date();
    try {
      const row = await api.addMemory(state.user, {
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        title: '', caption: '', story: '', location: '', photos: items.map((s) => s.url), tags: [],
      });
      await api.consumePendingImports(items.map((s) => s.id));
      nav(`#/edit/${row.id}`);
    } catch (e) { $('#imp-msg').innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  };

  function render() {
    root().innerHTML = `
      <div class="wrap">
        <a class="back" href="#/profile">← Back</a>
        <div class="section-title">Import Photos</div>
        <p class="muted">Upload photos to your shelf — they sit here so you can build moments in bulk without re-uploading each time. We read each photo's date automatically. Delete them when you're done, or leave them for later.</p>
        <div id="imp-msg"></div>
        <div class="btn-row" style="justify-content:flex-start;">
          <label class="btn" style="cursor:pointer;">+ Upload photos<input type="file" id="imp-input" accept="image/*,video/*" multiple hidden></label>
          ${staged.length ? `<button class="btn ghost" id="clear-all">Clear shelf (${staged.length})</button>` : ''}
        </div>
        <div id="imp-progress"></div>
        ${selected.size ? `<div class="notice" style="display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;">
          <span>${selected.size} selected</span>
          <span><button class="btn sm" id="build">Build a moment from these</button> <button class="btn ghost sm" id="deselect">Clear</button></span></div>` : ''}
        ${staged.length ? `<div class="shelf-grid">${staged.map((s) => `
          <div class="shelf-item ${selected.has(s.id) ? 'sel' : ''}" data-id="${esc(s.id)}">
            <img src="${esc(s.url)}" loading="lazy" alt="">
            <div class="shelf-date">${s.takenAt ? new Date(s.takenAt).toLocaleDateString() : 'No date'}</div>
            <button class="rm" data-del="${esc(s.id)}" data-path="${esc(s.storagePath)}">×</button>
          </div>`).join('')}</div>`
          : '<div class="empty"><div class="big">🖼️</div>Your shelf is empty.<br>Upload photos to get started.</div>'}
      </div>`;
    $('#imp-input').onchange = (e) => doUpload([...e.target.files]);
    if ($('#clear-all')) $('#clear-all').onclick = async () => {
      if (!confirm('Delete all photos on your shelf? (Photos already saved into moments are safe.)')) return;
      await api.clearPendingImports(state.user.id); staged = []; selected.clear(); render();
    };
    if ($('#deselect')) $('#deselect').onclick = () => { selected.clear(); render(); };
    if ($('#build')) $('#build').onclick = buildMoment;
    root().querySelectorAll('.shelf-item').forEach((it) => (it.onclick = (e) => {
      if (e.target.hasAttribute('data-del')) return;
      const id = it.getAttribute('data-id');
      selected.has(id) ? selected.delete(id) : selected.add(id);
      render();
    }));
    root().querySelectorAll('[data-del]').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.getAttribute('data-del');
      await api.deletePendingImport(id, b.getAttribute('data-path'));
      staged = staged.filter((s) => s.id !== id); selected.delete(id); render();
    }));
  }
  render();
}

// ---- Shared With Me (photo shares) -----------------------------------------
async function viewShared() {
  renderTopbar('profile');
  setLoading();
  const inbox = await api.getPhotoInbox(state.user.id);
  const otherIds = [...new Set(inbox.map((s) => (s.direction === 'incoming' ? s.fromUserId : s.toUserId)))];
  const people = {};
  for (const id of otherIds) { const u = await api.fetchUserById(id); if (u) people[id] = u; }
  const nameOf = (s) => { const p = people[s.direction === 'incoming' ? s.fromUserId : s.toUserId]; return p ? `${p.name} (@${p.handle})` : 'Someone'; };

  const card = (s) => {
    const who = s.direction === 'incoming' ? `From ${esc(nameOf(s))}` : `To ${esc(nameOf(s))}`;
    const isReq = s.kind === 'request';
    return `<div class="contribution" data-share="${esc(s.id)}">
      <div style="display:flex;justify-content:space-between;"><span style="font-weight:600;color:var(--blue)">${who}</span><span class="muted" style="font-size:0.8rem;">${timeAgo(s.createdAt)}</span></div>
      ${isReq ? `<p style="margin:6px 0;">📷 ${s.direction === 'incoming' ? 'Asked you for photos' : 'You asked for photos'}${s.note ? `: “${esc(s.note)}”` : '.'}</p>
        ${s.direction === 'incoming' ? `<button class="btn sm" data-send="${esc(s.direction === 'incoming' ? s.fromUserId : s.toUserId)}">Send photos</button>` : ''}`
      : `${s.note ? `<p style="margin:6px 0;">${esc(s.note)}</p>` : ''}
         ${s.photoUrl ? `<img src="${esc(s.photoUrl)}" style="max-width:220px;border-radius:10px;border:3px solid var(--paper);box-shadow:var(--shadow-sm);display:block;margin:8px 0;">` : ''}
         ${s.direction === 'incoming' && s.photoUrl ? `<a class="btn ghost sm" href="${esc(s.photoUrl)}" download target="_blank" data-save="${esc(s.id)}">Save photo</a>` : ''}`}
      <div class="replies" style="margin-top:10px;">
        ${s.replies.map((r) => `<div style="font-size:0.9rem;margin:4px 0;"><strong>${esc(r.name)}:</strong> ${esc(r.text)}</div>`).join('')}
        <form class="reply-form" style="display:flex;gap:6px;margin-top:6px;"><input name="text" placeholder="Reply…" style="flex:1" required><button class="btn ghost sm" type="submit">Send</button></form>
      </div>
    </div>`;
  };
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Shared With Me</div>
      <p class="muted">Photos people sent you, and requests — plus the ones you sent.</p>
      ${inbox.length ? inbox.map(card).join('') : '<div class="empty"><div class="big">📬</div>Nothing shared yet.<br>Send photos from someone\'s profile.</div>'}
    </div>`;
  root().querySelectorAll('[data-send]').forEach((b) => (b.onclick = async () => { const u = await api.fetchUserById(b.getAttribute('data-send')); if (u) openShareModal(u, 'send'); }));
  root().querySelectorAll('[data-save]').forEach((b) => (b.onclick = () => api.markShareSaved(b.getAttribute('data-save'))));
  root().querySelectorAll('[data-share]').forEach((cardEl) => {
    const form = cardEl.querySelector('.reply-form');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const text = new FormData(e.target).get('text');
      const share = inbox.find((s) => s.id === cardEl.getAttribute('data-share'));
      try { await api.addShareReply(state.user, share, text); viewShared(); } catch (err) { alert(err.message); }
    };
  });
}

// Send/Request photos to a specific person.
function openShareModal(target, mode = 'send') {
  const back = document.createElement('div');
  back.className = 'modal-back';
  const files = [];
  const draw = () => {
    back.innerHTML = `
      <div class="modal">
        <h2>${mode === 'send' ? 'Send photos to' : 'Ask for photos from'} @${esc(target.handle)}</h2>
        <div id="sh-msg"></div>
        <div class="viewrow" style="max-width:none;">
          <button class="viewchip ${mode === 'send' ? 'active' : ''}" data-mode="send">Send photos</button>
          <button class="viewchip ${mode === 'request' ? 'active' : ''}" data-mode="request">Request photos</button>
        </div>
        <form id="sh-form">
          ${mode === 'send' ? `<div class="field"><label>Photos</label><input type="file" id="sh-files" accept="image/*,video/*" multiple>
            <div class="photo-preview" id="sh-prev">${files.map((f, i) => `<div class="pp"><img src="${URL.createObjectURL(f)}"><button type="button" class="rm" data-i="${i}">×</button></div>`).join('')}</div></div>` : ''}
          <div class="field"><label>${mode === 'send' ? 'Note (optional)' : 'What are you looking for?'}</label><textarea name="note" placeholder="${mode === 'send' ? 'Here are the ones from the reunion…' : 'Any photos from the 2005 trip?'}"></textarea></div>
          <div class="btn-row" style="justify-content:flex-end;"><button type="button" class="btn ghost sm" id="sh-cancel">Cancel</button><button type="submit" class="btn sm">${mode === 'send' ? 'Send' : 'Send request'}</button></div>
        </form>
      </div>`;
    back.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.getAttribute('data-mode'); draw(); }));
    $('#sh-cancel', back).onclick = () => back.remove();
    if ($('#sh-files', back)) $('#sh-files', back).onchange = (e) => { for (const f of e.target.files) files.push(f); draw(); };
    back.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { files.splice(+b.getAttribute('data-i'), 1); draw(); }));
    $('#sh-form', back).onsubmit = async (e) => {
      e.preventDefault();
      const note = new FormData(e.target).get('note');
      const btn = $('#sh-form button[type=submit]', back); btn.disabled = true; btn.textContent = 'Sending…';
      try {
        if (mode === 'send') {
          if (!files.length) throw new Error('Add at least one photo.');
          await api.sendPhotos(state.user, target.id, files, note);
        } else await api.requestPhotos(state.user, target.id, note);
        $('#sh-msg', back).innerHTML = '<div class="success">Sent.</div>';
        setTimeout(() => back.remove(), 1000);
      } catch (err) { $('#sh-msg', back).innerHTML = `<div class="error">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = mode === 'send' ? 'Send' : 'Send request'; }
    };
  };
  back.onclick = (e) => { if (e.target === back) back.remove(); };
  document.body.appendChild(back);
  draw();
}

// ---- Merch catalog ---------------------------------------------------------
async function viewMerch() {
  renderTopbar('profile');
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Order Memories</div>
      <p class="muted">Turn your journey into something you can hold. Made to order from your own moments.</p>
      <div class="prod-grid">
        ${PRODUCTS.map((p) => `<a class="prod-card" href="#/merch/${p.key}">
          <div class="pemoji">${p.emoji}</div>
          <div class="pname">${esc(p.name)}</div>
          <div class="ptag muted">${esc(p.tagline)}</div>
          <div class="pprice">${esc(p.priceLabel)}</div>
        </a>`).join('')}
      </div>
      <p class="muted" style="text-align:center;margin-top:20px;font-size:0.85rem;">Payment isn't live yet — orders are saved and we'll follow up. (Stripe checkout coming.)</p>
      <div style="text-align:center;margin-top:12px;"><a class="btn ghost sm" href="#/orders">My Orders</a></div>
    </div>`;
}

// ---- Merch product configurator --------------------------------------------
async function viewMerchProduct(key) {
  renderTopbar('profile');
  setLoading();
  const product = getProduct(key);
  if (!product) { nav('#/merch'); return; }
  const u = state.user;
  const moments = (await api.getMomentsOf(u.id)).sort(api.byChrono);
  if (!moments.length) { root().innerHTML = `<div class="wrap"><a class="back" href="#/merch">← Store</a><div class="empty">Add some moments to your Journey first — then you can make a ${esc(product.name)}.</div></div>`; return; }

  let scope = product.scopes.includes('all') ? 'all' : 'custom';
  let decade = [...new Set(moments.map((m) => Math.floor(m.year / 10) * 10))].sort()[0];
  let tier = product.momentTiers ? product.momentTiers[0] : null;
  let placement = product.placement ? 'front' : null;
  const selected = new Set();
  const decades = [...new Set(moments.map((m) => Math.floor(m.year / 10) * 10))].sort();
  const maxPick = () => (product.momentTiers ? tier : product.maxMoments ? product.maxMoments : Infinity);
  const needsPicker = () => product.key !== 'book' || scope === 'custom';
  const chosen = () => {
    if (product.key === 'book' && scope === 'all') return moments;
    if (product.key === 'book' && scope === 'decade') return moments.filter((m) => Math.floor(m.year / 10) * 10 === decade);
    return moments.filter((m) => selected.has(m.id));
  };
  const price = () => priceFor(product, chosen().length);

  const render = () => {
    const picked = chosen();
    root().innerHTML = `
      <div class="wrap">
        <a class="back" href="#/merch">← Store</a>
        <div style="text-align:center;"><div style="font-size:3rem;">${product.emoji}</div>
          <h1 style="color:var(--blue);margin:4px 0;">${esc(product.name)}</h1>
          <p class="muted">${esc(product.detail)}</p></div>
        <div id="merch-msg"></div>

        ${product.key === 'book' ? `<div class="section-title" style="font-size:1.1rem;">What goes in it?</div>
          <div class="viewrow" style="max-width:none;">
            <button class="viewchip ${scope === 'all' ? 'active' : ''}" data-scope="all">Whole journey</button>
            <button class="viewchip ${scope === 'decade' ? 'active' : ''}" data-scope="decade">By decade</button>
            <button class="viewchip ${scope === 'custom' ? 'active' : ''}" data-scope="custom">Pick moments</button>
          </div>
          ${scope === 'decade' ? `<div class="field"><select id="decadeSel">${decades.map((d) => `<option value="${d}" ${d === decade ? 'selected' : ''}>${d}s (${moments.filter((m) => Math.floor(m.year / 10) * 10 === d).length} moments)</option>`).join('')}</select></div>` : ''}` : ''}

        ${product.momentTiers && product.momentTiers.length > 1 ? `<div class="section-title" style="font-size:1.1rem;">How many moments?</div>
          <div class="viewrow" style="max-width:none;">${product.momentTiers.map((t) => `<button class="viewchip ${t === tier ? 'active' : ''}" data-tier="${t}">${t === 1 ? 'One big moment' : t + ' moments'}</button>`).join('')}</div>` : ''}

        ${product.placement ? `<div class="section-title" style="font-size:1.1rem;">Placement</div>
          <div class="viewrow" style="max-width:none;"><button class="viewchip ${placement === 'front' ? 'active' : ''}" data-place="front">Front</button><button class="viewchip ${placement === 'back' ? 'active' : ''}" data-place="back">Back</button></div>` : ''}

        ${needsPicker() ? `<div class="section-title" style="font-size:1.1rem;">Choose moments ${maxPick() !== Infinity ? `<span class="muted">(${picked.length}/${maxPick()})</span>` : `<span class="muted">(${picked.length})</span>`}</div>
          <div class="pick-list">${moments.map((m) => `<div class="pick ${selected.has(m.id) ? 'sel' : ''}" data-pick="${esc(m.id)}">
            <div class="pthumb">${m.photos?.[0] ? `<img src="${esc(m.photos[0])}" alt="">` : '📝'}</div>
            <div style="flex:1;"><div style="font-weight:600;">${esc(m.title || 'Untitled moment')}</div><div class="muted" style="font-size:0.82rem;">${esc(fullDate(m))}</div></div>
            <div class="pcheck">${selected.has(m.id) ? '✓' : ''}</div></div>`).join('')}</div>` : `<div class="notice">This ${product.key === 'book' ? 'book' : 'item'} will use ${picked.length} moment${picked.length === 1 ? '' : 's'} from your journey.</div>`}

        <div class="section-title" style="font-size:1.1rem;">Ship to</div>
        <div class="panel">
          <div class="field"><label>Full name</label><input id="s-name" value="${esc(u.name || '')}"></div>
          <div class="field"><label>Street address</label><input id="s-addr" value="${esc(u.addressLine1 || '')}"></div>
          <div class="row">
            <div class="field"><label>City</label><input id="s-city" value="${esc(u.city || '')}"></div>
            <div class="field"><label>State</label><select id="s-state"><option value="">—</option>${US_STATES.map((s) => `<option ${u.state === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label>ZIP</label><input id="s-zip" value="${esc(u.zipCode || '')}" maxlength="10"></div>
          </div>
          <div class="field"><label>Phone</label><input id="s-phone" value="${esc(u.phone || '')}"></div>
        </div>

        <div class="order-bar">
          <div><div class="muted" style="font-size:0.8rem;">Total</div><div style="font-size:1.5rem;font-weight:700;color:var(--blue);">${money(price())}</div></div>
          <button class="btn" id="place">Place order</button>
        </div>
        <p class="muted" style="text-align:center;font-size:0.82rem;margin-top:8px;">No payment taken yet — we'll follow up to arrange payment &amp; delivery.</p>
      </div>`;
    // wire
    root().querySelectorAll('[data-scope]').forEach((b) => (b.onclick = () => { scope = b.getAttribute('data-scope'); render(); }));
    if ($('#decadeSel')) $('#decadeSel').onchange = (e) => { decade = +e.target.value; render(); };
    root().querySelectorAll('[data-tier]').forEach((b) => (b.onclick = () => { tier = +b.getAttribute('data-tier'); while (selected.size > tier) selected.delete([...selected][selected.size - 1]); render(); }));
    root().querySelectorAll('[data-place]').forEach((b) => (b.onclick = () => { placement = b.getAttribute('data-place'); render(); }));
    root().querySelectorAll('[data-pick]').forEach((el2) => (el2.onclick = () => {
      const id = el2.getAttribute('data-pick');
      if (selected.has(id)) selected.delete(id);
      else if (selected.size < maxPick()) selected.add(id);
      else if (maxPick() === 1) { selected.clear(); selected.add(id); }
      render();
    }));
    $('#place').onclick = placeOrder;
  };

  const placeOrder = async () => {
    const picked = chosen();
    const need = product.key === 'shirt' ? 1 : product.momentTiers && product.momentTiers.length > 1 ? tier : null;
    if (!picked.length) return ($('#merch-msg').innerHTML = '<div class="error">Choose at least one moment.</div>', window.scrollTo(0, 0));
    if (need && picked.length !== need) return ($('#merch-msg').innerHTML = `<div class="error">Please choose exactly ${need} moment${need === 1 ? '' : 's'}.</div>`, window.scrollTo(0, 0));
    const name = $('#s-name').value.trim(), addr = $('#s-addr').value.trim(), city = $('#s-city').value.trim(), st = $('#s-state').value, zip = $('#s-zip').value.trim();
    if (!name || !addr || !city || !st || !zip) return ($('#merch-msg').innerHTML = '<div class="error">Please fill in your full shipping address.</div>', window.scrollTo(0, 0));
    const btn = $('#place'); btn.disabled = true; btn.textContent = 'Placing…';
    try {
      await api.placeOrder(u, {
        productKey: product.key, productName: product.name, unitPriceCents: Math.round(price() * 100),
        scope: product.key === 'book' ? scope : 'custom', placement,
        momentIds: picked.map((m) => m.id), momentCount: picked.length,
        photoCount: picked.reduce((n, m) => n + (m.photos?.length || 0), 0),
        shippingName: name, shippingAddressLine1: addr, shippingCity: city, shippingState: st, shippingZip: zip, shippingPhone: $('#s-phone').value,
      });
      nav('#/orders?placed=1');
    } catch (err) { $('#merch-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = 'Place order'; window.scrollTo(0, 0); }
  };
  render();
}

// ---- My Orders -------------------------------------------------------------
async function viewOrders() {
  renderTopbar('profile');
  setLoading();
  const orders = await api.getMyOrders(state.user.id);
  const placed = location.hash.includes('placed=1');
  const statusLabel = (s) => ({ awaiting_payment: 'Awaiting payment', paid: 'Paid', in_production: 'In production', shipped: 'Shipped' }[s] || s);
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/merch">← Store</a>
      <div class="section-title">My Orders</div>
      ${placed ? '<div class="success">Order placed! We\'ll be in touch to arrange payment and delivery.</div>' : ''}
      ${orders.length ? orders.map((o) => `<div class="panel" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-weight:700;color:var(--blue);font-size:1.1rem;">${esc(o.product_name)}</div>
            <div class="muted" style="font-size:0.85rem;">${o.moment_count} moment${o.moment_count === 1 ? '' : 's'}${o.placement ? ' · ' + o.placement : ''} · ${new Date(o.created_at).toLocaleDateString()}</div></div>
          <div style="text-align:right;"><div style="font-weight:700;">${money((o.unit_price_cents || 0) / 100)}</div><div class="chip">${statusLabel(o.status)}</div></div>
        </div></div>`).join('')
        : '<div class="empty"><div class="big">📦</div>No orders yet.<br><a href="#/merch">Order a keepsake →</a></div>'}
    </div>`;
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
  const head = (parts[0] || 'journey').split('?')[0];
  clearInterval(state.avatarTimer);
  clearInterval(state.spotTimer);
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
      case 'import': await viewImport(); break;
      case 'shared': await viewShared(); break;
      case 'merch': parts[1] ? await viewMerchProduct(parts[1]) : await viewMerch(); break;
      case 'orders': await viewOrders(); break;
      case 'add': await viewMomentForm(null); break;
      case 'edit': await viewMomentForm(parts[1]); break;
      case 'moment': await viewMoment(parts[1]); break;
      case 'u': await viewPerson(parts[1]); break;
      case 'profile':
        if (parts[1] === 'edit') await viewProfileEdit();
        else if (parts[1] === 'qr') await viewQR();
        else if (parts[1] === 'customize') await viewCustomize();
        else await viewMyProfile();
        break;
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
