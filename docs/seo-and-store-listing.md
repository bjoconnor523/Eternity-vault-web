# Eternity Vault — SEO & App Store Listing Notes

_Last updated: 2026-08-06_

Goal: when people search "Eternity Vault" (or ask an AI) with the intent of
finding **the app**, they land on eternity-vault.com.

---

## The realistic picture

- The bare phrase **"Eternity Vault"** is dominated by a **Star Wars: The Old
  Republic** raid (10+ years of wikis/guides). Not worth chasing, and those
  searchers don't want the app anyway.
- Near-name rivals in the same space: eternalvault.app, Vaultd, Memory Vault,
  Lifevault.
- **What we're actually going for:** branded + intent searches ("Eternity
  Vault app / memories / legacy") and being the entity AI assistants cite for
  the app — NOT beating the game for the generic word.
- As of 2026-08-06 the site was **not yet in Google's index** (only ~10 days
  old). The single biggest unlock is Google Search Console (below).

---

## Done in code (2026-08-06) — already in the site files

All invisible to visitors (page `<head>` only):

- **JSON-LD structured data** on `index.html` — Organization + WebSite +
  MobileApplication. Tells Google & AI what Eternity Vault is (company, app,
  logo, slogan, description).
- **`rel=canonical`** on all 4 pages (index, support, privacy, terms).
- **Richer meta description** naming it a life-story app coming to iOS/Android.
- **sitemap.xml** now has `lastmod` + `priority`.

_Remember to upload these changed files to GitHub to deploy them._

---

## Manual steps — only Brandon can do these

### 1. Google Search Console (the real unlock — do this first)
1. Go to **search.google.com/search-console**
2. Add property → **Domain** → type `eternity-vault.com`
3. It gives a **TXT record** → add it at **GoDaddy** (same place as the site
   DNS) → come back → **Verify**
4. **Sitemaps** → submit `sitemap.xml`
5. **URL Inspection** box → paste `https://eternity-vault.com/` → **Request
   Indexing**

### 2. Bing Webmaster Tools (feeds Bing + some AI assistants)
1. Go to **bing.com/webmasters**
2. Sign in → **Import from Google Search Console** → authorize → pick
   `eternity-vault.com`. (One click; no re-verification needed.)

### 3. Later — backlinks (the durable fix for the name collision)
A few real links pointing at eternity-vault.com beat any on-page tweak:
- App Store + Play Store listing URL fields (below)
- Any social profiles (bio link → the site)

---

## App Store / Play Store listing copy

### The URL fields (paste into BOTH stores — these are the backlink)
```
Marketing URL:  https://eternity-vault.com
Support URL:    https://eternity-vault.com/support.html
Privacy URL:    https://eternity-vault.com/privacy.html
```
> This is the store **listing** name (safe to use now — matches the site + the
> LLC). It's separate from the technical `app.json` app-name/bundle rename,
> which stays on hold until the trademark clears.

### Apple App Store
**App Name** (≤30 chars):
```
Eternity Vault: Life Story
```
**Subtitle** (≤30 chars):
```
Your life, kept forever
```
**Keywords** (≤100 chars, commas, no spaces, don't repeat name/subtitle words):
```
memories,timeline,legacy,journal,family history,memory keeper,biography,heritage,keepsake
```
**Promotional Text** (≤170 chars):
```
A life, recorded in your own words, pictures and voice — witnessed by the people who were there, and kept forever. Coming soon.
```

### Google Play
**Title** (≤30 chars):
```
Eternity Vault: Life Story
```
**Short description** (≤80 chars):
```
Record a whole life in words, pictures and voice — witnessed, and kept forever.
```

### Full description (works for both stores)
```
Eternity Vault is a place to record a whole life — not a feed to scroll, but a lasting record you build in your own words, pictures and voice.

Somewhere between a photo album and a memoir, your Journey lays out a life as a timeline of moments: the year, the story, the people who were there.

• In your own words — photos, captions, and voice notes, told the way you'd tell them.
• Witnessed, not fabricated — the people who were there confirm the moments they shared with you.
• Kept forever — no likes, no metrics, no pressure. Built to last a lifetime, and beyond it.
• Yours to keep — download your whole Vault anytime. Your story is never held hostage.

Record the moments that made a life. Proof you were here.
```
