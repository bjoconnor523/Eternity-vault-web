// Photo timestamp helpers for the web add-moment picker — the counterpart to
// the mobile app's src/lib/photoDates.js. Reads a photo's real capture date
// (embedded EXIF, then a date in the filename) and formats it. Deliberately
// returns null when neither is present, so the moment date is left blank rather
// than guessed from an unreliable source like the file's last-modified time.

// A date encoded in a filename, e.g. IMG_20190804_153012.jpg or 2019-08-04.jpg.
// Validated so a random run of digits can't masquerade as a date.
const filenameYmd = (name) => {
  if (!name) return null;
  const m = String(name).match(/(19|20)(\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (!m) return null;
  const year = parseInt(m[1] + m[2], 10);
  const month = parseInt(m[3], 10);
  const day = parseInt(m[4], 10);
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1900 || year > maxYear) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
};

// Real capture date of a picked File → { year, month, day } or null.
// EXIF first (via exifr, loaded on demand), then the filename. No last-modified
// fallback: "no timestamp" stays blank.
export const captureYmdFromFile = async (file) => {
  try {
    const mod = await import('https://esm.sh/exifr@7.1.3');
    const exifr = mod.default || mod;
    const meta = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null);
    const d = meta?.DateTimeOriginal || meta?.CreateDate;
    if (d) {
      const dt = new Date(d);
      if (!isNaN(dt.getTime())) {
        return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
      }
    }
  } catch {}
  return filenameYmd(file?.name || '');
};

// Normalize a stored `takenAt` (ISO string or epoch ms) → { year, month, day }
// or null. Used for photos pulled in from the import shelf.
export const ymdFromTakenAt = (takenAt) => {
  if (!takenAt) return null;
  const dt = new Date(takenAt);
  if (isNaN(dt.getTime())) return null;
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
};

// The earliest date among a list of { year, month, day } (nulls ignored), or
// null. Picks a multi-photo moment's date from its oldest photo.
export const earliestYmd = (list) => {
  const key = (d) => d.year * 10000 + (d.month || 0) * 100 + (d.day || 0);
  return (list || [])
    .filter(Boolean)
    .reduce((best, d) => (best === null || key(d) < key(best) ? d : best), null);
};

// A compact label, e.g. "Aug 4, 2019" (no day → "Aug 2019", year only → "2019").
// '' for a missing date so callers can render nothing.
const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatPhotoDate = (ymd) => {
  if (!ymd || !ymd.year) return '';
  const mon = ymd.month >= 1 && ymd.month <= 12 ? MONTHS_ABBR[ymd.month - 1] : '';
  if (!mon) return String(ymd.year);
  if (!ymd.day) return `${mon} ${ymd.year}`;
  return `${mon} ${ymd.day}, ${ymd.year}`;
};
