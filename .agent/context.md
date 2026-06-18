# malaga-fotografia — Agent Context

> Maintained by Claude. Keep this accurate; remove stale info as the project evolves.
> Last updated: 2026-06-18

---

## Project Identity

- **Name:** malaga-fotografia
- **Owner:** Kostiantyn Vorobio (Kostya) — boss138@gmail.com
- **Purpose:** Personal photography portfolio website
- **Branding:** Initials "KV" in gold (#d8a24a) on dark (#0c0b0a) background

---

## Hosting & Deployment

- **Platform:** Cloudflare Workers
- **Live URL:** https://weathered-hill-22e9.boss138.workers.dev/
- **Repo:** github.com/vorkos/malaga-fotografia
- **Branches:** `main` (default), `feature/initial-page`

---

## Current State (2026-06-18)

- Single `index.html` — self-contained bundled page (~530 KB)
- Bundle format: base64-encoded, gzip-compressed assets unpacked at runtime via JS
- No build system, framework, or package.json yet
- Placeholder loading screen shows "KV" monogram while assets unpack

---

## Gathered Requirements

- [ ] Photography portfolio for Málaga-based work
- [ ] Hosted on Cloudflare (Workers or Pages — TBD)
- [ ] Clean, minimal aesthetic — warm off-white background (#faf9f5), dark/gold accent

## Open Questions

- What pages/sections are needed? (gallery, about, contact?)
- Are photos already organized/selected, or does curation happen during build?
- Custom domain planned?
- Should the bundle approach be replaced with a proper build pipeline?

---

## Tech Notes

- `index.html` is a bundler output — editing it directly is not practical for ongoing dev
- Cloudflare Workers can serve static assets; Pages might be cleaner for a static site
- DecompressionStream API used — requires a modern browser (no IE support needed)

---

## Key Decisions

| Decision | Date | Rationale |
|----------|------|-----------|
| Feature branch `feature/initial-page` for initial file | 2026-06-18 | Standard PR workflow |
| `main` branch created and pushed | 2026-06-18 | GitHub default branch |
