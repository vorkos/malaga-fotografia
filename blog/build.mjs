/**
 * blog/build.mjs — static-site generator for the Málaga Fotografía Journal.
 *
 * Reads one Markdown file per shoot from blog/content/*.md (files whose name
 * starts with "_" are treated as templates and skipped), and renders each into
 * a clean, pre-rendered static HTML page at blog/<slug>/index.html plus a
 * chronological index at blog/index.html.
 *
 * Why static + pre-rendered: the main site is client-rendered (its HTML ships
 * unresolved {{ }} templates), which is weak for search/social. Each Journal
 * page here is real HTML with a proper <title>, meta description and Open
 * Graph tags, so a post shared in a DM or on Instagram shows a real image and
 * headline, and Google can index the words. No database, no runtime — the
 * generated HTML is committed and served straight from Cloudflare static
 * assets.
 *
 * Run: `npm run build:blog`  (Node 18+, deps: markdown-it, gray-matter)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, 'content');
const OUT_DIR = __dirname; // blog/

const SITE = 'https://malaga-fotografia.com';
const BRAND = 'Málaga Fotografía';
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// --- helpers ---------------------------------------------------------------
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Resolve an image reference to a site path.
 *  - "http…"      → used as-is (external / absolute)
 *  - "/foo"       → used as-is (already root-relative)
 *  - "bar.jpg"    → "/gallery/bar.jpg" (served from R2 by _worker.js)   */
function imgUrl(p = '') {
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/')) return p;
  return `/gallery/${p}`;
}
/** Absolute URL, required for Open Graph image tags. */
function absUrl(p = '') {
  const u = imgUrl(p);
  return /^https?:\/\//i.test(u) ? u : SITE + u;
}

function fmtDate(d, lang = 'en') {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d ?? '');
  return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const HEAD_FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">`;

// --- per-post page ---------------------------------------------------------
function renderPost(post) {
  const { data, bodyHtml, slug } = post;
  const lang = data.lang === 'es' ? 'es' : 'en';
  const title = data.title ?? 'Untitled';
  const summary = data.summary ?? '';
  const url = `${SITE}/blog/${slug}/`;
  const allImages = Array.isArray(data.images) ? data.images : [];
  const cover = data.cover ?? allImages[0];
  const coverUrl = cover ? imgUrl(cover) : '';
  // Cover shows as a standalone hero above the story; the carousel holds the
  // rest of the shoot (cover excluded so it isn't shown twice).
  const images = allImages.filter((src) => imgUrl(src) !== coverUrl);

  const hero = cover
    ? `<figure class="post__hero"><img src="${esc(coverUrl)}" alt="${esc(title)}" loading="eager" decoding="async"></figure>`
    : '';

  const slides = images
    .map(
      (src, i) =>
        `<figure class="carousel__slide"><img src="${esc(imgUrl(src))}" alt="${esc(
          `${title} — ${i + 1}`,
        )}" loading="lazy" decoding="async"></figure>`,
    )
    .join('\n          ');

  const dots = images
    .map((_, i) => `<button class="carousel__dot" data-i="${i}" aria-label="Go to photo ${i + 1}"></button>`)
    .join('');

  const carousel = images.length
    ? `
      <div class="carousel" data-carousel aria-roledescription="carousel" aria-label="Photos from this shoot">
        <div class="carousel__track" data-track>
          ${slides}
        </div>
        ${
          images.length > 1
            ? `<button class="carousel__nav carousel__nav--prev" data-prev aria-label="Previous photo">‹</button>
        <button class="carousel__nav carousel__nav--next" data-next aria-label="Next photo">›</button>
        <div class="carousel__dots" data-dots>${dots}</div>`
            : ''
        }
      </div>`
    : '';

  const quote = data.quote
    ? `<blockquote class="post__quote"><p>${esc(data.quote)}</p>${
        data.quote_by ? `<cite>— ${esc(data.quote_by)}</cite>` : ''
      }</blockquote>`
    : '';

  const creditPairs = data.credits && typeof data.credits === 'object' ? Object.entries(data.credits) : [];
  const modelLine = data.model
    ? `<span>${lang === 'es' ? 'Modelo' : 'Model'}: ${
        data.model_link ? `<a href="${esc(data.model_link)}" rel="nofollow noopener" target="_blank">${esc(data.model)}</a>` : esc(data.model)
      }</span>`
    : '';
  const credits = creditPairs.length || modelLine
    ? `<div class="post__credits">${modelLine}${creditPairs
        .map(([k, v]) => `<span>${esc(k)}: ${esc(v)}</span>`)
        .join('')}</div>`
    : '';

  const ctaText =
    lang === 'es'
      ? '¿Quieres colaborar en algo así?'
      : 'Want to collaborate on something like this?';
  const ctaBtn = lang === 'es' ? 'Escríbeme para un TFP →' : 'Apply for a TFP shoot →';

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — ${BRAND}</title>
  <meta name="description" content="${esc(summary)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(summary)}">
  ${cover ? `<meta property="og:image" content="${esc(absUrl(cover))}">` : ''}
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary_large_image">
  ${HEAD_FONTS}
  <link rel="stylesheet" href="/blog/assets/blog.css">
</head>
<body>
  <header class="site-head">
    <a class="site-head__brand" href="/">${BRAND}</a>
    <nav class="site-head__nav"><a href="/blog/">${lang === 'es' ? 'Diario' : 'Journal'}</a><a href="/apply/">${lang === 'es' ? 'Colaborar' : 'Collaborate'}</a></nav>
  </header>

  <main class="post">
    <article>
      <p class="post__eyebrow">${esc(data.location ?? '')}${data.location && data.date ? ' · ' : ''}${esc(fmtDate(data.date, lang))}</p>
      <h1 class="post__title">${esc(title)}</h1>
      ${summary ? `<p class="post__dek">${esc(summary)}</p>` : ''}
      ${hero}
      ${carousel}
      <div class="post__body">
        ${bodyHtml}
      </div>
      ${quote}
      ${credits}
      <section class="post__cta">
        <p>${ctaText}</p>
        <a class="btn" href="/apply/">${ctaBtn}</a>
      </section>
    </article>
    <p class="post__back"><a href="/blog/">← ${lang === 'es' ? 'Todas las historias' : 'All stories'}</a></p>
  </main>

  <footer class="site-foot">
    <p>${BRAND} · Málaga, España</p>
  </footer>
  <script src="/blog/assets/carousel.js" defer></script>
</body>
</html>`;
}

// --- index page ------------------------------------------------------------
function renderIndex(posts) {
  const cards = posts
    .map((p) => {
      const cover = p.data.cover ?? p.data.images?.[0];
      return `      <a class="card" href="/blog/${p.slug}/">
        ${cover ? `<div class="card__img"><img src="${esc(imgUrl(cover))}" alt="" loading="lazy" decoding="async"></div>` : ''}
        <div class="card__meta">
          <p class="card__eyebrow">${esc(p.data.location ?? '')}${p.data.location && p.data.date ? ' · ' : ''}${esc(fmtDate(p.data.date))}</p>
          <h2 class="card__title">${esc(p.data.title ?? 'Untitled')}</h2>
          ${p.data.summary ? `<p class="card__dek">${esc(p.data.summary)}</p>` : ''}
        </div>
      </a>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Journal — ${BRAND}</title>
  <meta name="description" content="Stories from the shoots — portraits, boudoir and fine-art nude collaborations in Málaga.">
  <link rel="canonical" href="${SITE}/blog/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:title" content="Journal — ${BRAND}">
  <meta property="og:description" content="Stories from the shoots — portraits, boudoir and fine-art nude collaborations in Málaga.">
  ${posts[0] && (posts[0].data.cover ?? posts[0].data.images?.[0]) ? `<meta property="og:image" content="${esc(absUrl(posts[0].data.cover ?? posts[0].data.images[0]))}">` : ''}
  ${HEAD_FONTS}
  <link rel="stylesheet" href="/blog/assets/blog.css">
</head>
<body>
  <header class="site-head">
    <a class="site-head__brand" href="/">${BRAND}</a>
    <nav class="site-head__nav"><a href="/blog/" aria-current="page">Journal</a><a href="/apply/">Collaborate</a></nav>
  </header>

  <main class="journal">
    <header class="journal__head">
      <h1>The Journal</h1>
      <p>Stories from the shoots — the people, the places, and what we made together.</p>
    </header>
    ${posts.length ? `<div class="journal__grid">\n${cards}\n    </div>` : '<p class="journal__empty">First stories coming soon.</p>'}
  </main>

  <footer class="site-foot">
    <p>${BRAND} · Málaga, España</p>
  </footer>
</body>
</html>`;
}

// --- build -----------------------------------------------------------------
function build() {
  if (!existsSync(CONTENT_DIR)) {
    console.error(`No content dir at ${CONTENT_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const posts = [];

  for (const file of files) {
    const raw = readFileSync(join(CONTENT_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    if (data.published === false) continue;
    const slug = data.slug ?? file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    posts.push({ file, slug, data, bodyHtml: md.render(content) });
  }

  // newest first
  posts.sort((a, b) => new Date(b.data.date ?? 0) - new Date(a.data.date ?? 0));

  for (const post of posts) {
    const dir = join(OUT_DIR, post.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderPost(post), 'utf8');
    console.log(`  ✓ /blog/${post.slug}/`);
  }
  writeFileSync(join(OUT_DIR, 'index.html'), renderIndex(posts), 'utf8');
  console.log(`  ✓ /blog/  (${posts.length} post${posts.length === 1 ? '' : 's'})`);
}

build();
