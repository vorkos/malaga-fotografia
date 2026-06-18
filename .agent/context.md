# malaga-fotografia — Agent Context

> Maintained by Claude. Keep accurate; remove stale info as the project evolves.
> Last updated: 2026-06-18

---

## Project Identity

- **Name:** Málaga Fotografía
- **Owner/Photographer:** Kostiantyn V. (Kostya) — boss138@gmail.com
- **Speciality:** Portrait / boudoir / fine-art nude — Málaga, Spain
- **Branding:** "KV" monogram · Cormorant Garamond + Archivo fonts
- **Palette:** near-black `#0c0b0a` · warm off-white `#ece6dc` · gold `#d8a24a`

---

## Hosting & Repo

- **Platform:** Cloudflare Pages (connected to GitHub repo)
- **Live URL:** https://photography.boss138.workers.dev/
- **Repo:** github.com/vorkos/malaga-fotografia
- **Branches:** `main` (default), `feature/initial-page`
- **Deploy:** push to `main` → Cloudflare auto-builds. No build command. Output dir: `/`.

---

## Site Structure (single-page, bilingual ES/EN)

| Section | Anchor | Notes |
|---------|--------|-------|
| Hero | `#top` | Eyebrow + H1 + subtext + 2 CTAs + scroll indicator |
| About | `#about` | Intro text + portrait image slot |
| Portfolio/Gallery | `#portfolio` | 3-page carousel, auto-advances 4.5s, pauses on hover |
| TFP | `#tfp` | "Busco musas" — 2-column card (what I look for / what you get) |
| Process | `#process` | 4 numbered steps |
| Contact | `#contact` | WhatsApp + Instagram + Email buttons |
| Footer | — | Name · tagline · @handle |

---

## Contact Details (hardcoded in HTML)

- **WhatsApp:** +34 674 474 418
- **Instagram:** @ph.kostiantyn.v
- **Email:** photo@vorkos.dev
- **Pricing page:** malaga-fotografia.com/price · sessions from €250

---

## File Layout

```
repo root/
├── index.html            ← deployable site (~530 KB, self-contained bundle)
├── README.md             ← handover notes from original designer
├── src/
│   ├── Portfolio.dc.html ← editable source (dc-runtime template format)
│   ├── support.js        ← dc-runtime (React + template engine, minified)
│   └── image-slot.js     ← <image-slot> web component
└── .agent/
    └── context.md        ← this file
```

**Edit source in `src/Portfolio.dc.html`, not in `index.html` directly.**
`index.html` is a bundler output — it re-packages `src/` + assets into one self-contained file.

---

## Tech Stack

- **Runtime:** `dc-runtime` — a custom React-based template engine. Uses `<x-dc>`, `<sc-for>`, `<sc-if>` custom components and `{{ expr }}` interpolation.
- **Web component:** `<image-slot>` — drag-and-drop image placeholder that persists via `localStorage`/sidecar. **Not suitable for production** — only stores images in the visitor's browser.
- **Fonts:** Google Fonts (Archivo + Cormorant Garamond), loaded via `<link>` in the bundle.

---

## #1 Outstanding Task: Replace Image Placeholders

The gallery and about section use `<image-slot>` components that only store images in the visitor's local browser — so the published site shows empty boxes.

**Fix:** replace each `<image-slot>` with a real `<img>` and put photos in an `images/` folder.

```html
<!-- BEFORE -->
<image-slot id="g1" placeholder="Vertical" shape="rounded" radius="2" fit="cover"
            style="display:block;width:100%;aspect-ratio:4 / 5;height:auto;"></image-slot>

<!-- AFTER -->
<img src="images/g1.jpg" alt=""
     style="display:block;width:100%;aspect-ratio:4 / 5;object-fit:cover;border-radius:2px;">
```

### Gallery slot IDs

| Page | Vertical (4:5) | Horizontal (3:2) |
|------|----------------|-----------------|
| 1 | g1, g2, g3, g4 | g5, g6 |
| 2 | p2g1, p2g2, p2g3, p2g4 | p2g5, p2g6 |
| 3 | p3g1, p3g2, p3g3, p3g4 | p3g5, p3g6 |

Also: `about-portrait` — used in the About section (portrait orientation, tall).

Total: **19 image slots**.

---

## Key Decisions & History

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-18 | Created `main` and `feature/initial-page` branches | Standard GitHub workflow |
| 2026-06-18 | Added source files from handover zip (`src/`) | Designer handed off editable source alongside built bundle |
| 2026-06-18 | Hosting on Cloudflare Pages (not Workers) | Static site — Pages is simpler, no Worker script needed |

---

## Open Questions

- Which photos go in which slots? (g1–g4 vertical, g5–g6 horizontal per page)
- Custom domain planned? (currently `*.workers.dev`)
- Should `index.html` be rebuilt from `src/` or edited directly? (bundler tooling not yet in repo)
