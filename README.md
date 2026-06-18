# Málaga Fotografía — Portfolio site

Photographer portfolio (Kostiantyn V. — portrait / boudoir / fine-art nude, Málaga).
Bilingual ES/EN. Single-page site: hero, about, gallery (3-page auto-scroll carousel),
TFP collaboration, process, contact.

## Files

```
index.html      ← the deployable site (self-contained, ~530KB). Deploy THIS.
src/            ← editable source (optional, for re-generating index.html)
  Portfolio.dc.html   the page source
  support.js          runtime it depends on
  image-slot.js       drag-and-drop image placeholder component
```

For Cloudflare Pages you only need **`index.html` at the repo root**.
`src/` is just kept so you (or Claude Code) can see/modify the original markup.

## The ONE thing left to do: real images

The gallery currently uses drag-and-drop **placeholder slots** (`<image-slot>`),
which only store images in the visitor's own browser via localStorage — so a
published site shows empty "Vertical / Horizontal" boxes.

To make it real, replace each `<image-slot …>` with a normal `<img>`:

```html
<!-- before -->
<div style="border:1px solid rgba(236,230,220,0.16);background:#161310;padding:6px;border-radius:4px;">
  <image-slot id="g1" placeholder="Vertical" shape="rounded" radius="2" fit="cover"
              style="display:block;width:100%;aspect-ratio:4 / 5;height:auto;"></image-slot>
</div>

<!-- after -->
<div style="border:1px solid rgba(236,230,220,0.16);background:#161310;padding:6px;border-radius:4px;">
  <img src="images/g1.jpg" alt=""
       style="display:block;width:100%;aspect-ratio:4 / 5;object-fit:cover;border-radius:2px;">
</div>
```

Gallery slot IDs:
- Page 1: g1–g4 (vertical, 4:5), g5–g6 (horizontal, 3:2)
- Page 2: p2g1–p2g4 (vertical), p2g5–p2g6 (horizontal)
- Page 3: p3g1–p3g4 (vertical), p3g5–p3g6 (horizontal)

Put the photos in an `images/` folder next to `index.html` and reference them by
relative path (`images/g1.jpg`, …).

## Deploy to Cloudflare Pages

1. Put `index.html` (+ `images/`) at the repo root.
2. Cloudflare → Workers & Pages → your Pages project (connected to the GitHub repo).
   - Framework preset: **None**
   - Build command: **(empty)**
   - Build output directory: **/**
3. Push to the repo → Pages auto-builds → live at `*.pages.dev`.

## Design notes

- Fonts: Archivo (UI/body) + Cormorant Garamond (display/serif).
- Palette: near-black #0c0b0a, warm off-white #ece6dc, gold accent #d8a24a.
- Gallery: 3 pages, auto-advances every 4.5s, pauses on hover, clickable page dots.
- Language toggle (ES/EN) top-right.
