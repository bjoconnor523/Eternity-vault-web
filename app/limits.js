// Single source of truth for content caps (web).
//
// Mirrors the mobile app's src/lib/limits.js and the Supabase migration
// `content_caps_and_count_limits`. Keep all three in lockstep. The database is
// the real, un-bypassable guard; these values drive friendly maxlength limits
// in the forms and graceful guards in api.js so a member never sees a raw
// Postgres error.

// Per-field character caps.
export const LIMITS = {
  // moment fields
  title: 240,
  caption: 600,
  story: 15000,
  location: 240,
  tag: 150,
  // profile fields
  bio: 10000,
  epitaph: 200,
  name: 80,
  hometown: 120,
  currentLocation: 120,
  // other text
  comment: 2000,
  contribution: 10000,
  message: 4000,
  savedCompanion: 150,
  savedPlace: 200,
};

// Per-parent count caps (enforced in the DB by triggers).
export const COUNTS = {
  photosPerMoment: 12,
  contributionPhotos: 6,
  tagsPerMoment: 30,
  momentsPerJourney: 2500,
  savedCompanions: 200,
  savedPlaces: 500,
  links: 5,
  avatarPhotos: 5,
};

export const COUNT_MESSAGES = {
  momentsPerJourney: `This journey has reached the maximum of ${COUNTS.momentsPerJourney.toLocaleString()} moments.`,
  tagsPerMoment: `A moment can have at most ${COUNTS.tagsPerMoment} companions.`,
  savedCompanions: `You've reached the maximum of ${COUNTS.savedCompanions} saved companions.`,
  savedPlaces: `You've reached the maximum of ${COUNTS.savedPlaces} saved places.`,
};

// Throw a friendly error if `value` exceeds the cap for `field`. Returns the
// (trimmed-of-nothing) value so it can be used inline.
export const enforceLen = (field, value) => {
  const v = value == null ? '' : String(value);
  if (v.length > LIMITS[field]) {
    throw new Error(`That ${field} is too long (max ${LIMITS[field].toLocaleString()} characters).`);
  }
  return value;
};
