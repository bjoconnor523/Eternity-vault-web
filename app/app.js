// ============================================================================
// app.js — router + views for the Eternity Vault web app.
// Hash-routed SPA, no framework. Refined reverent design; bold centered nav.
// ============================================================================
import { supabase } from './supabase.js';
import * as api from './api.js';
import { LIMITS } from './limits.js';
import { captureYmdFromFile, ymdFromTakenAt, formatPhotoDate, earliestYmd } from './photoDates.js';

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

// Journey background themes — kept in lockstep with the mobile app's
// journeyTheme.js (BG_THEMES) and JourneyBackdrop.js. `color` is the flat base
// fill; `kind` selects the generative SVG drawn on top (see backdropSVG below);
// `dark` flags themes that want light chrome. 'default' is NO LONGER a blank
// canvas — it's a soft warm paper (kind 'paper').
const BG_THEMES = [
  { key: 'default', label: 'Soft Paper', color: '#F6EFDD', kind: 'paper' },
  { key: 'dawn', label: 'Dawn Horizon', color: '#FFF3D6', kind: 'dawn' },
  { key: 'night', label: 'Night Sky', color: '#141B30', kind: 'stars', dark: true },
  { key: 'linen', label: 'Linen', color: '#FBF6EC', kind: 'linen' },
  { key: 'hills', label: 'Rolling Hills', color: '#EAF1FB', kind: 'hills' },
  { key: 'tide', label: 'Tide Lines', color: '#E7F1F6', kind: 'tide' },
  { key: 'sprig', label: 'Sprig', color: '#EFF3E9', kind: 'sprig' },
  { key: 'sunset', label: 'Sunset Glow', color: '#FFD9A0', kind: 'sunset' },
  { key: 'meadow', label: 'Meadow', color: '#E4F2DC', kind: 'meadow' },
  { key: 'ocean', label: 'Ocean Deep', color: '#0E3B57', kind: 'ocean', dark: true },
  { key: 'confetti', label: 'Confetti', color: '#FDFBF4', kind: 'confetti' },
  { key: 'citrus', label: 'Citrus', color: '#FFE9B8', kind: 'citrus' },
  { key: 'aurora', label: 'Aurora', color: '#101B33', kind: 'aurora', dark: true },
  { key: 'terracotta', label: 'Terracotta', color: '#F3D9C3', kind: 'terracotta' },
  { key: 'wildflowers', label: 'Wildflowers', color: '#F9F5EA', kind: 'wildflowers' },
  { key: 'arcs', label: 'Sun Arcs', color: '#FDF8EF', kind: 'arcs' },
  { key: 'fireflies', label: 'Fireflies', color: '#14251E', kind: 'fireflies', dark: true },
  { key: 'marble', label: 'Marble', color: '#ECEBE7', kind: 'marble' },
  { key: 'constellation', label: 'Constellation', color: '#0E1834', kind: 'constellation', dark: true },
  { key: 'gilded', label: 'Gilded', color: '#FBF3DC', kind: 'gilded' },
  { key: 'topo', label: 'Topographic', color: '#EEF3EC', kind: 'topo' },
  { key: 'quilt', label: 'Memory Quilt', color: '#F7EFE0', kind: 'quilt' },
  { key: 'blossom', label: 'Blossom', color: '#F3F7FB', kind: 'blossom' },
  { key: 'harvest', label: 'Harvest', color: '#F6E7CE', kind: 'harvest' },
  { key: 'rainfall', label: 'Rainfall', color: '#DCE4EC', kind: 'rainfall' },
];
const bgTheme = (key) => BG_THEMES.find((b) => b.key === key) || BG_THEMES[0];
const bgColor = (key) => bgTheme(key).color;
const PHOTO_SHAPES = [{ key: 'rounded', label: 'Rounded', r: '9px' }, { key: 'square', label: 'Square', r: '2px' }, { key: 'circle', label: 'Circle', r: '50%' }];

// Journey-wide default fonts & colors — mirror the mobile lists (journeyTheme.js
// FONTS / FONT_COLORS / STYLE_FIELDS). 'classic' font and 'default' color mean
// "no override" (fall back to the card's own scheme).
const FONTS = [
  { key: 'classic', label: 'Classic', css: '' },
  { key: 'serif', label: 'Serif', css: "'Lora', Georgia, serif" },
  { key: 'rounded', label: 'Rounded', css: "'Nunito', system-ui, sans-serif" },
  { key: 'hand', label: 'Handwritten', css: "'Caveat', cursive" },
];
const FONT_COLORS = [
  { key: 'default', label: 'Blue', color: '#1B4B8F' }, { key: 'ink', label: 'Ink', color: '#1A2233' },
  { key: 'plum', label: 'Plum', color: '#6B3F7A' }, { key: 'forest', label: 'Forest', color: '#2F6B45' },
  { key: 'rust', label: 'Rust', color: '#9A4A24' }, { key: 'cream', label: 'Cream', color: '#F5EFE1' },
  { key: 'teal', label: 'Teal', color: '#2C8A9E' }, { key: 'olive', label: 'Olive', color: '#707A2E' },
  { key: 'amber', label: 'Amber', color: '#C9862E' }, { key: 'brick', label: 'Brick', color: '#A6412F' },
  { key: 'mulberry', label: 'Mulberry', color: '#8C4560' }, { key: 'slate', label: 'Slate', color: '#3F4A61' },
];
const STYLE_FIELDS = [
  { key: 'location', label: 'Location', sample: '📍 Dayton, Ohio' },
  { key: 'title', label: 'Title', sample: 'Summer at the lake house' },
  { key: 'caption', label: 'Caption', sample: 'The pool one from Vegas 😎' },
  { key: 'story', label: 'Story', sample: 'Tell the whole story…' },
];
// A chosen font's CSS family (or '' for 'classic'/none); a chosen color's hex
// (or '' for 'default'/none). Used both to preview and to set the timeline's
// CSS variables so moment text picks up the journey-wide default.
const fontCss = (key) => (FONTS.find((f) => f.key === key) || FONTS[0]).css;
const fontColorHex = (key) => (!key || key === 'default') ? '' : (FONT_COLORS.find((c) => c.key === key) || {}).color || '';

// Photo mat / frame around a moment's photo, mirrored from mobile journeyTheme.js
// (PHOTO_MATS). Painted via CSS vars on the timeline host so busy patterns and
// mats only ever touch the photo, never the text. 'cream' is the default.
const PHOTO_MATS = [
  { key: 'cream', label: 'Cream', color: '#FBF7EC', pad: 10, bottom: 10 },
  { key: 'white', label: 'White', color: '#FFFFFF', pad: 10, bottom: 10 },
  { key: 'black', label: 'Black', color: '#171717', pad: 10, bottom: 10 },
  { key: 'polaroid', label: 'Polaroid', color: '#FFFFFF', pad: 12, bottom: 34 },
  { key: 'none', label: 'None', color: 'transparent', pad: 0, bottom: 0 },
];
const photoMat = (key) => PHOTO_MATS.find((m) => m.key === key) || PHOTO_MATS[0];
// Reading text size for moment words (TEXT_SCALES). 'm' is 1.0 (unchanged).
const TEXT_SCALES = [
  { key: 's', label: 'Compact', scale: 0.92 },
  { key: 'm', label: 'Standard', scale: 1 },
  { key: 'l', label: 'Large', scale: 1.15 },
];
const textScaleVal = (key) => (TEXT_SCALES.find((t) => t.key === key) || TEXT_SCALES[1]).scale;
// The Journey accent (thread/chapter chrome). Chosen accent → favorite color →
// brand gold. Only paints decorative chrome, so any color is safe.
const ACCENT_DEFAULT = '#FFC93C';
const journeyAccentOf = (owner) => owner?.journeyAccent || owner?.favoriteColor || ACCENT_DEFAULT;

// ---- Generative journey backdrops (ported from mobile JourneyBackdrop.js) --
// Each returns the inner SVG for a fixed 400x800 viewBox, sliced to cover. A
// per-call unique suffix keeps gradient IDs from colliding when many previews
// render on one page. Opaque moment cards sit on top, so busy patterns only
// ever show in the gaps between cards.
let _bdUid = 0;
const _wrap = (inner) =>
  `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">${inner}</svg>`;
const _bg = (fill) => `<rect width="400" height="800" fill="${fill}"/>`;

const BACKDROPS = {
  paper: (u) =>
    `<defs><linearGradient id="pb${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FBF5E6"/><stop offset="100%" stop-color="#F1E7CE"/></linearGradient>
      <radialGradient id="pv${u}" cx="50%" cy="42%" r="72%"><stop offset="0%" stop-color="#FFFDF6" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFFDF6" stop-opacity="0"/></radialGradient></defs>
      ${_bg(`url(#pb${u})`)}<rect width="400" height="800" fill="url(#pv${u})"/>
      ${[[60,120],[330,90],[120,300],[300,360],[70,520],[350,560],[180,660],[40,720],[260,740]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%2?1.6:2.4}" fill="#D8C79E" opacity="0.4"/>`).join('')}`,
  dawn: (u) =>
    `<defs><linearGradient id="ds${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE9A8"/><stop offset="45%" stop-color="#FFF3D6"/><stop offset="100%" stop-color="#EAF1FB"/></linearGradient>
      <radialGradient id="dn${u}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFFDF3" stop-opacity="0.9"/><stop offset="100%" stop-color="#FFFDF3" stop-opacity="0"/></radialGradient></defs>
      ${_bg(`url(#ds${u})`)}<rect x="220" y="60" width="180" height="180" fill="url(#dn${u})"/>
      <path d="M0 560 C 90 520, 180 590, 260 545 C 320 515, 370 545, 400 530 L400 800 L0 800 Z" fill="#D9E7DE" opacity="0.7"/>
      <path d="M0 620 C 70 585, 160 640, 250 600 C 330 565, 380 610, 400 595 L400 800 L0 800 Z" fill="#C3D9CC" opacity="0.8"/>`,
  stars: (u) => {
    const stars = [[40,90,6],[120,60,4],[210,130,5],[320,70,4],[370,180,6],[60,220,4],[160,260,6],[260,210,4],[340,300,5],[20,340,4],[110,400,5],[230,380,4],[330,420,6],[70,470,4],[190,510,5],[300,500,4],[40,560,6],[140,610,4],[260,600,5],[360,560,4]];
    const spark = (cx,cy,r) => `M${cx} ${cy-r} L${cx+r*0.3} ${cy-r*0.3} L${cx+r} ${cy} L${cx+r*0.3} ${cy+r*0.3} L${cx} ${cy+r} L${cx-r*0.3} ${cy+r*0.3} L${cx-r} ${cy} L${cx-r*0.3} ${cy-r*0.3} Z`;
    const lines = [[40,90,120,60],[120,60,210,130],[160,260,260,210],[230,380,330,420],[140,610,260,600]];
    return `<defs><linearGradient id="ns${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1B2233"/><stop offset="100%" stop-color="#0A0F1F"/></linearGradient></defs>${_bg(`url(#ns${u})`)}
      ${lines.map(([a,b,c,d])=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#3A4568" stroke-width="1" opacity="0.5"/>`).join('')}
      ${stars.map(([cx,cy,r],i)=>`<path d="${spark(cx,cy,r)}" fill="#FFC93C" opacity="${0.35+(i%3)*0.22}"/>`).join('')}`;
  },
  linen: (u) =>
    `<defs><pattern id="lw${u}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="18" fill="#FBF6EC"/><line x1="0" y1="0" x2="0" y2="18" stroke="#EEE3C8" stroke-width="2"/><line x1="9" y1="0" x2="9" y2="18" stroke="#F3EADA" stroke-width="1"/></pattern></defs>${_bg(`url(#lw${u})`)}`,
  hills: (u) =>
    `<defs><linearGradient id="hs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EAF1FB"/><stop offset="100%" stop-color="#F7F9FC"/></linearGradient></defs>${_bg(`url(#hs${u})`)}
      <path d="M0 500 C 80 450, 160 460, 240 495 C 300 520, 350 490, 400 470 L400 800 L0 800 Z" fill="#DCE9F2"/>
      <path d="M0 580 C 90 540, 190 600, 280 560 C 330 538, 370 570, 400 555 L400 800 L0 800 Z" fill="#C9DCE3"/>
      <path d="M0 660 C 100 620, 200 670, 300 630 C 340 614, 375 640, 400 628 L400 800 L0 800 Z" fill="#AFCBC6"/>`,
  tide: (u) => {
    const wave = (y,dy) => `M0 ${y} C 60 ${y-dy}, 120 ${y+dy}, 180 ${y} C 240 ${y-dy}, 300 ${y+dy}, 360 ${y} C 390 ${y-dy*0.5}, 400 ${y}, 400 ${y}`;
    return `<defs><linearGradient id="ts${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F7F9FC"/><stop offset="100%" stop-color="#DCEBF0"/></linearGradient></defs>${_bg(`url(#ts${u})`)}
      ${[280,340,400,460,520,580].map((y,i)=>`<path d="${wave(y,14)}" fill="none" stroke="#7FAFC4" stroke-width="2" opacity="${0.18+i*0.06}"/>`).join('')}
      <rect x="0" y="700" width="400" height="100" fill="#EFE3C4" opacity="0.9"/>`;
  },
  sprig: () => {
    const sprig = (x,y,s,r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><line x1="0" y1="0" x2="0" y2="-24" stroke="#93A87D" stroke-width="1.5"/><path d="M0 -6 C -8 -10, -10 -18, -3 -20" stroke="#93A87D" stroke-width="1.5" fill="none"/><path d="M0 -14 C 8 -18, 10 -24, 4 -26" stroke="#93A87D" stroke-width="1.5" fill="none"/></g>`;
    const pos = [[40,120,1,-10],[340,90,0.8,15],[120,260,1.1,5],[280,300,0.9,-20],[60,400,1,20],[360,420,0.8,-8],[180,480,1.2,0],[40,600,0.9,12],[300,600,1,-15],[150,700,0.85,10],[370,700,1,-5],[230,160,0.7,25]];
    return `${_bg('#EFF3E9')}${pos.map(([x,y,s,r])=>sprig(x,y,s,r)).join('')}`;
  },
  sunset: (u) =>
    `<defs><linearGradient id="ss${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5A3D6E"/><stop offset="35%" stop-color="#C9663F"/><stop offset="65%" stop-color="#FFB347"/><stop offset="100%" stop-color="#FFD9A0"/></linearGradient></defs>${_bg(`url(#ss${u})`)}
      <circle cx="200" cy="470" r="56" fill="#FFE28A" opacity="0.95"/>
      ${[520,560,600].map((y,i)=>`<path d="M0 ${y} C 100 ${y-12}, 300 ${y+12}, 400 ${y}" stroke="#8C4560" stroke-width="${10-i*2}" opacity="0.25" fill="none"/>`).join('')}`,
  meadow: (u) => {
    const blades = [[30,760],[70,780],[110,755],[150,775],[190,760],[230,780],[270,758],[310,776],[350,762],[385,778]];
    const blooms = [[50,700,'#FFC93C'],[140,730,'#C9663F'],[220,705,'#3AB0C4'],[300,735,'#FFC93C'],[370,710,'#8C4560'],[90,745,'#FFFFFF'],[260,748,'#FFFFFF']];
    return `<defs><linearGradient id="ms${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EAF6E4"/><stop offset="100%" stop-color="#CDE8C4"/></linearGradient></defs>${_bg(`url(#ms${u})`)}
      ${blades.map(([x,y])=>`<path d="M${x} ${y} C ${x-4} ${y-22}, ${x+6} ${y-30}, ${x+2} ${y-44}" stroke="#6E9B5E" stroke-width="2.5" fill="none"/>`).join('')}
      ${blooms.map(([x,y,c])=>`<circle cx="${x}" cy="${y}" r="5" fill="${c}" opacity="0.9"/>`).join('')}`;
  },
  ocean: (u) => {
    const bubbles = [[60,620,6],[90,560,4],[320,640,7],[350,570,4],[200,690,5],[140,300,4],[280,250,5],[330,340,3],[70,220,5]];
    return `<defs><linearGradient id="od${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#155E7D"/><stop offset="100%" stop-color="#082A40"/></linearGradient></defs>${_bg(`url(#od${u})`)}
      <path d="M120 0 L200 0 L 320 800 L200 800 Z" fill="#7FDBE8" opacity="0.08"/>
      <path d="M230 0 L290 0 L 400 620 L400 800 L340 800 Z" fill="#7FDBE8" opacity="0.06"/>
      ${bubbles.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" stroke="#9BE3EE" stroke-width="1.5" fill="none" opacity="0.5"/>`).join('')}`;
  },
  confetti: () => {
    const bits = [[40,90,20,'#1B4B8F'],[110,60,-30,'#FFC93C'],[200,120,45,'#3AB0C4'],[290,70,10,'#C9663F'],[360,140,-15,'#2E9E5B'],[70,230,60,'#8C4560'],[180,280,-45,'#FFC93C'],[300,240,30,'#1B4B8F'],[30,380,-20,'#3AB0C4'],[140,420,15,'#C9663F'],[250,380,-60,'#2E9E5B'],[350,440,40,'#FFC93C'],[90,540,25,'#1B4B8F'],[210,560,-35,'#8C4560'],[320,590,50,'#3AB0C4'],[50,680,-10,'#FFC93C'],[170,700,35,'#2E9E5B'],[280,720,-50,'#1B4B8F'],[370,690,20,'#C9663F']];
    return `${_bg('#FDFBF4')}${bits.map(([x,y,r,c])=>`<rect x="${x}" y="${y}" width="10" height="5" rx="2" fill="${c}" opacity="0.75" transform="rotate(${r} ${x} ${y})"/>`).join('')}`;
  },
  citrus: (u) => {
    const rounds = [[60,130,70,'#FFB347'],[330,90,55,'#FFC93C'],[370,300,80,'#F2A03D'],[40,420,60,'#FFD36B'],[300,520,75,'#FFB347'],[90,660,85,'#FFC93C'],[350,720,55,'#F2A03D']];
    return `<defs><linearGradient id="cb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF3D0"/><stop offset="100%" stop-color="#FFE1A3"/></linearGradient></defs>${_bg(`url(#cb${u})`)}
      ${rounds.map(([x,y,r,c])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.28"/>`).join('')}`;
  },
  aurora: (u) =>
    `<defs><linearGradient id="as${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0B1430"/><stop offset="100%" stop-color="#12233F"/></linearGradient></defs>${_bg(`url(#as${u})`)}
      <path d="M-20 260 C 80 140, 180 320, 300 180 C 350 120, 400 160, 420 130 L420 260 C 320 340, 200 240, 100 340 C 40 390, -10 340, -20 360 Z" fill="#2E9E5B" opacity="0.30"/>
      <path d="M-20 400 C 90 300, 210 460, 320 330 C 370 275, 410 310, 420 290 L420 420 C 330 500, 190 390, 90 480 C 30 530, -10 480, -20 500 Z" fill="#3AB0C4" opacity="0.24"/>
      <path d="M-20 560 C 100 470, 230 610, 340 500 L420 460 L420 580 C 320 660, 180 560, 80 640 L-20 660 Z" fill="#6B3F7A" opacity="0.22"/>
      ${[[60,90],[160,60],[260,110],[340,70],[40,170],[370,190]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.8" fill="#FFFFFF" opacity="0.8"/>`).join('')}`,
  terracotta: (u) => {
    const arch = (x,y,r) => `M${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y} L${x+r} ${y+r*1.2} L${x-r} ${y+r*1.2} Z`;
    return `<defs><linearGradient id="tb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F6E2CE"/><stop offset="100%" stop-color="#EFC9A8"/></linearGradient></defs>${_bg(`url(#tb${u})`)}
      <path d="${arch(80,120,55)}" fill="#DFA477" opacity="0.4"/><path d="${arch(300,90,70)}" fill="#C97F4E" opacity="0.3"/>
      <path d="${arch(200,330,65)}" fill="#B96A3E" opacity="0.28"/><path d="${arch(60,520,50)}" fill="#C97F4E" opacity="0.34"/>
      <path d="${arch(330,480,60)}" fill="#DFA477" opacity="0.4"/><path d="${arch(160,660,70)}" fill="#C97F4E" opacity="0.3"/>
      <circle cx="350" cy="680" r="26" fill="#B96A3E" opacity="0.3"/>`;
  },
  wildflowers: () => {
    const fl = (x,y,c,s) => `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="0" x2="0" y2="-30" stroke="#7C9165" stroke-width="2"/><circle cx="0" cy="-34" r="6" fill="${c}"/><circle cx="0" cy="-34" r="2.4" fill="#FFF3D0"/></g>`;
    const spots = [[40,150,'#C9663F',1],[110,120,'#3AB0C4',0.8],[340,170,'#FFC93C',1.1],[70,320,'#8C4560',0.9],[280,300,'#FFC93C',0.8],[370,340,'#2E9E5B',1],[140,470,'#3AB0C4',1],[230,440,'#C9663F',0.85],[40,590,'#FFC93C',1],[320,600,'#8C4560',1.1],[180,640,'#2E9E5B',0.8],[90,740,'#C9663F',1],[270,750,'#3AB0C4',0.9],[370,730,'#FFC93C',0.85]];
    return `${_bg('#F9F5EA')}${spots.map(([x,y,c,s])=>fl(x,y,c,s)).join('')}`;
  },
  arcs: () => {
    const set = (cx,cy,colors) => colors.map((c,i)=>`<circle cx="${cx}" cy="${cy}" r="${60+i*26}" stroke="${c}" stroke-width="12" fill="none" opacity="0.5"/>`).join('');
    return `${_bg('#FDF8EF')}${set(0,0,['#FFC93C','#F2A03D','#3AB0C4','#1B4B8F'])}${set(400,800,['#FFC93C','#C9663F','#2E9E5B','#3AB0C4'])}`;
  },
  fireflies: (u) => {
    const flies = [[70,180],[180,120],[300,200],[350,100],[40,320],[230,300],[330,380],[110,430],[270,480],[60,560],[190,600],[340,620],[130,710],[290,730]];
    return `<defs><linearGradient id="db${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#16281F"/><stop offset="100%" stop-color="#0C1A13"/></linearGradient>
      <radialGradient id="gl${u}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFE28A" stop-opacity="0.9"/><stop offset="100%" stop-color="#FFE28A" stop-opacity="0"/></radialGradient></defs>${_bg(`url(#db${u})`)}
      ${flies.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3===0?14:9}" fill="url(#gl${u})"/><circle cx="${x}" cy="${y}" r="2" fill="#FFE28A" opacity="0.95"/>`).join('')}
      <path d="M0 780 C 80 750, 160 790, 240 765 C 310 745, 370 775, 400 760 L400 800 L0 800 Z" fill="#1E3527" opacity="0.9"/>`;
  },
  marble: (u) => {
    const vein = (d,w,o) => `<path d="${d}" stroke="#B9BDC4" stroke-width="${w}" fill="none" opacity="${o}" stroke-linecap="round"/>`;
    return `<defs><linearGradient id="mb${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F4F3F0"/><stop offset="100%" stop-color="#E4E3DE"/></linearGradient></defs>${_bg(`url(#mb${u})`)}
      ${vein('M-20 140 C 90 90, 180 220, 300 150 C 360 118, 410 170, 440 140',3,0.5)}${vein('M-20 150 C 100 110, 190 235, 310 168',1.2,0.35)}
      ${vein('M-20 420 C 120 350, 220 470, 340 400 C 390 372, 420 420, 440 405',3.5,0.45)}${vein('M40 -20 C 80 120, 30 240, 120 360 C 180 440, 120 560, 180 700',2.2,0.4)}
      ${vein('M360 -20 C 320 140, 380 260, 300 380 C 250 456, 330 580, 280 800',2.6,0.4)}${vein('M-20 640 C 110 590, 210 700, 330 630 C 380 602, 420 650, 440 632',3,0.4)}`;
  },
  constellation: (u) => {
    const stars = [[50,90,2.6],[130,60,1.8],[210,120,3],[300,80,2],[360,150,2.4],[70,210,2],[180,250,2.8],[270,210,1.8],[340,290,2.6],[40,340,2.2],[150,380,2.6],[250,350,1.8],[340,420,3],[80,470,2],[200,510,2.8],[310,490,2],[50,590,2.4],[160,630,2],[270,600,2.8],[360,640,2],[110,710,2.2],[300,730,2.6]];
    const links = [[0,1],[1,2],[2,4],[5,6],[6,7],[6,9],[10,11],[11,12],[13,14],[14,15],[16,17],[17,18],[18,19],[20,18]];
    return `<defs><linearGradient id="cs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#12204A"/><stop offset="100%" stop-color="#0A122C"/></linearGradient></defs>${_bg(`url(#cs${u})`)}
      ${links.map(([a,b])=>`<line x1="${stars[a][0]}" y1="${stars[a][1]}" x2="${stars[b][0]}" y2="${stars[b][1]}" stroke="#8AA0D8" stroke-width="1" opacity="0.35"/>`).join('')}
      ${stars.map(([cx,cy,r],i)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${i%5===0?'#FFD98A':'#DCE6FF'}" opacity="${0.7+(i%3)*0.1}"/>`).join('')}`;
  },
  gilded: (u) => {
    const rays = (cx,cy,n,len) => Array.from({length:n},(_,i)=>{const a=(Math.PI/2)*(i/(n-1))+(cx===0?0:Math.PI);return `<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(a)*len}" y2="${cy+Math.sin(a)*len}" stroke="#D9AE48" stroke-width="${i%2?1:2}" opacity="0.4"/>`;}).join('');
    return `<defs><linearGradient id="gb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FCF5DF"/><stop offset="100%" stop-color="#F6EBCB"/></linearGradient></defs>${_bg(`url(#gb${u})`)}
      ${rays(0,0,11,340)}${rays(400,800,11,340)}
      <circle cx="0" cy="0" r="26" stroke="#D9AE48" stroke-width="2" fill="none" opacity="0.5"/><circle cx="400" cy="800" r="26" stroke="#D9AE48" stroke-width="2" fill="none" opacity="0.5"/>`;
  },
  topo: () => {
    const ring = (cx,cy,base,n,color) => Array.from({length:n},(_,i)=>{const r=base+i*20;return `<path d="M${cx-r} ${cy} a ${r} ${r*0.62} 0 1 0 ${r*2} 0 a ${r} ${r*0.62} 0 1 0 ${-r*2} 0" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>`;}).join('');
    return `${_bg('#EDF2EA')}${ring(110,200,26,5,'#A9BE9E')}${ring(320,470,30,5,'#9FB8C0')}${ring(90,660,22,4,'#C2B58E')}`;
  },
  quilt: () => {
    const cell=80, tones=['#E7C24C','#8FB3D9','#D98C5F','#9FC49A','#C89BB4','#E9DCBB'];
    let sq=''; let n=0;
    for(let gy=0;gy<10;gy++)for(let gx=0;gx<5;gx++){const x=gx*cell,y=gy*cell,c=tones[(gx+gy*3+n)%tones.length];sq+=`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${c}" opacity="0.22"/>`+((gx+gy)%2===0?`<path d="M${x} ${y} L${x+cell} ${y+cell}" stroke="${c}" stroke-width="6" opacity="0.16"/>`:'');n++;}
    let grid='';
    for(let i=0;i<=5;i++)grid+=`<line x1="${i*cell}" y1="0" x2="${i*cell}" y2="800" stroke="#B49B72" stroke-width="1" stroke-dasharray="3 4" opacity="0.4"/>`;
    for(let i=0;i<=10;i++)grid+=`<line x1="0" y1="${i*cell}" x2="400" y2="${i*cell}" stroke="#B49B72" stroke-width="1" stroke-dasharray="3 4" opacity="0.4"/>`;
    return `${_bg('#F7EFE0')}${sq}${grid}`;
  },
  blossom: (u) => {
    const petal = (x,y,s,r,c) => `<path d="M${x} ${y} C ${x-8*s} ${y-6*s}, ${x-8*s} ${y-18*s}, ${x} ${y-22*s} C ${x+8*s} ${y-18*s}, ${x+8*s} ${y-6*s}, ${x} ${y} Z" fill="${c}" opacity="0.55" transform="rotate(${r} ${x} ${y})"/>`;
    const spots = [[50,110,1,20,'#FFD98A'],[130,70,0.8,-30,'#FFFFFF'],[250,130,1.1,45,'#AFC9EC'],[330,90,0.9,10,'#FFD98A'],[70,250,1,-15,'#FFFFFF'],[200,290,1.2,60,'#FFD98A'],[320,250,0.9,-45,'#AFC9EC'],[40,400,0.85,25,'#FFFFFF'],[150,440,1,15,'#FFD98A'],[280,400,1.1,-60,'#AFC9EC'],[360,460,0.8,40,'#FFFFFF'],[90,570,1,-20,'#FFD98A'],[220,600,0.9,35,'#AFC9EC'],[330,590,1,-50,'#FFFFFF'],[60,700,1.1,10,'#FFD98A'],[180,730,0.85,-35,'#AFC9EC'],[300,720,1,50,'#FFFFFF']];
    return `<defs><linearGradient id="bl${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F6FAFE"/><stop offset="100%" stop-color="#E8F0F8"/></linearGradient></defs>${_bg(`url(#bl${u})`)}${spots.map(([x,y,s,r,c])=>petal(x,y,s,r,c)).join('')}`;
  },
  harvest: (u) => {
    const leaf = (x,y,s,r,c) => `<path d="M${x} ${y} C ${x-10*s} ${y-8*s}, ${x-6*s} ${y-22*s}, ${x} ${y-26*s} C ${x+6*s} ${y-22*s}, ${x+10*s} ${y-8*s}, ${x} ${y} Z" fill="${c}" opacity="0.5" transform="rotate(${r} ${x} ${y})"/>`;
    const spots = [[60,120,1,20,'#C46B34'],[150,80,0.8,-30,'#D9A038'],[260,130,1.1,45,'#8A8A3A'],[340,90,0.9,10,'#C46B34'],[80,260,1,-15,'#D9A038'],[200,300,1.2,60,'#A6412F'],[320,250,0.9,-45,'#8A8A3A'],[40,410,0.9,25,'#C46B34'],[160,450,1,15,'#D9A038'],[290,410,1.1,-60,'#A6412F'],[360,470,0.8,40,'#8A8A3A'],[90,580,1,-20,'#C46B34'],[220,610,0.9,35,'#D9A038'],[330,600,1,-50,'#A6412F'],[60,710,1.1,10,'#8A8A3A'],[180,740,0.85,-35,'#C46B34'],[300,730,1,50,'#D9A038']];
    return `<defs><linearGradient id="hb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FAEDD4"/><stop offset="100%" stop-color="#F0DCB6"/></linearGradient></defs>${_bg(`url(#hb${u})`)}${spots.map(([x,y,s,r,c])=>leaf(x,y,s,r,c)).join('')}`;
  },
  rainfall: (u) => {
    let drops='';
    for(let i=0;i<46;i++){const x=(i*71)%400,y=(i*137)%780,len=16+(i%4)*8;drops+=`<line x1="${x}" y1="${y}" x2="${x-4}" y2="${y+len}" stroke="#7C93AD" stroke-width="1.5" opacity="0.3" stroke-linecap="round"/>`;}
    return `<defs><linearGradient id="rb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E4EBF2"/><stop offset="100%" stop-color="#CDD8E2"/></linearGradient></defs>${_bg(`url(#rb${u})`)}
      ${[133,267].map((x)=>`<line x1="${x}" y1="0" x2="${x}" y2="800" stroke="#AEBECE" stroke-width="2" opacity="0.35"/>`).join('')}
      ${[200,400,600].map((y)=>`<line x1="0" y1="${y}" x2="400" y2="${y}" stroke="#AEBECE" stroke-width="2" opacity="0.35"/>`).join('')}${drops}`;
  },
};
// The inner SVG string for a theme kind, or '' for an unknown/absent kind.
function backdropSVG(kind) {
  const gen = BACKDROPS[kind];
  return gen ? _wrap(gen('_' + (_bdUid++))) : '';
}

// A fixed, behind-everything layer painting the owner's chosen journey theme:
// the flat base color + the generative pattern on top. Opaque moment cards
// sit above it, so the pattern only ever shows in the gaps.
function journeyBackdropHTML(owner) {
  const t = bgTheme(owner?.journeyBg);
  return `<div class="jbackdrop ${t.dark ? 'dark' : ''}" style="background:${t.color}" aria-hidden="true">${backdropSVG(t.kind)}</div>`;
}

// Set (or clear) the journey-wide default font/color CSS variables on a
// timeline host, from the owner's stored per-field choices. Only real choices
// are set; anything left at 'classic'/'default' falls back to the card scheme.
function applyThemeVars(host, owner) {
  const set = (name, val) => (val ? host.style.setProperty(name, val) : host.style.removeProperty(name));
  for (const f of STYLE_FIELDS) {
    set(`--jt-${f.key}-font`, fontCss(owner?.[`${f.key}Font`]));
    set(`--jt-${f.key}-color`, fontColorHex(owner?.[`${f.key}FontColor`]));
  }
  // Journey-wide look: photo mat, reading text size, and accent chrome.
  const mat = photoMat(owner?.journeyPhotoMat);
  host.style.setProperty('--jt-mat-color', mat.key === 'none' ? 'transparent' : mat.color);
  host.style.setProperty('--jt-mat-pad', `${mat.pad}px`);
  host.style.setProperty('--jt-mat-bottom', `${mat.bottom}px`);
  host.style.setProperty('--jt-text-scale', String(textScaleVal(owner?.journeyTextScale)));
  host.style.setProperty('--jt-accent', journeyAccentOf(owner));
}

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
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
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
            <div class="field"><label>Your name</label><input name="name" autocomplete="name" maxlength="${LIMITS.name}" required></div>
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
    ${u.coverUrl ? `<div class="jcover"><img src="${esc(u.coverUrl)}" alt=""></div>` : ''}
    <div class="monument">
      <div class="monument-top">
        <div class="monument-photo">${photoInner}</div>
        ${wheel ? `<div class="wheel-wrap">${wheel}</div>` : ''}
      </div>
      ${wheel && isSelf ? '<div style="text-align:center;margin:-8px 0 6px;"><a href="#/profile/edit" style="font-size:0.85rem;color:var(--muted);">Customize your wheel &amp; photos →</a></div>' : ''}
      <h1>${esc(u.name || 'Unnamed')}</h1>
      <div class="handle">@${esc(u.handle || '')}</div>
      <div>${business ? '<span class="chip">Business</span>' : ''}${sealed ? '<span class="chip sealed">✦ Kept as they left it</span>' : ''}</div>
      ${u.epitaph ? `<div class="epitaph">“${esc(u.epitaph)}”</div>` : isSelf ? `<div class="epitaph muted"><a href="#/profile/edit">+ add an epitaph</a></div>` : ''}
      ${birthBits.length ? `<div class="birthline">${bornWord} ${esc(birthBits.join(' · '))}</div>` : ''}
      ${u.currentLocation ? `<div class="rooted"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg><span>Rooted in ${esc(u.currentLocation)}</span></div>` : isSelf ? `<div class="rooted muted"><a href="#/profile/edit">+ where you're rooted now</a></div>` : ''}
      ${u.bio ? `<p style="max-width:480px;margin:14px auto 0;">${esc(u.bio)}</p>` : isSelf ? `<p class="muted" style="margin-top:10px;"><a href="#/profile/edit">+ add a short bio</a></p>` : ''}
      ${u.links && u.links.length ? `<div class="prof-links">${u.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="prof-link">${esc(l.label || l.url)}</a>`).join('')}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="n">${moments.length}</div><div class="l">Moments</div></div>
        <div class="stat"><div class="n">${years}</div><div class="l">Years</div></div>
        <div class="stat"><div class="n">${circleCount}</div><div class="l">Circle</div></div>
      </div>
    </div>`;
}

// ---- Timeline --------------------------------------------------------------
const isVideoUrl = (u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || '');
const mediaTag = (url) => (isVideoUrl(url) ? `<video src="${esc(url)}" controls preload="metadata"></video>` : `<img src="${esc(url)}" loading="lazy" alt="">`);

// The central thread — the vertical journey "line". It was the format's one
// locked, iconic element (a white ribbon with a blue helix coiling around it,
// like a snake around a sword) until Brandon opened it to customization on
// 2026-08-10. Each style tiles one SVG pattern period seamlessly down the whole
// journey, any length. Kept in lockstep with the mobile renderer (ThreadPaint /
// resolveLine in components/journey.js + lib/journeyTheme.js). The month/year
// date tabs stay fixed — only the line is customizable.
const JOURNEY_LINES = [
  { key: 'ribbon', label: 'Ribbon' },
  { key: 'thread', label: 'Thread' },
  { key: 'rope', label: 'Rope' },
  { key: 'beads', label: 'Beads' },
  { key: 'stitch', label: 'Stitched' },
  { key: 'vine', label: 'Vine' },
];
const LINE_W = 18, LINE_CX = 9;
// One period of a vertical sine as an SVG path string, centered on cx; starts
// and ends at cx with matching slope so pattern tiles join into a smooth wave.
function lineWave(cx, amp, period, phase) {
  let d = '';
  for (let y = 0; y <= period; y += 3) {
    const x = cx + Math.sin((y / period) * Math.PI * 2 + phase) * amp;
    d += (y === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y + ' ';
  }
  return d.trim();
}
function lineLeaf(cx, y, side) {
  const x = cx + Math.sin((y / 48) * Math.PI * 2) * 5;
  const lx = x + side * 2;
  return `<ellipse cx="${lx.toFixed(2)}" cy="${y}" rx="6" ry="3.2" fill="#6FA24A" transform="rotate(${side * 32} ${lx.toFixed(2)} ${y})"/>`;
}
// The SVG for the owner's chosen line style, tinted by their accent where the
// style is color-led (thread/beads/stitch). `uid` keeps pattern ids unique when
// several previews render on one page (the Edit Journey picker).
function lineSvg(owner, uid = '') {
  const key = (owner && owner.journeyLine) || 'ribbon';
  const a = journeyAccentOf(owner);
  const id = 'jl' + uid;
  const open = `<svg width="${LINE_W}" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;
  if (key === 'thread')
    return `${open}<rect x="${LINE_CX - 1.5}" width="3" height="100%" rx="1.5" fill="${a}"/></svg>`;
  if (key === 'rope')
    return `${open}<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${LINE_W}" height="18"><path d="${lineWave(LINE_CX, 4, 18, 0)}" stroke="#B98A3C" stroke-width="3.4" fill="none"/><path d="${lineWave(LINE_CX, 4, 18, Math.PI)}" stroke="#7E5B2C" stroke-width="3.4" fill="none"/></pattern></defs><rect width="${LINE_W}" height="100%" fill="url(#${id})"/></svg>`;
  if (key === 'beads')
    return `${open}<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${LINE_W}" height="22"><circle cx="${LINE_CX}" cy="11" r="5" fill="${a}" stroke="#FBF3DA" stroke-width="1.5"/></pattern></defs><rect x="${LINE_CX - 1}" width="2" height="100%" fill="#D9C79A"/><rect width="${LINE_W}" height="100%" fill="url(#${id})"/></svg>`;
  if (key === 'stitch')
    return `${open}<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${LINE_W}" height="16"><rect x="${LINE_CX - 1.5}" y="0" width="3" height="9" rx="1.5" fill="${a}"/></pattern></defs><rect width="${LINE_W}" height="100%" fill="url(#${id})"/></svg>`;
  if (key === 'vine')
    return `${open}<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${LINE_W}" height="48"><path d="${lineWave(LINE_CX, 5, 48, 0)}" stroke="#4E7A3A" stroke-width="3" fill="none"/>${lineLeaf(LINE_CX, 12, 1)}${lineLeaf(LINE_CX, 36, -1)}</pattern></defs><rect width="${LINE_W}" height="100%" fill="url(#${id})"/></svg>`;
  // Ribbon (default): white core, pale edge, coiling blue helix.
  const dots = Array.from({ length: 8 }, (_, i) => {
    const t = (i / 8) * Math.PI * 2;
    const along = ((i + 0.5) / 8) * 40;
    const across = 5.5 + Math.sin(t) * 4.3;
    const depth = (Math.cos(t) + 1) / 2;
    return `<circle cx="${(across + 3.5).toFixed(2)}" cy="${along.toFixed(2)}" r="${(0.9 + depth * 0.9).toFixed(2)}" fill="#1B4B8F" opacity="${(0.28 + depth * 0.55).toFixed(2)}"/>`;
  }).join('');
  return `${open}<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${LINE_W}" height="40">${dots}</pattern></defs><rect x="4.5" width="9" height="100%" rx="3" fill="#FFFDF8" stroke="#E9DFC4" stroke-width="1"/><rect width="${LINE_W}" height="100%" fill="url(#${id})"/></svg>`;
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
  if (photos.length === 1) media = `<figure class="jhero one">${mediaTag(photos[0])}${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  else if (photos.length >= 2) media = `<div class="jcarousel">${photos.slice(0, 10).map((p) => `<div class="jslide">${mediaTag(p)}</div>`).join('')}</div>`;
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
  let html = '<div class="journey"><div class="spine">' + lineSvg(owner) + '</div>' +
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

// Does a moment match a free-text query? Searches everything a person would
// scan for by eye — title, caption, story, place, companions, the year. Every
// whitespace-separated term must appear (AND), so "maine 2009" narrows.
const momentMatches = (m, q) => {
  if (!q) return true;
  const hay = [m.title, m.caption, m.story, placeLabel(m), m.location, String(m.year || ''), ...((m.tags || []).map((t) => t.label)), ...(m.topics || [])]
    .filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((term) => hay.includes(term));
};

const viewChipsHTML = (id) =>
  `<div class="jvtools">
     <div class="viewrow" id="${id}">${JOURNEY_VIEWS.map((v) => `<button class="viewchip ${v.key === 'all' ? 'active' : ''}" data-view="${v.key}">${v.label}</button>`).join('')}</div>
     <label class="jsearch" title="Search this journey">${icon('search', 16)}<input type="search" id="${id}-q" class="jsearch-input" placeholder="Search this journey…" autocomplete="off"></label>
   </div>`;

// Mount a timeline that re-renders when the All / Solo / With-Companions filter
// changes. Photo shape follows the journey owner's chosen shape.
function mountFilteredTimeline(hostId, chipsId, moments, owner) {
  let view = 'all';
  let query = '';
  const shape = (PHOTO_SHAPES.find((s) => s.key === owner?.journeyPhotoShape) || PHOTO_SHAPES[0]).r;
  const render = () => {
    const filtered = filterByView(moments, view).filter((m) => momentMatches(m, query));
    const host = el(hostId);
    host.style.setProperty('--photo-radius', shape);
    applyThemeVars(host, owner);
    host.innerHTML = filtered.length ? timelineHTML(filtered, owner)
      : query ? `<div class="empty">No moments match “${esc(query)}”.</div>`
      : `<div class="empty">${view === 'solo' ? 'No solo moments yet — nothing without a companion tagged.' : view === 'companions' ? 'No moments with companions yet — nothing here has a tag.' : 'No moments yet.'}</div>`;
    attachMomentClicks();
    document.querySelectorAll(`#${chipsId} .viewchip`).forEach((c) => c.classList.toggle('active', c.dataset.view === view));
  };
  document.querySelectorAll(`#${chipsId} .viewchip`).forEach((c) => (c.onclick = () => { view = c.dataset.view; render(); }));
  const q = el(`${chipsId}-q`);
  if (q) q.oninput = () => { query = q.value.trim(); render(); };
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
    ${journeyBackdropHTML(state.user)}
    <div class="wrap journeywide">
      ${monumentHTML(state.user, moments, circleCount, true)}
      ${moments.length ? journeySummary(moments) : ''}
      ${moments.length ? timelineMapHTML(moments, state.user) : ''}
      ${!sealed ? `<div class="btn-row"><a class="btn" href="#/add">+ Add a moment</a><a class="btn ghost" href="#/profile/customize">✦ Edit Journey</a><a class="btn ghost" href="#/profile/edit">Edit profile</a></div>` : ''}
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

// Small round-button glyphs, reused in the template and the toggle handler.
const CIRCLE_PLUS_SVG = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
const CIRCLE_CHECK_SVG = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.4 12.4l2.4 2.4 4.8-5.2"/></svg>';
const TRIDOT_SVG = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="4.5" r="1.7" fill="currentColor"/><circle cx="5.5" cy="13.5" r="1.7" fill="currentColor"/><circle cx="14.5" cy="13.5" r="1.7" fill="currentColor"/></svg>';

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
    ${journeyBackdropHTML(u)}
    <div class="wrap journeywide">
      <div class="pv-topbar">
        <a class="back" href="#/world" style="margin:0;">← World</a>
        <div class="pv-actions">
          <button class="round-btn ${inCircle ? 'in' : ''}" id="circle-btn" title="${inCircle ? 'In your Circle' : 'Add to Circle'}" aria-label="${inCircle ? 'In your Circle' : 'Add to Circle'}">${inCircle ? CIRCLE_CHECK_SVG : CIRCLE_PLUS_SVG}</button>
          <button class="round-btn" id="pv-more" title="More" aria-label="More options" aria-haspopup="true">${TRIDOT_SVG}</button>
          <div class="more-menu" id="pv-menu" hidden>
            <button class="more-item" id="share-btn"><i>↗</i> Send / Request</button>
            <button class="more-item" id="report-btn"><i>⚑</i> Report</button>
            <button class="more-item danger" id="block-btn"><i>⊘</i> Block</button>
          </div>
        </div>
      </div>
      ${monumentHTML(u, moments, circleCount, false)}
      ${moments.length ? journeySummary(moments) : ''}
      ${moments.length ? timelineMapHTML(moments, u) : ''}
      <div class="section-title" style="text-align:center;">${esc(u.name?.split(' ')[0] || 'Their')}'s Journey</div>
      ${moments.length ? `${viewChipsHTML('pv-chips')}${decadeRailHTML(moments)}<div id="pv-host"></div>` : '<div class="empty">No moments yet.</div>'}
      ${appFooter()}
    </div>`;
  if (moments.length) { mountFilteredTimeline('pv-host', 'pv-chips', moments, u); wireJumpNav(moments); }
  startAvatarRotation(u);
  // Toggle Circle membership IN PLACE — updating just the button (and the
  // Circle stat) instead of re-rendering the whole page, which would reset the
  // scroll position back to the top.
  let inCircleNow = inCircle;
  const circleBtn = $('#circle-btn');
  circleBtn.onclick = async () => {
    circleBtn.disabled = true;
    try {
      if (inCircleNow) await api.removeFromCircle(state.user.id, u.id);
      else await api.addToCircle(state.user, u.id);
      inCircleNow = !inCircleNow;
      circleBtn.classList.toggle('in', inCircleNow);
      circleBtn.innerHTML = inCircleNow ? CIRCLE_CHECK_SVG : CIRCLE_PLUS_SVG;
      circleBtn.title = inCircleNow ? 'In your Circle' : 'Add to Circle';
      circleBtn.setAttribute('aria-label', circleBtn.title);
      // Keep their Circle count (3rd monument stat) in sync without a reload.
      const countEl = root().querySelectorAll('.monument .stat .n')[2];
      if (countEl) { const n = parseInt(countEl.textContent, 10); if (!Number.isNaN(n)) countEl.textContent = String(Math.max(0, n + (inCircleNow ? 1 : -1))); }
    } catch (e) { alert(e.message); }
    finally { circleBtn.disabled = false; }
  };
  // The tri-dot menu: Send / Request, Report, Block — tucked out of the way.
  const pvMore = $('#pv-more'), pvMenu = $('#pv-menu');
  if (pvMore && pvMenu) {
    pvMore.onclick = (e) => {
      e.stopPropagation();
      const willOpen = pvMenu.hidden;
      pvMenu.hidden = !willOpen;
      if (willOpen) {
        const closeOnce = () => { pvMenu.hidden = true; document.removeEventListener('click', closeOnce); };
        setTimeout(() => document.addEventListener('click', closeOnce), 0);
      }
    };
  }
  const closeMenu = () => { if (pvMenu) pvMenu.hidden = true; };
  $('#share-btn').onclick = () => { closeMenu(); openShareModal(u, 'send'); };
  $('#report-btn').onclick = () => { closeMenu(); openReport({ reportedUserId: u.id, label: `@${u.handle}` }); };
  $('#block-btn').onclick = async () => {
    closeMenu();
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

// Browser geolocation for "Places near you", best-effort. Resolves null on
// decline / no support / timeout — the caller then shows the global list.
function getBrowserCoords(timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false }
    );
  });
}

// "City, State" in the US, "City, Country" elsewhere — mirrors the mobile
// placeLabel() so a place reads the same on both clients.
function placeLabelWeb(city, region, country) {
  if (!city) return '';
  const isUS = /^(united states|united states of america|usa|us)$/i.test(country || '');
  const qualifier = isUS ? region || country : country || region;
  return qualifier && qualifier !== city ? `${city}, ${qualifier}` : city;
}

const placeHash = (pl) =>
  `#/place/${encodeURIComponent(pl.city || '')}/${encodeURIComponent(pl.region || '')}/${encodeURIComponent(pl.country || '')}`;

const yearsAgoWeb = (n) => (n == null ? '' : n <= 0 ? 'Earlier today' : `${n} ${n === 1 ? 'year' : 'years'} ago today`);

function renderOnThisDay(list) {
  const w = $('#otd-wrap');
  if (!w) return;
  if (!list || !list.length) { w.innerHTML = ''; return; }
  w.innerHTML = `<div class="eyebrow" style="font-size:1.3rem;">📅 On this day, across lives</div>
    <div class="muted" style="margin:-2px 0 8px;font-size:0.9rem;">Moments from other lives, on today's date</div>
    <div class="hstrip">${list.map((m) => `<div class="otd-card" data-moment="${esc(m.momentId)}">
      ${m.photoUrl ? `<div class="otd-photo"><img src="${esc(m.photoUrl)}" loading="lazy" alt=""></div>`
        : `<div class="otd-photo otd-photo-empty">${esc(String(m.year || ''))}</div>`}
      <div class="otd-b"><div class="otd-ago">${esc(yearsAgoWeb(m.yearsAgo))}</div>
        <div class="otd-t">${esc(m.title || m.caption || 'A moment')}</div>
        <div class="otd-w">${esc(m.name || '')}</div></div>
    </div>`).join('')}</div>`;
  w.querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
}

function renderFeatured(f) {
  const w = $('#featured-wrap');
  if (!w) return;
  if (!f) { w.innerHTML = ''; return; }
  const span = f.firstYear && f.lastYear && f.firstYear !== f.lastYear ? `${f.firstYear} – ${f.lastYear}` : String(f.firstYear || f.lastYear || '');
  const foot = [`${f.momentCount} ${f.momentCount === 1 ? 'moment' : 'moments'}`, span, f.hometown].filter(Boolean).join('  ·  ');
  w.innerHTML = `<div class="eyebrow" style="font-size:1.3rem;">✦ Featured life of the week</div>
    <div class="feat" data-handle="${esc(f.handle)}">
      <div class="feat-top">
        <div class="feat-pfp">${f.avatarUri ? `<img src="${esc(f.avatarUri)}" alt="">` : esc(initials(f.name))}</div>
        <div class="feat-id"><div class="feat-name">${esc(f.name)}</div>
          <div class="feat-hd">@${esc(f.handle)}${f.accountType === 'business' ? ' · Business' : ''}</div></div>
      </div>
      ${f.epitaph ? `<div class="feat-epi">“${esc(f.epitaph)}”</div>` : ''}
      ${f.photos.length ? `<div class="feat-strip">${f.photos.map((u) => `<img src="${esc(u)}" loading="lazy" alt="">`).join('')}</div>` : ''}
      <div class="feat-foot">${esc(foot)}</div>
    </div>`;
  w.querySelector('.feat').onclick = () => nav(`#/u/${f.handle}`);
}

function renderPlaces(list, nearby) {
  const w = $('#places-wrap');
  if (!w) return;
  if (!list || !list.length) { w.innerHTML = ''; return; }
  w.innerHTML = `<div class="eyebrow" style="font-size:1.3rem;">📍 ${nearby ? 'Places near you' : 'Cities with the most moments'}</div>
    <div class="muted" style="margin:-2px 0 8px;font-size:0.9rem;">${nearby ? 'Memories logged around where you are' : 'Where lives are being recorded'}</div>
    <div class="hstrip">${list.map((pl) => `<div class="place-card" data-place="${esc(placeHash(pl))}">
      ${pl.samplePhoto ? `<div class="pc-photo"><img src="${esc(pl.samplePhoto)}" loading="lazy" alt=""></div>`
        : `<div class="pc-photo pc-photo-empty">📍</div>`}
      <div class="pc-b"><div class="pc-city">${esc(pl.city)}</div>
        <div class="pc-meta">${pl.momentCount} ${pl.momentCount === 1 ? 'moment' : 'moments'}${pl.distanceKm != null ? ` · ${Math.max(1, Math.round(pl.distanceKm))} km` : ''}</div></div>
    </div>`).join('')}</div>`;
  w.querySelectorAll('[data-place]').forEach((c) => (c.onclick = () => nav(c.getAttribute('data-place'))));
}

// A single real place, with every moment logged there across all lives — the
// tap-through from the Places strip on the World page.
async function viewPlace(cityEnc, regionEnc, countryEnc) {
  const city = decodeURIComponent(cityEnc || '');
  const region = decodeURIComponent(regionEnc || '');
  const country = decodeURIComponent(countryEnc || '');
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('world', unread);
  setLoading();
  const list = await api.getMomentsAtPlace(city, region || null, country || null, state.blocked).catch(() => []);
  const label = placeLabelWeb(city, region, country) || city;
  const rows = list.map((m) => `<div class="person" data-moment="${esc(m.momentId)}">
      <div class="feed-thumb sm">${m.photoUrl ? `<img src="${esc(m.photoUrl)}" loading="lazy" alt="">` : '📍'}</div>
      <div class="who"><div class="nm">${esc(m.title || m.caption || 'A moment')}</div>
        <div class="hd"><a href="#/u/${esc(m.handle)}" onclick="event.stopPropagation()">${esc(m.name)}</a>${m.year ? ' · ' + esc(String(m.year)) : ''}</div></div>
      <div style="color:var(--blue);font-size:1.4rem;">›</div></div>`).join('');
  root().innerHTML = `<div class="wrap">
    <div class="eyebrow">World</div>
    <div class="section-title" style="margin-top:2px;">📍 ${esc(label)}</div>
    <div class="muted" style="margin-bottom:14px;">${list.length} ${list.length === 1 ? 'moment' : 'moments'} recorded here, across lives</div>
    ${rows || '<div class="empty">No moments here yet.</div>'}
    <div style="margin-top:16px;"><a class="btn ghost" href="#/world">← Back to World</a></div>
    ${appFooter()}</div>`;
  root().querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
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
      <div id="otd-wrap"></div>
      <div id="featured-wrap"></div>
      <div id="places-wrap"></div>
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

  // The discovery strips populate independently (fire-and-forget) so nothing —
  // least of all the up-to-6s geolocation prompt — holds up search results.
  // On this day, across lives — moments from other lives on today's date.
  api.getOnThisDay(state.user, state.blocked).then(renderOnThisDay).catch(() => {});
  // Featured life of the week — one journey, same for everyone all week.
  api.getFeaturedLife(state.blocked).then(renderFeatured).catch(() => {});
  // Places near you (or global top cities). Ask the browser for coordinates;
  // a decline quietly falls back to the worldwide list.
  getBrowserCoords()
    .then((coords) =>
      api.getPlacesNear(coords?.lat ?? null, coords?.lng ?? null).then((list) => renderPlaces(list, !!coords))
    )
    .catch(() => {});
  let worldFilter = 'all';
  let lastQuery = '';
  const doSearch = async (q) => {
    lastQuery = q;
    $('#results').innerHTML = '<div class="spinner"></div>';
    let people = (await api.searchOthers(state.user.id, q)).filter((u) => !state.blocked.has(u.id));
    if (worldFilter !== 'all') people = people.filter((u) => (u.accountType || 'personal') === worldFilter);
    // Topic search across everyone's moments (private tags, never displayed on
    // the moment — only surfaced here as discovery).
    const topicMoments = q.trim() ? await api.searchMomentsByTopic(q, state.blocked) : [];
    const topicHTML = topicMoments.length
      ? `<div class="section-title">Moments tagged “${esc(q.trim())}”</div>` +
        topicMoments.slice(0, 12).map((m) => `<div class="person" data-moment="${esc(m.id)}">
          <div class="pfp">🔖</div>
          <div class="who"><div class="nm">${esc(m.title || m.caption || 'A moment')}</div><div class="hd">${esc(String(m.year || ''))}</div></div>
          <div style="color:var(--blue);font-size:1.4rem;">›</div></div>`).join('')
      : '';
    const peopleHTML = people.length
      ? `<div class="section-title">${q ? 'People' : 'Recently joined'}</div>` + people.map(personRowHTML).join('')
      : topicMoments.length ? ''
      : '<div class="empty">No one found. Try another name.</div>';
    $('#results').innerHTML = topicHTML + peopleHTML;
    $('#results').querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
    $('#results').querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
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
// A pale favorite color leaves the white book text unreadable — nudge any light
// accent to a deep slate so every spine reads as a real cover. Mirrors the app's
// coverColor() in CircleScreen.
function shelfCoverColor(u) {
  const hex = u.journeyAccent || u.favoriteColor || '';
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#39445A';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#39445A' : hex;
}
// The little life-span line on a book — all from the profile, no query.
function shelfSpan(u) {
  if (!u.birthYear) return '';
  if (u.accountType === 'business') return `Founded ${u.birthYear}`;
  if (u.memorialState === 'sealed') {
    const end = u.sealedAt ? new Date(u.sealedAt).getFullYear() : '';
    return `${u.birthYear} – ${end || 'present'}`;
  }
  return `${u.birthYear} – present`;
}
// One life on the shelf: cover (or accent wash), name, epitaph, span, moment
// count, and where they're rooted now. A doorway — the whole book opens their
// Journey.
function lifebookHTML(u, count) {
  const accent = shelfCoverColor(u);
  const span = shelfSpan(u);
  const meta = [span, count > 0 ? `${count} ${count === 1 ? 'moment' : 'moments'}` : ''].filter(Boolean).join('  ·  ');
  const cover = u.coverUrl
    ? `<div class="lb-cover" style="background-image:url('${esc(u.coverUrl)}')"></div>`
    : `<div class="lb-cover" style="background:${accent}"></div><div class="lb-ghost">${esc(initials(u.name || '?'))}</div>`;
  return `<div class="lifebook" data-handle="${esc(u.handle || '')}">
    ${cover}
    <div class="lb-spine" style="background:${accent}"></div>
    ${u.accountType === 'business' ? '<div class="lb-biz">Business</div>' : ''}
    <div class="lb-band">
      <div class="lb-name">${esc(u.name || 'Unnamed')}</div>
      ${u.epitaph ? `<div class="lb-epi">“${esc(u.epitaph)}”</div>` : ''}
      ${meta ? `<div class="lb-meta">${esc(meta)}</div>` : ''}
      ${u.currentLocation ? `<div class="lb-rooted"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg><span>Rooted in ${esc(u.currentLocation)}</span></div>` : ''}
    </div>
  </div>`;
}

async function viewCircle() {
  const unread = await api.unreadCount(state.user.id).catch(() => 0);
  renderTopbar('circle', unread);
  setLoading();
  const pairs = await api.fetchCircleOf(state.user.id);
  const ids = [...new Set(pairs.map((p) => (p.a === state.user.id ? p.b : p.a)))].filter((id) => !state.blocked.has(id));
  const people = [];
  for (const id of ids) { const u = await api.fetchUserById(id); if (u) people.push(u); }
  people.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const counts = ids.length ? await api.getCircleMomentCounts(ids) : {};
  root().innerHTML = `
    <div class="wrap">
      <div class="section-title">Your Circle</div>
      ${people.length
        ? `<p class="muted" style="margin-top:-6px;">${people.length} ${people.length === 1 ? 'life' : 'lives'} you keep close — a shelf of doorways into other Journeys.</p>
           <div class="shelf">${people.map((u) => lifebookHTML(u, counts[u.id] || 0)).join('')}</div>`
        : `<div class="empty"><div class="big">✦</div>Your Circle is empty.<br>Find people in the <a href="#/world">World</a>.</div>`}
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
    if (n.type === 'share') return `${who} shared “${esc(n.memoryTitle || 'a moment')}” with you${n.body ? `: “${esc(n.body)}”` : ''}`;
    if (n.type === 'circle') return `${who} added you to their Circle`;
    if (n.type === 'memorial') return `${esc(n.body || 'A memorial notice')}`;
    if (n.type === 'keeper_request' || n.type === 'keeper_confirmed' || n.type === 'keeper_declined')
      return `${esc(n.body || who + ' — a Keeper update')}`;
    return `${who} sent you a notification`;
  };
  root().innerHTML = `
    <div class="wrap">
      <div class="section-title">Notifications</div>
      ${notes.length ? notes.map((n) => {
        const keeper = (n.type || '').startsWith('keeper_');
        const attr = keeper ? 'data-nav="#/settings"' : n.memoryId ? `data-moment="${esc(n.memoryId)}"` : n.fromHandle ? `data-handle="${esc(n.fromHandle)}"` : '';
        return `<div class="notif ${n.read ? '' : 'unread'}" ${attr} style="cursor:${attr ? 'pointer' : 'default'}">
          <div class="notif-av">${avatarImg({ avatarUri: n.fromAvatarUri, name: n.fromName || '?' }, 'na-img')}</div>
          <div class="notif-body"><div>${line(n)}</div><div class="muted" style="font-size:0.8rem;margin-top:3px;">${timeAgo(n.createdAt)}</div></div></div>`;
      }).join('')
        : '<div class="empty"><div class="big">🔔</div>No notifications yet.</div>'}
      ${appFooter()}
    </div>`;
  root().querySelectorAll('[data-moment]').forEach((c) => (c.onclick = () => nav(`#/moment/${c.getAttribute('data-moment')}`)));
  root().querySelectorAll('[data-handle]').forEach((c) => (c.onclick = () => nav(`#/u/${c.getAttribute('data-handle')}`)));
  root().querySelectorAll('[data-nav]').forEach((c) => (c.onclick = () => nav(c.getAttribute('data-nav'))));
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
    <div class="wrap" id="moment-detail">
      <a class="back" href="${isOwner ? '#/journey' : `#/u/${esc(owner?.handle || '')}`}">← Back</a>
      <div class="datetab" style="font-size:1.4rem">${esc(fullDate(m))}</div>
      <div class="panel" style="border-top-left-radius:0;position:relative;">
        <div class="more-wrap">
          <button class="moredots" id="more-btn" aria-label="More options" aria-haspopup="true"><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="4.5" r="1.7"/><circle cx="5.5" cy="13.5" r="1.7"/><circle cx="14.5" cy="13.5" r="1.7"/></svg></button>
          <div class="more-menu" id="more-menu" hidden>
            <button class="more-item" id="share-moment"><i>↗</i> Share</button>
            ${!isOwner ? `<button class="more-item danger" id="report-moment"><i>⚑</i> Report</button>` : ''}
          </div>
        </div>
        ${owner ? `<div class="muted" style="margin-bottom:8px;">A moment from <a href="#/u/${esc(owner.handle)}">${esc(owner.name)}</a>${m.milestone && MILESTONE_ICON[m.milestone] ? ' · ' + MILESTONE_ICON[m.milestone] : ''}</div>` : ''}
        ${m.title ? `<h1 style="color:var(--blue);margin:0 0 6px;font-size:calc(2rem * var(--jt-text-scale,1));">${esc(m.title)}</h1>` : ''}
        ${m.caption ? `<div style="font-size:calc(1.12rem * var(--jt-text-scale,1));color:var(--muted);">${esc(m.caption)}</div>` : ''}
        ${photosHTML}
        ${m.story ? `<p style="white-space:pre-wrap;margin-top:14px;font-size:calc(1.08rem * var(--jt-text-scale,1));">${esc(m.story)}</p>` : ''}
        ${m.audioUrl ? `<audio controls src="${esc(m.audioUrl)}" style="width:100%;margin-top:12px;"></audio>` : ''}
        ${loc ? `<div class="m-loc" style="color:var(--muted);margin-top:12px;">📍 ${m.placeLat ? `<a href="https://maps.google.com/?q=${m.placeLat},${m.placeLng}" target="_blank" rel="noopener">${esc(loc)}</a>` : esc(loc)}</div>` : ''}
        ${(m.tags || []).length ? `<div class="tags" style="margin-top:14px;">${m.tags.map((t) => `<span class="tag witnessed" style="background:${t.confirmed ? 'var(--gold)' : 'rgba(27,75,143,0.1)'};color:var(--blue-deep)">${t.confirmed ? '✓ ' : ''}${esc(t.label)}</span>`).join('')}</div>` : ''}
        <div class="btn-row" style="justify-content:flex-start;margin-top:18px;">
          ${canConfirm ? `<button class="btn gold sm" id="confirm-tag">✓ I was there</button>` : ''}
          ${!isOwner && !adoptedCopyId && myTag && myTag.confirmed ? `<button class="btn ghost sm" id="adopt">+ Add to my Journey</button>` : ''}
          ${!isOwner && adoptedCopyId ? `<a class="btn ghost sm" href="#/moment/${esc(adoptedCopyId)}">In your Journey ✓</a>` : ''}
          ${!isOwner && myTag && !frozen ? `<button class="btn ghost sm" id="add-side">+ Add your side</button>` : ''}
          ${isOwner && !frozen ? `<a class="btn ghost sm" href="#/edit/${esc(m.id)}">Edit</a><button class="btn danger sm" id="del-moment">Delete</button>` : ''}
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
        <form id="comment-form" style="display:flex;gap:8px;margin-bottom:16px;"><input name="text" maxlength="${LIMITS.comment}" placeholder="Leave a comment…" style="flex:1" required><button class="btn" type="submit">Post</button></form>`}
      <div id="comments">${comments.length ? comments.map((c) => `<div class="comment"><span class="who">${esc(c.name)}</span>${c.pinned ? ' 📌' : ''}<span class="when">${timeAgo(c.createdAt)}</span><div>${esc(c.text)}</div>${(isOwner || c.userId === state.user.id) ? `<div class="comment-tools">${isOwner ? `<button class="linkbtn" data-pin="${esc(c.id)}" data-pinned="${c.pinned ? 1 : 0}">${c.pinned ? 'Unpin' : 'Pin'}</button>` : ''}<button class="linkbtn" data-delc="${esc(c.id)}">Delete</button></div>` : ''}</div>`).join('') : '<div class="muted">No comments yet.</div>'}</div>
      ${appFooter()}
    </div>`;
  // The opened moment inherits its Journey's look — reading text size, photo mat,
  // and photo shape — so it matches the tree it came from.
  const mdHost = el('moment-detail');
  if (mdHost) {
    applyThemeVars(mdHost, owner);
    mdHost.style.setProperty('--photo-radius', (PHOTO_SHAPES.find((s) => s.key === owner?.journeyPhotoShape) || PHOTO_SHAPES[0]).r);
  }
  if (isOwner && !frozen) {
    const del = $('#del-moment');
    if (del) del.onclick = async () => { if (!confirm('Delete this moment? This cannot be undone.')) return; await api.deleteMemory(m.id); nav('#/journey'); };
  }
  const rep = $('#report-moment');
  if (rep) rep.onclick = () => openReport({ momentId: m.id, reportedUserId: m.ownerId || null, label: `“${m.title || 'this moment'}”` });
  // The tri-dot overflow menu: toggle, and close on the next outside click
  // (a one-shot listener, so nothing leaks across re-renders).
  const moreBtn = $('#more-btn');
  const moreMenu = $('#more-menu');
  if (moreBtn && moreMenu) {
    moreBtn.onclick = (e) => {
      e.stopPropagation();
      const willOpen = moreMenu.hidden;
      moreMenu.hidden = !willOpen;
      if (willOpen) {
        const closeOnce = () => { moreMenu.hidden = true; document.removeEventListener('click', closeOnce); };
        setTimeout(() => document.addEventListener('click', closeOnce), 0);
      }
    };
  }
  const shareBtn = $('#share-moment');
  if (shareBtn) shareBtn.onclick = () => { if (moreMenu) moreMenu.hidden = true; openShareMoment(m); };
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
        <div class="field"><label>Your telling</label><textarea name="note" maxlength="${LIMITS.contribution}" placeholder="What do you remember from that day?"></textarea></div>
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
  // Each photo's own capture date, shown tiny under its thumbnail. Keyed by the
  // File object (freshly picked) or the URL (pulled from the shelf); missing =
  // no timestamp = no date shown. `dateTouched` guards the moment-date autofill:
  // start "touched" when editing so a new photo never overwrites a real date the
  // moment already has.
  const fileDate = new Map();
  const urlDate = new Map();
  let dateTouched = !!existingId;
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
        <div class="field"><label>Title</label><input name="title" value="${m ? esc(m.title) : ''}" maxlength="${LIMITS.title}" placeholder="e.g. Summer at the lake house"></div>
        <div class="field"><label>Caption</label><input name="caption" value="${m ? esc(m.caption) : ''}" maxlength="${LIMITS.caption}" placeholder="A short line"></div>
        <div class="field"><label>Story</label><textarea name="story" maxlength="${LIMITS.story}" placeholder="Tell it the way you'd tell it…">${m ? esc(m.story) : ''}</textarea></div>
        <div class="field"><label>Where did it happen?</label>
          <div class="row" id="place-city-row">
            <input name="city" value="${esc(curCity)}" placeholder="City">
            <select name="stateSel">
              <option value="">State…</option>
              ${US_STATES.map((s) => `<option value="${esc(s)}" ${curState === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div id="place-custom-row" style="display:none;"><input name="customPlace" maxlength="${LIMITS.location}" placeholder="Custom place — e.g. Grandma's kitchen"></div>
          <div class="hint" id="place-hint">United States for now — we'll add more countries soon. <a href="#" id="place-toggle">Use a custom place name →</a></div>
          <div id="saved-place" class="saved-comp"></div>
        </div>
        <div class="field"><label>Milestone</label><select name="milestone">${MILESTONE_OPTS.map(([v, l]) => `<option value="${v}" ${m && (m.milestone || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Seal as a time capsule <span class="muted">— optional; stays hidden until this date</span></label><input name="sealedUntil" type="date" value="${m && m.sealedUntil ? esc(m.sealedUntil) : ''}"></div>
        <div class="field"><label>People who were there</label><input name="tags" value="${m ? esc((m.tags || []).map((t) => (t.handle ? '@' + t.handle : t.label)).join(', ')) : ''}" placeholder="Mom, @davidk, the whole crew">
          <div class="hint">Separate with commas. Use @handle to link a real member.</div>
          <div id="saved-comp" class="saved-comp"></div></div>
        <div class="field"><label>Private topics <span class="muted">— just for you; never shown on the moment</span></label>
          <input name="topics" value="${m ? esc((m.topics || []).join(', ')) : ''}" placeholder="music, career, travel">
          <div class="hint">Separate with commas. They make this moment findable in your search — and by topic across the World.</div>
          <div id="saved-topics" class="saved-comp"></div></div>
        <div class="field"><label>Photos</label><input type="file" id="photo-input" accept="image/*,video/*" multiple><div class="photo-preview" id="preview"></div></div>
        <div class="field"><label>Or pull from your shelf</label><div id="shelf-strip" class="shelf-strip"><span class="muted" style="font-size:0.9rem;">Loading…</span></div>
          <div class="hint"><a href="#/import">Manage your import shelf →</a></div></div>
        <button class="btn block" type="submit">${existingId ? 'Save changes' : 'Add to my Journey'}</button>
      </form>
    </div>`;
  // Tiny "when it was taken" caption; blank when the photo has no timestamp.
  const dateTag = (ymd) => `<div class="pp-date">${esc(formatPhotoDate(ymd))}</div>`;
  const renderPreview = () => {
    const wrap = $('#preview');
    wrap.innerHTML =
      keptPhotos.map((url, i) => `<div class="pp"><img src="${esc(url)}" alt=""><button type="button" class="rm" data-kept="${i}">×</button>${dateTag(urlDate.get(url))}</div>`).join('') +
      pendingFiles.map((f, i) => `<div class="pp"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="rm" data-new="${i}">×</button>${dateTag(fileDate.get(f))}</div>`).join('');
    wrap.querySelectorAll('[data-kept]').forEach((b) => (b.onclick = () => { keptPhotos.splice(+b.getAttribute('data-kept'), 1); renderPreview(); }));
    wrap.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => { pendingFiles.splice(+b.getAttribute('data-new'), 1); renderPreview(); }));
  };
  // Fill the moment's date from the earliest photo that knows when it was taken —
  // unless the user has already set the date themselves.
  const applyPhotoDate = () => {
    if (dateTouched) return;
    const d = earliestYmd([...keptPhotos.map((u) => urlDate.get(u)), ...pendingFiles.map((f) => fileDate.get(f))]);
    if (!d) return;
    const yEl = $('#m-form input[name=year]'), mEl = $('#m-form select[name=month]'), dEl = $('#m-form input[name=day]');
    if (yEl) yEl.value = d.year;
    if (mEl) mEl.value = d.month;
    if (dEl) dEl.value = d.day;
  };
  // A real edit to any date field means "hands off" for autofill. Setting .value
  // in applyPhotoDate doesn't fire 'input', so autofill keeps working until the
  // user actually types.
  ['year', 'month', 'day'].forEach((n) => {
    const el = $(`#m-form [name=${n}]`);
    if (el) el.addEventListener('input', () => { dateTouched = true; });
  });
  $('#photo-input').onchange = async (e) => {
    const files = [...e.target.files];
    for (const f of files) pendingFiles.push(f);
    renderPreview();
    await Promise.all(files.map(async (f) => { fileDate.set(f, await captureYmdFromFile(f)); }));
    renderPreview();
    applyPhotoDate();
  };
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
      const url = elm.getAttribute('data-url');
      keptPhotos.push(url);
      const s = shelf.find((x) => x.id === id);
      if (s) urlDate.set(url, ymdFromTakenAt(s.takenAt));
      elm.classList.add('used');
      renderPreview();
      applyPhotoDate();
    }));
  })();
  // Your saved custom companions — tap to reuse the exact same name.
  (async () => {
    const saved = await api.getSavedCompanions(state.user.id).catch(() => []);
    const wrap = $('#saved-comp');
    if (!wrap || !saved.length) return;
    const tagsInput = $('#m-form input[name=tags]');
    const has = (name) => tagsInput.value.split(',').map((s) => s.trim().toLowerCase()).includes(name.toLowerCase());
    wrap.innerHTML = '<span class="saved-comp-lbl">Saved:</span>' +
      saved.map((c) => `<button type="button" class="saved-chip" data-name="${esc(c.name)}">+ ${esc(c.name)}</button>`).join('');
    wrap.querySelectorAll('.saved-chip').forEach((b) => (b.onclick = () => {
      const name = b.getAttribute('data-name');
      if (has(name)) return;
      tagsInput.value = tagsInput.value.trim() ? `${tagsInput.value.replace(/,\s*$/, '')}, ${name}` : name;
    }));
  })();

  // Your previously-used topics — tap to reuse the same spelling.
  (async () => {
    const mine = await api.getMyTopics(state.user.id).catch(() => []);
    const wrap = $('#saved-topics');
    if (!wrap || !mine.length) return;
    const inp = $('#m-form input[name=topics]');
    const has = (t) => inp.value.split(',').map((s) => s.trim().toLowerCase()).includes(t.toLowerCase());
    wrap.innerHTML = '<span class="saved-comp-lbl">Your topics:</span>' +
      mine.map((t) => `<button type="button" class="saved-chip" data-t="${esc(t)}">#${esc(t)}</button>`).join('');
    wrap.querySelectorAll('.saved-chip').forEach((b) => (b.onclick = () => {
      const t = b.getAttribute('data-t');
      if (has(t)) return;
      inp.value = inp.value.trim() ? `${inp.value.replace(/,\s*$/, '')}, ${t}` : t;
    }));
  })();

  // Place: a US city + state, OR a custom label. A toggle swaps between them;
  // saved places (from before) are one-tap chips that fill the fields.
  let customPlace = false;
  const cityRow = $('#place-city-row'), customRow = $('#place-custom-row'), placeToggle = $('#place-toggle');
  const setCustomPlace = (on) => {
    customPlace = on;
    cityRow.style.display = on ? 'none' : '';
    customRow.style.display = on ? '' : 'none';
    placeToggle.textContent = on ? 'Use a city & state instead →' : 'Use a custom place name →';
  };
  placeToggle.onclick = (e) => { e.preventDefault(); setCustomPlace(!customPlace); };
  // Editing an older/custom moment (location text but no city) opens in custom mode.
  if (m && !m.placeCity && (m.location || '').trim()) { setCustomPlace(true); $('#m-form input[name=customPlace]').value = m.location; }
  (async () => {
    const saved = await api.getSavedPlaces(state.user.id).catch(() => []);
    const wrap = $('#saved-place');
    if (!wrap || !saved.length) return;
    wrap.innerHTML = '<span class="saved-comp-lbl">Your places:</span>' +
      saved.map((s) => `<button type="button" class="saved-chip" data-id="${esc(s.id)}">${s.kind === 'custom' ? '✎ ' : '📍 '}${esc(s.label)}</button>`).join('');
    wrap.querySelectorAll('.saved-chip').forEach((b) => (b.onclick = () => {
      const sp = saved.find((x) => x.id === b.getAttribute('data-id'));
      if (!sp) return;
      if (sp.kind === 'custom') { setCustomPlace(true); $('#m-form input[name=customPlace]').value = sp.label; }
      else { setCustomPlace(false); $('#m-form input[name=city]').value = sp.city || ''; $('#m-form select[name=stateSel]').value = sp.region || ''; }
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
      // Remember custom (non-@handle) names so they're reused consistently.
      api.addSavedCompanions(state.user.id, tags.filter((t) => !t.label.startsWith('@')).map((t) => t.label)).catch(() => {});
      let place = null;
      let locationText = '';
      if (customPlace) {
        locationText = (f.get('customPlace') || '').trim();
      } else {
        const city = (f.get('city') || '').trim();
        const st = f.get('stateSel') || '';
        place = (city || st) ? { city: city || null, region: st || null, country: 'United States', lat: null, lng: null } : null;
        locationText = [city, st].filter(Boolean).join(', ');
      }
      // Remember the place so it's reused consistently next time.
      if (place) api.addSavedPlace(state.user.id, { kind: 'city', label: [place.city, place.region].filter(Boolean).join(', '), city: place.city, region: place.region, country: place.country }).catch(() => {});
      else if (customPlace && locationText) api.addSavedPlace(state.user.id, { kind: 'custom', label: locationText }).catch(() => {});
      const topics = (f.get('topics') || '').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
      const payload = {
        year: +f.get('year'), month: f.get('month') ? +f.get('month') : null, day: f.get('day') ? +f.get('day') : null,
        title: f.get('title'), caption: f.get('caption'), story: f.get('story'),
        location: locationText, place, milestone: f.get('milestone') || null,
        sealedUntil: f.get('sealedUntil') || null,
        photos: [...keptPhotos, ...pendingFiles], tags, topics,
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
      <a class="back" id="pf-back" href="#/profile">← Back</a>
      <div class="section-title">Edit your profile</div>
      <div id="pf-err"></div>
      <form id="pf-form" class="panel">
        <div class="field"><label>Profile photos <span class="muted">— up to 5, they rotate on a timer</span></label>
          <div class="photo-preview" id="av-previews"></div>
          <label class="btn ghost sm" style="cursor:pointer;margin-top:8px;">+ Add photo<input type="file" id="av-input" accept="image/*" multiple hidden></label>
        </div>
        <div class="field" id="rotate-field" style="display:${total() > 1 ? 'block' : 'none'}"><label>Rotate photos</label>
          <select id="rotate">${ROTATE_OPTIONS.map((o) => `<option value="${o.key}" ${((u.avatarRotate || 'day') === o.key) ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
        <div class="field"><label>Name</label><input name="name" value="${esc(u.name || '')}" maxlength="${LIMITS.name}"></div>
        <div class="field"><label>Epitaph <span class="muted">— a line that captures a life</span></label><input name="epitaph" value="${esc(u.epitaph || '')}" maxlength="${LIMITS.epitaph}" placeholder="She never met a stranger."></div>
        <div class="field"><label>Bio</label><textarea name="bio" maxlength="${LIMITS.bio}" placeholder="A few words about you.">${esc(u.bio || '')}</textarea></div>
        <div class="row">
          <div class="field"><label>Birth year</label><input name="birthYear" type="number" min="1900" max="${new Date().getFullYear()}" value="${u.birthYear || ''}"></div>
          <div class="field"><label>Month</label><select name="birthMonth">${['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => `<option value="${v}" ${String(u.birthMonth || '') === String(v) ? 'selected' : ''}>${v ? MONTHS[v] : '—'}</option>`).join('')}</select></div>
          <div class="field"><label>Day</label><input name="birthDay" type="number" min="1" max="31" value="${u.birthDay || ''}"></div>
        </div>
        <div class="field"><label>Hometown</label><input name="hometown" value="${esc(u.hometown || '')}" maxlength="${LIMITS.hometown}" placeholder="Where you're from"></div>
        <div class="field"><label>Currently rooted <span class="muted">— where you live now</span></label><input name="currentLocation" value="${esc(u.currentLocation || '')}" maxlength="${LIMITS.currentLocation}" placeholder="Portland, Oregon"></div>
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
  // Back should return where you came from — the Journey if you opened edit
  // from there, the profile hub if from there — not always the hub.
  const goBack = () => { if (history.length > 1) history.back(); else nav('#/journey'); };
  $('#pf-back').onclick = (e) => { e.preventDefault(); goBack(); };
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
        currentLocation: f.get('currentLocation'),
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
      goBack();
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
      <div class="prof-hub-head">
        <div class="prof-hub-av">${avatarImg({ avatarUri: activeAvatarUri(u), name: u.name }, 'pha-img')}</div>
        <h1>${esc(u.name || 'Unnamed')}</h1>
        <div class="handle">@${esc(u.handle || '')}</div>
      </div>
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
        ${menuRow('#/profile/customize', '🎨', 'Edit Journey')}
        ${menuRow('#/shared', '📬', 'Shared With Me')}
        ${menuRow('#/merch', '🛍️', 'Order Memories')}
        ${menuRow('#/orders', '📦', 'My Orders')}
        ${menuRow('#/settings', '⚙️', 'Account & Settings')}
        ${u.isAdmin ? menuRow('#/admin', '📊', 'Admin Dashboard') : ''}
      </div>
      ${u.isModerator && !u.isAdmin ? '<p class="muted" style="text-align:center;margin-top:18px;font-size:0.88rem;">Moderation tools are coming to the web soon.</p>' : ''}
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

// ---- Edit Journey (the journey's look: theme, shape, default fonts/colors) --
async function viewCustomize() {
  renderTopbar('profile');
  const u = state.user;
  const fontsRow = (field) =>
    `<div class="pick-row" data-font-field="${field}">${FONTS.map((f) => `<button type="button" class="pick-chip ${(u[`${field}Font`] || 'classic') === f.key ? 'sel' : ''}" data-font="${f.key}" style="${f.css ? `font-family:${f.css}` : ''}">${f.label}</button>`).join('')}</div>`;
  const colorsRow = (field) =>
    `<div class="pick-row swatches" data-color-field="${field}">${FONT_COLORS.map((c) => `<button type="button" class="swatch ${(u[`${field}FontColor`] || 'default') === c.key ? 'sel' : ''}" data-color="${c.key}" title="${c.label}" style="background:${c.color}"></button>`).join('')}</div>`;
  root().innerHTML = `
    <div class="wrap">
      <a class="back" href="#/profile">← Back</a>
      <div class="section-title">Edit Journey</div>
      <p class="muted" style="margin-top:-4px;">The look and feel of your Journey — its backdrop, photo shape, and the default fonts &amp; colors for every moment.</p>
      <div id="cust-msg"></div>

      <div class="section-title" style="font-size:1.15rem;">Cover</div>
      <p class="muted" style="margin-top:-4px;font-size:0.9rem;">A banner across the top of your Journey — like the cover of a book.</p>
      <div class="cover-edit">
        <div class="cover-prev ${u.coverUrl ? '' : 'empty'}">${u.coverUrl ? `<img src="${esc(u.coverUrl)}" alt="">` : 'No cover yet'}</div>
        <div class="btn-row" style="justify-content:flex-start;">
          <label class="btn ghost sm">${u.coverUrl ? 'Change cover' : 'Add a cover photo'}<input type="file" id="cover-file" accept="image/*" hidden></label>
          ${u.coverUrl ? '<button class="btn ghost sm" id="cover-remove">Remove</button>' : ''}
        </div>
      </div>

      <div class="section-title" style="font-size:1.15rem;">Background</div>
      <div class="theme-grid wide" id="bg-grid">${BG_THEMES.map((b) => `<div class="theme-sw big ${u.journeyBg === b.key ? 'sel' : ''}" data-bg="${b.key}"><div class="sw-prev ${b.dark ? 'dark' : ''}" style="background:${b.color}">${backdropSVG(b.kind)}</div><div class="tn">${b.label}</div></div>`).join('')}</div>

      <div class="section-title" style="font-size:1.15rem;">Photo shape</div>
      <div class="theme-grid" id="shape-grid">${PHOTO_SHAPES.map((s) => `<div class="theme-sw ${u.journeyPhotoShape === s.key ? 'sel' : ''}" data-shape="${s.key}"><div class="dot" style="background:var(--blue);border-radius:${s.r}"></div><div class="tn">${s.label}</div></div>`).join('')}</div>

      <div class="section-title" style="font-size:1.15rem;">Photo mat</div>
      <div class="theme-grid" id="mat-grid">${PHOTO_MATS.map((m) => `<div class="theme-sw ${(u.journeyPhotoMat || 'cream') === m.key ? 'sel' : ''}" data-mat="${m.key}"><div class="mat-prev" style="background:${m.color === 'transparent' ? 'var(--line)' : m.color}"><span></span></div><div class="tn">${m.label}</div></div>`).join('')}</div>

      <div class="section-title" style="font-size:1.15rem;">Reading text size</div>
      <div class="pick-row" id="scale-row">${TEXT_SCALES.map((t) => `<button type="button" class="pick-chip ${(u.journeyTextScale || 'm') === t.key ? 'sel' : ''}" data-scale="${t.key}" style="font-size:${t.scale}em">${t.label}</button>`).join('')}</div>

      <div class="section-title" style="font-size:1.15rem;">Accent color</div>
      <p class="muted" style="margin-top:-4px;font-size:0.9rem;">Tints the thread, chapter markers, and small details. “Auto” follows your favorite color.</p>
      <div class="pick-row swatches" id="accent-row"><button type="button" class="swatch auto ${u.journeyAccent ? '' : 'sel'}" data-accent="" title="Auto">A</button>${FAVORITE_COLORS.map((hex) => `<button type="button" class="swatch ${u.journeyAccent === hex ? 'sel' : ''}" data-accent="${hex}" title="${hex}" style="background:${hex}"></button>`).join('')}</div>

      <div class="section-title" style="font-size:1.15rem;">Journey line</div>
      <p class="muted" style="margin-top:-4px;font-size:0.9rem;">The thread running down your Journey. The month/year tags stay the same on every Journey — but the line is yours, and it takes your accent color.</p>
      <div class="theme-grid" id="line-grid">${JOURNEY_LINES.map((opt) => `<div class="theme-sw ${(u.journeyLine || 'ribbon') === opt.key ? 'sel' : ''}" data-line="${opt.key}"><div class="line-prev">${lineSvg({ journeyLine: opt.key, journeyAccent: u.journeyAccent, favoriteColor: u.favoriteColor }, opt.key)}</div><div class="tn">${opt.label}</div></div>`).join('')}</div>

      <div class="section-title" style="font-size:1.15rem;">Default fonts &amp; colors</div>
      <p class="muted" style="margin-top:-4px;font-size:0.9rem;">These set the look for every moment. Pick “Classic” / “Blue” to leave a field on its default.</p>
      ${STYLE_FIELDS.map((f) => `<div class="style-block"><div class="style-label">${f.label}</div>${fontsRow(f.key)}${colorsRow(f.key)}</div>`).join('')}
    </div>`;

  const save = async (field, val) => {
    try { await api.updateProfile(u.id, { [field]: val }); state.user[field] = val; $('#cust-msg').innerHTML = '<div class="success">Saved.</div>'; }
    catch (err) { $('#cust-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; }
  };
  // For changes whose saved value we only learn from the server (a cover upload
  // returns its stored URL): merge the returned fields back into state.user.
  const savePatch = async (patch) => {
    try { const next = await api.updateProfile(u.id, patch); Object.assign(state.user, next); $('#cust-msg').innerHTML = '<div class="success">Saved.</div>'; return next; }
    catch (err) { $('#cust-msg').innerHTML = `<div class="error">${esc(err.message)}</div>`; }
  };
  const wire = (gridId, attr, field) =>
    root().querySelectorAll(`#${gridId} .theme-sw`).forEach((sw) => (sw.onclick = () => {
      root().querySelectorAll(`#${gridId} .theme-sw`).forEach((x) => x.classList.remove('sel'));
      sw.classList.add('sel');
      save(field, sw.getAttribute(attr));
    }));
  wire('bg-grid', 'data-bg', 'journeyBg');
  wire('shape-grid', 'data-shape', 'journeyPhotoShape');
  wire('mat-grid', 'data-mat', 'journeyPhotoMat');
  wire('line-grid', 'data-line', 'journeyLine');

  // Cover: upload a fresh file, or clear it — then re-render this screen.
  const coverFile = $('#cover-file');
  if (coverFile) coverFile.onchange = async () => {
    const f = coverFile.files?.[0];
    if (!f) return;
    $('#cust-msg').innerHTML = '<div class="muted">Uploading…</div>';
    await savePatch({ coverFile: f });
    viewCustomize();
  };
  const coverRemove = $('#cover-remove');
  if (coverRemove) coverRemove.onclick = async () => { await savePatch({ coverUrl: null }); viewCustomize(); };

  // Reading text size + accent (chip / swatch rows).
  root().querySelectorAll('#scale-row .pick-chip').forEach((chip) => (chip.onclick = () => {
    root().querySelectorAll('#scale-row .pick-chip').forEach((x) => x.classList.remove('sel'));
    chip.classList.add('sel');
    save('journeyTextScale', chip.getAttribute('data-scale'));
  }));
  root().querySelectorAll('#accent-row .swatch').forEach((sw) => (sw.onclick = () => {
    root().querySelectorAll('#accent-row .swatch').forEach((x) => x.classList.remove('sel'));
    sw.classList.add('sel');
    save('journeyAccent', sw.getAttribute('data-accent'));
  }));
  root().querySelectorAll('[data-font-field]').forEach((row) => {
    const field = row.getAttribute('data-font-field');
    row.querySelectorAll('.pick-chip').forEach((chip) => (chip.onclick = () => {
      row.querySelectorAll('.pick-chip').forEach((x) => x.classList.remove('sel'));
      chip.classList.add('sel');
      save(`${field}Font`, chip.getAttribute('data-font'));
    }));
  });
  root().querySelectorAll('[data-color-field]').forEach((row) => {
    const field = row.getAttribute('data-color-field');
    row.querySelectorAll('.swatch').forEach((sw) => (sw.onclick = () => {
      row.querySelectorAll('.swatch').forEach((x) => x.classList.remove('sel'));
      sw.classList.add('sel');
      save(`${field}FontColor`, sw.getAttribute('data-color'));
    }));
  });
}

// ---- Settings --------------------------------------------------------------
async function viewSettings() {
  renderTopbar('settings');
  setLoading();
  const u = state.user;
  // Circle members, and the Inner Circle (those tagged in your moments) — the
  // Keeper is named from the Inner Circle only.
  const pairs = await api.fetchCircleOf(u.id);
  const ids = [...new Set(pairs.map((p) => (p.a === u.id ? p.b : p.a)))];
  const members = [];
  for (const id of ids) { const m = await api.fetchUserById(id); if (m) members.push(m); }
  const myMoments = await api.getMomentsOf(u.id);
  const taggedIds = new Set();
  for (const mm of myMoments) for (const t of mm.tags || []) if (t.userId) taggedIds.add(t.userId);
  const innerMembers = members.filter((m) => taggedIds.has(m.id));
  let keeperReqs = await api.getKeeperRequests(u.id);
  let keeperChanging = false;
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
      <div class="panel"><p class="muted" style="margin-top:0;">Name the one person you trust to tell us when you're gone. They can never edit or add to your Vault — only close it, and share it. They must accept before they become your Keeper. Choose from your Inner Circle.</p>
        <div id="keeper-block"></div>
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
  const refreshKeeper = async () => { keeperReqs = await api.getKeeperRequests(u.id); renderKeeper(); };
  const renderKeeper = () => {
    const block = $('#keeper-block'); if (!block) return;
    const confirmed = members.find((m) => m.id === u.keeperId);
    const out = keeperReqs.outgoing;
    const inc = keeperReqs.incoming || [];
    const showPicker = keeperChanging || (!confirmed && !out);
    let html = '';
    if (confirmed && !keeperChanging) {
      html += `<div class="settings-row"><div class="lbl"><div class="t">${esc(confirmed.name)}</div><div class="d">@${esc(confirmed.handle)} · your Keeper</div></div>
        <button class="btn ghost sm" id="k-change">Change</button> <button class="btn danger sm" id="k-remove">Remove</button></div>`;
    } else if (out && !keeperChanging) {
      html += `<div class="settings-row"><div class="lbl"><div class="t">${esc(out.name || 'Someone')}</div><div class="d">Waiting for them to accept — they become your Keeper only when they do.</div></div>
        <button class="btn danger sm" id="k-cancel">Cancel request</button></div>`;
    }
    if (showPicker) {
      if (!innerMembers.length) {
        html += '<div class="hint">Your Inner Circle is empty. Tag the people who were there in your moments first, then name one as your Keeper.</div>';
      } else {
        html += `<div class="field"><label>Choose from your Inner Circle</label><select id="k-pick"><option value="">Choose someone…</option>${innerMembers.map((m) => `<option value="${m.id}">${esc(m.name)} (@${esc(m.handle)})</option>`).join('')}</select></div>
          <button class="btn sm" id="k-send">Send request</button>${(confirmed || out) ? ' <button class="btn ghost sm" id="k-cancelchange">Cancel</button>' : ''}`;
      }
    }
    if (inc.length) {
      html += '<div class="section-title" style="font-size:1rem;margin-top:16px;">Asked to be a Keeper</div>';
      for (const r of inc) {
        html += `<div class="settings-row"><div class="lbl"><div class="t">${esc(r.name || 'Someone')}</div><div class="d">asked you to be their Keeper — the one person who can report their passing. Only accept if you're willing.</div></div>
          <button class="btn sm" data-accept="${esc(r.id)}" data-subj="${esc(r.subjectId)}">Accept</button> <button class="btn ghost sm" data-decline="${esc(r.id)}" data-subj="${esc(r.subjectId)}">Decline</button></div>`;
      }
    }
    block.innerHTML = html;
    if ($('#k-change', block)) $('#k-change', block).onclick = () => { keeperChanging = true; renderKeeper(); };
    if ($('#k-cancelchange', block)) $('#k-cancelchange', block).onclick = () => { keeperChanging = false; renderKeeper(); };
    if ($('#k-remove', block)) $('#k-remove', block).onclick = async () => {
      try { await api.removeKeeper(u); u.keeperId = null; state.user.keeperId = null; keeperChanging = false; await refreshKeeper(); }
      catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
    };
    if ($('#k-cancel', block)) $('#k-cancel', block).onclick = async () => {
      try { await api.cancelKeeperRequest(out.id); await refreshKeeper(); } catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
    };
    if ($('#k-send', block)) $('#k-send', block).onclick = async () => {
      const v = $('#k-pick', block).value; if (!v) return;
      try { await api.requestKeeper(u, v); keeperChanging = false; await refreshKeeper(); msg('<div class="success">Request sent — they become your Keeper once they accept.</div>'); }
      catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
    };
    block.querySelectorAll('[data-accept]').forEach((b) => (b.onclick = async () => {
      try { await api.confirmKeeperRequest(u, b.getAttribute('data-accept'), b.getAttribute('data-subj')); await refreshKeeper(); } catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
    }));
    block.querySelectorAll('[data-decline]').forEach((b) => (b.onclick = async () => {
      try { await api.declineKeeperRequest(u, b.getAttribute('data-decline'), b.getAttribute('data-subj')); await refreshKeeper(); } catch (err) { msg(`<div class="error">${esc(err.message)}</div>`); }
    }));
  };
  renderKeeper();
  $('#logout').onclick = async () => { await api.logOut(); state.user = null; state.blocked = new Set(); nav('#/login'); route(); };
  $('#del-account').onclick = () => openDeleteFlow();
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
          <div class="field"><label>Full name</label><input id="s-name" value="${esc(u.name || '')}" maxlength="${LIMITS.name}"></div>
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

// ---- Share modal -----------------------------------------------------------
// Share a moment with other members on the platform. In-platform only for now
// (no external social / SMS) — pick people from your Circle and they get a
// notification linking to the moment.
async function openShareMoment(m) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal"><h2>Share this moment</h2><div class="muted">Loading your Circle…</div></div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.onclick = (e) => { if (e.target === back) close(); };

  const pairs = await api.fetchCircleOf(state.user.id);
  const ids = [...new Set(pairs.map((p) => (p.a === state.user.id ? p.b : p.a)))].filter((id) => !state.blocked.has(id));
  const people = [];
  for (const id of ids) { const u = await api.fetchUserById(id); if (u) people.push(u); }
  people.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const selected = new Set();

  if (!people.length) {
    back.querySelector('.modal').innerHTML = `<h2>Share this moment</h2>
      <p class="muted">Your Circle is empty — add people in the <a href="#/world">World</a> first, then you can share moments with them.</p>
      <div class="btn-row" style="justify-content:flex-end;"><button class="btn ghost sm" id="sh-cancel">Close</button></div>`;
    $('#sh-cancel', back).onclick = close;
    return;
  }

  back.querySelector('.modal').innerHTML = `
    <h2>Share this moment</h2>
    <p class="muted" style="margin-top:-6px;">Send “${esc(m.title || 'this moment')}” to people in your Circle. They'll get a notification linking here.</p>
    <div id="sh-msg"></div>
    <div class="share-list">${people.map((u) => `<label class="share-row">
      <span class="sr-av">${u.avatarUri ? `<img src="${esc(u.avatarUri)}" alt="">` : esc(initials(u.name || '?'))}</span>
      <span class="sr-name">${esc(u.name || 'Unnamed')} <span class="muted">@${esc(u.handle || '')}</span></span>
      <input type="checkbox" data-check="${esc(u.id)}">
    </label>`).join('')}</div>
    <div class="field" style="margin-top:12px;"><label>Add a note (optional)</label><input id="sh-note" maxlength="140" placeholder="Thought you'd want to see this."></div>
    <div class="btn-row" style="justify-content:flex-end;">
      <button class="btn ghost sm" id="sh-cancel">Cancel</button>
      <button class="btn sm" id="sh-send">Share</button>
    </div>`;
  back.querySelectorAll('[data-check]').forEach((c) => (c.onchange = () => {
    const id = c.getAttribute('data-check');
    if (c.checked) selected.add(id); else selected.delete(id);
  }));
  $('#sh-cancel', back).onclick = close;
  $('#sh-send', back).onclick = async () => {
    if (!selected.size) { $('#sh-msg', back).innerHTML = `<div class="error">Pick at least one person to share with.</div>`; return; }
    const send = $('#sh-send', back); send.disabled = true; send.textContent = 'Sharing…';
    try {
      const note = ($('#sh-note', back) && $('#sh-note', back).value) || '';
      const n = await api.shareMoment(state.user, m.id, m.title, [...selected], note);
      back.querySelector('.modal').innerHTML = `<h2>Shared</h2>
        <p class="muted">Sent to ${n} ${n === 1 ? 'person' : 'people'} — it's waiting in their notifications.</p>
        <div class="btn-row" style="justify-content:flex-end;"><button class="btn sm" id="sh-done">Done</button></div>`;
      $('#sh-done', back).onclick = close;
    } catch (e) {
      $('#sh-msg', back).innerHTML = `<div class="error">${esc(e.message)}</div>`;
      send.disabled = false; send.textContent = 'Share';
    }
  };
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

const DELETE_REASONS = [
  'Just taking a break',
  'Privacy concerns',
  "I didn't find it useful",
  'Too complicated to use',
  'I made a duplicate account',
  'Something upset me',
  'Other',
];

// A deliberate three-step account deletion with a required reason.
function openDeleteFlow() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  let reason = '';
  let note = '';
  const close = () => back.remove();
  const render = (step) => {
    if (step === 1) {
      back.innerHTML = `<div class="modal">
        <h2 style="color:var(--danger)">Delete your account?</h2>
        <p>This permanently deletes your profile, moments, photos, voice notes, tags, and Circle connections. It cannot be undone.</p>
        <div class="muted" style="text-transform:uppercase;letter-spacing:.5px;font-size:.8rem;margin-top:12px;">Step 1 of 3</div>
        <div class="btn-row" style="justify-content:flex-end;">
          <button type="button" class="btn ghost sm" id="d-cancel">Keep my account</button>
          <button type="button" class="btn sm" id="d-next">Continue</button>
        </div></div>`;
      $('#d-cancel', back).onclick = close;
      $('#d-next', back).onclick = () => render(2);
    } else if (step === 2) {
      back.innerHTML = `<div class="modal">
        <h2>Before you go</h2>
        <p>Why are you leaving? This helps us — and it's required.</p>
        <div id="d-reasons">${DELETE_REASONS.map((r) => `<label class="d-reason"><input type="radio" name="dreason" value="${esc(r)}" ${reason === r ? 'checked' : ''}> ${esc(r)}</label>`).join('')}</div>
        <div class="field" style="margin-top:10px;"><textarea id="d-note" placeholder="Anything else? (optional)">${esc(note)}</textarea></div>
        <div class="btn-row" style="justify-content:flex-end;">
          <button type="button" class="btn ghost sm" id="d-back">Back</button>
          <button type="button" class="btn sm" id="d-next" disabled>Continue</button>
        </div></div>`;
      const nextBtn = $('#d-next', back);
      nextBtn.disabled = !reason;
      back.querySelectorAll('input[name=dreason]').forEach((r) => (r.onchange = () => { reason = r.value; nextBtn.disabled = false; }));
      $('#d-note', back).oninput = (e) => { note = e.target.value; };
      $('#d-back', back).onclick = () => render(1);
      nextBtn.onclick = () => { if (reason) render(3); };
    } else {
      back.innerHTML = `<div class="modal">
        <h2 style="color:var(--danger)">Last check</h2>
        <p>This erases everything, forever. There is no undo, and no way to recover your journey afterward.</p>
        <div class="muted" style="text-transform:uppercase;letter-spacing:.5px;font-size:.8rem;margin-top:12px;">Step 3 of 3</div>
        <div id="d-msg"></div>
        <div class="btn-row" style="justify-content:flex-end;">
          <button type="button" class="btn ghost sm" id="d-cancel">Cancel</button>
          <button type="button" class="btn danger sm" id="d-final">Permanently delete</button>
        </div></div>`;
      $('#d-cancel', back).onclick = close;
      $('#d-final', back).onclick = async () => {
        const btn = $('#d-final', back); btn.disabled = true; btn.textContent = 'Deleting…';
        try {
          await api.deleteAccount({ category: reason, text: note, accountType: state.user?.accountType || null });
          state.user = null; state.blocked = new Set(); nav('#/login'); route(); close();
        } catch (err) {
          $('#d-msg', back).innerHTML = `<div class="error">${esc(err.message)}</div>`;
          btn.disabled = false; btn.textContent = 'Permanently delete';
        }
      };
    }
  };
  document.body.appendChild(back);
  back.onclick = (e) => { if (e.target === back) close(); };
  render(1);
}

// ---- Router ----------------------------------------------------------------
// ---- Internal admin / BI dashboard (admins only) ---------------------------
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString());

function signupSparkline(rows) {
  const data = (rows || []).map((r) => Number(r.signups) || 0);
  if (!data.length) return '';
  const w = 640, h = 60, max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 8) - 4).toFixed(1)}`);
  const total = data.reduce((a, b) => a + b, 0);
  return `
    <div class="admin-card" style="grid-column:1/-1;">
      <div class="admin-k">Signups · last ${data.length} days <span class="muted" style="font-weight:400;">(${total} total)</span></div>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:60px;margin-top:6px;">
        <polyline fill="none" stroke="var(--blue,#1B4B8F)" stroke-width="2"
          points="${pts.join(' ')}" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>`;
}

async function viewAdmin() {
  if (!state.user?.isAdmin) { nav('#/profile'); return; }
  setLoading();
  let o, signups, members;
  try {
    [o, signups, members] = await Promise.all([
      api.adminOverview(), api.adminSignupsDaily(30), api.adminMembers(),
    ]);
  } catch (e) {
    root().innerHTML = `<div class="wrap"><a class="back" href="#/profile">← Back</a>
      <div class="error">Couldn't load the dashboard: ${esc(e.message)}</div></div>`;
    return;
  }

  const card = (k, v, sub) =>
    `<div class="admin-card"><div class="admin-k">${k}</div><div class="admin-v">${v}</div>${sub ? `<div class="admin-sub">${sub}</div>` : ''}</div>`;
  const orders = o.orders_by_status || {};
  const ordersLine = Object.keys(orders).length
    ? Object.entries(orders).map(([k, v]) => `${esc(k.replace(/_/g, ' '))}: <b>${v}</b>`).join(' · ')
    : 'none yet';

  const roleBtn = (m, field, label) => {
    const on = m[field];
    const isSelf = m.id === state.user.id;
    return `<button class="admin-tog ${on ? 'on' : ''}" data-id="${m.id}" data-field="${field}" data-val="${on ? '0' : '1'}"
      ${isSelf && field !== 'banned' ? 'disabled title="Cannot change your own role"' : ''}>${label}${on ? ' ✓' : ''}</button>`;
  };

  const rows = (members || []).map((m) => `
    <tr>
      <td><b>${esc(m.name || '')}</b><br><span class="muted">@${esc(m.handle)}</span></td>
      <td>${m.account_type === 'business' ? '🏢' : '👤'} ${m.memorial_state === 'sealed' ? '· 🔒' : ''}</td>
      <td style="text-align:right;">${fmtNum(m.moments)}</td>
      <td>${roleBtn(m, 'is_admin', 'Admin')}</td>
      <td>${roleBtn(m, 'is_moderator', 'Mod')}</td>
      <td>${roleBtn(m, 'banned', m.banned ? 'Banned' : 'Ban')}</td>
    </tr>`).join('');

  root().innerHTML = `
    <div class="wrap admin-wrap">
      <a class="back" href="#/profile">← Back</a>
      <h1 class="admin-title">Internal Dashboard</h1>
      <p class="muted" style="margin-top:-6px;">Owner &amp; moderator view · every role change is logged.</p>

      <div class="admin-grid">
        ${card('Members', fmtNum(o.users_total), `${fmtNum(o.users_personal)} people · ${fmtNum(o.users_business)} businesses`)}
        ${card('Toward 100k', (o.goal_pct ?? 0) + '%', `${fmtNum(o.signups_7d)} new this week`)}
        ${card('Moments', fmtNum(o.moments_total), `${fmtNum(o.moments_30d)} in 30 days · avg ${o.avg_moments}/journey`)}
        ${card('Circle links', fmtNum(o.circle_links), `${fmtNum(o.tags_confirmed)} witnessed · ${fmtNum(o.tags_unconfirmed)} remembered`)}
        ${card('Legacy', `${fmtNum(o.sealed_journeys)} sealed`, `${fmtNum(o.memorial_pending)} in grace · ${o.keeper_pct}% have a Keeper`)}
        ${card('Store', `${fmtNum(o.spotlight_pending)} Spotlight`, `awaiting your review · orders — ${ordersLine}`)}
        ${card('Safety', `${fmtNum(o.reports_open)} reports`, `${fmtNum(o.banned)} banned`)}
        ${signupSparkline(signups)}
      </div>

      <h2 class="admin-h2">Members &amp; roles</h2>
      <div class="admin-tablewrap">
        <table class="admin-table">
          <thead><tr><th>Member</th><th>Type</th><th style="text-align:right;">Moments</th><th>Admin</th><th>Mod</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${appFooter()}
    </div>`;

  root().querySelectorAll('.admin-tog:not([disabled])').forEach((b) => {
    b.onclick = async () => {
      const field = b.getAttribute('data-field');
      const val = b.getAttribute('data-val') === '1';
      if (field === 'banned' && val && !confirm('Ban this member? They are signed out and their content hidden.')) return;
      b.disabled = true;
      try {
        await api.adminSetProfileFlags(b.getAttribute('data-id'), { [field]: val });
        await viewAdmin();
      } catch (e) { alert(e.message); b.disabled = false; }
    };
  });
}

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
      case 'admin': await viewAdmin(); break;
      case 'import': await viewImport(); break;
      case 'shared': await viewShared(); break;
      case 'merch': parts[1] ? await viewMerchProduct(parts[1]) : await viewMerch(); break;
      case 'orders': await viewOrders(); break;
      case 'add': await viewMomentForm(null); break;
      case 'edit': await viewMomentForm(parts[1]); break;
      case 'moment': await viewMoment(parts[1]); break;
      case 'u': await viewPerson(parts[1]); break;
      case 'place': await viewPlace(parts[1], parts[2], parts[3]); break;
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
  enableCarouselDrag();
  if (!recovery) route();
}

// Grab-and-slide the photo strip itself (not just the scrollbar). Delegated so
// it covers every .jcarousel, including ones added later by re-renders.
function enableCarouselDrag() {
  let strip = null, startX = 0, startScroll = 0, dragging = false, moved = 0;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('.jcarousel');
    if (!el) return;
    // Let links/buttons inside a slide still work.
    strip = el; startX = e.clientX; startScroll = el.scrollLeft;
    dragging = true; moved = 0;
  });
  document.addEventListener('pointermove', (e) => {
    if (!dragging || !strip) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) {
      moved = Math.abs(dx);
      strip.scrollLeft = startScroll - dx;
      strip.classList.add('dragging');
      if (strip.setPointerCapture && e.pointerId != null) {
        try { strip.setPointerCapture(e.pointerId); } catch {}
      }
      e.preventDefault();
    }
  });
  const end = () => {
    if (strip) strip.classList.remove('dragging');
    dragging = false; strip = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // Swallow the click that follows a real drag so a slide's tap target
  // doesn't fire after you were only scrolling.
  document.addEventListener('click', (e) => {
    if (moved > 4 && e.target.closest && e.target.closest('.jcarousel')) {
      e.stopPropagation(); e.preventDefault(); moved = 0;
    }
  }, true);
}

boot();
