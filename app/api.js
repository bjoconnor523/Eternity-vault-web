// ============================================================================
// api.js — the web app's data layer.
//
// This is a faithful port of the mobile app's src/context/AppContext.js: same
// Supabase tables, the same `moments_feed` view (which masks sealed capsules
// server-side), the same private `photos`/`audio` buckets re-signed on read,
// and the same snake_case-DB <-> camelCase-app field mapping. If you change how
// data is shaped here, keep it in step with the phone app.
// ============================================================================
import { supabase } from './supabase.js';

// ---- Media: private buckets, re-signed on read -----------------------------
// The photos/audio buckets are private. A stored value is a storage PATH (or an
// old signed URL we can recover the path from). We never trust a stored token —
// every read mints a fresh 1-year signed URL, so media stays "kept forever."
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

const pathFromStored = (bucket, value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^https?:\/\//i.test(value)) {
    const m = value.match(new RegExp(`/object/(?:sign|public|authenticated)/${bucket}/([^?]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  }
  // A bare path has no scheme; a blob:/data: uri does and can't be re-signed.
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? null : value;
};

const signMap = async (bucket, paths) => {
  const map = new Map();
  if (!paths?.length) return map;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error || !data) return map;
  data.forEach((d) => {
    if (d && !d.error && d.signedUrl) map.set(d.path, d.signedUrl);
  });
  return map;
};

const signStoredUrls = async (bucket, values) => {
  const arr = values || [];
  if (!arr.length) return arr;
  const paths = arr.map((v) => pathFromStored(bucket, v));
  const map = await signMap(bucket, [...new Set(paths.filter(Boolean))]);
  return arr.map((v, i) => (paths[i] && map.get(paths[i])) || v);
};
const signStoredUrl = async (bucket, value) =>
  value ? (await signStoredUrls(bucket, [value]))[0] : value;

const signedUrlFor = async (bucket, path) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data?.signedUrl || null;
};

const hydrateMoments = async (list) => {
  const arr = list || [];
  if (!arr.length) return arr;
  const photoPaths = [
    ...new Set(arr.flatMap((m) => (m.photos || []).map((v) => pathFromStored('photos', v)).filter(Boolean))),
  ];
  const audioPaths = [...new Set(arr.map((m) => pathFromStored('audio', m.audioUrl)).filter(Boolean))];
  const [photoMap, audioMap] = await Promise.all([signMap('photos', photoPaths), signMap('audio', audioPaths)]);
  return arr.map((m) => {
    const photos = (m.photos || []).map((v) => {
      const p = pathFromStored('photos', v);
      return (p && photoMap.get(p)) || v;
    });
    const ap = pathFromStored('audio', m.audioUrl);
    return { ...m, photos, photoUri: photos[0] || null, audioUrl: (ap && audioMap.get(ap)) || m.audioUrl || null };
  });
};

const hydrateUsers = async (list) => {
  const arr = list || [];
  if (!arr.length) return arr;
  const paths = [
    ...new Set(
      arr
        .flatMap((u) => [u?.avatarUri, ...(u?.avatarPhotos || [])])
        .map((v) => pathFromStored('photos', v))
        .filter(Boolean)
    ),
  ];
  const map = await signMap('photos', paths);
  const resolve = (v) => {
    const p = pathFromStored('photos', v);
    return (p && map.get(p)) || v;
  };
  return arr.map((u) =>
    u
      ? {
          ...u,
          avatarUri: u.avatarUri ? resolve(u.avatarUri) : u.avatarUri,
          avatarPhotos: u.avatarPhotos ? u.avatarPhotos.map(resolve) : u.avatarPhotos,
        }
      : u
  );
};
export const hydrateUser = async (u) => (u ? (await hydrateUsers([u]))[0] : u);

// ---- Photo upload (browser) ------------------------------------------------
// Mirrors the app: downscale the long edge to 1600px, re-encode JPEG, upload to
// the private `photos` bucket, return a fresh signed URL. Videos pass through.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const isVideoFile = (file) => (file?.type || '').startsWith('video/');

const compressImage = (file) =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const longest = Math.max(img.width, img.height);
        const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob || file);
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    } catch {
      resolve(file);
    }
  });

// Upload one File/Blob (or pass through an existing https URL) → stored URL.
export const uploadOnePhoto = async (userId, fileOrUrl) => {
  if (!fileOrUrl) return fileOrUrl;
  if (typeof fileOrUrl === 'string') return fileOrUrl; // already uploaded / remote
  try {
    const isVideo = isVideoFile(fileOrUrl);
    const body = isVideo ? fileOrUrl : await compressImage(fileOrUrl);
    const ext = isVideo ? (fileOrUrl.name?.split('.').pop() || 'mp4') : 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('photos')
      .upload(path, body, { contentType: isVideo ? fileOrUrl.type : 'image/jpeg', upsert: false });
    if (error) return null;
    return (await signedUrlFor('photos', path)) || null;
  } catch {
    return null;
  }
};

export const uploadPhotos = async (userId, items) => {
  const out = [];
  for (const it of items || []) {
    const u = await uploadOnePhoto(userId, it);
    if (u) out.push(u);
  }
  return out;
};

// ---- Field mapping: DB row -> app shape ------------------------------------
const journeyFieldsFromRow = (p) => ({
  yearFont: p.year_font || 'classic',
  locationFont: p.location_font || 'classic',
  locationFontColor: p.location_font_color || 'default',
  titleFont: p.title_font || 'classic',
  titleFontColor: p.title_font_color || 'default',
  captionFont: p.caption_font || 'classic',
  captionFontColor: p.caption_font_color || 'default',
  storyFont: p.story_font || 'classic',
  storyFontColor: p.story_font_color || 'default',
});

export const profileToUser = (p) => ({
  id: p.id,
  name: p.name,
  handle: p.handle,
  avatarUri: p.avatar_url,
  avatarPhotos:
    Array.isArray(p.avatar_photos) && p.avatar_photos.length
      ? p.avatar_photos
      : p.avatar_url
      ? [p.avatar_url]
      : [],
  avatarRotate: p.avatar_rotate || 'day',
  birthYear: p.birth_year,
  birthMonth: p.birth_month,
  birthDay: p.birth_day,
  hometown: p.hometown,
  bio: p.bio,
  epitaph: p.epitaph || '',
  isModerator: !!p.is_moderator,
  accountType: p.account_type || 'personal',
  keeperId: p.keeper_id || null,
  memorialState: p.memorial_state || 'living',
  sealedAt: p.sealed_at || null,
  favoriteColor: p.favorite_color || '',
  favoriteNumber: p.favorite_number,
  companionsLimit: p.companions_limit || 8,
  journeyPhotoShape: p.journey_photo_shape || 'rounded',
  journeyBg: p.journey_bg || 'default',
  ...journeyFieldsFromRow(p),
  tagPermission: p.tag_permission || 'anyone',
  links: Array.isArray(p.links) ? p.links : [],
  wheelColors: p.wheel_colors && typeof p.wheel_colors === 'object' && !Array.isArray(p.wheel_colors) ? p.wheel_colors : {},
  profileComplete: !!p.handle,
});

const momentFromRow = (row) => ({
  id: row.id,
  ownerId: row.user_id,
  year: row.year,
  month: row.month,
  day: row.day,
  location: row.location || '',
  title: row.title || '',
  caption: row.caption || '',
  story: row.story || '',
  photos: row.photos || [],
  photoUri: (row.photos && row.photos[0]) || null,
  audioUrl: row.audio_url || null,
  placeCity: row.place_city || null,
  placeRegion: row.place_region || null,
  placeCountry: row.place_country || null,
  placeLat: row.place_lat ?? null,
  placeLng: row.place_lng ?? null,
  sealedUntil: row.sealed_until || null,
  style: row.style || null,
  milestone: row.milestone || null,
  adopted: !!row.source_moment_id,
  tags: (row.moment_tags || []).map((t) => ({
    label: t.label,
    handle: t.handle,
    userId: t.tagged_user_id,
    confirmed: !!t.confirmed,
  })),
  topics: [], // private topic tags — searchable, never displayed
  createdAt: row.created_at,
});

// Attach each moment's private topic tags in one query.
const attachTopics = async (moments) => {
  const ids = moments.map((m) => m.id);
  if (!ids.length) return moments;
  const { data } = await supabase.from('moment_topics').select('moment_id, topic').in('moment_id', ids);
  const byMoment = new Map();
  for (const r of data || []) {
    if (!byMoment.has(r.moment_id)) byMoment.set(r.moment_id, []);
    byMoment.get(r.moment_id).push(r.topic);
  }
  return moments.map((m) => ({ ...m, topics: byMoment.get(m.id) || [] }));
};

const insertTopics = async (momentId, ownerId, topics) => {
  const clean = [...new Set((topics || []).map((t) => (t || '').trim()).filter(Boolean))];
  if (!clean.length) return;
  await supabase.from('moment_topics').insert(clean.map((topic) => ({ moment_id: momentId, owner_id: ownerId, topic })));
};

// Chronological: year, then month, then day, then created_at.
const byChrono = (a, b) =>
  a.year - b.year ||
  (a.month || 13) - (b.month || 13) ||
  (a.day || 32) - (b.day || 32) ||
  String(a.createdAt || '').localeCompare(String(b.createdAt || ''));

// ---- Auth ------------------------------------------------------------------
const HANDLE_RE = /^[a-z0-9_]{3,15}$/;

const rowToSelfUser = (profile, email) => ({
  ...profileToUser(profile),
  email: email || '',
  phone: profile.phone || '',
  addressLine1: profile.address_line1 || '',
  city: profile.city || '',
  state: profile.state || '',
  zipCode: profile.zip_code || '',
  createdAt: profile.created_at,
});

export const getSessionUser = async () => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
  if (error || !data) return null;
  if (data.banned) {
    await supabase.auth.signOut();
    return null;
  }
  return hydrateUser(rowToSelfUser(data, authUser.email));
};

export const logIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    if ((error?.message || '').toLowerCase().includes('not confirmed')) {
      const e = new Error('Confirm your email first — check your inbox for our link.');
      e.code = 'email-not-confirmed';
      throw e;
    }
    throw new Error('Invalid email or password.');
  }
  let { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!profile) throw new Error('Could not load your profile.');
  if (profile.banned) {
    await supabase.auth.signOut();
    throw new Error('This account has been suspended.');
  }
  return hydrateUser(rowToSelfUser(profile, data.user.email));
};

export const signUp = async ({ name, email, handle, password, accountType = 'personal' }) => {
  const emailNorm = email.trim().toLowerCase();
  const handleNorm = handle.trim().toLowerCase().replace(/^@/, '');
  if (!HANDLE_RE.test(handleNorm)) {
    throw new Error('Handles are 3–15 characters: lowercase letters, numbers, underscores.');
  }
  const { data: existingHandle } = await supabase.from('profiles').select('id').eq('handle', handleNorm).limit(1);
  if (existingHandle?.length > 0) throw new Error(`@${handleNorm} is taken — try another handle.`);

  const { data, error } = await supabase.auth.signUp({ email: emailNorm, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign up failed.');
  if ((data.user.identities?.length ?? 0) === 0) {
    throw new Error('That email already has an account — try logging in instead.');
  }
  if (!data.session) {
    // Email confirmation is on: no session yet, so we can't write the profile
    // row (RLS needs a signed-in user). Stash and finish on first login.
    localStorage.setItem(
      'ev_pending_signup',
      JSON.stringify({ email: emailNorm, name: name.trim(), handle: handleNorm, accountType })
    );
    return { needsConfirmation: true, email: emailNorm };
  }
  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    name: name.trim(),
    handle: handleNorm,
    account_type: accountType,
  });
  if (profileError) {
    await supabase.auth.signOut();
    throw new Error('Could not create your profile.');
  }
  return hydrateUser(rowToSelfUser({ id: data.user.id, name: name.trim(), handle: handleNorm, account_type: accountType }, emailNorm));
};

// Finish a confirmed-email signup: create the profile row on first login.
export const ensureProfileRow = async () => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
  if (existing) return hydrateUser(rowToSelfUser(existing, authUser.email));

  let stash = null;
  try {
    stash = JSON.parse(localStorage.getItem('ev_pending_signup') || 'null');
  } catch {}
  if (stash && stash.email !== authUser.email) stash = null;
  const base =
    stash?.handle ||
    (authUser.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 12).padEnd(3, '0') ||
    'member';
  const tryInsert = (handle) =>
    supabase
      .from('profiles')
      .insert({ id: authUser.id, name: stash?.name || '', handle, account_type: stash?.accountType || 'personal' })
      .select()
      .single();
  let { data: row, error } = await tryInsert(base);
  if (error) ({ data: row } = await tryInsert(`${base.slice(0, 11)}${Math.floor(100 + Math.random() * 900)}`));
  if (row) localStorage.removeItem('ev_pending_signup');
  return row ? hydrateUser(rowToSelfUser(row, authUser.email)) : null;
};

export const resendConfirmation = async (email) => {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
  return !error;
};

export const logOut = async () => {
  await supabase.auth.signOut();
};

// ---- Profiles --------------------------------------------------------------
export const fetchUserById = async (id) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return data ? hydrateUser(profileToUser(data)) : null;
};

export const fetchUserByHandle = async (handle) => {
  const h = handle.trim().toLowerCase().replace(/^@/, '');
  const { data } = await supabase.from('profiles').select('*').eq('handle', h).maybeSingle();
  return data ? hydrateUser(profileToUser(data)) : null;
};

export const updateProfile = async (userId, patch) => {
  const next = { ...patch };
  if ('avatarFile' in patch && patch.avatarFile) {
    const url = await uploadOnePhoto(userId, patch.avatarFile);
    if (url) {
      next.avatarUri = url;
      next.avatarPhotos = [url];
    }
    delete next.avatarFile;
  }
  // avatarPhotos may mix already-uploaded URLs and freshly-picked File objects.
  if ('avatarPhotos' in patch && patch.avatarPhotos) {
    next.avatarPhotos = await uploadPhotos(userId, patch.avatarPhotos);
    next.avatarUri = next.avatarPhotos[0] || null;
  }
  const dbPatch = {};
  const map = {
    name: 'name',
    avatarUri: 'avatar_url',
    avatarPhotos: 'avatar_photos',
    avatarRotate: 'avatar_rotate',
    wheelColors: 'wheel_colors',
    birthYear: 'birth_year',
    birthMonth: 'birth_month',
    birthDay: 'birth_day',
    hometown: 'hometown',
    bio: 'bio',
    epitaph: 'epitaph',
    favoriteColor: 'favorite_color',
    favoriteNumber: 'favorite_number',
    journeyBg: 'journey_bg',
    journeyPhotoShape: 'journey_photo_shape',
    tagPermission: 'tag_permission',
    phone: 'phone',
    addressLine1: 'address_line1',
    city: 'city',
    state: 'state',
    zipCode: 'zip_code',
    keeperId: 'keeper_id',
    links: 'links',
  };
  for (const [k, col] of Object.entries(map)) if (k in next) dbPatch[col] = next[k];
  if (Object.keys(dbPatch).length) {
    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', userId);
    if (error) throw new Error('Could not save your profile.');
  }
  return next;
};

// ---- Moments ---------------------------------------------------------------
const MOMENTS_PAGE = 150;

export const getMomentsOf = async (userId) => {
  const out = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('moments_feed') // masks sealed capsules server-side
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * MOMENTS_PAGE, (page + 1) * MOMENTS_PAGE - 1);
    if (error) break;
    out.push(...(data || []).map(momentFromRow));
    if ((data?.length || 0) < MOMENTS_PAGE) break;
  }
  return hydrateMoments(await attachTopics(out.sort(byChrono)));
};

export const getMomentById = async (id) => {
  const { data, error } = await supabase.from('moments_feed').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return (await hydrateMoments(await attachTopics([momentFromRow(data)])))[0];
};

// The distinct topics this user has used, for add-moment suggestions.
export const getMyTopics = async (userId) => {
  const { data } = await supabase.from('moment_topics').select('topic').eq('owner_id', userId);
  return [...new Set((data || []).map((r) => r.topic))].sort((a, b) => a.localeCompare(b));
};

// Every moment across ALL journeys whose topic matches (via moments_feed, so
// sealed capsules stay masked). Returns moments carrying ownerId.
export const searchMomentsByTopic = async (query, blocked = new Set()) => {
  const q = (query || '').trim();
  if (!q) return [];
  const { data: hits } = await supabase.from('moment_topics').select('moment_id').ilike('topic', `%${q}%`).limit(200);
  const ids = [...new Set((hits || []).map((h) => h.moment_id))];
  if (!ids.length) return [];
  const { data: rows } = await supabase.from('moments_feed').select('*').in('id', ids).limit(60);
  const moments = (rows || []).map(momentFromRow).filter((m) => !blocked.has(m.ownerId));
  return hydrateMoments(await attachTopics(moments));
};

const normalizeTag = (t) =>
  typeof t === 'string'
    ? { label: t, handle: null, userId: null, confirmed: false }
    : { label: t.label, handle: t.handle || null, userId: t.userId || null, confirmed: !!t.confirmed };

const insertTags = async (momentId, tags) => {
  if (!tags.length) return;
  await supabase.from('moment_tags').insert(
    tags.map((t) => ({
      moment_id: momentId,
      tagged_user_id: t.userId || null,
      label: t.label,
      handle: t.handle || null,
      confirmed: !!t.confirmed,
    }))
  );
};

// A user's saved custom companions (named people with no account), so the same
// name is reused consistently across moments.
export const getSavedCompanions = async (userId) => {
  const { data } = await supabase
    .from('saved_companions')
    .select('id, name')
    .eq('owner_id', userId)
    .order('name');
  return data || [];
};

// Remember custom companion names (skips ones already saved, case-insensitive).
export const addSavedCompanions = async (userId, names) => {
  const clean = [...new Set((names || []).map((n) => (n || '').trim()).filter(Boolean))];
  if (!clean.length) return;
  const { data: existing } = await supabase.from('saved_companions').select('name').eq('owner_id', userId);
  const have = new Set((existing || []).map((r) => r.name.toLowerCase()));
  const toAdd = clean.filter((n) => !have.has(n.toLowerCase()));
  if (toAdd.length) await supabase.from('saved_companions').insert(toAdd.map((name) => ({ owner_id: userId, name })));
};

// A user's saved places (canonical US cities and custom labels), reused so the
// same place is picked identically every time.
export const getSavedPlaces = async (userId) => {
  const { data } = await supabase
    .from('saved_places')
    .select('id, kind, label, city, region, country, lat, lng')
    .eq('owner_id', userId)
    .order('label');
  return data || [];
};

export const addSavedPlace = async (userId, p) => {
  const label = (p?.label || '').trim();
  if (!label) return;
  const { data: existing } = await supabase
    .from('saved_places').select('id').eq('owner_id', userId).ilike('label', label).maybeSingle();
  if (existing) return;
  await supabase.from('saved_places').insert({
    owner_id: userId, kind: p.kind || 'custom', label,
    city: p.city || null, region: p.region || null, country: p.country || null,
    lat: p.lat ?? null, lng: p.lng ?? null,
  });
};

// Resolve free-text tags: an "@handle" that matches a real member links to them.
const resolveTags = async (rawTags) => {
  const tags = (rawTags || []).map(normalizeTag).filter((t) => (t.label || '').trim());
  const handles = tags.map((t) => (t.label.startsWith('@') ? t.label.slice(1).toLowerCase() : null)).filter(Boolean);
  if (handles.length) {
    const { data } = await supabase.from('profiles').select('id, handle, name').in('handle', handles);
    const byHandle = new Map((data || []).map((p) => [p.handle, p]));
    return tags.map((t) => {
      if (t.label.startsWith('@')) {
        const p = byHandle.get(t.label.slice(1).toLowerCase());
        if (p) return { label: p.name || t.label, handle: p.handle, userId: p.id, confirmed: false };
      }
      return t;
    });
  }
  return tags;
};

const notifyNewTags = async (self, tags, prevTags, moment) => {
  const prevIds = new Set((prevTags || []).map((t) => t.userId).filter(Boolean));
  for (const t of tags) {
    if (t.userId && t.userId !== self.id && !prevIds.has(t.userId)) {
      await pushNotification(self, t.userId, {
        type: 'tag',
        memoryId: moment.id,
        memoryTitle: moment.title || 'a moment',
        year: moment.year,
      });
    }
  }
};

export const addMemory = async (self, memory) => {
  const tags = await resolveTags(memory.tags);
  const photos = await uploadPhotos(self.id, memory.photos || []);
  const month = memory.month >= 1 && memory.month <= 12 ? memory.month : null;
  const day = month && memory.day >= 1 && memory.day <= 31 ? memory.day : null;
  const { data: row, error } = await supabase
    .from('moments')
    .insert({
      user_id: self.id,
      year: memory.year,
      month,
      day,
      location: (memory.location || '').trim(),
      title: memory.title || '',
      caption: memory.caption || '',
      story: memory.story || '',
      photos,
      place_city: memory.place?.city || null,
      place_region: memory.place?.region || null,
      place_country: memory.place?.country || null,
      place_lat: memory.place?.lat ?? null,
      place_lng: memory.place?.lng ?? null,
      sealed_until: memory.sealedUntil || null,
      milestone: memory.milestone || null,
    })
    .select()
    .single();
  if (error || !row) throw new Error('Could not save the moment.');
  await insertTags(row.id, tags);
  await insertTopics(row.id, self.id, memory.topics);
  await notifyNewTags(self, tags, [], { id: row.id, title: row.title, year: row.year });
  return row;
};

export const updateMemory = async (self, id, patch, prevTags) => {
  const cols = {};
  if ('year' in patch) cols.year = patch.year;
  if ('month' in patch) cols.month = patch.month >= 1 && patch.month <= 12 ? patch.month : null;
  if ('day' in patch) cols.day = patch.day >= 1 && patch.day <= 31 ? patch.day : null;
  if ('location' in patch) cols.location = (patch.location || '').trim();
  if ('title' in patch) cols.title = patch.title || '';
  if ('caption' in patch) cols.caption = patch.caption || '';
  if ('story' in patch) cols.story = patch.story || '';
  if ('photos' in patch) cols.photos = await uploadPhotos(self.id, patch.photos || []);
  if ('place' in patch) {
    cols.place_city = patch.place?.city || null;
    cols.place_region = patch.place?.region || null;
    cols.place_country = patch.place?.country || null;
    cols.place_lat = patch.place?.lat ?? null;
    cols.place_lng = patch.place?.lng ?? null;
  }
  if ('sealedUntil' in patch) cols.sealed_until = patch.sealedUntil || null;
  if ('milestone' in patch) cols.milestone = patch.milestone || null;
  if (Object.keys(cols).length) {
    const { error } = await supabase.from('moments').update(cols).eq('id', id);
    if (error) throw new Error('Could not update the moment.');
  }
  if ('topics' in patch) {
    await supabase.from('moment_topics').delete().eq('moment_id', id);
    await insertTopics(id, self.id, patch.topics);
  }
  if (patch.tags) {
    const prevByUser = {};
    for (const t of prevTags || []) if (t.userId) prevByUser[t.userId] = t;
    const tags = (await resolveTags(patch.tags)).map((t) =>
      t.userId && prevByUser[t.userId]?.confirmed ? { ...t, confirmed: true } : t
    );
    await supabase.from('moment_tags').delete().eq('moment_id', id);
    await insertTags(id, tags);
    await notifyNewTags(self, tags, prevTags || [], {
      id,
      title: 'title' in cols ? cols.title : patch.title,
      year: 'year' in cols ? cols.year : patch.year,
    });
  }
};

export const deleteMemory = async (id) => {
  await supabase.from('moments').delete().eq('id', id);
};

// ---- Circle ----------------------------------------------------------------
export const fetchCircleOf = async (userId) => {
  const { data } = await supabase.from('circle').select('a,b').or(`a.eq.${userId},b.eq.${userId}`);
  return data || [];
};

export const fetchCircleCountOf = async (userId) => {
  const { count } = await supabase
    .from('circle')
    .select('id', { count: 'exact', head: true })
    .or(`a.eq.${userId},b.eq.${userId}`);
  return count || 0;
};

export const addToCircle = async (self, otherId) => {
  const { error } = await supabase.from('circle').insert({ a: self.id, b: otherId });
  if (error) throw new Error('Could not add to your Circle.');
  await pushNotification(self, otherId, { type: 'circle' });
};

export const removeFromCircle = async (selfId, otherId) => {
  await supabase
    .from('circle')
    .delete()
    .or(`and(a.eq.${selfId},b.eq.${otherId}),and(a.eq.${otherId},b.eq.${selfId})`);
};

// ---- Directory / search / trending ----------------------------------------
export const searchOthers = async (selfId, query) => {
  const q = (query || '').trim().replace(/^@/, '');
  let req = supabase.from('profiles').select('*').neq('id', selfId).limit(30);
  if (q) req = req.or(`name.ilike.%${q}%,handle.ilike.%${q}%`);
  else req = req.order('created_at', { ascending: false });
  const { data } = await req;
  const mapped = (data || []).map(profileToUser).filter((u) => u.profileComplete);
  return hydrateUsers(mapped);
};

export const getTrendingProfiles = async (hoursBack = 6, limitN = 20) => {
  const { data, error } = await supabase.rpc('get_trending_profiles', { hours_back: hoursBack, limit_n: limitN });
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    avatarUri: row.avatar_url,
    viewCount: row.view_count,
  }));
};

export const recordProfileView = async (selfId, viewedId) => {
  if (!selfId || !viewedId || viewedId === selfId) return;
  try {
    await supabase.from('profile_views').insert({ viewer_id: selfId, viewed_id: viewedId });
  } catch {}
};

// ---- Moment detail: comments + contributions ------------------------------
export const getComments = async (momentId) => {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(name, handle)')
    .eq('moment_id', momentId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.profiles?.name || 'Someone',
    handle: r.profiles?.handle || '',
    text: r.text,
    pinned: r.pinned,
    createdAt: r.created_at,
  }));
};

export const addComment = async (self, momentId, text) => {
  if (!text.trim()) return;
  const { error } = await supabase.from('comments').insert({ moment_id: momentId, user_id: self.id, text: text.trim() });
  if (error) throw new Error('Could not post your comment.');
  const { data: moment } = await supabase.from('moments').select('user_id, title, year').eq('id', momentId).single();
  if (moment && moment.user_id !== self.id) {
    await pushNotification(self, moment.user_id, {
      type: 'comment',
      memoryId: momentId,
      memoryTitle: moment.title || 'a moment',
      year: moment.year,
      body: text.trim().slice(0, 140),
    });
  }
};

export const deleteComment = async (commentId) => {
  await supabase.from('comments').delete().eq('id', commentId);
};

export const getContributions = async (momentId) => {
  const { data, error } = await supabase
    .from('moment_contributions')
    .select('*, profiles(name, handle)')
    .eq('moment_id', momentId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return Promise.all(
    (data || []).map(async (r) => ({
      id: r.id,
      contributorId: r.contributor_id,
      name: r.profiles?.name || 'Someone',
      handle: r.profiles?.handle || '',
      photos: await signStoredUrls('photos', r.photos || []),
      note: r.note || '',
      audioUrl: await signStoredUrl('audio', r.audio_url || null),
      createdAt: r.created_at,
    }))
  );
};

// ---- Notifications ---------------------------------------------------------
const notifFromRow = (r) => ({
  id: r.id,
  type: r.type,
  fromId: r.from_id,
  fromName: r.from_name,
  fromHandle: r.from_handle,
  memoryId: r.moment_id,
  memoryTitle: r.moment_title,
  year: r.year,
  body: r.body,
  read: r.read,
  createdAt: r.created_at,
});

export const fetchNotificationsOf = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  const notes = (data || []).map(notifFromRow);
  // The row denormalizes the sender's name/handle but not their photo, so pull
  // avatars for the senders in one query and attach them (signed for display).
  const ids = [...new Set(notes.map((n) => n.fromId).filter(Boolean))];
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
    const byId = new Map();
    await Promise.all(
      (profs || []).map(async (p) => byId.set(p.id, await signStoredUrl('photos', p.avatar_url)))
    );
    notes.forEach((n) => { n.fromAvatarUri = byId.get(n.fromId) || null; });
  }
  return notes;
};

export const markNotificationsRead = async (userId) => {
  await supabase.from('notifications').update({ read: true }).eq('recipient_id', userId).eq('read', false);
};

export const unreadCount = async (userId) => {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  return count || 0;
};

// Write a notification row for another member (best-effort push via edge fn).
export const pushNotification = async (self, toUserId, notif) => {
  if (!toUserId || toUserId === self.id) return;
  await supabase.from('notifications').insert({
    recipient_id: toUserId,
    type: notif.type,
    from_id: self.id,
    from_name: self.name,
    from_handle: self.handle,
    moment_id: notif.memoryId ?? null,
    moment_title: notif.memoryTitle ?? null,
    year: notif.year ?? null,
    body: notif.body ?? null,
  });
};

// ---- Keeper (mutual handshake) ---------------------------------------------
// Naming a Keeper only SENDS a request; keeper_id is set server-side once the
// named person accepts (confirm_keeper_request).
export const requestKeeper = async (self, keeperId) => {
  const { data: open } = await supabase.from('keeper_requests').select('id').eq('subject_id', self.id).eq('status', 'pending');
  for (const r of open || []) await supabase.rpc('cancel_keeper_request', { req_id: r.id });
  const { error } = await supabase.from('keeper_requests').insert({ subject_id: self.id, keeper_id: keeperId });
  if (error) throw new Error('Could not send the request.');
  await pushNotification(self, keeperId, { type: 'keeper_request', body: `${self.name} asked you to be their Keeper.` });
};

export const getKeeperRequests = async (userId) => {
  const { data } = await supabase.from('keeper_requests').select('*').eq('status', 'pending');
  const rows = data || [];
  const who = async (id) => { const u = await fetchUserById(id); return u ? { name: u.name, handle: u.handle } : {}; };
  const incoming = [];
  for (const r of rows.filter((x) => x.keeper_id === userId)) incoming.push({ id: r.id, subjectId: r.subject_id, ...(await who(r.subject_id)) });
  const out = rows.find((x) => x.subject_id === userId);
  const outgoing = out ? { id: out.id, keeperId: out.keeper_id, ...(await who(out.keeper_id)) } : null;
  return { incoming, outgoing };
};

export const confirmKeeperRequest = async (self, reqId, subjectId) => {
  const { error } = await supabase.rpc('confirm_keeper_request', { req_id: reqId });
  if (error) throw new Error(error.message || 'Could not confirm.');
  await pushNotification(self, subjectId, { type: 'keeper_confirmed', body: `${self.name} accepted — they are now your Keeper.` });
};

export const declineKeeperRequest = async (self, reqId, subjectId) => {
  const { error } = await supabase.rpc('decline_keeper_request', { req_id: reqId });
  if (error) throw new Error(error.message || 'Could not decline.');
  await pushNotification(self, subjectId, { type: 'keeper_declined', body: `${self.name} declined being your Keeper.` });
};

export const cancelKeeperRequest = async (reqId) => {
  await supabase.rpc('cancel_keeper_request', { req_id: reqId });
};

export const removeKeeper = async (self) => {
  const { data: open } = await supabase.from('keeper_requests').select('id').eq('subject_id', self.id).eq('status', 'pending');
  for (const r of open || []) await supabase.rpc('cancel_keeper_request', { req_id: r.id });
  await updateProfile(self.id, { keeperId: null });
};

// ---- Safety: blocks + reports --------------------------------------------
export const fetchBlockedIds = async (userId) => {
  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  const ids = new Set();
  for (const b of data || []) ids.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
  return ids;
};

export const blockUser = async (self, otherId) => {
  const { error } = await supabase.from('blocks').insert({ blocker_id: self.id, blocked_id: otherId });
  if (error) throw new Error('Could not block this person.');
};

export const unblockUser = async (selfId, otherId) => {
  await supabase.from('blocks').delete().eq('blocker_id', selfId).eq('blocked_id', otherId);
};

export const reportContent = async (self, { reportedUserId = null, momentId = null, commentId = null, reason, details = '' }) => {
  const { error } = await supabase.from('reports').insert({
    reporter_id: self.id,
    reported_user_id: reportedUserId,
    moment_id: momentId,
    comment_id: commentId,
    reason,
    details: details || '',
  });
  if (error) throw new Error('Could not send your report.');
};

// ---- Account + password ---------------------------------------------------
export const sendPasswordReset = async (email, redirectTo) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) throw new Error(error.message);
};

export const changeEmail = async (newEmail) => {
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() });
  if (error) throw new Error(error.message);
};

export const updatePassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
};

export const deleteAccount = async (feedback) => {
  // Record why (no PII) before the account is gone — best-effort.
  if (feedback && (feedback.category || feedback.text)) {
    try {
      await supabase.from('deletion_feedback').insert({
        reason_category: feedback.category || null,
        reason_text: (feedback.text || '').trim() || null,
        account_type: feedback.accountType || null,
      });
    } catch (e) { /* never block the deletion the user asked for */ }
  }
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw new Error('Could not delete your account. Please try again.');
  await supabase.auth.signOut();
};

// ---- Photo import staging (pending_imports) --------------------------------
// A shelf of uploaded photos that sit in the app so you can build moments in
// bulk without re-uploading each time. Mirrors the app's pending-imports flow.
const pendingFromRow = async (r) => ({
  id: r.id,
  storagePath: r.storage_path,
  url: await signedUrlFor('photos', r.storage_path),
  takenAt: r.taken_at,
});

export const getPendingImports = async (userId) => {
  const { data, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false, nullsFirst: false });
  if (error) return [];
  return Promise.all((data || []).map(pendingFromRow));
};

// files: [{ file, takenAt }] — takenAt is epoch ms (from EXIF or lastModified).
export const addPendingImports = async (userId, files, onProgress) => {
  let saved = 0, done = 0;
  const failed = [];
  for (const { file, takenAt } of files) {
    let path = null;
    try {
      const isVideo = isVideoFile(file);
      const body = isVideo ? file : await compressImage(file);
      const ext = isVideo ? (file.name?.split('.').pop() || 'mp4') : 'jpg';
      path = `${userId}/pending/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, body, { contentType: isVideo ? file.type : 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from('pending_imports').insert({
        user_id: userId,
        storage_path: path,
        taken_at: takenAt ? new Date(takenAt).toISOString() : null,
      });
      if (error) throw error;
      saved++;
    } catch (e) {
      if (path) { try { await supabase.storage.from('photos').remove([path]); } catch {} }
      failed.push(e?.message || 'Upload error');
    } finally {
      done++;
      try { onProgress?.(done, files.length); } catch {}
    }
  }
  return { saved, failed };
};

// Discard a shelf photo entirely (removes the file + the row).
export const deletePendingImport = async (id, storagePath) => {
  if (storagePath) await supabase.storage.from('photos').remove([storagePath]);
  await supabase.from('pending_imports').delete().eq('id', id);
};

// Empty the shelf (rows + files).
export const clearPendingImports = async (userId) => {
  const { data } = await supabase.from('pending_imports').select('id, storage_path').eq('user_id', userId);
  const paths = (data || []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) { try { await supabase.storage.from('photos').remove(paths); } catch {} }
  await supabase.from('pending_imports').delete().eq('user_id', userId);
};

// Take shelf items OUT of the shelf because a moment now owns the files.
// Deletes ONLY the rows — the files stay, because the moment points at them.
export const consumePendingImports = async (ids) => {
  if (!ids?.length) return;
  await supabase.from('pending_imports').delete().in('id', ids);
};

// ---- Send / receive photos (photo_shares) ---------------------------------
export const sendPhotos = async (self, toUserId, files, note = '') => {
  if (!toUserId || !files?.length) return 0;
  const urls = (await uploadPhotos(self.id, files)).filter((u) => /^https?:\/\//i.test(u));
  if (!urls.length) return 0;
  const rows = urls.map((photo_url) => ({ from_user_id: self.id, to_user_id: toUserId, kind: 'send', photo_url, note: note.trim() }));
  const { error } = await supabase.from('photo_shares').insert(rows);
  if (error) throw new Error('Could not send the photos.');
  await pushNotification(self, toUserId, { type: 'photo_send', body: note.trim() || `sent you ${rows.length} photo${rows.length === 1 ? '' : 's'}` });
  return rows.length;
};

export const requestPhotos = async (self, toUserId, note = '') => {
  const { error } = await supabase.from('photo_shares').insert({ from_user_id: self.id, to_user_id: toUserId, kind: 'request', note: note.trim() });
  if (error) throw new Error('Could not send the request.');
  await pushNotification(self, toUserId, { type: 'photo_request', body: note.trim() });
};

export const getPhotoInbox = async (userId) => {
  const { data, error } = await supabase
    .from('photo_shares')
    .select('*, photo_share_replies(*, profiles(name, handle))')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) return [];
  return Promise.all((data || []).map(async (row) => ({
    id: row.id, kind: row.kind, note: row.note, status: row.status, createdAt: row.created_at,
    fromUserId: row.from_user_id, toUserId: row.to_user_id,
    direction: row.to_user_id === userId ? 'incoming' : 'outgoing',
    photoUrl: await signStoredUrl('photos', row.photo_url),
    replies: (row.photo_share_replies || [])
      .map((r) => ({ id: r.id, senderId: r.sender_id, text: r.text, createdAt: r.created_at, name: r.profiles?.name || 'Someone', handle: r.profiles?.handle || '' }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
  })));
};

export const markShareSaved = async (id) => { await supabase.from('photo_shares').update({ status: 'saved' }).eq('id', id); };

export const addShareReply = async (self, share, text) => {
  if (!text.trim()) return;
  const { error } = await supabase.from('photo_share_replies').insert({ share_id: share.id, sender_id: self.id, text: text.trim() });
  if (error) throw new Error('Could not send your reply.');
  const otherId = share.fromUserId === self.id ? share.toUserId : share.fromUserId;
  await pushNotification(self, otherId, { type: 'photo_reply', body: text.trim().slice(0, 140) });
};

// ---- Orders (merch) --------------------------------------------------------
// No payment processor yet — orders land as 'awaiting_payment' (the DB default)
// with a clean shape for Stripe checkout to slot in later.
export const placeOrder = async (self, o) => {
  const { data, error } = await supabase.from('orders').insert({
    user_id: self.id,
    product_key: o.productKey,
    product_name: o.productName,
    unit_price_cents: o.unitPriceCents,
    scope: o.scope,
    placement: o.placement || null,
    moment_ids: o.momentIds || [],
    moment_count: o.momentCount || 0,
    photo_count: o.photoCount || 0,
    shipping_name: (o.shippingName || '').trim(),
    shipping_address_line1: (o.shippingAddressLine1 || '').trim(),
    shipping_city: (o.shippingCity || '').trim(),
    shipping_state: (o.shippingState || '').trim(),
    shipping_zip: (o.shippingZip || '').trim(),
    shipping_phone: (o.shippingPhone || '').trim(),
  }).select().single();
  if (error) throw new Error('Could not place your order.');
  return data;
};

export const getMyOrders = async (userId) => {
  const { data } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data || [];
};

// ---- World spotlight + Circle feed ----------------------------------------
// One random journey + moment for everyone, on a synchronized server clock
// (get_journey_spotlight). Skips anyone you've blocked.
export const getJourneySpotlight = async (blocked = new Set()) => {
  const { data, error } = await supabase.rpc('get_journey_spotlight');
  if (error) return null;
  const row = data?.[0];
  if (!row || blocked.has(row.profile_id)) return null;
  return {
    profileId: row.profile_id,
    name: row.name,
    handle: row.handle,
    avatarUri: await signStoredUrl('photos', row.avatar_url),
    momentId: row.moment_id,
    year: row.year,
    month: row.month,
    day: row.day,
    photoUrl: await signStoredUrl('photos', row.photo_url),
  };
};

// The newest moments posted by a set of users — the Inner Circle feed. Sealed
// capsules stay masked (moments_feed). Ordered by when they were posted.
export const getRecentMomentsOf = async (userIds, limit = 24) => {
  if (!userIds?.length) return [];
  const { data, error } = await supabase
    .from('moments_feed')
    .select('*')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return hydrateMoments((data || []).map(momentFromRow));
};

// ---- Witnessing, adopting, contributions, comment tools -------------------
// Confirm your own tag on someone's moment → it becomes "witnessed".
export const confirmTag = async (self, momentId, ownerId) => {
  const { error } = await supabase.from('moment_tags').update({ confirmed: true }).eq('moment_id', momentId).eq('tagged_user_id', self.id);
  if (error) throw new Error('Could not confirm.');
  if (ownerId && ownerId !== self.id) await pushNotification(self, ownerId, { type: 'confirm', memoryId: momentId });
};

export const getAdoptedCopyId = async (userId, sourceMomentId) => {
  if (!userId || !sourceMomentId) return null;
  const { data } = await supabase.from('moments').select('id').eq('user_id', userId).eq('source_moment_id', sourceMomentId).maybeSingle();
  return data?.id || null;
};

// Copy a moment you were part of onto your own journey (photos and all).
export const adoptMoment = async (self, momentId) => {
  const { data: src, error } = await supabase.from('moments_feed').select('*').eq('id', momentId).single();
  if (error || !src) throw new Error("That moment isn't available.");
  if (src.sealed_until && src.sealed_until > new Date().toISOString().slice(0, 10)) throw new Error('That moment is a sealed time capsule — you can add it once it opens.');
  const { data: row, error: insErr } = await supabase.from('moments').insert({
    user_id: self.id, year: src.year, month: src.month, day: src.day,
    location: src.location || '', title: src.title || '', caption: src.caption || '', story: src.story || '',
    photos: src.photos || [], source_moment_id: src.id,
    place_city: src.place_city || null, place_region: src.place_region || null, place_country: src.place_country || null,
    place_lat: src.place_lat ?? null, place_lng: src.place_lng ?? null,
  }).select().maybeSingle();
  if (insErr && insErr.code !== '23505') throw new Error('Could not add to your Journey.');
  return row;
};

// A confirmed companion adds their own side (note + photos) to a moment.
export const addOrUpdateContribution = async (self, momentId, { photos, note }) => {
  const uploaded = await uploadPhotos(self.id, photos || []);
  const { data: existing } = await supabase.from('moment_contributions').select('id').eq('moment_id', momentId).eq('contributor_id', self.id).maybeSingle();
  const { error } = await supabase.from('moment_contributions').upsert(
    { moment_id: momentId, contributor_id: self.id, photos: uploaded, note: (note || '').trim(), updated_at: new Date().toISOString() },
    { onConflict: 'moment_id,contributor_id' }
  );
  if (error) throw new Error("Couldn't save your addition.");
  if (!existing) {
    const { data: moment } = await supabase.from('moments').select('user_id, title, year').eq('id', momentId).single();
    if (moment && moment.user_id !== self.id) await pushNotification(self, moment.user_id, { type: 'contribution', memoryId: momentId, memoryTitle: moment.title || 'a moment', year: moment.year });
  }
};

export const togglePinComment = async (id, pinned) => { await supabase.from('comments').update({ pinned }).eq('id', id); };

export { byChrono };
