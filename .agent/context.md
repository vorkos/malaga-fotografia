# malaga-fotografia — Agent Context

> Maintained by Claude. Keep accurate; remove stale info as the project evolves.
> Last updated: 2026-07-11

---

## Project Identity

- **Name:** Málaga Fotografía
- **Owner/Photographer:** Kostiantyn V. (Kostya) — boss138@gmail.com · photo@vorkos.dev
- **Speciality:** Portrait / boudoir / fine-art nude — Málaga, Spain
- **Branding:** "KV" monogram · Cormorant Garamond + Archivo fonts
- **Palette:** near-black `#0c0b0a` · warm off-white `#ece6dc` · gold `#d8a24a`
- **Contact:** WhatsApp +34 674 474 418 · Instagram @ph.kostiantyn.v

---

## Constraints

- **Cloudflare free tier only** — no paid features: no Image Resizing, no Durable Objects, no premium analytics. Every solution must stay within the free plan.

---

## Hosting & Deploy

- **Platform:** Cloudflare Workers with Static Assets binding
- **R2 bucket:** `photos` (binding: `PHOTOS`) — 108 photos served at `/gallery/*`
- **Live URLs:** `https://malaga-fotografia.com/` · `https://www.malaga-fotografia.com/` · `https://photography.boss138.workers.dev/`
- **Repo:** github.com/vorkos/malaga-fotografia (branch: `main`)
- **Deploy:** Cloudflare Builds auto-deploys on every push to `main` — no manual step needed
- **DNS:** domain moved from Squarespace to Cloudflare nameservers (2026-06-18)

---

## Repo File Layout

```
repo root/
├── index.html            ← main portfolio (~542 KB, self-contained bundle)
├── prices.html           ← pricing page (same bundle format)
├── _worker.js            ← Cloudflare Worker: proxies /gallery/* from R2, delegates rest to ASSETS
├── wrangler.jsonc        ← Worker config: name=photography, assets=., r2=photos
├── .assetsignore         ← excludes _worker.js, wrangler.jsonc, src/, temp scripts from static assets
├── src/
│   ├── Portfolio.dc.html ← designer source (dc-runtime template, NOT auto-built into index.html)
│   ├── Prices.dc.html
│   ├── support.js        ← dc-runtime (React + template engine, minified)
│   └── image-slot.js     ← <image-slot> web component (only used in source, not in deployed bundle)
└── .agent/
    └── context.md        ← this file
```

**index.html is NOT rebuilt from src/ automatically.** src/ is designer reference only. Edit index.html directly using Python byte-level scripts (see "Editing index.html" below).

---

## index.html Encoding — CRITICAL

The bundle is a single-line JSON-encoded HTML string. Rules:

| Thing | Encoding in bytes |
|-------|------------------|
| Attribute quotes | `\"` = bytes `0x5C 0x22` (backslash + double-quote) |
| Forward slashes in styles/URLs | Plain `/` = byte `0x2F` (NOT escaped) |
| Closing HTML tags (e.g. `</body>`) | `/` in template JSON, but outer HTML `</body>` is plain bytes |
| aspect-ratio in style | `aspect-ratio:4 / 5` (plain slash, spaces around it) |

**Python pattern for gallery img tag (V = vertical, H = horizontal):**
```python
VS = b'display:block;width:100%;aspect-ratio:4 / 5;object-fit:cover;border-radius:2px;'
HS = b'display:block;width:100%;aspect-ratio:3 / 2;object-fit:cover;border-radius:2px;'

def tag(filename, style):
    return b'<img src=\x5c"/gallery/' + filename.encode() + b'\x5c" alt=\x5c"\x5c" style=\x5c"' + style + b'\x5c">'

# Replace old slot with new file:
b = b.replace(tag('OLD.jpg', VS), tag('NEW.jpg', VS), 1)
```

When moving photos between slots, always replace the **source slot first** (to remove the duplicate), then replace the destination slot.

---

## Gallery Architecture

- **3 pages** in a horizontal carousel (scroll-snap, auto-advances every 4.5 s, pauses on hover)
- Each page: **4 vertical (4:5 aspect) + 2 horizontal (3:2 aspect)** = 18 slots total
- Photos served from R2 via Worker at `/gallery/FILENAME`

### Slot IDs

| Page | Vertical slots (4:5) | Horizontal slots (3:2) |
|------|----------------------|------------------------|
| 1 | g1, g2, g3, g4 | g5, g6 |
| 2 | p2g1, p2g2, p2g3, p2g4 | p2g5, p2g6 |
| 3 | p3g1, p3g2, p3g3, p3g4 | p3g5, p3g6 |

Also: **about-portrait** in the About section — currently `Z52_0569.jpg` (style: `width:100%;height:clamp(380px,46vw,520px);object-fit:cover;border-radius:3px;`)

### Static fallback (as of last update)

| Slot | Photo | Orient |
|------|-------|--------|
| g1 | Z52_0537-small.jpg | V |
| g2 | Z52_1162-small.jpg | V |
| g3 | Z52_1652-small.jpg | V |
| g4 | Z52_0924.jpg | V |
| g5 | Z52_0461.jpg | H |
| g6 | Z52_0383.jpg | H |
| p2g1 | Z52_1917-small.jpg | V |
| p2g2 | Z52_1820-small.jpg | V |
| p2g3 | Z52_2867-small.jpg | V |
| p2g4 | Z52_9094-small.jpg | V |
| p2g5 | Z52_0431.jpg | H |
| p2g6 | Z52_0446.jpg | H |
| p3g1 | Z52_9385-small.jpg | V |
| p3g2 | Z52_7655-small.jpg | V |
| p3g3 | Z52_6186_DxO-small.jpg | V |
| p3g4 | Z52_0501.jpg | V |
| p3g5 | Z52_9221-small.jpg | H |
| p3g6 | Z52_2638-small.jpg | H |

### Random rotation (JS, injected before `</body>`)

On every page load, a script in index.html shuffles V and H pools independently and reassigns all 18 gallery img src attributes. It finds imgs inside `#pf-track` by checking inline style for `4 / 5` (vertical) or `3 / 2` (horizontal).

**V pool (28 photos — 3★ heroes + unrated):**
Z52_0501, Z52_0537-small, Z52_1336, Z52_1162-small, Z52_1652-small, Z52_0924, Z52_1917-small, Z52_1820-small, Z52_2867-small, Z52_6186_DxO-small, Z52_9385-small, Z52_9094-small, Z52_7655-small, Z52_2868-small, Z52_9756-small, Z52_9652-small, Z52_9480-small, Z52_9287-small, Z52_7827-small, Z52_7622-small, Z52_7547-small_2, Z52_0012-small, Z52_0515, Z52_0561, Z52_0631, Z52_9457-small, Z52_9087-small, Z52_8190_1-small

**H pool (11 photos — 3★ heroes + 2★ greats):**
Z52_0461, Z52_0431, Z52_0383, Z52_9221-small, Z52_2638-small, Z52_9471-small_1, Z52_0441, Z52_0446, Z52_2637-small, Z52_2615-small

---

## Photo Rating (completed 2026-06-18)

Two-pass rating of all 108 R2 photos:
- **Pass 1:** 1–5★ — photos with 3★+ survived (62 photos)
- **Pass 2:** re-ranked 1–3★ within survivors
  - **3★ HERO** = must-have (used in gallery + random pool)
  - **2★ GREAT** = good (H-orientation greats in pool, V-greats excluded for quality)
  - **1★ OK** = acceptable (not used)

Rating tool was `rate.html` (served locally via `python3 -m http.server 8099`). Orientation data in `orientations.txt`.

---

## _worker.js

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/gallery/')) {
      const key = url.pathname.slice(1);
      const obj = await env.PHOTOS.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers });
    }
    return env.ASSETS.fetch(request);
  },
};
```

---

## Pages

- `/` → index.html — main portfolio (bilingual ES/EN, default: ES)
- `/prices.html` → pricing page — sessions from €250. Contains 1 R2 photo: Z52_0501.jpg
- `/blog/` → the **Journal** index; `/blog/<slug>/` → per-shoot posts. See "Journal / Blog" below.

---

## Journal / Blog (added 2026-07-11)

Per-shoot photo essays ("photos + short story about the model & shoot") to build
trust and attract TFP models. Lives at **`malaga-fotografia.com/blog`**.

- **Static, pre-rendered.** `blog/build.mjs` renders `blog/content/*.md`
  (Markdown + YAML front-matter) → `blog/<slug>/index.html` + `blog/index.html`.
  Deps: `markdown-it`, `gray-matter` (in package.json). Run `npm run build:blog`.
  Generated HTML is **committed** — no CI build step; Cloudflare just serves it.
- **Why static, not the dc-runtime bundle:** the main index.html is
  client-rendered (ships unresolved `{{ }}`; scrapers see no real content). Blog
  pages are real HTML with proper `<title>` / description / Open Graph per post,
  so shared links unfurl with a photo + headline and Google can index them.
  The blog is the site's SEO/discovery surface.
- **Post shape:** hero + story + swipeable photo carousel + model pull-quote +
  credits (model name linked to their IG, with consent) + "Apply for a TFP
  shoot" CTA. Brand-styled (dark/gold, Cormorant Garamond + Archivo).
- **Photos: organised on R2 by model name** → key `gallery/<model>/<file>`,
  served by the existing `_worker.js` /gallery/ route (no worker change). The
  108 portfolio photos stay flat at `gallery/Z52_*.jpg` (wired to the homepage
  rotation — do NOT move them).
- **Authoring tool (local):** `npm run pick -- "<shoot-folder>" [--model <name>]`
  → `blog/tools/pick.mjs` serves a local picker page: click/order photos, fill
  the story, Publish → uploads picks to `gallery/<model>/`, writes the post
  `.md`, runs the build. It never pushes — review the local preview, then
  `git push origin main` to deploy. (`blog/tools`, `blog/content`, `blog/build.mjs`
  are in `.assetsignore` so they're not served.)
- **Live posts:** `barbara` (13-06-26 session, 8 single-person frames,
  Barbara Cia @cia_model_official).
- **Pending:** a 2nd Barbara post from the 25-06-26 shoot (folder has a 2nd
  red-haired model + two-person frames mixed in — needs Kostya to say which
  frames are Barbara before publishing).
- **Homepage tie-ins (2026-07-11):** added a `Journal`/`Diario` nav item
  (`/blog/`) to the ES+EN `t.nav` arrays, and real `<title>` + description +
  Open Graph tags to the outer `<head>` (og:image = SFW `Z52_0461.jpg`) so the
  homepage itself unfurls properly. The *inner* JS-rendered head still has an
  empty title (Google renders empty) — a deeper fix would need the dc-runtime
  source; not done.

**Barbara's source exports:** `C:\Users\vorkos\Pictures\exported\IG\26_06\`
(`13-06-26` = 15 imgs, ranges Z52_0300–0780; `25-06-26` = 26 imgs, Z52_3641–5690,
mixed models).

---

## Site Sections (index.html)

| Section | Anchor | Notes |
|---------|--------|-------|
| Hero | `#top` | Eyebrow + H1 + subtext + 2 CTAs + scroll indicator |
| About | `#about` | Intro text + portrait (Z52_0569.jpg, fixed) |
| Portfolio/Gallery | `#portfolio` | 3-page carousel, 18 slots, random rotation on load |
| TFP | `#tfp` | "Busco musas" — 2-column card |
| Process | `#process` | 4 numbered steps |
| Contact | `#contact` | WhatsApp + Instagram + Email |
| Footer | — | Name · tagline · @handle |

---

## Key Decisions Log

| Date | Decision |
|------|----------|
| 2026-06-18 | Switched from Cloudflare Pages to Cloudflare Workers + R2 for photo serving |
| 2026-06-18 | DNS moved from Squarespace to Cloudflare; www CNAME removed and rebound to Worker |
| 2026-06-18 | Cloudflare Builds CI/CD: auto-deploys on push to main (no GitHub Actions needed) |
| 2026-06-18 | Replaced all 19 image-slot placeholders with real R2 img tags via Python byte scripts |
| 2026-06-18 | Rated all 108 R2 photos (2-pass system); implemented random gallery rotation on load |
| 2026-06-18 | prices.html URL fixed: old link was `/price`, now `/prices.html` |
| 2026-07-11 | Added a static Journal/blog at `/blog` (Markdown→pre-rendered HTML, committed). Photos organised on R2 by model name (`gallery/<model>/`). Homepage got OG/SEO meta + a Journal nav link. First post: Barbara. Local authoring tool `npm run pick`. |
